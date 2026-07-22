import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/** Confirmação do double opt-in: token válido → assinatura ativa. */
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const db = createAdminClient();
  const { data: sub } = token
    ? await db
        .from("subscriptions")
        .select("id, space_id, spaces(slug)")
        .eq("token", token)
        .maybeSingle()
    : { data: null };
  if (!sub) {
    return new Response("Link de confirmação inválido ou expirado.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  await db
    .from("subscriptions")
    .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq("id", sub.id);
  const slug = (sub.spaces as unknown as { slug: string } | null)?.slug;
  redirect(slug ? `/docs/${slug}?inscrito=1` : "/");
}
