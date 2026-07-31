import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiKeysManager } from "./api-keys-manager";
import { TenantLimitsManager } from "./tenant-limits-manager";
import { ApiDocs } from "./api-docs";

export const metadata: Metadata = { title: "Chaves de API" };

/**
 * Chaves SECRETAS de API (#5) — auth das rotas de gestão `/api/manage/v1/…`.
 * Área de alto privilégio: exige `user.manage`. O segredo só aparece na criação.
 */
export default async function ChavesApiPage() {
  const pode = await hasPermission("user.manage", null);
  if (!pode) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Chaves de API</h1>
        <p className="mt-2 text-text-muted">Você não tem permissão para gerenciar chaves de API.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, active, last_used_at, created_at")
    .order("created_at", { ascending: false });

  // Limites por base + bases existentes (tabelas internas → service-role, já
  // protegidas pela checagem user.manage acima).
  const admin = createAdminClient();
  const [{ data: limits }, { data: bases }] = await Promise.all([
    admin.from("tenant_limits").select("tenant, max_concurrency, daily_token_cap, updated_at").order("tenant"),
    admin.from("ai_bases").select("base_code").eq("active", true),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Chaves de API</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
        Chaves secretas (<code>sk_live_…</code>) para integrar sistemas externos via{" "}
        <code>/api/manage/v1/…</code> (conteúdo) e das APIs de <b>análise de dados</b> e{" "}
        <b>leitura de documentos (OCR)</b> — <code>/api/v1/analyze</code> e <code>/api/v1/extract</code> (escopo{" "}
        <code>data.analyze</code>). Os escopos são as permissões que a chave concede. O segredo é mostrado só na criação.
      </p>
      <ApiKeysManager keys={data ?? []} />
      <TenantLimitsManager limits={limits ?? []} bases={(bases ?? []).map((b) => b.base_code).filter((c): c is string => !!c)} />
      <ApiDocs />
    </div>
  );
}
