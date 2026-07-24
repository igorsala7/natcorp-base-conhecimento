import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToEmailHtml, injectEmailBody, wrapEmailDocument } from "@/lib/blocks/email-html";

/**
 * Aplica o template de e-mail (design de marca) ao corpo de cada e-mail.
 *
 * `loadEmailWrapper` lê `email_settings.template` UMA vez e devolve uma função
 * que, para cada corpo, injeta os tokens e embrulha no documento. Assim o digest
 * (N inscritos) carrega o template só uma vez. Sem template salvo → shell mínimo
 * limpo (melhora até os e-mails atuais; nada de regressão).
 *
 * Tokens no texto do template: {{conteudo}} (o corpo), {{remetente}} (from_name),
 * {{ano}} (ano atual).
 */

export async function loadEmailWrapper(): Promise<(bodyHtml: string) => string> {
  let templateHtml: string | null = null;
  let remetente = "Base de Conhecimento";
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("email_settings").select("template, from_name").maybeSingle();
    if (data?.from_name) remetente = data.from_name;
    if (data?.template) {
      const { blocks } = normalizeDoc(data.template);
      if (blocks.length) templateHtml = blocksToEmailHtml(blocks);
    }
  } catch {
    // silencioso: cai no shell mínimo
  }
  const ano = String(new Date().getFullYear());

  return (bodyHtml: string) => {
    if (!templateHtml) return wrapEmailDocument(bodyHtml); // shell mínimo
    return wrapEmailDocument(injectEmailBody(templateHtml, bodyHtml, { remetente, ano }));
  };
}
