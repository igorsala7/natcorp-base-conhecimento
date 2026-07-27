import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { loadEmailWrapper } from "@/lib/email/template";
import { emailButton, emailParagraph } from "@/lib/blocks/email-html";
import { env } from "@/lib/env";

/** Escapa texto do usuário antes de entrar no HTML do e-mail (anti-injeção). */
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/**
 * Avisa por e-mail os RESPONSÁVEIS por aprovar um nó — os usuários com
 * `review.approve` cujo escopo (documentação + subárvore) cobre aquele nó,
 * resolvidos pela RPC `approvers_for_node`. Disparado quando um rascunho vai
 * para revisão.
 *
 * Fire-and-forget: NUNCA lança. Um e-mail que cai (ou transporte desligado) não
 * pode derrubar o "Enviar para revisão". Quem enviou é excluído da lista.
 */
export async function notifyApprovers(
  nodeId: string,
  submitterId: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: approvers } = await admin.rpc("approvers_for_node", { p_node_id: nodeId });
    const ids = [...new Set((approvers ?? []).map((a) => a.user_id))].filter(
      (id): id is string => !!id && id !== submitterId,
    );
    if (!ids.length) return;

    const { data: node } = await admin
      .from("nodes")
      .select("title, space_id")
      .eq("id", nodeId)
      .maybeSingle();
    const [{ data: profs }, { data: space }, { data: submitter }] = await Promise.all([
      admin.from("profiles").select("email, full_name").in("id", ids),
      node
        ? admin.from("spaces").select("name").eq("id", node.space_id).maybeSingle()
        : Promise.resolve({ data: null }),
      submitterId
        ? admin.from("profiles").select("full_name, email").eq("id", submitterId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const titulo = esc(node?.title ?? "um artigo");
    const docNome = esc(space?.name ?? "a documentação");
    const quem = esc(submitter?.full_name || submitter?.email || "Um editor");
    const link = `${env.NEXT_PUBLIC_SITE_URL}/admin/conteudo/${nodeId}`;

    const wrap = await loadEmailWrapper();
    const corpo =
      emailParagraph(
        `<strong>${quem}</strong> enviou "<strong>${titulo}</strong>" (em ${docNome}) para sua revisão e aprovação.`,
      ) +
      emailButton("Revisar e aprovar", link) +
      emailParagraph(`Se o botão não funcionar, acesse:<br>${link}`, { muted: true, small: true });

    for (const p of profs ?? []) {
      if (!p.email) continue;
      await sendEmail({
        to: p.email,
        subject: `Aprovação pendente: "${node?.title ?? "artigo"}"`,
        html: wrap(corpo),
        text: `${submitter?.full_name || "Um editor"} enviou "${node?.title ?? "um artigo"}" (${space?.name ?? "documentação"}) para sua aprovação. Acesse: ${link}`,
      });
    }
  } catch {
    // Nunca derruba o fluxo de revisão.
  }
}
