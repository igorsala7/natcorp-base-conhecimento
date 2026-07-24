import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { portalRateLimitOk } from "@/lib/portal/rate-limit";
import { emailEnabled, sendEmail } from "@/lib/email/send";
import { loadEmailWrapper } from "@/lib/email/template";
import { emailButton, emailParagraph } from "@/lib/blocks/email-html";
import { env } from "@/lib/env";

const bodySchema = z.object({
  spaceSlug: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  frequency: z.enum(["instant", "daily", "weekly"]),
});

/**
 * Inscrição em novidades da documentação (double opt-in): grava pendente e
 * envia o e-mail de confirmação com o token. Nada é enviado ao leitor até ele
 * confirmar. Chave pública + rate limit — o portal é anônimo.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await portalRateLimitOk("subscribe", 5))) {
    return Response.json({ ok: false, error: "Muitas tentativas. Aguarde um pouco." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const { spaceSlug, email, frequency } = parsed.data;

  const db = createAdminClient();
  const { data: space } = await db
    .from("spaces")
    .select("id, name")
    .eq("slug", spaceSlug)
    .eq("visibility", "public")
    .maybeSingle();
  if (!space) return Response.json({ ok: false, error: "Documentação não encontrada." }, { status: 404 });

  if (!(await emailEnabled())) {
    return Response.json(
      { ok: false, error: "O envio de e-mail não está configurado neste portal." },
      { status: 503 },
    );
  }

  // Reinscrição reaproveita a linha (unique space+email): volta a pendente.
  const { data: sub, error } = await db
    .from("subscriptions")
    .upsert(
      { space_id: space.id, email, frequency, unsubscribed_at: null },
      { onConflict: "space_id,email" },
    )
    .select("token, confirmed_at")
    .single();
  if (error || !sub) {
    return Response.json({ ok: false, error: "Falha ao registrar. Tente novamente." }, { status: 500 });
  }

  if (!sub.confirmed_at) {
    const confirmar = `${env.NEXT_PUBLIC_SITE_URL}/api/portal/subscribe/confirm?token=${sub.token}`;
    const wrap = await loadEmailWrapper();
    const corpo =
      emailParagraph(
        `Você pediu para receber novidades da documentação <strong>${space.name}</strong>. Confirme sua inscrição:`,
      ) +
      emailButton("Confirmar inscrição", confirmar) +
      emailParagraph("Se não foi você, ignore este e-mail — nada será enviado sem a confirmação.", {
        muted: true,
        small: true,
      });
    await sendEmail({
      to: email,
      subject: `Confirme sua inscrição — ${space.name}`,
      html: wrap(corpo),
      text: `Confirme sua inscrição em ${space.name}: ${confirmar}`,
    });
  }

  return Response.json({ ok: true, pending: !sub.confirmed_at });
}
