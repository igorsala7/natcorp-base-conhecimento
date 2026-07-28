import { NextResponse } from "next/server";

// Sempre dinâmico e sem cache — é o alvo do healthcheck do container/orquestrador.
export const dynamic = "force-dynamic";

/** GET /api/health — liveness simples (200 = processo web de pé). */
export function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
