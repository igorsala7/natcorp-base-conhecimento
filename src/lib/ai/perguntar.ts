/**
 * QUANDO O AGENTE DEVE PERGUNTAR — e, principalmente, quando NÃO deve.
 *
 * O eval de cenários (19/08/2026) mediu cinco modelos de três provedores nos
 * mesmos 36 turnos reais, com a ferramenta de perguntar DISPONÍVEL em todos:
 *
 *   perguntou de menos   8 a 10 das 10 ocasiões em que devia
 *   perguntou demais     0 a 5
 *
 * Cinco modelos errando na mesma direção não é limitação de modelo: é o prompt.
 * Ele empurra para agir e em nenhum ponto autoriza a dúvida. Esta diretiva é a
 * autorização — escrita a partir das regras que o dono ditou em
 * `docs/regras-de-negocio-chat.md`.
 *
 * ── Por que perguntar é BARATO ──────────────────────────────────────────────
 * Medido em 1.176 turnos de 20 dias: um turno que termina em esclarecimento
 * NÃO chega ao modelo (zero tokens). Um turno de resposta custa 66.051 tokens
 * de mediana — e quando passa de 100 mil, o turno seguinte gasta outros 132 mil
 * em média (218 pares). Adivinhar errado é o caminho CARO, não o rápido.
 *
 * Por isso os dois lados entram juntos: sem a lista do que NÃO justifica
 * pergunta, autorizar a dúvida produz um agente que interroga o usuário — que
 * é o defeito oposto, e igualmente medido no eval (5 perguntas a mais num dos
 * modelos).
 *
 * ── O que ela entrega, medido ───────────────────────────────────────────────
 * Sozinha, quase nada: o "perguntou de menos" ficou em 10→8, 9→9, 10→10. Texto
 * não vence o instinto de agir. Somada à checagem de período do servidor
 * (`periodo.ts`), os três modelos melhoraram nos DOIS eixos, sem nenhum passar a
 * perguntar demais:
 *
 *   gemini-3.5-flash        ferramenta 50→51%   pergunta 72→81%
 *   gemini-3.5-flash-lite   ferramenta 58→62%   pergunta 61→65%
 *   claude-haiku-4-5        ferramenta 53→57%   pergunta 72→76%
 *
 * A lição para as próximas: onde a regra é enumerável, um portão no servidor; a
 * diretiva cobre o resto e dá ao modelo o vocabulário para conduzir a pergunta.
 */

/** Diretiva de esclarecimento. Vai no fim do prompt, com as regras. */
export const DIRETIVA_PERGUNTAR = `## QUANDO PERGUNTAR ANTES DE AGIR

Você PODE e DEVE perguntar quando falta algo que MUDA O RESULTADO e não dá para
deduzir do histórico nem da tela. Perguntar custa quase nada; entregar o dado
errado com aparência de certo custa a confiança da pessoa.

PERGUNTE nestes casos:
- TERMO AMBÍGUO entre assuntos diferentes ("evento" pode ser do eSocial, da folha,
  do ponto ou do banco de horas; "jornada" pode ser de trabalho, do colaborador ou
  banco de horas). Pergunte citando as opções concretas que existem.
- MUDANÇA CLARA DE ASSUNTO em relação ao que se falava — confirme em uma frase e
  siga já no novo escopo.
- ESCOPO ORGANIZACIONAL EM BRANCO num pedido agregado (relatório, painel,
  conformidade) quando NENHUMA mensagem anterior fixou empresa, filial, centro de
  custo ou cargo: diga que o padrão é a empresa inteira e JÁ LISTE os recortes
  disponíveis. Nunca pergunte "qual escopo você quer?" em aberto — isso transfere
  à pessoa o trabalho de saber o que existe.
- PARÂMETRO OMITIDO QUE MUDA O NÚMERO, com destaque para o PERÍODO. "eventos de
  apuração da matrícula 205818" é uma frase completa e ainda assim precisa de
  pergunta: sem período, escolher um sozinho traz centenas de linhas erradas.
- FORMATO DE ENTREGA quando o resultado é grande: responder no chat ou gerar
  arquivo? Não decida sozinho entre os dois.
- SAIR DA TELA PARA UMA FERRAMENTA: se a coluna pedida não está no relatório
  aberto, diga isso, ofereça continuar ou cancelar, e — ao continuar — herde os
  filtros da página como parâmetros, confirmando o recorte ("vou buscar na
  empresa X, filial Y"). A tela filtrada por um centro de custo consultada sem
  filtro devolve a base inteira: plausível, apresentável e errado.

NÃO PERGUNTE nestes casos — aqui a pergunta é que é o defeito:
- MENSAGEM CURTA com contexto claro. "15 15, início 01/10 e depois 01/11" tem duas
  palavras úteis e é inequívoco num parcelamento de férias.
- REPETIÇÃO do que a pessoa já pediu. Repetir é INSISTÊNCIA, não dúvida.
- PRONOME COM ANTECEDENTE CLARO ("e o Tony?", "quais deles", "esse campo" com um
  campo em foco, "essas informações" logo depois de você mostrá-las).
- SAUDAÇÃO NA FRENTE do pedido. "Olá, quais são meus dados?" é o mesmo pedido que
  "quais são meus dados?".
- CANAL JÁ INDICADO. Se a mensagem traz um endereço de e-mail, é e-mail — não
  pergunte por qual meio enviar. Sem endereço nem canal, aí sim pergunte.
- VERBO QUE JÁ SEPARA AS FERRAMENTAS. Consultar e solicitar são coisas diferentes,
  mas "quando eu vou tirar férias" é consulta e "quero marcar minhas férias" é
  solicitação. Só pergunte quando o verbo de fato não separar.
- MESMO CONTEÚDO EM OUTRO FORMATO. "agora gere em PPT e Word" logo após um PDF é o
  mesmo material — refazer a pergunta é fazer a pessoa repetir o que já disse.

COMO PERGUNTAR: uma pergunta só, curta, com as OPÇÕES concretas quando elas
existirem. Nunca devolva uma lista de perguntas nem peça que a pessoa digite um
nome que você já tem na tela ou no histórico.`;

/**
 * Só faz sentido oferecer a dúvida onde há decisão a tomar. Num turno social
 * ("bom dia") ou num que o servidor já resolveu (confirmação executada), a
 * diretiva é peso morto no prompt — e ainda convida o modelo a perguntar onde
 * não há o que perguntar.
 */
export function devePerguntarDiretiva(opts: { social: boolean; soRedigir: boolean; temFerramentas: boolean }): boolean {
  return !opts.social && !opts.soRedigir && opts.temFerramentas;
}
