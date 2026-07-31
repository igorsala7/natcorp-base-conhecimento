import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/permissions";
import { currentMaxLevel } from "@/lib/auth/roles";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import {
  SystemManager,
  type ProviderRow,
  type AssignmentRow,
  type EmailRow,
} from "./system-manager";
import type { BackupRow, BackupSettingsRow } from "./backup-panel";
import type { PromptCatUI } from "./prompts-panel";
import type { WebAccessData } from "./web-access-panel";
import { InfraPanel, type InfraData } from "./infra-panel";
import { PROMPT_CATEGORIES } from "@/lib/ai/prompt-registry";
import { resolveCategory } from "@/lib/ai/prompts";
import { secretsPresentes } from "./actions";

export const metadata: Metadata = { title: "Sistema" };

/**
 * Configurações GERAIS do produto — provedores de IA por finalidade e envio de
 * e-mail. Diferente de `/admin/configuracoes`, que é por documentação.
 *
 * `ai.configure` e `integrations.manage` já existiam em `permissions` desde a
 * Fase 0.5 (concedidas ao Admin técnico); alterar SEGREDO exige Owner (100),
 * exigência que o banco também aplica.
 */
export default async function SistemaPage() {
  const podeIa = await hasPermission("ai.configure", null);
  const podeIntegr = await hasPermission("integrations.manage", null);
  if (!podeIa && !podeIntegr) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Sistema</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para configurar o sistema. Esta área exige um papel{" "}
          <strong className="font-medium">global</strong> — um papel restrito a uma documentação
          não alcança configuração geral.
        </p>
      </div>
    );
  }

  const canBackup = await hasPermission("system.backup", null);
  const supabase = await createClient();
  const [{ data: providers }, { data: assignments }, { data: email }, segredos, nivel, { data: backups }, { data: backupSettings }] =
    await Promise.all([
      supabase.from("ai_providers").select("id, name, kind, base_url, active, base_code").order("name"),
      supabase.from("ai_assignments").select("purpose, provider_id, model, base_code"),
      supabase.from("email_settings").select("*").maybeSingle(),
      secretsPresentes(),
      currentMaxLevel(null),
      canBackup
        ? supabase.from("backup_jobs")
            .select("id, kind, status, progress, phase, bytes, tables_count, rows_count, files_count, error, created_at, source_backup_id")
            .order("created_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
      canBackup
        ? supabase.from("backup_settings").select("*").eq("id", true).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Token do GitHub vive numa tabela deny-all (só service-role lê). Só checamos presença.
  let githubTokenPresent = false;
  if (canBackup) {
    const { data: sec } = await createAdminClient().from("backup_secrets").select("github_token_enc").eq("id", true).maybeSingle();
    githubTokenPresent = Boolean(sec?.github_token_enc);
  }

  // Infra/Escala (tabela deny-all → service-role). Não expõe o token, só presença.
  let infraData: InfraData | null = null;
  if (podeIa) {
    const { data: row } = await createAdminClient().from("infra_settings").select("*").eq("id", true).maybeSingle();
    infraData = {
      redis_rest_url: row?.redis_rest_url ?? null,
      redis_token_present: Boolean(row?.redis_rest_token_enc),
      max_concurrency_per_base: row?.max_concurrency_per_base ?? null,
      daily_token_cap_per_base: row?.daily_token_cap_per_base ?? null,
      lease_ttl_seconds: row?.lease_ttl_seconds ?? null,
      cb_failures: row?.cb_failures ?? null,
      cb_window_ms: row?.cb_window_ms ?? null,
      cb_cooldown_ms: row?.cb_cooldown_ms ?? null,
    };
  }

  // Prompts (Sistema → Prompts): mesma permissão da IA. Monta o payload da UI a
  // partir do registro (defaults = código) + os valores efetivos (override ou
  // default) e marca quais categorias têm override gravado.
  const canPrompts = podeIa;
  let prompts: PromptCatUI[] = [];
  if (canPrompts) {
    const { data: rows } = await supabase.from("prompt_overrides").select("key");
    const comOverride = new Set((rows ?? []).map((r) => r.key));
    prompts = await Promise.all(
      PROMPT_CATEGORIES.map(async (cat) => ({
        key: cat.key,
        label: cat.label,
        description: cat.description,
        hasOverride: comOverride.has(cat.key),
        fields: cat.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type ?? ("text" as const),
          rows: f.rows ?? 4,
          hint: f.hint,
          min: f.min,
          max: f.max,
          step: f.step,
          def: String(f.default),
        })),
        values: await resolveCategory(cat.key),
      })),
    );
  }

  // Acesso à web dos assistentes (RLS exige ai.configure; sem ela, cai no padrão).
  const { data: webRow } = await supabase
    .from("web_fetch_settings")
    .select("authoring_enabled, reader_enabled, allowlist")
    .eq("id", true)
    .maybeSingle();
  const webAccess: WebAccessData = webRow
    ? { authoring: webRow.authoring_enabled, reader: webRow.reader_enabled, allowlist: webRow.allowlist ?? [] }
    : { authoring: true, reader: false, allowlist: [] };

  const emailRow: EmailRow = email
    ? {
        transport: email.transport,
        from_name: email.from_name,
        from_email: email.from_email,
        smtp_host: email.smtp_host,
        smtp_port: email.smtp_port,
        smtp_user: email.smtp_user,
        smtp_secure: email.smtp_secure,
      }
    : {
        transport: "off",
        from_name: "Base de Conhecimento",
        from_email: null,
        smtp_host: null,
        smtp_port: null,
        smtp_user: null,
        smtp_secure: true,
      };

  // Bases ativas (seletor "Configuração por base" da IA).
  const { data: basesRows } = await createAdminClient().from("ai_bases").select("base_code").eq("active", true).order("base_code");
  const bases = (basesRows ?? []).map((b) => b.base_code).filter((c): c is string => !!c);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Sistema</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
        Parametrizações gerais do produto. Vale para todas as documentações.
      </p>

      <SystemManager
        providers={(providers ?? []) as ProviderRow[]}
        assignments={(assignments ?? []) as AssignmentRow[]}
        email={emailRow}
        temChave={segredos.providers}
        isOwner={nivel >= 100}
        temChaveMestra={hasEncryptionKey()}
        canBackup={canBackup}
        backups={(backups ?? []) as BackupRow[]}
        backupSettings={
          (backupSettings as BackupSettingsRow | null) ?? {
            auto_enabled: false, frequency: "daily", hour: 3, weekday: 0,
            include_storage: true, retention_days: 30, last_run_at: null,
            github_repo: null, github_branch: "main", github_path: "backups",
          }
        }
        githubTokenPresent={githubTokenPresent}
        canPrompts={canPrompts}
        prompts={prompts}
        webAccess={webAccess}
        bases={bases}
      />

      {infraData && <InfraPanel infra={infraData} temChaveMestra={hasEncryptionKey()} />}
    </div>
  );
}
