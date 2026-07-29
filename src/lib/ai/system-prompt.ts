/**
 * Compositor do system prompt por SEÇÕES temáticas.
 *
 * Motivação: um chatbot pode ser ao mesmo tempo "assistente de documentação"
 * (RAG) e "assistente de dados" (ferramentas/APIs). Em vez de um blocão único,
 * cada tema tem sua seção com um único dono — assim as instruções não se
 * contradizem (ex.: "cite [n]" da documentação vs. resposta vinda de uma API).
 *
 * Ordem fixa; seções vazias são OMITIDAS; as REGRAS ficam sempre por ÚLTIMO
 * (piso inegociável), e o CONTEXTO vem depois. Ver [[prompt-cascade]] —
 * `persona` e `regras` são resolvidas lá (resolvePersona/resolveRegras) e
 * entregues já prontas aqui.
 *
 * COMPATIBILIDADE: sem `especializacao`/`usoFerramentas`/`linguagem` e sem
 * `comTools`, a saída é BYTE-IDÊNTICA a `withContext(buildSystemPrompt(...))`.
 * Isso é fixado por teste — não altere a montagem sem atualizar o teste.
 */

/**
 * Cláusula anexada ao FIM das regras (posição vencedora) quando há ferramentas
 * ativas. Reconcilia a exigência de citação da documentação com respostas que
 * vêm de dados de API — senão as duas brigariam.
 */
export const RECONCILIACAO_FERRAMENTAS =
  "Respostas baseadas em DADOS retornados por ferramentas (APIs) são fonte legítima e não " +
  "exigem citação [n]; a exigência de citar fontes com [n] vale para o conteúdo da documentação.";

const H_ESPECIALIZACAO = "ESPECIALIZAÇÃO DO ATENDIMENTO:";
const H_FERRAMENTAS = "USO DAS FERRAMENTAS:";

export type PromptSections = {
  /** Persona já resolvida (chave → espaço → padrão). Obrigatória. */
  persona: string;
  /** Prompt do agente ativo (ex.: Nati). Só aparece quando presente. */
  especializacao?: string | null;
  /** Nota de ferramentas/capacidades (roteamento API × documentação). */
  usoFerramentas?: string | null;
  /** Instrução de linguagem/canal (ex.: formatação do WhatsApp). */
  linguagem?: string | null;
  /** Bloco de regras já resolvido. Sempre por último. Obrigatório. */
  regras: string;
  /** Quando há ferramentas ativas: anexa a cláusula de reconciliação às regras. */
  comTools?: boolean;
};

/** Monta o system prompt final a partir das seções + o bloco de CONTEXTO. */
export function composeSystemPrompt(s: PromptSections, contextBlock: string): string {
  const regrasFinal = s.comTools ? `${s.regras}\n\n${RECONCILIACAO_FERRAMENTAS}` : s.regras;
  const secoes = [
    s.persona,
    s.especializacao?.trim() ? `${H_ESPECIALIZACAO}\n${s.especializacao.trim()}` : "",
    s.usoFerramentas?.trim() ? `${H_FERRAMENTAS}\n${s.usoFerramentas.trim()}` : "",
    s.linguagem?.trim() || "",
    regrasFinal,
  ].filter(Boolean);
  return `${secoes.join("\n\n")}\n\nCONTEXTO:\n${contextBlock}`;
}
