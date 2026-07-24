import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { emailEnabled, sendEmail } from "@/lib/email/send";
import { loadEmailWrapper } from "@/lib/email/template";
import { frequenciaDue } from "./rules";

/**
 * Digests de novidades por documentação (padrão HubSpot):
 * - instant: a cada tick do cron, o que foi publicado desde o último envio;
 * - daily:   uma vez por dia (12h UTC ≈ 9h no Brasil);
 * - weekly:  segunda-feira, no mesmo horário.
 *
 * A PRIMEIRA execução de cada (espaço, frequência) só grava a linha-base em
 * subscription_runs e não envia nada — sem isso, ligar a região despejaria o
 * histórico inteiro na caixa dos primeiros inscritos.
 */
type Db = SupabaseClient<Database>;

type Artigo = { id: string; title: string; description: string | null; caminho: string };

function htmlDigest(
  spaceName: string,
  artigos: Artigo[],
  siteUrl: string,
  spaceSlug: string,
  token: string,
): { html: string; text: string } {
  const itens = artigos
    .map(
      (a) => `<li style="margin:0 0 12px">
  <a href="${siteUrl}/docs/${a.caminho}" style="font-weight:600">${a.title}</a>
  ${a.description ? `<br><span style="color:#555;font-size:13px">${a.description}</span>` : ""}
</li>`,
    )
    .join("\n");
  const html = `<p>Novidades na documentação <strong>${spaceName}</strong>:</p>
<ul style="padding-left:18px">${itens}</ul>
<p style="color:#888;font-size:12px">
  <a href="${siteUrl}/docs/${spaceSlug}">Abrir a documentação</a> ·
  <a href="${siteUrl}/api/portal/subscribe/unsubscribe?token=${token}">Cancelar inscrição</a>
</p>`;
  const text =
    `Novidades em ${spaceName}:\n` +
    artigos.map((a) => `- ${a.title}: ${siteUrl}/docs/${a.caminho}`).join("\n") +
    `\n\nCancelar: ${siteUrl}/api/portal/subscribe/unsubscribe?token=`;
  return { html, text };
}

export async function processDigests(db: Db, siteUrl: string): Promise<{ enviados: number }> {
  if (!(await emailEnabled())) return { enviados: 0 };
  const wrap = await loadEmailWrapper(); // template de marca, carregado 1× para todos
  const agora = new Date();
  let enviados = 0;

  const [{ data: spaces }, { data: runs }] = await Promise.all([
    db.from("spaces").select("id, slug, name").eq("visibility", "public"),
    db.from("subscription_runs").select("space_id, frequency, last_run_at"),
  ]);
  const runPor = new Map((runs ?? []).map((r) => [`${r.space_id}:${r.frequency}`, r.last_run_at]));

  for (const space of spaces ?? []) {
    for (const freq of ["instant", "daily", "weekly"]) {
      const lastRun = runPor.get(`${space.id}:${freq}`) ?? null;
      if (!frequenciaDue(freq, agora, lastRun)) continue;

      if (!lastRun) {
        // Linha-base: daqui em diante conta como novidade.
        await db
          .from("subscription_runs")
          .upsert(
            { space_id: space.id, frequency: freq, last_run_at: agora.toISOString() },
            { onConflict: "space_id,frequency" },
          );
        continue;
      }

      const { data: novos } = await db
        .from("nodes")
        .select("id, title, description, published_at")
        .eq("space_id", space.id)
        .eq("type", "article")
        .eq("status", "published")
        .is("deleted_at", null)
        .gt("published_at", lastRun)
        .order("published_at", { ascending: false })
        .limit(20);
      if (!novos?.length) {
        // daily/weekly avançam a base mesmo sem novidade (senão o gate de
        // idade nunca reabre); instant só avança quando envia.
        if (freq !== "instant") {
          await db
            .from("subscription_runs")
            .update({ last_run_at: agora.toISOString() })
            .eq("space_id", space.id)
            .eq("frequency", freq);
        }
        continue;
      }

      // Caminho público de cada artigo (subindo pelos pais).
      const { data: todos } = await db
        .from("nodes")
        .select("id, parent_id, slug")
        .eq("space_id", space.id)
        .is("deleted_at", null);
      const porId = new Map((todos ?? []).map((n) => [n.id, n]));
      const caminho = (id: string): string => {
        const partes: string[] = [];
        let atual = porId.get(id);
        let guarda = 0;
        while (atual && guarda++ < 50) {
          partes.unshift(atual.slug);
          atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
        }
        return `${space.slug}/${partes.join("/")}`;
      };
      const artigos: Artigo[] = novos.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        caminho: caminho(n.id),
      }));

      const { data: subs } = await db
        .from("subscriptions")
        .select("email, token")
        .eq("space_id", space.id)
        .eq("frequency", freq)
        .not("confirmed_at", "is", null)
        .is("unsubscribed_at", null);

      for (const sub of subs ?? []) {
        const corpo = htmlDigest(space.name, artigos, siteUrl, space.slug, sub.token);
        const r = await sendEmail({
          to: sub.email,
          subject:
            freq === "instant"
              ? `Novo na documentação ${space.name}: ${artigos[0]!.title}`
              : `Novidades da documentação ${space.name}`,
          html: wrap(corpo.html),
          text: corpo.text,
        });
        if (r.ok) enviados += 1;
      }

      await db
        .from("subscription_runs")
        .update({ last_run_at: agora.toISOString() })
        .eq("space_id", space.id)
        .eq("frequency", freq);
    }
  }
  return { enviados };
}
