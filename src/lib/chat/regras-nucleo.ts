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

/**
 * NÚMERO EXATO — decisão do Igor (12/08/2026): "os números precisam sempre ser
 * exatos, batendo centavos".
 *
 * O modelo condensava valores na tabela ("R$ 2,3 Mi", "-R$ 614 K", "1,2 mil"),
 * que é bom de LER e péssimo como DADO: aquela tabela é salva em Relatórios
 * Salvos, baixada em CSV e vira gráfico. O leitor do widget até entende a
 * escala abreviada, mas 2,3 Mi não é um número — é uma faixa. O que se perde na
 * abreviação não volta depois, em lugar nenhum.
 *
 * A regra separa os dois usos: no texto corrido, arredondar ajuda a entender;
 * dentro de tabela, o valor é matéria-prima e vai inteiro.
 */
export function regraNumerosExatos(): string {
  return (
    "NÚMEROS EM TABELA SÃO EXATOS: dentro de uma tabela markdown, escreva o valor COMPLETO, como ele veio da " +
    "ferramenta/relatório — \"R$ 2.300.000,00\", \"-614.000,00\", \"1.240\". NUNCA abrevie escala (Mi, MM, K, mil, " +
    "bi) e NUNCA arredonde para 'facilitar': essa tabela é salva como relatório, exportada em CSV e vira gráfico, e o " +
    "valor abreviado não volta a ser exato depois. No TEXTO ao redor da tabela você PODE resumir (\"cerca de 2,3 " +
    "milhões\") — ali é leitura, não dado. Não invente casas decimais que a origem não trouxe: exato é igual à fonte, " +
    "não mais preciso que ela."
  );
}

/**
 * MATRÍCULA NÃO SE ADIVINHA.
 *
 * Numa conversa sobre "Tony Oliveira" o modelo emitiu `matricula=607305` na
 * PRIMEIRA chamada, sem nenhuma consulta que ligasse o nome ao número
 * (14/08/2026). As seis ferramentas seguintes obedeceram e trouxeram, corretas,
 * a vida funcional de OUTRA pessoa: cargos, salários, avaliações e férias.
 *
 * O erro não aparece: a resposta fica bem formada, com dados reais, e o nome
 * certo no texto. E no painel do operador não há guard que segure — ele enxerga
 * todo mundo, então uma matrícula inventada que exista devolve dados de verdade.
 *
 * Por isso a regra é sobre a ORIGEM do número, não sobre "ter cuidado": ou ele
 * veio de uma consulta feita NESTE turno, ou da identidade de quem pergunta, ou
 * a pessoa o digitou. Fora disso, o modelo pergunta.
 */
export function regraMatriculaComFonte(): string {
  return (
    "MATRÍCULA E CÓDIGO DE PESSOA — de onde o número pode vir: (a) de um resultado de ferramenta DESTE turno; " +
    "(b) da identidade de quem está perguntando; (c) do que a pessoa digitou. NUNCA de memória, de dedução pelo " +
    "nome, nem de uma conversa anterior. " +
    "Quando o pedido citar alguém pelo NOME, PRIMEIRO consulte a ferramenta de cadastro para achar a matrícula " +
    "e só então chame as demais. Se voltar mais de uma pessoa, PERGUNTE qual — não escolha. Se não voltar " +
    "nenhuma, diga que não encontrou; não tente um número parecido. " +
    "Um número errado aqui não dá erro: as consultas respondem certo sobre a PESSOA ERRADA, e ninguém percebe."
  );
}
