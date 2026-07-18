import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { listReviewQueue } from "../conteudo/review-actions";
import { ReviewQueue } from "./review-queue";

export const metadata: Metadata = { title: "Revisão" };

export default async function RevisaoPage() {
  const [canApprove, canReject] = await Promise.all([
    hasPermission("review.approve"),
    hasPermission("review.reject"),
  ]);
  if (!canApprove && !canReject) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Revisão</h1>
        <p className="mt-2 text-text-muted">Você não tem permissão para revisar conteúdo.</p>
      </div>
    );
  }
  const items = await listReviewQueue();
  return <ReviewQueue items={items} canApprove={canApprove} canReject={canReject} />;
}
