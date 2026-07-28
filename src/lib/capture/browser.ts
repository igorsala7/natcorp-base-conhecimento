import "server-only";
import { chromium, type Browser, type Page } from "playwright";
import { hostEhSeguro } from "@/lib/ai/web-fetch";

/**
 * Motor de captura de telas (Playwright/Chromium) para enriquecer artigos com
 * prints educativos. Roda no WORKER (browser headless é pesado e assíncrono).
 *
 * Uma SESSÃO mantém a página aberta entre o inventário e a captura: o inventário
 * marca cada elemento com `data-cap-ref`, a IA decide o plano olhando os rótulos,
 * e a captura reencontra os elementos pela marca (sobrevive porque a página não
 * recarrega). Modo `interactive` executa ações (clicar/preencher) antes do print.
 *
 * Trava SSRF: a URL de entrada passa pela MESMA checagem de host público do
 * web-fetch — um navegador real navegando para IP interno seria SSRF.
 */

const VIEWPORT = { width: 1440, height: 900 };
const NAV_TIMEOUT = 25_000;
const MAX_ELEMENTOS = 80;

export type ElementoCapturavel = {
  ref: string; // "e1", "e2"…
  tipo: "campo" | "botao" | "imagem" | "titulo" | "secao" | "link";
  rotulo: string;
};

export type InventarioPagina = {
  url: string;
  titulo: string;
  texto: string;
  elementos: ElementoCapturavel[];
};

export type LoginInput = { usuario: string; senha: string };

export type AcaoCaptura =
  | { tipo: "clicar"; ref: string }
  | { tipo: "preencher"; ref: string; valor: string }
  | { tipo: "esperar"; ms: number };

export type PlanoCaptura = {
  /** ref de um elemento, ou "PAGINA" (página inteira) ou "VIEWPORT" (tela visível). */
  alvo: string;
  /** Destaca o elemento (spotlight na tela) em vez de recortar só nele. */
  destaque?: boolean;
  legenda?: string;
  /** Ações a executar ANTES do print (modo interativo). */
  acoes?: AcaoCaptura[];
};

export type CapturaPng = {
  alvo: string;
  legenda: string | null;
  png: Buffer;
  largura: number;
  altura: number;
};

type ElementoBruto = { ref: string; tipo: ElementoCapturavel["tipo"]; rotulo: string };

// Scripts do NAVEGADOR passados como STRING (Playwright roda verbatim): funções
// reais serializadas por bundlers (tsx/esbuild) vazam o helper `__name`, que não
// existe no browser. Sem args (a constante é embutida) e sem regex (o Node limpa).
const JS_INVENTARIO = `(() => {
  var MAX = ${MAX_ELEMENTOS}, out = [], i = 0;
  function visivel(el){ var r = el.getBoundingClientRect(); var s = getComputedStyle(el); return r.width>8 && r.height>8 && s.visibility!=='hidden' && s.display!=='none'; }
  function rotuloDe(el){
    var a = el.getAttribute('aria-label'); if(a) return a;
    if(el.id){ var l = document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if(l && l.textContent) return l.textContent; }
    var lab = el.closest('label'); if(lab && lab.textContent) return lab.textContent;
    var ph = el.getAttribute('placeholder'); if(ph) return ph;
    var alt = el.getAttribute('alt'); if(alt) return alt;
    return (el.innerText || el.textContent || '');
  }
  function add(el, tipo){
    if(i>=MAX || el.hasAttribute('data-cap-ref') || !visivel(el)) return;
    var rotulo = (rotuloDe(el) || '').trim().slice(0,160);
    if(tipo!=='imagem' && !rotulo) return;
    var ref = 'e' + (++i);
    el.setAttribute('data-cap-ref', ref);
    out.push({ ref: ref, tipo: tipo, rotulo: rotulo });
  }
  document.querySelectorAll('h1,h2,h3').forEach(function(e){ add(e,'titulo'); });
  document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(function(e){ add(e,'campo'); });
  document.querySelectorAll('button,[role=button],a.btn,input[type=submit]').forEach(function(e){ add(e,'botao'); });
  document.querySelectorAll('img,figure').forEach(function(e){ add(e,'imagem'); });
  return out;
})()`;

