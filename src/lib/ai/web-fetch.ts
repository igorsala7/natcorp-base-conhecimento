import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Busca o TEXTO legível de páginas públicas para as superfícies de AUTORIA da
 * IA (o Chat IA do editor puxa uma fonte para redigir um artigo). O conteúdo
 * volta como DADO — quem chama o injeta no prompt claramente delimitado, nunca
 * como instrução (regra anti-prompt-injection do projeto).
 *
 * Proteção SSRF (obrigatória — o servidor faria a requisição): só http/https,
 * o hostname é resolvido e TODOS os IPs precisam ser públicos (bloqueia
 * loopback, redes privadas, link-local e o metadata 169.254.169.254), redirects
 * são seguidos manualmente revalidando cada salto, com timeout, teto de bytes e
 * checagem de content-type (só text/html|text/plain). Risco residual conhecido:
 * DNS rebinding entre a checagem e o fetch — aceitável para uma ferramenta de
 * autoria usada por administradores.
 */

const MAX_BYTES = 1_500_000; // teto de download por página (~1,5 MB)
const MAX_TEXT = 20_000; // teto de texto entregue à IA por página
const TIMEOUT_MS = 9000;
const MAX_REDIRECTS = 3;

export type PaginaBuscada = {
  url: string;
  titulo: string | null;
  texto: string;
  /** HTML bruto (só quando pedido via `incluirHtml`) — para o importador preservar títulos. */
  html?: string;
};
export type ResultadoBusca =
  | { ok: true; pagina: PaginaBuscada }
  | { ok: false; url: string; motivo: string };

/**
 * Host permitido pela allowlist (casa o domínio e subdomínios). Uma entrada
 * "natcorp.com.br" libera "www.natcorp.com.br". Aceita "*.dominio" e ".dominio".
 * Vive aqui (junto do fetch) para as funções de segurança não puxarem o
 * cliente de banco — o que também as torna testáveis sem ambiente.
 */
export function hostPermitido(host: string, allowlist: string[]): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return allowlist.some((bruto) => {
    const d = bruto.trim().toLowerCase().replace(/^\*?\.?/, "");
    return !!d && (h === d || h.endsWith(`.${d}`));
  });
}

/** URLs http(s) achadas num texto (pontuação final aparada, deduplicadas). */
export function extrairUrls(texto: string, limite = 3): string[] {
  const achados = texto.match(/https?:\/\/[^\s<>"'`)]+/gi) ?? [];
  const limpos = achados.map((u) => u.replace(/[.,;:!?)\]}>"']+$/, ""));
  return [...new Set(limpos)].slice(0, limite);
}

/** IP em faixa privada/reservada/loopback/link-local (IPv4 e IPv6). */
function ipEhPrivado(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p as [number, number, number, number];
    if (a === 10 || a === 127 || a === 0) return true; // privado / loopback / "este host"
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 169 && b === 254) return true; // link-local + metadata cloud
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a >= 224) return true; // multicast/reservado
    return false;
  }
  if (v === 6) {
    let s = ip.toLowerCase();
    if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
    if (s === "::1" || s === "::") return true; // loopback / não especificado
    // IPv4-mapeado (::ffff:1.2.3.4) → checa o IPv4 embutido.
    const m = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return ipEhPrivado(m[1]!);
    if (s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd")) return true; // link-local / ULA
    if (s.startsWith("ff")) return true; // multicast
    return false;
  }
  return true; // não é IP reconhecível → recusa
}

/** Hostname seguro: nomes locais recusados; IPs e resoluções precisam ser públicos.
 * Exportado para o motor de captura (navegador headless) aplicar a MESMA trava. */
export async function hostEhSeguro(hostname: string): Promise<boolean> {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return false;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return false;
  }
  if (net.isIP(h)) return !ipEhPrivado(h);
  try {
    const addrs = await lookup(h, { all: true });
    if (!addrs.length) return false;
    return addrs.every((a) => !ipEhPrivado(a.address));
  } catch {
    return false;
  }
}

