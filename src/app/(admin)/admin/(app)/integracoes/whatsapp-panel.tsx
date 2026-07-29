"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { AUTH_TYPES, CREDENTIAL_FIELDS, type AuthType } from "@/lib/integrations/credentials";
import { saveWhatsappConfig } from "./whatsapp-actions";

export type WhatsappSettings = {
  active: boolean;
  phone_number_id: string | null;
  waba_id: string | null;
  business_account_id: string | null;
  unidentified_message: string;
  identity_endpoint: string | null;
  identity_method: string;
  identity_auth_type: AuthType;
  identity_phone_param: string;
  identity_phone_local: string;
  identity_map: Record<string, string>;
};

/** Campos que a resposta da API de identificação deve alimentar. */
const MAP_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "base_code", label: "Base / cliente", hint: "Campo da resposta que identifica o cliente = um base_code cadastrado." },
  { key: "p_usuario", label: "Usuário" },
  { key: "p_empresa", label: "Cód. empresa" },
  { key: "p_matricula", label: "Matrícula" },
  { key: "p_perfil", label: "Perfil" },
  { key: "p_portal", label: "Portal" },
  { key: "nome", label: "Nome (saudação)" },
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const LOCAIS = [
  ["query", "Query string"],
  ["path", "Caminho (path)"],
  ["body", "Corpo (body)"],
  ["header", "Header"],
] as const;

