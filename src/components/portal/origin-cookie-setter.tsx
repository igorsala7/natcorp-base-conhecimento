"use client";

import { useEffect } from "react";
import { persistOriginCookie } from "@/app/(portal)/actions";

/**
 * Invisível. A página liberou o acesso pelo Referer mas o Server Component
 * não pode gravar cookie durante o render — este componente persiste o token
 * assinado via action no mount. Com o cookie, recarregar e abrir em nova aba
 * continuam funcionando pelos 7 dias do token (mesma TTL da senha).
 */
export function OriginCookieSetter({ spaceSlug, token }: { spaceSlug: string; token: string }) {
  useEffect(() => {
    void persistOriginCookie(spaceSlug, token);
  }, [spaceSlug, token]);
  return null;
}
