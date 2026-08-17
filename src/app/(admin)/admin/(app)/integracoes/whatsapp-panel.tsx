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
import { Select } from "@/components/ui/select";

export type WhatsappSettings = {
  active: boolean;
  provider: "meta" | "evolution";
  evolution_url: string | null;
  evolution_instance: string | null;
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

type SecretsPresent = { app_secret: boolean; access_token: boolean; verify_token: boolean; identity: boolean };

function settingsVazio(): WhatsappSettings {
  return {
    active: false,
    provider: "meta",
    evolution_url: null,
    evolution_instance: null,
    phone_number_id: null,
    waba_id: null,
    business_account_id: null,
    unidentified_message: "Não consegui identificar seu cadastro por este número. Fale com o suporte.",
    identity_endpoint: null,
    identity_method: "GET",
    identity_auth_type: "none",
    identity_phone_param: "telefone",
    identity_phone_local: "query",
    identity_map: {},
  };
}

/** Wrapper multi-canal: seletor "Padrão × cliente". Cada base = um canal (conta
 *  Meta própria). O form remonta (key) ao trocar de base. */
export function WhatsappPanel({
  channels,
  secrets,
  bases,
  webhookUrl,
  temChaveMestra,
}: {
  channels: Record<string, WhatsappSettings>;
  secrets: Record<string, SecretsPresent>;
  bases: string[];
  webhookUrl: string;
  temChaveMestra: boolean;
}) {
  const [baseSel, setBaseSel] = useState("");
  const settings = channels[baseSel] ?? settingsVazio();
  const secretsPresent = secrets[baseSel] ?? { app_secret: false, access_token: false, verify_token: false, identity: false };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
        <span className="text-sm font-semibold text-text">Canal</span>
        <Select className={`${controlClass} h-9 w-auto`} value={baseSel} onChange={(v) => setBaseSel(v)}>
          <option value="">Padrão (fallback)</option>
          {bases.map((b) => (
            <option key={b} value={b}>{channels[b] ? b : `${b} — novo`}</option>
          ))}
        </Select>
        <span className="text-xs text-text-muted">
          {baseSel
            ? "Conta própria deste cliente (Meta ou Evolution) — roteada pelo número/instância que recebe."
            : "Canal padrão: usado quando o número não casa nenhum cliente."}
        </span>
      </div>
      <WhatsappForm key={baseSel} base={baseSel} settings={settings} secretsPresent={secretsPresent} webhookUrl={webhookUrl} temChaveMestra={temChaveMestra} />
    </div>
  );
}