export function WhatsappPanel({
  settings,
  secretsPresent,
  webhookUrl,
  temChaveMestra,
}: {
  settings: WhatsappSettings;
  secretsPresent: { app_secret: boolean; access_token: boolean; verify_token: boolean; identity: boolean };
  webhookUrl: string;
  temChaveMestra: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [active, setActive] = useState(settings.active);
  const [phoneNumberId, setPhoneNumberId] = useState(settings.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(settings.waba_id ?? "");
  const [businessId, setBusinessId] = useState(settings.business_account_id ?? "");
  const [unidentified, setUnidentified] = useState(settings.unidentified_message);
  const [endpoint, setEndpoint] = useState(settings.identity_endpoint ?? "");
  const [method, setMethod] = useState(settings.identity_method);
  const [authType, setAuthType] = useState<AuthType>(settings.identity_auth_type);
  const [phoneParam, setPhoneParam] = useState(settings.identity_phone_param);
  const [phoneLocal, setPhoneLocal] = useState(settings.identity_phone_local);
  const [map, setMap] = useState<Record<string, string>>(settings.identity_map ?? {});
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [idSecret, setIdSecret] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const idCampos = CREDENTIAL_FIELDS[authType];
  const idJaConfig = secretsPresent.identity && settings.identity_auth_type === authType;

  function salvar() {
    startTransition(async () => {
      const r = await saveWhatsappConfig({
        active,
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        business_account_id: businessId,
        unidentified_message: unidentified,
        identity_endpoint: endpoint,
        identity_method: method,
        identity_auth_type: authType,
        identity_phone_param: phoneParam,
        identity_phone_local: phoneLocal,
        identity_map: map,
        appSecret,
        accessToken,
        verifyToken,
        identitySecret: idSecret,
      });
      if (!r.ok) return toast.error(r.error);
      toast.success("Configuração do WhatsApp salva.");
      setAppSecret("");
      setAccessToken("");
      setVerifyToken("");
      setIdSecret({});
      router.refresh();
    });
  }

  function copiar() {
    navigator.clipboard?.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const secretInput = (label: string, present: boolean, value: string, onChange: (v: string) => void, id: string) => (
    <Field label={label} htmlFor={id} hint={present ? "Configurado. Deixe em branco para manter." : undefined}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="password"
          autoComplete="off"
          className={cn(controlClass, "font-mono")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={present ? "•••••••• (manter)" : undefined}
        />
        {present && <Badge tone="info">✓</Badge>}
      </div>
    </Field>
  );

  return (
    <div className="flex flex-col gap-5">
      {!temChaveMestra && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">APP_ENCRYPTION_KEY não configurada.</strong> Os tokens
            serão gravados em texto simples. Defina a chave-mestra e salve novamente para cifrá-los.
          </span>
        </div>
      )}

      {/* Webhook para colar no painel da Meta */}
      <div className="rounded-lg border border-border bg-surface-2/40 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Webhook (cole no app da Meta)</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1.5 text-xs">{webhookUrl}</code>
          <Button size="sm" variant="secondary" onClick={copiar}>
            {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Use o mesmo <strong>Token de verificação</strong> abaixo no campo &quot;Verify token&quot; da Meta.
        </p>
      </div>

      {/* Conta Meta */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Conta Meta (Cloud API)</h3>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Canal ativo
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone number ID" htmlFor="wa_pnid">
            <input id="wa_pnid" className={controlClass} value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
          </Field>
          <Field label="WABA ID" htmlFor="wa_waba">
            <input id="wa_waba" className={controlClass} value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
          </Field>
          <Field label="Business account ID" htmlFor="wa_biz">
            <input id="wa_biz" className={controlClass} value={businessId} onChange={(e) => setBusinessId(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {secretInput("App secret", secretsPresent.app_secret, appSecret, setAppSecret, "wa_app")}
          {secretInput("Access token", secretsPresent.access_token, accessToken, setAccessToken, "wa_tok")}
          {secretInput("Verify token", secretsPresent.verify_token, verifyToken, setVerifyToken, "wa_vf")}
        </div>
        <Field className="mt-3" label="Mensagem para telefone não identificado" htmlFor="wa_unid">
          <textarea id="wa_unid" rows={2} className={controlClass} value={unidentified} onChange={(e) => setUnidentified(e.target.value)} />
        </Field>
      </section>

      {/* API de identificação */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-text">API de identificação (telefone → identidade + base)</h3>
        <div className="grid grid-cols-[1fr_7rem_9rem] gap-3">
          <Field label="Endpoint" htmlFor="wa_ep">
            <input id="wa_ep" className={controlClass} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://sua-api/identificar" />
          </Field>
          <Field label="Método" htmlFor="wa_m">
            <select id="wa_m" className={controlClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Autenticação" htmlFor="wa_at">
            <select id="wa_at" className={controlClass} value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
              {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Parâmetro do telefone" htmlFor="wa_pp" hint="Nome do parâmetro que recebe o número.">
            <input id="wa_pp" className={controlClass} value={phoneParam} onChange={(e) => setPhoneParam(e.target.value)} />
          </Field>
          <Field label="Onde vai o telefone" htmlFor="wa_pl">
            <select id="wa_pl" className={controlClass} value={phoneLocal} onChange={(e) => setPhoneLocal(e.target.value)}>
              {LOCAIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        {idCampos.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Credencial da API</p>
            {idJaConfig && <p className="mb-2 text-xs text-text-muted">Já configurada. Deixe em branco para manter.</p>}
            <div className="grid grid-cols-2 gap-2.5">
              {idCampos.map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`wa_id_${f.key}`} hint={f.hint}>
                  <input
                    id={`wa_id_${f.key}`}
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    className={cn(controlClass, f.secret && "font-mono")}
                    value={idSecret[f.key] ?? ""}
                    onChange={(e) => setIdSecret((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={idJaConfig ? "•••••• (manter)" : undefined}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Mapa da resposta → nossos campos
          </p>
          <p className="mb-2 text-xs text-text-muted">
            Para cada campo, informe o <strong>nome do campo na resposta</strong> da API (use ponto para aninhado: <code>dados.matricula</code>).
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {MAP_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`wa_map_${f.key}`} hint={f.hint}>
                <input
                  id={`wa_map_${f.key}`}
                  className={controlClass}
                  value={map[f.key] ?? ""}
                  onChange={(e) => setMap((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder="campo na resposta"
                />
              </Field>
            ))}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button disabled={pending} onClick={salvar}>Salvar configuração</Button>
      </div>
    </div>
  );
}
