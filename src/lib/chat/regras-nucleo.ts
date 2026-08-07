/**
 * Regras de NÚCLEO — as que valem em qualquer turno e têm UM dono só.
 *
 * Nasceu de uma contradição real: três textos diferentes eram concatenados no mesmo
 * bloco do prompt, um mandando PERGUNTAR quando falta um parâmetro, outro dizendo que
 * "é ERRADO responder em texto perguntando" e um terceiro que "'na dúvida' NÃO é
 * desculpa para não agir". O modelo ficava entre agir e perguntar — e essa hesitação
 * aparecia como "o agente se perde".
 *
 * O critério aqui não é o CANAL (tela × ferramenta), que era o que dividia os textos
 * antigos: é o TIPO do que falta. Um analista de RH precisa conseguir prever o que o
 * agente vai fazer, e a previsão não pode depender de por onde o dado vem.
 *
 * Puro: sem server-only, sem IO.
 */

/** Agir × perguntar — dono único. Substitui os blocos de form-fields e report-tools. */
export function regraAgirOuPerguntar(): string {
  return (
    "AGIR OU PERGUNTAR (regra única — vale para a tela E para as ferramentas):\n" +
    "1. AJA SEM PERGUNTAR quando ALVO e VALOR são determináveis: um campo/botão cujo rótulo corresponde ao que foi " +
    "pedido, ou uma ferramenta cujos parâmetros obrigatórios você preenche com o que está no CONTEXTO (mensagem, " +
    "histórico, tela, identidade do usuário). Ação de tela tem confirmação visual e o usuário pode desfazer; consulta é " +
    "somente leitura. Não peça licença nem descreva o que faria: execute NESTA resposta.\n" +
    "2. PERGUNTE UMA VEZ, em UMA frase, só quando faltar um dado que SÓ o usuário tem e que MUDA o resultado: " +
    "(a) dois ou mais alvos/valores igualmente plausíveis, sem critério para escolher; (b) um parâmetro OBRIGATÓRIO " +
    "que não está no contexto e não tem padrão. Se a ferramenta ACEITA aquele filtro em branco (traz todo o escopo " +
    "liberado), chame com ele em branco em vez de perguntar.\n" +
    "3. NUNCA pergunte para confirmar o que já está claro (\"quer que eu preencha?\", \"posso consultar?\"), e NUNCA " +
    "invente um valor só para evitar a pergunta.\n" +
    "4. Se perguntou, ESPERE a resposta — não chame a ferramenta com um chute no mesmo passo.\n" +
    "5. PERGUNTA ou AFIRMAÇÃO não é comando: \"o que é esse campo?\", \"esse campo é obrigatório?\" → responda, não " +
    "toque na tela. Só o pedido de AÇÃO opera a tela."
  );
}

/**
 * Rótulo das colunas — estava DUPLICADO em quatro lugares do mesmo prompt. Repetição
 * não é ênfase: o modelo pode ler as cópias como regras diferentes sobre coisas
 * diferentes. Uma cópia, no núcleo.
 */
export function regraRotulosColuna(): string {
  return (
    "RÓTULO DAS COLUNAS: ao apresentar dados (de ferramenta, da tela ou de arquivo), cite cada campo pela LABEL " +
    "amigável que o usuário reconhece (\"Cargo\", \"Data de admissão\", \"Salário\"), NUNCA pela chave técnica do " +
    "JSON/banco (\"COD_CARGO\", \"DS_NOME\", \"VL_SALARIO\")."
  );
}
