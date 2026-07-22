import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStudioSession } from "../actions";
import { listSpaceFolders } from "../../conteudo/space-actions";
import { listSnippets } from "../../conteudo/template-actions";
import { Studio } from "./studio";

export const metadata: Metadata = { title: "Estúdio IA" };

export default async function EstudioSessaoPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const sessao = await getStudioSession(sessionId);
  if (!sessao) redirect("/admin/estudio");

  const [folders, snippets] = await Promise.all([
    listSpaceFolders(sessao.spaceId),
    listSnippets(sessao.spaceId),
  ]);

  return <Studio sessao={sessao} folders={folders} snippets={snippets} />;
}
