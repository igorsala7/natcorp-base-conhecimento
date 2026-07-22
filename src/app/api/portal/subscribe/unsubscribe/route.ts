import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/** Descadastro em um clique (link presente em todo digest). */
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const db = createAdminClient();
  const { data: sub } = token
    ? await db
        .from("subscriptions")
        .select("id, spaces(slug)")
        .eq("token", token)
        .maybeSingle()
    : { data: null };
  if (!sub) {
    return new Response("Link inválido.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  await db
    .from("subscriptions")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", sub.id);
  const slug = (sub.spaces as unknown as { slug: string } | null)?.slug;
  redirect(slug ? `/docs/${slug}?desinscrito=1` : "/");
}
