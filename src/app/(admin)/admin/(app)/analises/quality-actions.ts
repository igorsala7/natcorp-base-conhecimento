"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { enqueueQualityScan } from "@/lib/jobs/boss";

/**
 * Enfileira a varredura de qualidade/SEO da documentação (worker): auditoria
 * por artigo publicado + checagem de links externos com cache.
 */
export async function runQualityScan(
  spaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  try {
    await enqueueQualityScan(spaceId);
  } catch {
    return {
      ok: false,
      error: "Fila indisponível — o worker (npm run worker) está no ar?",
    };
  }
  await audit({ action: "content.quality_scan", entityType: "space", entityId: spaceId, spaceId });
  revalidatePath("/admin/analises");
  return { ok: true };
}
