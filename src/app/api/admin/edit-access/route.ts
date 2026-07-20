import type { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";
// Depende da sessão: nunca pode ser cacheado por engano.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/edit-access?space=<id> → `{ canEdit: boolean }`
 *
 * Existe para o portal público oferecer o atalho de edição a quem pode editar
 * **sem ler sessão no servidor do portal**. O portal só faz `fetch` daqui; a
 * autenticação acontece deste lado. Assim a rota `/docs` continua anônima,
 * cacheável e sem nenhum import do admin no bundle.
 *
 * Responde 200 com `{canEdit:false}` para anônimo em vez de 401: não há nada a
 * proteger na resposta (ela não revela conteúdo, só uma capacidade), e um 401
 * encheria o console de todo visitante deslogado.
 */
export async function GET(req: NextRequest) {
  const spaceId = req.nextUrl.searchParams.get("space");
  if (!spaceId) return Response.json({ canEdit: false });

  // `hasPermission` já resolve sessão ausente como "não pode".
  const canEdit = await hasPermission("content.edit", spaceId);
  return Response.json(
    { canEdit },
    { headers: { "Cache-Control": "no-store" } },
  );
}
