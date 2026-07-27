import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/permissions";
import { packBackup } from "@/lib/backup/engine";

export const runtime = "nodejs";

/**
 * GET /api/admin/backup/<id>/download — empacota o backup num único .zip e o
 * entrega para download. Exige `system.backup`. Backups grandes (com arquivos)
 * podem demorar — o zip é montado sob demanda a partir do bucket.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission("system.backup", null))) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("backup_jobs")
    .select("kind, status, storage_path, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!job || !job.storage_path || job.kind === "restore" || job.status !== "done") {
    return Response.json({ error: "Backup indisponível." }, { status: 404 });
  }

  const zip = await packBackup(createAdminClient(), job.storage_path);
  const dia = String(job.created_at ?? "").slice(0, 10);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="backup-${dia}-${id.slice(0, 8)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
