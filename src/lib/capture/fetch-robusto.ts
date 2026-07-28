import "server-only";
import { buscarPaginas } from "@/lib/ai/web-fetch";
import { lerPaginaComNavegador } from "@/lib/capture/browser";

/**
 * Scraping ROBUSTO para superfícies de AUTORIA (Chat IA do editor, Importador):
 * tenta o fetch simples e, se o resultado vier VAZIO ou for uma página de
 * desafio anti-bot (Cloudflare "Verifying your browser…"), cai para um navegador
 * real, que passa o desafio. NÃO use no leitor público (abrir um navegador por
 * requisição pública é vetor de abuso/DoS) — lá vale só o fetch simples.
 */

export type ImagemPagina = { url: string; alt: string };

export type PaginaRobusta = {
  url: string;
  titulo: string | null;
  texto: string;
  html?: string;
  imagens: ImagemPagina[];
  viaNavegador: boolean;
};

/** Extrai `<img>` de conteúdo de um HTML (fallback do fetch simples, sem tamanhos). */
function extrairImagensDeHtml(html: string, baseUrl: string): ImagemPagina[] {
  const out: ImagemPagina[] = [];
  const vistos = new Set<string>();
  const re = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 12) {
    const bruto = m[1]!;
    if (!bruto || bruto.startsWith("data:") || /\.svg(\?|$)/i.test(bruto)) continue;
    let abs: string;
    try {
      abs = new URL(bruto, baseUrl).toString();
    } catch {
      continue;
    }
    if (vistos.has(abs)) continue;
    vistos.add(abs);
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1] ?? "";
    out.push({ url: abs, alt: alt.slice(0, 160) });
  }
  return out;
}

/** Heurística: conteúdo curto demais ou com marcas de "checando seu navegador". */
function pareceBloqueado(titulo: string | null, texto: string): boolean {
  if (texto.trim().length < 300) return true;
  const t = `${titulo ?? ""} ${texto.slice(0, 500)}`.toLowerCase();
  return /verifying your browser|checking your browser|just a moment|attention required|enable javascript|please wait a few seconds|cloudflare|verificando (o )?seu navegador/.test(
    t,
  );
}

export async function buscarPaginaRobusta(
  url: string,
  opts?: { incluirHtml?: boolean; login?: { usuario: string; senha: string } },
): Promise<{ ok: true; pagina: PaginaRobusta } | { ok: false; motivo: string }> {
  const [r] = await buscarPaginas([url], { incluirHtml: true });
  const simples = r?.ok ? r.pagina : null;
  const imgsSimples = simples?.html ? extrairImagensDeHtml(simples.html, simples.url) : [];

  // Fetch simples já trouxe conteúdo real → usa (rápido, sem browser).
  if (simples && !opts?.login && !pareceBloqueado(simples.titulo, simples.texto)) {
    return {
      ok: true,
      pagina: {
        url: simples.url, titulo: simples.titulo, texto: simples.texto,
        ...(opts?.incluirHtml ? { html: simples.html } : {}),
        imagens: imgsSimples, viaNavegador: false,
      },
    };
  }

  // Bloqueado / vazio / exige login → navegador real.
  const nav = await lerPaginaComNavegador(url, opts?.login).catch(() => null);
  if (nav && nav.texto.trim().length > (simples?.texto.trim().length ?? 0)) {
    return {
      ok: true,
      pagina: {
        url: nav.url, titulo: nav.titulo, texto: nav.texto,
        ...(opts?.incluirHtml ? { html: nav.html } : {}),
        imagens: nav.imagens, viaNavegador: true,
      },
    };
  }

  // Navegador não ajudou e o fetch simples só trouxe a página de desafio anti-bot:
  // NÃO devolve o desafio como fonte (a IA acharia que "não consegue acessar").
  if (simples && pareceBloqueado(simples.titulo, simples.texto)) {
    return { ok: false, motivo: "a página tem proteção anti-bot e o navegador não conseguiu lê-la (o servidor de desenvolvimento foi reiniciado após a última mudança? o Chromium está instalado?)" };
  }
  // Fetch simples trouxe algum conteúdo real (site sem proteção) → usa.
  if (simples && simples.texto.trim()) {
    return {
      ok: true,
      pagina: {
        url: simples.url, titulo: simples.titulo, texto: simples.texto,
        ...(opts?.incluirHtml ? { html: simples.html } : {}),
        imagens: imgsSimples, viaNavegador: false,
      },
    };
  }
  return { ok: false, motivo: r && r.ok === false ? r.motivo : "não consegui acessar a página" };
}
