import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// `hostPermitido` mora em web-fetch.ts (sem dependência de banco). Reexportado
// aqui por conveniência para quem já importava a política.
export { hostPermitido } from "@/lib/ai/web-fetch";

/**
 * Política de acesso à web dos assistentes (Sistema → IA). Lida via service-role
 * porque as rotas do LEITOR (portal/widget/API) não têm sessão de usuário. Cache
 * curto (mesmo padrão de `config.ts`); `invalidateWebFetchPolicy` no salvar.
 */
export type WebFetchPolicy = {
  /** Superfícies de autoria (Chat IA do editor, Estúdio). Sem allowlist. */
  authoring: boolean;
  /** Superfícies públicas (portal/widget/API). Restrito à `allowlist`. */
  reader: boolean;
  /** Domínios permitidos no lado público (vazio = nada é buscado no leitor). */
  allowlist: string[];
};

const PADRAO: WebFetchPolicy = { authoring: true, reader: false, allowlist: [] };
const TTL_MS = 30_000;
let cache: { at: number; valor: WebFetchPolicy } | null = null;

export function invalidateWebFetchPolicy(): void {
  cache = null;
}

export async function webFetchPolicy(): Promise<WebFetchPolicy> {
  const agora = Date.now();
  if (cache && agora - cache.at < TTL_MS) return cache.valor;
  let valor = PADRAO;
  try {
    const { data } = await createAdminClient()
      .from("web_fetch_settings")
      .select("authoring_enabled, reader_enabled, allowlist")
      .eq("id", true)
      .maybeSingle();
    if (data) {
      valor = {
        authoring: data.authoring_enabled,
        reader: data.reader_enabled,
        allowlist: (data.allowlist ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean),
      };
    }
  } catch {
    // Banco indisponível não pode derrubar o chat — cai no padrão seguro.
    valor = PADRAO;
  }
  cache = { at: agora, valor };
  return valor;
}
