import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { authHeaders } from "./executor";
import { loadCredentialSecret } from "./resolve";
import { parseModulosPayload, dedupModulos, type ModuloRow } from "./module-parse";

/**
 * SYNC DA TAXONOMIA (Fase 2b) — busca os módulos/submódulos do sistema do cliente
 * e os guarda em `ai_modules` (cache do SELETOR na tela de tools). Reusa a mesma
 * autenticação das tools (OAuth ORDS via `authHeaders`) e a credencial da base.
 *
 * Endpoint: GET {base_url}/chatbot/modulos/v1/consulta?p_painel={PC|PG|PO}
 * (sem o parâmetro = todos). Paginado por `offset`/`hasMore`. Internamente
 * chamamos o conceito de `portal` (mesmos valores do `p_painel`).
 */

const PAINEIS: (string | null)[] = [null, "PC", "PG", "PO"];
const MAX_PAGES = 200; // trava de segurança (200 × ~25 = 5000 itens por painel)
const PAGE_TIMEOUT_MS = 20_000;

/** Busca TODAS as páginas de um painel (segue offset enquanto `hasMore`). */
async function fetchPainel(
  baseUrl: string,
  auth: Record<string, string>,
  painel: string | null,
): Promise<ModuloRow[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const rows: ModuloRow[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${base}/chatbot/modulos/v1/consulta`);
    if (painel) url.searchParams.set("p_painel", painel);
    if (offset) url.searchParams.set("offset", String(offset));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    let payload: { hasMore?: boolean; limit?: number } | null = null;
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json", ...auth },
        signal: controller.signal,
      });
      if (!res.ok) break; // 401/500 etc.: para aqui (não apaga o cache existente)
      payload = (await res.json()) as { hasMore?: boolean; limit?: number };
    } catch {
      break;
    } finally {
      clearTimeout(timer);
    }
    rows.push(...parseModulosPayload(payload));
    if (payload?.hasMore !== true) break;
    offset += Number(payload?.limit) || 25;
  }
  return rows;
}

export type SyncResult = { ok: boolean; count: number; error?: string };

/** Sincroniza a taxonomia de uma base para `ai_modules` (replace-all por base). */
export async function syncBaseModules(baseCode: string): Promise<SyncResult> {
  const db = createAdminClient();
  const alvo = baseCode.trim().replace(/([\\%_])/g, "\\$1");
  const { data: base } = await db
    .from("ai_bases")
    .select("base_code, base_url, credential_id")
    .ilike("base_code", alvo)
    .limit(1)
    .maybeSingle();
  if (!base) return { ok: false, count: 0, error: "Base não encontrada." };
  if (!base.base_url) return { ok: false, count: 0, error: "Base sem URL configurada (base_url)." };

  const cred = base.credential_id ? await loadCredentialSecret(base.credential_id) : null;
  const auth = await authHeaders(cred, fetch);

  const linhas: { base_code: string; portal: string | null; modulo: string; submodulo: string | null; synced_at: string }[] = [];
  const now = new Date().toISOString();
  for (const painel of PAINEIS) {
    const rows = dedupModulos(await fetchPainel(base.base_url, auth, painel));
    for (const r of rows) {
      linhas.push({ base_code: base.base_code, portal: painel, modulo: r.modulo, submodulo: r.submodulo, synced_at: now });
    }
  }
  if (linhas.length === 0) {
    return { ok: false, count: 0, error: "O endpoint não retornou módulos (verifique a URL/credencial da base)." };
  }

  // Replace-all para esta base: a taxonomia muda no cliente; re-sync completo é o
  // mais simples e correto (só apaga DEPOIS de ter os dados novos em mãos).
  await db.from("ai_modules").delete().eq("base_code", base.base_code);
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db.from("ai_modules").insert(linhas.slice(i, i + 500));
    if (error) return { ok: false, count: i, error: error.message };
  }
  return { ok: true, count: linhas.length };
}
