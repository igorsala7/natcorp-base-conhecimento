import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { listReviewQueue } from "../conteudo/review-actions";
import { ReviewQueue } from "./review-queue";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Revisão" };

export default async function RevisaoPage() {
  const [canApprove, canReject] = await Promise.all([
    hasPermission("review.approve"),
    hasPermission("review.reject"),
  ]);
  if (!canApprove && !canReject) {
    return (
      <SemPermissao
        titulo="Revisão"
        oQue="revisar conteúdo"
        permissao="review.approve"
        papel="Revisor"
      />
    );
  }
  const items = await listReviewQueue();
  return (
    <PageShell
      titulo="Revisão"
      descricao="Artigos aguardando aprovação para publicar."
      largura="page"
    >
      <ReviewQueue items={items} canApprove={canApprove} canReject={canReject} />
    </PageShell>
  );
}
