/**
 * Cache em memória de resultados de ferramenta + filtro por NOME.
 *
 * Dados quase-estáticos (estrutura da organização, equipe do gestor, cadastro do
 * próprio usuário) não precisam bater na API a cada mensagem — `cache_ttl` na
 * ferramenta liga um cache por (base, parâmetros, identidade). E quando a IA passa
 * um `termo` (nome), o servidor filtra o resultado antes de devolver: a IA recebe
 * só os casamentos, não a lista inteira — menos tokens e mais fácil de acertar.
 */
import type { ExecResult } from "./executor";
import type { Identity } from "./params";

type Entry = { exp: number; result: ExecResult };
const cache = new Map<string, Entry>();

/**
 * Executa via cache e informa se foi HIT (útil p/ o log de execução). Só guarda
 * resultados OK (erro é transitório, não cacheia).
 */
export async function getCachedExecMeta(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<ExecResult>,
): Promise<{ result: ExecResult; cached: boolean }> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return { result: hit.result, cached: true };
  const result = await fetcher();
  if (result.ok) cache.set(key, { exp: Date.now() + ttlSeconds * 1000, result });
  return { result, cached: false };
}

/** Executa via cache; só guarda resultados OK (erro é transitório, não cacheia). */
export async function getCachedExec(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<ExecResult>,
): Promise<ExecResult> {
  return (await getCachedExecMeta(key, ttlSeconds, fetcher)).result;
}

/** Chave de cache: parâmetros que afetam a API (menos `termo`) + identidade que escopa. */
export function cacheArgsKey(modelArgs: Record<string, unknown>, identity: Identity): string {
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(modelArgs)) if (k !== "termo") rest[k] = v;
  return JSON.stringify({ ...rest, u: identity.usuario ?? "", e: identity.cod_empresa ?? "", m: identity.matricula ?? "", b: identity.base ?? "" });
}

/**
 * Remove linhas IDÊNTICAS de `data.items` (várias APIs ORDS repetem cada registro
 * muitas vezes — ex.: estrutura devolve 148 linhas para 16 empresas distintas).
 * Menos ruído e menos tokens. Só mexe se houver duplicata real (JSON igual).
 */
export function dedupItems(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return data;
  const seen = new Set<string>();
  const uniq = items.filter((it) => {
    const k = JSON.stringify(it);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.length === items.length ? data : { ...(data as object), items: uniq };
}

/** Minúsculas, sem acento, aparado — para casar nomes de forma tolerante. */
export function normalizar(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra `data.items` pelo `termo`, casando contra qualquer campo cujo nome
 * contenha "nome" (nome_empresa, nome_filial, nome…). Sem casar nada, devolve o
 * dado ORIGINAL (não esconde a lista — a IA pode navegar ou pedir de outro jeito).
 */
export function filtrarPorTermo(data: unknown, termo: string): unknown {
  const t = normalizar(termo);
  if (!t || !data || typeof data !== "object") return data;
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return data;
  const matched = items.filter(
    (it) =>
      it != null &&
      typeof it === "object" &&
      Object.entries(it as Record<string, unknown>).some(
        ([k, v]) => /nome/i.test(k) && typeof v === "string" && normalizar(v).includes(t),
      ),
  );
  return matched.length ? { ...(data as object), items: matched } : data;
}
