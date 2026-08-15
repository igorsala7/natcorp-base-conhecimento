import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiKeysManager } from "./api-keys-manager";
import { TenantLimitsManager } from "./tenant-limits-manager";
import { ApiDocs } from "./api-docs";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Chaves de API" };

/**
 * Chaves SECRETAS de API (#5) — auth das rotas de gestão `/api/manage/v1/…`.
 * Área de alto privilégio: exige `user.manage`. O segredo só aparece na criação.
 */
export default async function ChavesApiPage() {
  const pode = await hasPermission("user.manage", null);
  if (!pode) {
    return (
      <SemPermissao
        titulo="Chaves de API"
        oQue="gerenciar chaves de API"
        permissao="user.manage"
        papel="Admin técnico"
      />
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
    <PageShell titulo="Chaves de API" descricao={
        <>
          Chaves secretas (<code>sk_live_…</code>) para integrar sistemas externos via{" "}
          <code>/api/manage/v1/…</code> (conteúdo) e das APIs de <b>análise de dados</b> e{" "}
          <b>leitura de documentos (OCR)</b>. Os escopos são as permissões que a chave concede — o segredo é
          mostrado só na criação.
        </>
      } largura="page">
      <ApiKeysManager keys={data ?? []} />
      <TenantLimitsManager limits={limits ?? []} bases={(bases ?? []).map((b) => b.base_code).filter((c): c is string => !!c)} />
      <ApiDocs />
    </PageShell>
  );
}
