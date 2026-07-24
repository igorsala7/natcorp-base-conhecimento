"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

/**
 * Script anti-FOUC de tema. Aplica a classe/colorScheme ANTES da primeira
 * pintura, conforme localStorage("theme") ou a preferência do sistema —
 * espelhando a config do next-themes (attribute="class", defaultTheme="system",
 * enableSystem, enableColorScheme).
 */
const themeInitScript = `(function(){try{var e=localStorage.getItem("theme")||"system",t=e==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):e,d=document.documentElement;d.classList.remove("light","dark");d.classList.add(t);d.style.colorScheme=t}catch(e){}})();`;

/**
 * Injeta o script acima no HTML pelo SERVIDOR, via useServerInsertedHTML: o
 * <script> vai para o stream de SSR (fica no <head> e executa antes da pintura)
 * mas NÃO entra na árvore reconciliada no cliente. Por isso não dispara o aviso
 * do React 19.2 "Encountered a script tag while rendering React component" —
 * esse aviso só existe no renderer de cliente, e aqui o script nunca passa por
 * ele. Renderizar um <script> executável direto no JSX (client OU server
 * component) dispararia o aviso; este é o escape correto.
 *
 * O script interno do next-themes (também executável, dentro do ThemeProvider
 * client) é neutralizado à parte em src/components/providers.tsx.
 */
export function ThemeScript() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
  });
  return null;
}