// Lê a mensagem de alerta/validação/erro visível mais provável (comportamento
// humano: "o que a tela respondeu?"). String — roda no navegador.
const JS_EVENTO = `(() => {
  var sels = ['[role=alert]','[aria-live=assertive]','.alert:not(.alert-secondary)','.error','.is-invalid ~ .invalid-feedback','.invalid-feedback','.toast','.Toastify__toast','.MuiAlert-message','.swal2-html-container','.ant-message-notice-content','.notyf__message','[aria-invalid="true"]'];
  var vis = function(el){ var r = el.getBoundingClientRect(); var s = getComputedStyle(el); return r.width>2 && r.height>2 && s.visibility!=='hidden' && s.display!=='none'; };
  for (var i=0;i<sels.length;i++){
    var els = document.querySelectorAll(sels[i]);
    for (var j=0;j<els.length;j++){ if(vis(els[j])){ var t=(els[j].textContent||'').replace(/\\s+/g,' ').trim(); if(t) return t; } }
  }
  return '';
})()`;

// Spotlight: escurece a tela e contorna o alvo (`ref` é interno, ex.: "e3").
function jsSpotlight(ref: string): string {
  return `(() => {
    var el = document.querySelector('[data-cap-ref="${ref}"]');
    if(!el) return false;
    el.scrollIntoView({block:'center',inline:'center'});
    var r = el.getBoundingClientRect();
    var o = document.createElement('div');
    o.id = '__cap_spot__';
    o.style.cssText = 'position:fixed;left:'+(r.left-6)+'px;top:'+(r.top-6)+'px;width:'+(r.width+12)+'px;height:'+(r.height+12)+'px;border:3px solid #C95788;border-radius:8px;box-shadow:0 0 0 9999px rgba(20,10,40,0.55);z-index:2147483647;pointer-events:none;';
    document.body.appendChild(o);
    return true;
  })()`;
}

export class SessaoCaptura {
  /** Mensagens de página (alerta/validação/erro) percebidas durante as ações. */
  readonly eventos: string[] = [];

  private constructor(
    private readonly browser: Browser,
    private readonly page: Page,
    public readonly inventario: InventarioPagina,
  ) {}

  /** Abre a página (com login opcional), inventaria os elementos e devolve a sessão. */
  static async iniciar(opts: {
    url: string;
    login?: LoginInput;
    modo?: "static" | "interactive";
  }): Promise<SessaoCaptura> {
    let u: URL;
    try {
      u = new URL(opts.url);
    } catch {
      throw new Error("URL inválida");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Só http/https");
    if (!(await hostEhSeguro(u.hostname))) throw new Error("Endereço bloqueado (rede interna/privada)");

    const browser = await chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 2,
        locale: "pt-BR",
      });
      const page = await ctx.newPage();
      await page.goto(u.toString(), { waitUntil: "load", timeout: NAV_TIMEOUT });
      await page.waitForTimeout(800);

      if (opts.login) await tentarLogin(page, opts.login);

