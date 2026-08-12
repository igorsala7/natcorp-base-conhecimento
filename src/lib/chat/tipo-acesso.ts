/**
 * QUEM está falando com o assistente: colaborador, candidato ou ninguém
 * identificado.
 *
 * A regra é do produto (Igor, 12/08/2026) e a ORDEM é o que importa:
 *
 *   p_matricula preenchida                          → COLABORADOR
 *   p_matricula vazia + p_cod_candidato preenchido  → CANDIDATO
 *
 * Matrícula primeiro porque a vida das pessoas anda nessa direção: o candidato
 * contratado ganha matrícula e volta a ser colaborador sem que ninguém precise
 * limpar o código de candidato do token do anfitrião. A regra inversa
 * ("tem cod_candidato → é candidato") transformaria todo recém-contratado num
 * candidato eterno.
 *
 * Puro, sem IO: as duas pontas que decidem coisas diferentes a partir disto —
 * a escolha do agente e o escopo das ferramentas — precisam concordar, e a
 * única forma de garantir isso é ser a mesma função.
 */

export type TipoAcesso = "colaborador" | "candidato" | "anonimo";

export function tipoDeAcesso(input: {
  matricula?: string | null;
  codCandidato?: string | null;
}): TipoAcesso {
  if (String(input.matricula ?? "").trim()) return "colaborador";
  if (String(input.codCandidato ?? "").trim()) return "candidato";
  return "anonimo";
}

/** Atalho de leitura para os pontos onde só interessa "é candidato?". */
export function ehCandidato(input: { matricula?: string | null; codCandidato?: string | null }): boolean {
  return tipoDeAcesso(input) === "candidato";
}
