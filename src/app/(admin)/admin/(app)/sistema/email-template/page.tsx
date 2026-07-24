import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { EmailTemplateEditor } from "./email-template-editor";

export const metadata: Metadata = { title: "Template de e-mail" };

/**
 * Designer do template de e-mail (design de marca) da instalação. Usa o motor de
 * blocos do editor de artigos; a saída vira HTML seguro de e-mail. Configurar
 * e-mail exige `integrations.manage` (mesma porta da tela Sistema → E-mail).
 */
export default async function EmailTemplatePage() {
  if (!(await hasPermission("integrations.manage", null))) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("email_settings")
    .select("template, from_name")
    .maybeSingle();

  // spaceId só serve para uploads de imagem (logo do e-mail → bucket assets).
  const spaces = await listSpaces();

  return (
    <EmailTemplateEditor
      initialDoc={row?.template ?? null}
      spaceId={spaces[0]?.id ?? ""}
      remetente={row?.from_name || "Base de Conhecimento"}
    />
  );
}