      const brutos = (await page.evaluate(JS_INVENTARIO)) as ElementoBruto[];
      const elementos: ElementoCapturavel[] = brutos.map((e) => ({
        ref: e.ref,
        tipo: e.tipo,
        rotulo: (e.rotulo || "(imagem)").replace(/\s+/g, " ").trim().slice(0, 120),
      }));
      const titulo = (await page.title()).slice(0, 200);
      const texto = (await page.evaluate("document.body ? document.body.innerText : ''")) as string;
      const inventario: InventarioPagina = {
        url: page.url(),
        titulo,
        texto: texto.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20_000),
        elementos,
      };
      return new SessaoCaptura(browser, page, inventario);
    } catch (e) {
      await browser.close().catch(() => {});
      throw e;
    }
  }

  /** Executa o plano de capturas e devolve os PNGs. */
  async capturar(planos: PlanoCaptura[]): Promise<CapturaPng[]> {
    const out: CapturaPng[] = [];
    for (const p of planos.slice(0, 24)) {
      try {
        for (const a of p.acoes ?? []) {
          const ev = await this.executarAcao(a);
          if (ev && !this.eventos.includes(ev)) this.eventos.push(ev);
        }
        const png = await this.printar(p);
        if (png) out.push({ alvo: p.alvo, legenda: p.legenda ?? null, ...png });
      } catch {
        // Um print que falha não derruba os demais.
      }
    }
    return out;
  }

  /** Executa uma ação como um HUMANO (passa o mouse, pequenas pausas, digita
   *  caractere a caractere) e devolve qualquer mensagem de página (alerta/erro/
   *  validação) que tenha surgido — para a documentação registrar o que ocorreu. */
  private async executarAcao(a: AcaoCaptura): Promise<string | null> {
    if (a.tipo === "esperar") {
      await this.page.waitForTimeout(Math.min(a.ms, 5000));
      return null;
    }
    const loc = this.page.locator(`[data-cap-ref="${a.ref}"]`).first();
    if (!(await loc.count())) return `Não encontrei o elemento "${a.ref}" na tela.`;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.hover().catch(() => {}); // humano: leva o mouse antes de agir
    await this.page.waitForTimeout(160 + Math.floor(Math.random() * 220));
    if (a.tipo === "clicar") {
      await loc.click({ timeout: 4000 }).catch(() => {});
      await this.page.waitForTimeout(700 + Math.floor(Math.random() * 500));
    } else {
      await loc.click({ timeout: 3000 }).catch(() => {});
      await loc.fill("").catch(() => {});
      await loc.pressSequentially(a.valor, { delay: 40 + Math.floor(Math.random() * 45) }).catch(() => {});
      await this.page.waitForTimeout(250);
    }
    return await this.lerEvento();
  }

  /** Lê a mensagem de alerta/validação/erro mais provável na tela (curta). */
  private async lerEvento(): Promise<string | null> {
    const t = (await this.page.evaluate(JS_EVENTO).catch(() => "")) as string;
    return t.trim() ? t.trim().slice(0, 300) : null;
  }

  private async printar(p: PlanoCaptura): Promise<{ png: Buffer; largura: number; altura: number } | null> {
    if (p.alvo === "PAGINA") {
      const png = await this.page.screenshot({ fullPage: true, type: "png" });
      return { png, largura: VIEWPORT.width, altura: 0 };
    }
    if (p.alvo === "VIEWPORT") {
      const png = await this.page.screenshot({ type: "png" });
      return { png, largura: VIEWPORT.width, altura: VIEWPORT.height };
    }
    const loc = this.page.locator(`[data-cap-ref="${p.alvo}"]`).first();
    if (!(await loc.count())) return null;
    await loc.scrollIntoViewIfNeeded().catch(() => {});

    if (p.destaque) {
      const ok = (await this.page.evaluate(jsSpotlight(p.alvo))) as boolean;
      const png = await this.page.screenshot({ type: "png" });
      if (ok) await this.page.evaluate("var e=document.getElementById('__cap_spot__'); if(e){ e.remove(); }");
      return { png, largura: VIEWPORT.width, altura: VIEWPORT.height };
    }
    const box = await loc.boundingBox();
    const png = await loc.screenshot({ type: "png" });
    return { png, largura: Math.round(box?.width ?? 0), altura: Math.round(box?.height ?? 0) };
  }

  async fechar(): Promise<void> {
    await this.browser.close().catch(() => {});
  }
}

