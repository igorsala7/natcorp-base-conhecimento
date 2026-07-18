import { NextResponse } from "next/server";
import {
  PermissionError,
  requirePermission,
} from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";

/**
 * Endpoint de DEMONSTRAÇÃO da Fase 0.5 (a publicação real chega na Fase 1).
 * Existe para provar o DoD: mesmo chamando direto (curl/fetch), sem passar
 * pela UI, o servidor recusa quem não tem `content.publish`.
 *
 * Owner/Admin téc./Gestor → 200. Editor/Revisor/Leitor → 403.
 */
export async function POST() {
  try {
    const user = await requirePermission("content.publish");
    await audit({ action: "demo.publish", entityType: "demo" });
    return NextResponse.json({
      ok: true,
      message: "Publicação autorizada (demo).",
      user: user.email,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { ok: false, error: "Sem permissão para publicar." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 },
    );
  }
}
