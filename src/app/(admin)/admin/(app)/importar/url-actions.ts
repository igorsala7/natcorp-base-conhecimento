"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { hostEhSeguro } from "@/lib/ai/web-fetch";
import { extrairPaginaWeb } from "@/lib/importer/pagina-web";
import { ingestKnowledgeFile } from "../base-conhecimento/actions";

export type PreviaUrl = {
  ok: true;
  url: string;
  titulo: string;
  conteudo: string;
  caracteres: number;
};
export type ErroUrl = { ok: false; error: string };

/** Página que não cabe: 3 MB de HTML é site quebrado ou download disfarçado. */
const MAX_HTML = 3 * 1024 * 1024;
/** Abaixo disto não há o que indexar — provavelmente muro de login ou SPA vazia. */
const MIN_CONTEUDO = 200;

/**
 * LÊ UMA URL E MOSTRA O QUE VAI SER INDEXADO — antes de indexar.
 *
 * Duas etapas de propósito. Scraping erra: uma página protegida por login
 * devolve o formulário de login, uma SPA devolve o esqueleto vazio, e um site
 * com o miolo dentro de `<div>` genérica pode entregar a barra lateral. Indexar
 * qualquer uma dessas coisas envenena o chatbot em silêncio — ele passa a citar
 * "Aceite os cookies" como se fosse procedimento.
 *
 * A prévia devolve o texto extraído para a pessoa julgar. Só depois ela grava.
 *
 * ── A trava SSRF ────────────────────────────────────────────────────────────
 * Este endpoint busca uma URL escolhida por quem usa, do SERVIDOR. Sem a
 * checagem, `http://169.254.169.254/` devolveria as credenciais da instância, e
 * `http://localhost:5432` viraria um scanner da rede interna. `hostEhSeguro`
 * resolve o DNS e recusa IP privado, loopback e link-local — é a mesma trava dos
 * assistentes que leem sites citados, e reusá-la é o ponto: uma segunda
 * implementação é uma segunda chance de errar.
 */
export async function lerUrl(spaceId: string, urlBruta: string): Promise<PreviaUrl | ErroUrl> {
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar esta documentação." };
  }

  let url: URL;
  try {
    url = new URL(urlBruta.trim());
  } catch {
    return { ok: false, error: "Endereço inválido. Comece com https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Só http e https." };
  }
  if (!(await hostEhSeguro(url.hostname))) {
    return { ok: false, error: "Este endereço aponta para a rede interna e foi recusado." };
  }

  let html: string;
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        // Sem User-Agent, muito CDN devolve 403 e a pessoa conclui que a página
        // não existe. Identificar-se é mais honesto que fingir ser navegador.
        "User-Agent": "NatcorpDocs/1.0 (+indexação de base de conhecimento)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!r.ok) return { ok: false, error: `A página respondeu HTTP ${r.status}.` };

    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("html")) {
      return {
        ok: false,
        error: `Este endereço devolveu ${tipo.split(";")[0] || "conteúdo não-HTML"}. Para PDF e DOCX, use o envio de arquivo.`,
      };
    }
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_HTML) return { ok: false, error: "Página grande demais (acima de 3 MB de HTML)." };
    html = new TextDecoder("utf-8").decode(buf);
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" ? "A página demorou mais de 20s." : (e as Error).message;
    return { ok: false, error: `Não consegui abrir: ${msg}` };
  }

  const p = extrairPaginaWeb(html);
  if (p.caracteres < MIN_CONTEUDO) {
    return {
      ok: false,
      error:
        "Quase não veio texto. A página pode exigir login ou montar o conteúdo por JavaScript — nesses casos, salve como PDF e envie o arquivo.",
    };
  }
  return { ok: true, url: url.toString(), titulo: p.titulo, conteudo: p.conteudo, caracteres: p.caracteres };
}

/**
 * Grava a página lida como documento da base — mesmo caminho do arquivo.
 *
 * O texto vem do CLIENTE, e não de uma segunda busca, porque é exatamente o que
 * a pessoa aprovou na prévia: rebuscar poderia trazer conteúdo diferente (banner
 * rotativo, teste A/B) do que ela viu e aceitou.
 */
export async function indexarUrl(input: {
  spaceId: string;
  url: string;
  titulo: string;
  conteudo: string;
}): Promise<{ ok: true } | ErroUrl> {
  const { spaceId, url, titulo, conteudo } = input;
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar esta documentação." };
  }
  if (conteudo.trim().length < MIN_CONTEUDO) return { ok: false, error: "Conteúdo vazio." };

  // A origem fica no topo do documento: quando o chatbot citar este trecho,
  // quem ler a citação precisa saber que ela veio de fora e de onde.
  const corpo = `# ${titulo}\n\n_Fonte: ${url}_\n_Lida em ${new Date().toLocaleDateString("pt-BR")}_\n\n${conteudo}`;
  const nome = `${titulo.slice(0, 80).replace(/[^\w\s.-]/g, "").trim() || "pagina"}.md`;

  const supabase = await createClient();
  const path = `${spaceId}/kb-url-${Date.now()}-${nome.replace(/[^\w.-]/g, "_")}`;
  const bytes = new TextEncoder().encode(corpo);
  const { error } = await supabase.storage.from("imports").upload(path, bytes, { contentType: "text/markdown" });
  if (error) return { ok: false, error: `Falha ao guardar: ${error.message}` };

  const r = await ingestKnowledgeFile({
    spaceId,
    storagePath: path,
    originalName: nome,
    mime: "text/markdown",
    sizeBytes: bytes.byteLength,
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
