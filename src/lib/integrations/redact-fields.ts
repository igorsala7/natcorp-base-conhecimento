/**
 * Remove CREDENCIAIS do que a API devolve, antes de o resultado chegar ao modelo.
 *
 * Caso real: `natdocs_empresas` (/documents/v1/emps) devolve 48 campos por empresa,
 * entre eles `cert_file`, `cert_password` e `cert_charset` — o certificado digital da
 * empresa e a SENHA dele. Ninguém pediu; vinha junto porque o endpoint faz `select *`.
 * Sem isto, a senha entra no contexto do modelo e no log de execução.
 *
 * Regra: o campo sai pelo NOME, não pelo conteúdo — heurística sobre o valor erraria
 * (uma senha curta parece qualquer coisa). O que casa vira `"[removido]"` em vez de
 * sumir, para o modelo entender que o campo existe e foi omitido de propósito.
 *
 * PURA e sem I/O — mesmo padrão de `html-values` e `guard-catalog`.
 */

/** Nomes (normalizados) que indicam credencial ou segredo. */
const SEGREDO = [
  /(^|_)senha(_|$)/,
  /(^|_)password(_|$)/,
  /(^|_)passwd(_|$)/,
  /(^|_)secret(_|$)/,
  /(^|_)token(_|$)/,
  /(^|_)api_?key(_|$)/,
  /(^|_)client_?secret(_|$)/,
  /(^|_)private_?key(_|$)/,
  /cert_(file|password|charset|mimetype)/,
  /(^|_)certificado(_|$)/,
];

/** Profundidade máxima — retorno aninhado não pode virar recursão sem fim. */
const MAX_NIVEL = 8;
export const MARCA = "[removido]";

const norm = (s: string) => String(s ?? "").trim().toLowerCase();

/** O nome deste campo indica credencial? */
export function campoSensivel(nome: string): boolean {
  const n = norm(nome);
  return SEGREDO.some((r) => r.test(n));
}

/**
 * Percorre o resultado e substitui o VALOR dos campos de credencial pela marca.
 * Preserva a estrutura e os demais campos.
 */
export function redigirCredenciais<T>(dados: T, nivel = 0): T {
  if (nivel > MAX_NIVEL) return dados;
  if (Array.isArray(dados)) return dados.map((d) => redigirCredenciais(d, nivel + 1)) as unknown as T;
  if (dados && typeof dados === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dados as Record<string, unknown>)) {
      // Campo vazio não vira "[removido]" — poluiria o resultado sem proteger nada.
      if (campoSensivel(k)) out[k] = v === null || v === undefined || v === "" ? v : MARCA;
      else out[k] = redigirCredenciais(v, nivel + 1);
    }
    return out as unknown as T;
  }
  return dados;
}
