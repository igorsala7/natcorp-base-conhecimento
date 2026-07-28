import "server-only";
import type { RetrievedSource } from "@/lib/ai/rag";
import { extrairUrls, buscarPaginas } from "@/lib/ai/web-fetch";
import { webFetchPolicy } from "@/lib/ai/web-fetch-policy";

/**
 * Superfícies do LEITOR (portal, widget, API): se a pergunta cita URLs e o
 * acesso à web do leitor está ligado, busca o texto (RESTRITO à allowlist) e o
 * devolve como fontes SINTÉTICAS numeradas a partir de `startN`. Elas entram no
 * mesmo caminho das fontes da documentação — viram bloco de contexto e citação,
 * o modelo cita [n] e o card mostra o link. Fora da allowlist / leitor desligado
 * → lista vazia (o assistente segue só com a documentação).
 */
export async function webSourcesParaLeitor(
  question: string,
  startN: number,
): Promise<RetrievedSource[]> {
  const pol = await webFetchPolicy();
  if (!pol.reader || pol.allowlist.length === 0) return [];
  const urls = extrairUrls(question);
  if (!urls.length) return [];

  const sources: RetrievedSource[] = [];
  let n = startN;
  for (const r of await buscarPaginas(urls, { allowlist: pol.allowlist })) {
    if (r.ok) sources.push(sinteticoWeb(n++, r.pagina.url, r.pagina.titulo, r.pagina.texto));
  }
  return sources;
}

function sinteticoWeb(
  n: number,
  url: string,
  titulo: string | null,
  texto: string,
): RetrievedSource {
  return {
    n,
    node_id: null,
    document_id: null,
    title: titulo || url,
    origin: "Fonte da web",
    heading_path: null,
    content: texto,
    snippet: null,
    url,
    image: null,
    space_id: null,
    space_name: null,
    dir_node_id: null,
    dir_title: null,
    score: 1,
  };
}
