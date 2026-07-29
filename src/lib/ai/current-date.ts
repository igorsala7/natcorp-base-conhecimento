/**
 * Nota de DATA ATUAL para o contexto do chat.
 *
 * Sem uma âncora de "hoje" no prompt, o modelo resolve expressões relativas
 * ("setembro do ano passado", "mês passado") contra o relógio interno defasado
 * do treino — e erra o ano (pediram set/2025 e voltou set/2023). Esta linha, no
 * início do bloco de CONTEXTO, dá a data de hoje no fuso de Brasília e a regra
 * de resolução relativa.
 *
 * `agora` é injetável para testes determinísticos (o fuso é sempre
 * America/Sao_Paulo, então o Date de entrada pode ser UTC).
 */
export function notaDataAtual(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const get = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  const ano = get("year");
  const mes = get("month");
  const dia = get("day");
  const anoPassado = Number(ano) - 1;
  return (
    `DATA DE HOJE: ${dia}/${mes}/${ano} (fuso de Brasília, America/Sao_Paulo). ` +
    "Resolva expressões relativas a partir de HOJE, ANTES de acionar ferramentas ou buscar: " +
    `"este ano" = ${ano}; "ano passado" = ${anoPassado}; "mês passado", "último trimestre" e ` +
    '"últimos N meses" contam de hoje para trás. Ao informar datas às ferramentas, converta para ' +
    "ISO (AAAA-MM-DD, ou AAAA-MM quando for mês). Se o período ficar ambíguo, pergunte antes de consultar."
  );
}