/**
 * Lê o TEXTO (e o HTML renderizado) de uma página com um navegador REAL — passa
 * desafios anti-bot (Cloudflare "Verifying your browser…") que o fetch simples
 * não vence. Usado como fallback do scraping de AUTORIA. Mesma trava SSRF.
 */
// Rola a página até o fim (em passos) para disparar o carregamento tardio
// (lazy-load) das imagens — teto de 3,5s para não travar.
const JS_SCROLL_LAZY = `(async () => {
  await new Promise(function(res){
    var y = 0;
    var t = setInterval(function(){
      window.scrollBy(0, 800); y += 800;
      if (y >= document.body.scrollHeight) { clearInterval(t); res(null); }
    }, 80);
    setTimeout(function(){ clearInterval(t); window.scrollTo(0, 0); res(null); }, 3500);
  });
})()`;

// Extrai as imagens de CONTEÚDO da página (URL absoluta + alt), ignorando ícones/
// spacers (< 150×100), data: URIs e SVG; maiores primeiro; teto de 12.
const JS_IMAGENS = `(() => {
  var out = [];
  document.querySelectorAll('img').forEach(function(img){
    var src = img.currentSrc || img.src || '';
    if (!src || src.indexOf('data:') === 0 || /\\.svg(\\?|$)/i.test(src)) return;
    var w = img.naturalWidth || img.width || 0, h = img.naturalHeight || img.height || 0;
    if (w < 150 || h < 100) return;
    out.push({ url: src, alt: (img.getAttribute('alt') || '').slice(0,160), area: w*h });
  });
  out.sort(function(a,b){ return b.area - a.area; });
  return out.slice(0, 12).map(function(x){ return { url: x.url, alt: x.alt }; });
})()`;

export async function lerPaginaComNavegador(
  inicial: string,
  login?: LoginInput,
): Promise<{ url: string; titulo: string; texto: string; html: string; imagens: { url: string; alt: string }[] } | null> {
  let u: URL;
  try {
    u = new URL(inicial);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!(await hostEhSeguro(u.hostname))) return null;

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "pt-BR" });
    const page = await ctx.newPage();
    await page.goto(u.toString(), { waitUntil: "load", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(1500); // deixa o desafio anti-bot resolver e redirecionar
    if (login) await tentarLogin(page, login);
    const titulo = (await page.title()).slice(0, 200);
    const texto = ((await page.evaluate("document.body ? document.body.innerText : ''")) as string)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20_000);
    const html = (await page.content()).slice(0, 2_000_000);
    // Rola a página para disparar o lazy-load das imagens (senão naturalWidth=0).
    await page.evaluate(JS_SCROLL_LAZY).catch(() => {});
    await page.waitForTimeout(400);
    const imagens = ((await page.evaluate(JS_IMAGENS)) as { url: string; alt: string }[]) ?? [];
    return { url: page.url(), titulo, texto, html, imagens };
  } catch {
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Login heurístico: preenche o campo de senha, o campo de usuário mais provável
 * e envia. Cobre formulários comuns (o próprio sistema do usuário, em geral).
 * Silencioso: se não achar o formulário, segue sem logar (a página de login vira
 * o print, e a IA avisa). NUNCA registra as credenciais.
 */
async function tentarLogin(page: Page, login: LoginInput): Promise<void> {
  const senha = page.locator('input[type="password"]').first();
  if (!(await senha.count())) return;
  await senha.fill(login.senha).catch(() => {});
  const usuario = page
    .locator('input[type="email"], input[type="text"], input[name*="user" i], input[name*="email" i], input:not([type])')
    .first();
  if (await usuario.count()) await usuario.fill(login.usuario).catch(() => {});
  const botao = page
    .locator('button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")')
    .first();
  if (await botao.count()) await botao.click({ timeout: 5000 }).catch(() => {});
  else await senha.press("Enter").catch(() => {});
  await page.waitForLoadState("load", { timeout: NAV_TIMEOUT }).catch(() => {});
  await page.waitForTimeout(1200);
}
