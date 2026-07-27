"use client";

import { useEffect, useRef } from "react";
import { readPortalIdentity } from "@/lib/portal/track-client";

/**
 * Registra o acesso do leitor a uma página do portal (documentação, diretório ou
 * artigo) — só quando há identidade de rastreio (`p_*` na URL ou salva na visita).
 * Dispara um beacon por página; não renderiza nada.
 */
export function PortalTracker({
  spaceSlug, nodeId, kind, title, path,
}: {
  spaceSlug: string;
  nodeId: string | null;
  kind: "home" | "folder" | "article";
  title: string;
  path: string;
}) {
  const jaEnviado = useRef<string | null>(null);

  useEffect(() => {
    const assinatura = `${kind}:${nodeId ?? ""}:${path}`;
    // Evita disparo duplo (Strict Mode) para a MESMA página; muda a cada navegação.
    if (jaEnviado.current === assinatura) return;

    const track = readPortalIdentity();
    if (!track) return; // sem identidade não há o que rastrear
    jaEnviado.current = assinatura;

    // Mesma sessão do Ask-AI, para conversa e acesso baterem.
    let sid = "";
    try {
      const chave = `kb.portal.sid.${spaceSlug}`;
      sid = localStorage.getItem(chave) ?? "";
      if (!sid) {
        sid = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(chave, sid);
      }
    } catch {
      /* storage indisponível */
    }

    try {
      void fetch("/api/portal/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          spaceSlug, nodeId, kind, title, path,
          ...(sid ? { sessionId: sid } : {}),
          track,
        }),
      }).catch(() => {});
    } catch {
      /* rede indisponível — acesso apenas não é registrado */
    }
  }, [spaceSlug, nodeId, kind, title, path]);

  return null;
}
