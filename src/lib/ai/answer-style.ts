/**
 * Estilo da resposta — completude. Quando o usuário pede um PASSO A PASSO / guia /
 * "como implantar/configurar", a resposta não pode vir resumida: reforçamos a
 * completude no prompt E ampliamos os trechos do RAG (para o modelo ter todo o
 * conteúdo). É DIRECIONADO (só nesses pedidos) para não inflar perguntas simples.
 */

const RX_COMPLETO =
  /passo a passo|passo-a-passo|tutorial|\bguia\b|\bmanual\b|procedimento|detalh|completo|todas as etapas|todos os passos|como (implant|implement|configur|habilit|ativ|parametriz|criar|montar|fazer|proceder|realizar)/i;

/** O usuário quer uma resposta COMPLETA/detalhada (passo a passo, guia, tutorial…)? */
export function pedeCompletude(pergunta: string): boolean {
  return RX_COMPLETO.test(String(pergunta ?? ""));
}

/** Nota injetada no contexto quando o usuário pede um passo a passo/guia. */
export function notaCompletude(): string {
  return (
    "RESPOSTA COMPLETA (o usuário pediu um passo a passo / guia / como fazer): dê a resposta DETALHADA e COMPLETA usando " +
    "TODO o conteúdo relevante da documentação no contexto — liste TODAS as etapas/telas na ORDEM, com pré-requisitos, " +
    "campos e sequência, SEM resumir, SEM pular passos e SEM encurtar por brevidade. Prefira uma lista numerada de passos. " +
    "Se parte do procedimento NÃO estiver na documentação, diga explicitamente o que falta (em vez de omitir) e oriente o " +
    "próximo caminho."
  );
}
