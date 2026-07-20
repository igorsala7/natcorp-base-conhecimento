import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { currentMaxLevel } from "@/lib/auth/roles";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import {
  SystemManager,
  type ProviderRow,
  type AssignmentRow,
  type EmailRow,
} from "./system-manager";
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

  const supabase = await createClient();
  const [{ data: providers }, { data: assignments }, { data: email }, segredos, nivel] =
    await Promise.all([
      supabase.from("ai_providers").select("id, name, kind, base_url, active").order("name"),
      supabase.from("ai_assignments").select("purpose, provider_id, model"),
      supabase.from("email_settings").select("*").maybeSingle(),
      secretsPresentes(),
      currentMaxLevel(null),
    ]);

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
      />
    </div>
  );
}
