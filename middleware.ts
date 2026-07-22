import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveCustomDomain } from "@/lib/portal/custom-domain";

export async function middleware(request: NextRequest) {
  // Domínio próprio de documentação: reescreve para /docs/<slug>/… ANTES da
  // sessão — portal público não depende de cookie de sessão.
  const custom = await resolveCustomDomain(request);
  if (custom) return custom;

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas, exceto assets estáticos e imagens.
     * O refresh de sessão do Supabase precisa acontecer em toda navegação.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
