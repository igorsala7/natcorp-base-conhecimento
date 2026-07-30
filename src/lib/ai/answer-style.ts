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

/**
 * Pergunta de ENUMERAÇÃO — "quais são TODOS os X", "liste os programas de Y",
 * "quantos itens tem…". Difere da completude (passo a passo): aqui o usuário
 * quer a LISTA INTEIRA de itens (ex.: os programas de um módulo). O RAG traz
 * MAIS chunks dos arquivos de conhecimento para não devolver só um pedaço.
 */
const RX_ENUMERA =
  /\b(todos|todas|quais|liste|listar|relacione|relacionar|enumere|quantos|quantas)\b|lista de|lista dos|lista das/i;

export function pedeEnumeracao(pergunta: string): boolean {
  return RX_ENUMERA.test(String(pergunta ?? ""));
}

/**
 * Limpa a pergunta de enumeração para a busca LÉXICA nos arquivos: tira as
 * palavras interrogativas/de comando e o "cola" ("quais são todos os … de …"),
 * deixando só o CONTEÚDO ("programas módulo medicina ocupacional"). Sem isso, o
 * `websearch_to_tsquery` faria AND de "quais/são/todos" — que não existem nos
 * dados — e não casaria nada. Se sobrar pouco, devolve a original.
 */
const RX_LISTA_LIXO =
  /\b(quais|qual|quantos|quantas|todos|todas|toda|todo|liste|listar|relacione|relacionar|enumere|enumerar|mostre|mostrar|traga|trazer|me|diga|dizer|gostaria|preciso|quero|queria|ver|saber|sao|são|é|eh|existe|existem|ha|há|tem|possui|do|da|de|dos|das|no|na|nos|nas|o|a|os|as|um|uma|uns|umas|e|ou|por|favor|lista)\b/gi;

export function limparConsultaLista(pergunta: string): string {
  const limpo = String(pergunta ?? "")
    .replace(RX_LISTA_LIXO, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.length >= 3 ? limpo : String(pergunta ?? "");
}

/** Nota injetada quando o usuário quer a LISTA INTEIRA de itens. */
export function notaEnumeracao(): string {
  return (
    "LISTA COMPLETA (o usuário quer TODOS os itens): percorra TODO o contexto e liste TODOS os itens que se encaixam " +
    "(ex.: todos os programas de um módulo), SEM resumir e SEM parar em alguns exemplos. Use uma lista com marcadores. " +
    "Se houver muitos, liste todos mesmo assim. Não misture itens de outra fonte/assunto que não seja o pedido; se o " +
    "contexto não trouxer a lista, diga que não encontrou a lista completa em vez de responder com poucos exemplos."
  );
}