function WhatsappForm({
  base,
  settings,
  secretsPresent,
  webhookUrl,
  temChaveMestra,
}: {
  base: string;
  settings: WhatsappSettings;
  secretsPresent: SecretsPresent;
  webhookUrl: string;
  temChaveMestra: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [active, setActive] = useState(settings.active);
  const [provider, setProvider] = useState<WhatsappSettings["provider"]>(settings.provider);
  const [evolutionUrl, setEvolutionUrl] = useState(settings.evolution_url ?? "");
  const [evolutionInstance, setEvolutionInstance] = useState(settings.evolution_instance ?? "");
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

  const isEvo = provider === "evolution";
  const evolutionWebhookUrl = webhookUrl.replace(/\/api\/whatsapp\/webhook$/, "/api/whatsapp/evolution/webhook");
  const shownWebhook = isEvo ? evolutionWebhookUrl : webhookUrl;

  function salvar() {
    startTransition(async () => {
      const r = await saveWhatsappConfig({
        base,
        active,
        provider,
        evolution_url: evolutionUrl,
        evolution_instance: evolutionInstance,
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
    navigator.clipboard?.writeText(shownWebhook).then(() => {
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
        <div className="flex items-start gap-2.5 rounded-lg border border-warning-line bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">APP_ENCRYPTION_KEY não configurada.</strong> Os tokens
            serão gravados em texto simples. Defina a chave-mestra e salve novamente para cifrá-los.
          </span>
        </div>
      )}

      {/* Provedor: Meta oficial ou Evolution (self-hosted) */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
        <span className="text-sm font-semibold text-text">Provedor</span>
        <Select
          className={`${controlClass} h-9 w-auto`}
          value={provider}
          onChange={(v) => setProvider(v as WhatsappSettings["provider"])}
        >
          <option value="meta">Meta — WhatsApp Cloud API (oficial)</option>
          <option value="evolution">Evolution API (self-hosted, não-oficial)</option>
        </Select>
        <span className="text-xs text-text-muted">
          {isEvo
            ? "Conecta seu número por QR code no servidor Evolution — sem aprovação da Meta."
            : "Número aprovado na Meta (WhatsApp Business Platform)."}
        </span>
      </div>

      {/* Webhook para colar no provedor */}
      <div className="rounded-lg border border-border bg-surface-2/40 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {isEvo ? "Webhook (configure na instância do Evolution)" : "Webhook (cole no app da Meta)"}
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1.5 text-xs">{shownWebhook}</code>
          <Button size="sm" variant="secondary" onClick={copiar}>
            {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {isEvo ? (
            <>
              Aponte o webhook da instância para esta URL com o evento <code>messages.upsert</code>. Para
              autenticar, configure o header <code>apikey</code> igual à API Key da instância.
            </>
          ) : (
            <>
              Use o mesmo <strong>Token de verificação</strong> abaixo no campo &quot;Verify token&quot; da Meta.
            </>
          )}
        </p>
      </div>

      {isEvo ? (
        /* Conta Evolution */
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Servidor Evolution</h3>
            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
              Canal ativo
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="URL do servidor" htmlFor="wa_evo_url" hint="Ex.: https://evolution.suaempresa.com">
              <input id="wa_evo_url" className={controlClass} value={evolutionUrl} onChange={(e) => setEvolutionUrl(e.target.value)} placeholder="https://evolution.suaempresa.com" />
            </Field>
            <Field label="Instância" htmlFor="wa_evo_inst" hint="Nome da instância pareada (QR code).">
              <input id="wa_evo_inst" className={controlClass} value={evolutionInstance} onChange={(e) => setEvolutionInstance(e.target.value)} placeholder="minha-instancia" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {secretInput("API Key (apikey da instância)", secretsPresent.access_token, accessToken, setAccessToken, "wa_evo_key")}
          </div>
          <Field className="mt-3" label="Mensagem para telefone não identificado" htmlFor="wa_unid">
            <textarea id="wa_unid" rows={2} className={controlClass} value={unidentified} onChange={(e) => setUnidentified(e.target.value)} />
          </Field>
        </section>
      ) : (
        /* Conta Meta */
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
      )}

      {/* API de identificação */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-text">API de identificação (telefone → identidade + base)</h3>
        <div className="grid grid-cols-[1fr_7rem_9rem] gap-3">
          <Field label="Endpoint" htmlFor="wa_ep">
            <input id="wa_ep" className={controlClass} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://sua-api/identificar" />
          </Field>
          <Field label="Método" htmlFor="wa_m">
            <Select id="wa_m" value={method} onChange={(v) => setMethod(v)}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Autenticação" htmlFor="wa_at">
            <Select id="wa_at" value={authType} onChange={(v) => setAuthType(v as AuthType)}>
              {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Parâmetro do telefone" htmlFor="wa_pp" hint="Nome do parâmetro que recebe o número.">
            <input id="wa_pp" className={controlClass} value={phoneParam} onChange={(e) => setPhoneParam(e.target.value)} />
          </Field>
          <Field label="Onde vai o telefone" htmlFor="wa_pl">
            <Select id="wa_pl" value={phoneLocal} onChange={(v) => setPhoneLocal(v)}>
              {LOCAIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
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
