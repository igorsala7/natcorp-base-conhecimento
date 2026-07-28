import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionReview, listAuthorSpaces } from "../../sistema/extension-actions";
import { SessionReview } from "./session-review";

export const metadata: Metadata = { title: "Revisar captura" };

export default async function ExtensionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await getSessionReview(id);
  if (!review) notFound();
  const spaces = await listAuthorSpaces();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SessionReview initial={review} spaces={spaces} />
    </div>
  );
}
