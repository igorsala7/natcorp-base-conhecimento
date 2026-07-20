import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryDecryptSecret } from "@/lib/crypto/secrets";

/**
 * Envio de e-mail do sistema — Brevo (API REST) ou SMTP genérico.
 *
 * **Nunca lança.** Um convite não pode falhar porque o e-mail caiu: a ação que
 * chama isto continua funcionando e o link segue disponível na tela. O
 * resultado diz o que houve para quem quiser mostrar um aviso.
 *
 * Os segredos vêm de `email_secrets`, tabela sem grant para `authenticated` —
 * só o service-role alcança.
 */

export type EmailResult =
  | { ok: true; via: "brevo" | "smtp" }
  | { ok: false; reason: string };

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type Config = {
  transport: "off" | "brevo" | "smtp";
  from_name: string;
  from_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_secure: boolean;
  brevoKey: string | null;
  smtpPass: string | null;
};

async function carregarConfig(): Promise<Config | null> {
  try {
    const supabase = createAdminClient();
    const { data: cfg } = await supabase.from("email_settings").select("*").maybeSingle();
    if (!cfg) return null;
    const { data: sec } = await supabase.from("email_secrets").select("*").maybeSingle();
    return {
      transport: cfg.transport as Config["transport"],
      from_name: cfg.from_name,
      from_email: cfg.from_email,
      smtp_host: cfg.smtp_host,
      smtp_port: cfg.smtp_port,
      smtp_user: cfg.smtp_user,
      smtp_secure: cfg.smtp_secure,
      brevoKey: tryDecryptSecret(sec?.brevo_api_key_enc),
      smtpPass: tryDecryptSecret(sec?.smtp_pass_enc),
    };
  } catch {
    return null;
  }
}

/** Há transporte configurado? Use para decidir se mostra "enviamos por e-mail". */
export async function emailEnabled(): Promise<boolean> {
  const cfg = await carregarConfig();
  return !!cfg && cfg.transport !== "off" && !!cfg.from_email;
}

async function viaBrevo(cfg: Config, msg: EmailInput): Promise<EmailResult> {
  if (!cfg.brevoKey) return { ok: false, reason: "Chave da API do Brevo não configurada." };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": cfg.brevoKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: cfg.from_name, email: cfg.from_email },
      to: [{ email: msg.to }],
      subject: msg.subject,
      htmlContent: msg.html,
      ...(msg.text ? { textContent: msg.text } : {}),
    }),
  });
  if (!res.ok) {
    // O corpo do Brevo diz a causa real (remetente não verificado, cota…).
    const corpo = await res.text().catch(() => "");
    return { ok: false, reason: `Brevo respondeu ${res.status}: ${corpo.slice(0, 200)}` };
  }
  return { ok: true, via: "brevo" };
}

async function viaSmtp(cfg: Config, msg: EmailInput): Promise<EmailResult> {
  if (!cfg.smtp_host || !cfg.smtp_port) return { ok: false, reason: "SMTP incompleto (host/porta)." };
  // Import dinâmico: o nodemailer só é carregado por quem usa SMTP.
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    secure: cfg.smtp_secure,
    ...(cfg.smtp_user ? { auth: { user: cfg.smtp_user, pass: cfg.smtpPass ?? "" } } : {}),
  });
  await transporter.sendMail({
    from: `"${cfg.from_name}" <${cfg.from_email}>`,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    ...(msg.text ? { text: msg.text } : {}),
  });
  return { ok: true, via: "smtp" };
}

/** Envia. Nunca lança — devolve o motivo quando não dá. */
export async function sendEmail(msg: EmailInput): Promise<EmailResult> {
  const cfg = await carregarConfig();
  if (!cfg) return { ok: false, reason: "Configuração de e-mail indisponível." };
  if (cfg.transport === "off") return { ok: false, reason: "Envio de e-mail desligado." };
  if (!cfg.from_email) return { ok: false, reason: "Remetente (from_email) não configurado." };

  try {
    return cfg.transport === "brevo" ? await viaBrevo(cfg, msg) : await viaSmtp(cfg, msg);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
