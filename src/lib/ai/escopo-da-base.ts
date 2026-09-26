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
  /**
   * INFORMATIVA: a base resolveu algo PRÓPRIO (documentação anexada ou
   * arquivo dela)? Não diz mais "de onde vem o escopo", porque o escopo
   * agora é sempre a união — ver `decidirEscopo`. Serve para tela e log
   * distinguirem "cliente configurado" de "cliente ainda no padrão".
   *
   * Quem decide `p_base` da cerca da tarefa 7 NÃO deve usar isto: a cerca é
   * de PROPRIEDADE (só recusa arquivo de OUTRA base) e nunca corta documento
   * de espaço, então `p_base` vai sempre que houver base.
   */
  origem: "base" | "chave";
};

/**
 * A DECISÃO, pura e testável: a UNIÃO de tudo que esta identidade alcança.
 *
 * ── O escopo da chave é SOMADO, nunca uma QUEDA ──────────────────────────
 * Até 25/09 esta função tinha um ramo de queda: devolvia o escopo da chave
 * SOMENTE quando a base não resolvia nada, e descartava a chave quando
 * resolvia. Medido: o primeiro ramo de `escopo_documentacao` não filtra por
 * base — ele devolve as universais para TODAS as bases. Ou seja, no instante
 * em que alguém marcasse a PRIMEIRA documentação como universal, toda base
 * passaria a resolver algo, o ramo de queda deixaria de rodar, e o escopo da
 * chave seria DESCARTADO. Produção tem três chaves vivas, cada uma com um
 * espaço extra (`painel-do-gestor`, `natcorp`, `painel-do-colaborador`):
 * aquela primeira linha apagaria silenciosamente uma documentação de cada uma
 * das três instalações, sem erro em lugar nenhum, e o sintoma seria o chatbot
 * deixar de achar aquele manual.
 *
 * Também contradizia a decisão "aditivo primeiro": marcar algo como universal
 * tem de SOMAR, nunca tirar.
 *
 * ── Como se RETIRA uma documentação que vem da chave ─────────────────────
 * É a pergunta que a próxima pessoa vai fazer, e a resposta não é aqui.
 * Remova-a onde ela é configurada: a tela da chave, em `/admin/widget`
 * (`widget_key_spaces`). Isso é explícito e é da Natcorp. O cliente não tira
 * documentação de chave; ele só esconde universal, pela sobreposição de
 * `ai_base_documentacoes` (migration 20260925140000).
 *
 * Arquivo sozinho já conta como escopo próprio da base. Sem isso, o cliente
 * que só anexou o PDF de regras internas seria contado como "não
 * configurado", e `origem` mentiria.
 */
export function decidirEscopo(linhas: LinhasDoEscopo, spaceIdsDaChave: string[]): EscopoResolvido {
  const daBase = [...new Set(linhas.documentacoes.map((d) => d.space_id))];
  const documentIds = [...new Set(linhas.documentos)];
  return {
    // União sem duplicata, com a chave PRIMEIRO: a ordem não muda o
    // resultado da busca (o SQL filtra por pertinência, não por posição),
    // mas mantém estável o escopo que o cliente já tinha.
    spaceIds: [...new Set([...spaceIdsDaChave, ...daBase])],
    documentIds,
    origem: daBase.length > 0 || documentIds.length > 0 ? "base" : "chave",
  };
}

/**
 * Lê as duas RPCs e decide. Duas consultas no caminho quente do turno, então
 * quem chamar precisa cachear — o cache de contexto de 60 s já existe e a chave
 * dele ganha base, portal e perfil.
 *
 * Erro de banco NÃO derruba o turno: sem linha nenhuma para somar, a união de
 * `decidirEscopo` é exatamente o escopo da chave — o comportamento de antes
 * desta rodada. Uma falha de leitura de configuração não deve apagar a
 * documentação do cliente.
 *
 * O log nos dois pontos de queda é OBRIGATÓRIO, não enfeite: sem ele, "o
 * cliente não configurou nada" e "a leitura da configuração está quebrada"
 * produzem exatamente o mesmo resultado visível — o escopo da chave, em
 * silêncio — e não há como distinguir os dois de fora. `rag.ts` já corrigiu
 * essa MESMA classe de defeito no catch do embedding da consulta (era um
 * catch mudo, virou `console.error`); esta função tinha reintroduzido o
 * defeito 250 linhas acima, no mesmo caminho.
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
      // A RPC RESPONDEU, mas com erro (permissão, assinatura mudou, função
      // inexistente) — diferente da exceção do catch abaixo (transporte/rede).
      // Só a BASE entra na mensagem; a identidade carrega matrícula e usuário,
      // e log não é lugar de dado de pessoa.
      console.error(
        `[escopo-da-base] RPC de escopo respondeu com erro para a base "${base}", caindo no escopo da chave:`,
        docs.error?.message ?? "(escopo_documentacao ok)",
        arqs.error?.message ?? "(documentos_da_base ok)",
      );
      return decidirEscopo({ documentacoes: [], documentos: [] }, spaceIdsDaChave);
    }
    return decidirEscopo(
      {
        documentacoes: (docs.data ?? []) as { space_id: string; origem: string }[],
        documentos: ((arqs.data ?? []) as { document_id: string }[]).map((d) => d.document_id),
      },
      spaceIdsDaChave,
    );
  } catch (e) {
    // Exceção de TRANSPORTE (rede, timeout) ou algo inesperado que nem chegou
    // a virar resposta com `.error` — diferente do caso acima. Mesma regra:
    // só a base na mensagem, nunca a identidade.
    console.error(
      `[escopo-da-base] falha ao resolver o escopo da base "${base}", caindo no escopo da chave:`,
      e instanceof Error ? e.message : e,
    );
    return decidirEscopo({ documentacoes: [], documentos: [] }, spaceIdsDaChave);
  }
}
