import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { listReviewQueue } from "../conteudo/review-actions";
import { ReviewQueue } from "./review-queue";
import { SemPermissao } from "@/components/ui/sem-permissao";

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
  return <ReviewQueue items={items} canApprove={canApprove} canReject={canReject} />;
}