/** Lê o corpo até o teto de bytes (cancela o resto) e decodifica como UTF-8. */
async function lerLimitado(resp: Response): Promise<string> {
  const reader = resp.body?.getReader();
  if (!reader) return (await resp.text()).slice(0, MAX_BYTES);
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      partes.push(value);
      total += value.length;
      if (total >= MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of partes) {
    buf.set(p.subarray(0, Math.min(p.length, total - off)), off);
    off += p.length;
    if (off >= total) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ccedil: "ç", atilde: "ã", otilde: "õ", aacute: "á", eacute: "é",
  iacute: "í", oacute: "ó", uacute: "ú", acirc: "â", ecirc: "ê", ocirc: "ô",
  agrave: "à", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
};

function decodificarEntidades(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (todo, corpo: string) => {
    if (corpo[0] === "#") {
      const cp = corpo[1]?.toLowerCase() === "x" ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : todo;
    }
    return ENTIDADES[corpo.toLowerCase()] ?? todo;
  });
}

function extrairTitulo(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m ? decodificarEntidades(m[1]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
  return t ? t.slice(0, 200) : null;
}

/** HTML → texto legível: remove ruído, vira blocos por parágrafo, decodifica. */
function htmlParaTexto(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<\/?(p|div|section|article|header|footer|li|tr|h[1-6]|ul|ol|table|br)\b[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodificarEntidades(s);
  s = s
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

async function buscarUma(
  inicial: string,
  allowlist?: string[],
  incluirHtml?: boolean,
): Promise<ResultadoBusca> {
  let atual = inicial;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let u: URL;
    try {
      u = new URL(atual);
    } catch {
      return { ok: false, url: inicial, motivo: "URL inválida" };
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, url: inicial, motivo: "só http/https" };
    }
    // Trava do lado público: quando há allowlist, o host (e cada salto de
    // redirect) precisa estar nela. `undefined` = autoria (sem restrição de domínio).
    if (allowlist && !hostPermitido(u.hostname, allowlist)) {
      return { ok: false, url: inicial, motivo: "domínio fora da lista permitida" };
    }
    if (!(await hostEhSeguro(u.hostname))) {
      return { ok: false, url: inicial, motivo: "endereço bloqueado (rede interna/privada)" };
    }
    let resp: Response;
    try {
      resp = await fetch(u, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "NatcorpDocsBot/1.0 (+autoria)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      });
    } catch {
      return { ok: false, url: inicial, motivo: "não respondeu a tempo ou recusou" };
    }
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) return { ok: false, url: inicial, motivo: "redirect sem destino" };
      atual = new URL(loc, u).toString();
      continue; // revalida o próximo salto no topo do laço
    }
    if (!resp.ok) return { ok: false, url: inicial, motivo: `HTTP ${resp.status}` };
    const ct = (resp.headers.get("content-type") ?? "").toLowerCase();
    if (!/text\/html|application\/xhtml|text\/plain/.test(ct)) {
      return { ok: false, url: inicial, motivo: "conteúdo não é página de texto" };
    }
    const bruto = await lerLimitado(resp);
    const texto = (/text\/plain/.test(ct) ? bruto : htmlParaTexto(bruto)).slice(0, MAX_TEXT).trim();
    if (!texto) return { ok: false, url: inicial, motivo: "página sem texto" };
    return {
      ok: true,
      pagina: {
        url: u.toString(),
        titulo: extrairTitulo(bruto),
        texto,
        ...(incluirHtml ? { html: bruto } : {}),
      },
    };
  }
  return { ok: false, url: inicial, motivo: "redirects demais" };
}

/**
 * Busca cada URL (sequencial, para respeitar o teto de latência).
 * `opts.allowlist` (superfícies públicas) restringe os domínios; ausente = autoria.
 */
export async function buscarPaginas(
  urls: string[],
  opts?: { allowlist?: string[]; incluirHtml?: boolean },
): Promise<ResultadoBusca[]> {
  const out: ResultadoBusca[] = [];
  for (const u of urls) out.push(await buscarUma(u, opts?.allowlist, opts?.incluirHtml));
  return out;
}

/**
 * Limpa o HTML para importação: remove ruído de layout (scripts, navegação,
 * rodapé, formulários…) mantendo a estrutura de conteúdo (títulos, parágrafos,
 * listas, tabelas, imagens). Um `<base>` com o href da página é injetado para
 * as URLs relativas de imagens resolverem na extração.
 */
export function limparHtmlParaImport(html: string, baseUrl: string): string {
  const s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|template|svg|iframe|nav|footer|header|aside|form|button)\b[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<link\b[^>]*>/gi, " ")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "") // handlers inline
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  const corpo = s.match(/<body[\s\S]*<\/body>/i)?.[0] ?? s;
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${baseUrl.replace(/"/g, "%22")}"></head>${corpo}</html>`;
}
