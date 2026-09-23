"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

/**
 * A GESTÃO DO CLIENTE É SEMPRE CLARA.
 *
 * A área roda em iFrame dentro do APEX, que é claro. Herdar o tema do sistema
 * operacional de quem abriu fazia a tela nascer escura dentro de uma página
 * clara — parece defeito, não preferência, e ninguém ali tem seletor de tema
 * para corrigir (a gestão não expõe um, de propósito: é uma tela embutida).
 *
 * ── Duas peças, porque o tema tem dois momentos ───────────────────────
 * 1. ESTE script, antes da primeira pintura. Sem ele haveria o flash escuro
 *    que o `ThemeScript` do RootLayout existe para evitar — ele roda primeiro
 *    e aplica o tema do sistema; este roda depois, no mesmo <head>, e corrige.
 * 2. `forcedTheme` no `Providers` (ver src/components/providers.tsx). Sem ele
 *    o next-themes reaplicaria o tema salvo/do sistema na HIDRATAÇÃO e a tela
 *    escureceria um segundo depois de aberta — pior que nascer escura.
 *
 * ── O que este script NÃO faz ─────────────────────────────────────────
 * Não toca em `localStorage`. A preferência da pessoa continua valendo em
 * qualquer outra área do produto; o que muda é só como ESTE documento pinta.
 */
const script = `(function(){try{var d=document.documentElement;d.classList.remove("dark");d.classList.add("light");d.style.colorScheme="light"}catch(e){}})();`;

export function TemaClaro() {
  const inserido = useRef(false);
  useServerInsertedHTML(() => {
    if (inserido.current) return null;
    inserido.current = true;
    // Mesma saída do ThemeScript: vai pelo stream do SSR e nunca entra na
    // árvore reconciliada no cliente, então o React 19.2 não reclama do
    // <script> ("Encountered a script tag while rendering React component").
    return <script dangerouslySetInnerHTML={{ __html: script }} />;
  });
  return null;
}
