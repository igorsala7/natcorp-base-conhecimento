import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionReview, listAuthorSpaces } from "../../sistema/extension-actions";
import { SessionReview } from "./session-review";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Revisar captura" };

export default async function ExtensionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await getSessionReview(id);
  if (!review) notFound();
  const spaces = await listAuthorSpaces();
  return (
    <PageShell
      titulo="Revisar captura"
      descricao="Os passos capturados pela extensão de navegador, antes de virarem artigo."
      largura="page"
    >
      <SessionReview initial={review} spaces={spaces} />
    </PageShell>
  );
}
