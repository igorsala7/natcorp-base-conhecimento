// SEM `server-only` — de propósito, e não por esquecimento. A DECISÃO
// (`decidirEscopo`) precisa ser importável pelo teste (Vitest roda fora do
// runtime de Server Component, e `server-only` lança nesse caso). O módulo
// não toca segredo nenhum: importa uma função pura e um TYPE do Supabase, e
// quem carrega o cliente de banco de verdade é sempre o CHAMADOR
// (`retrievePublicContext`, que já é `server-only`). É a mesma razão de
// `src/lib/elegibilidade/frase.ts` ficar fora de `server-only` enquanto
// `src/lib/prompts/sugeridos.ts` fica dentro: pureza testável de um lado,
// acesso a segredo do outro.
import type { SupabaseClient } from "@supabase/supabase-js";
import { identidadeDoRastreio } from "@/lib/elegibilidade";
import type { TrackingKey } from "@/lib/chat/tracking";

export type LinhasDoEscopo = {
  documentacoes: { space_id: string; origem: string }[];
  documentos: string[];
};

export type EscopoResolvido = {
  spaceIds: string[];
  documentIds: string[];
  /** De onde veio: a base resolveu algo, ou caiu no escopo da chave. */
  origem: "base" | "chave";
};

/**
 * A DECISÃO, pura e testável: o que a base resolveu, ou o escopo da chave.
 *
 * Cair no escopo da chave quando a base não tem nada anexado é o que torna esta
 * rodada ADITIVA: enquanto ninguém configurar, todo cliente continua vendo
 * exatamente o que via, e a migração é um cliente por vez.
 *
 * Arquivo sozinho já conta como escopo. Sem isso, o cliente que só anexou o PDF
 * de regras internas cairia no escopo da chave e o PDF não entraria na busca —
 * o pedido que originou o projeto ficaria sem efeito.
 */
export function decidirEscopo(linhas: LinhasDoEscopo, spaceIdsDaChave: string[]): EscopoResolvido {
  const spaceIds = [...new Set(linhas.documentacoes.map((d) => d.space_id))];
  const documentIds = [...new Set(linhas.documentos)];
  if (spaceIds.length === 0 && documentIds.length === 0) {
    return { spaceIds: [...new Set(spaceIdsDaChave)], documentIds: [], origem: "chave" };
  }
  return { spaceIds, documentIds, origem: "base" };
}

/**
 * Lê as duas RPCs e decide. Duas consultas no caminho quente do turno, então
 * quem chamar precisa cachear — o cache de contexto de 60 s já existe e a chave
 * dele ganha base, portal e perfil.
 *
 * Erro de banco NÃO derruba o turno: devolve o escopo da chave, que é o
 * comportamento de antes desta mudança. Uma falha de leitura de configuração
 * não deve apagar a documentação do cliente.
 */
export async function resolverEscopoDaBase(
  db: SupabaseClient,
  base: string,
  track: Partial<Record<TrackingKey, string>>,
  spaceIdsDaChave: string[],
): Promise<EscopoResolvido> {
  const identidade = identidadeDoRastreio(track);
  try {
    const [docs, arqs] = await Promise.all([
      db.rpc("escopo_documentacao", { p_base: base, p_identidade: identidade }),
      db.rpc("documentos_da_base", { p_base: base, p_identidade: identidade }),
    ]);
    if (docs.error || arqs.error) {
      return decidirEscopo({ documentacoes: [], documentos: [] }, spaceIdsDaChave);
    }
    return decidirEscopo(
      {
        documentacoes: (docs.data ?? []) as { space_id: string; origem: string }[],
        documentos: ((arqs.data ?? []) as { document_id: string }[]).map((d) => d.document_id),
      },
      spaceIdsDaChave,
    );
  } catch {
    return decidirEscopo({ documentacoes: [], documentos: [] }, spaceIdsDaChave);
  }
}
