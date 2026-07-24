"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Providers globais do cliente:
 *  - ThemeProvider (next-themes): dark/light por classe, respeita o sistema.
 *  - QueryClientProvider (TanStack Query): infra de dados no cliente (uso real
 *    a partir da Fase 1; montado aqui para não reescrever a árvore depois).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // O next-themes injeta AQUI (componente client) um <script> anti-FOUC
      // executável. No React 19.2 isso dispara "Encountered a script tag while
      // rendering React component". Marcamos esse script como bloco-de-dados
      // (type não-executável) — a exata exceção que o React checa
      // (isScriptDataBlock) — então o aviso some e o script vira inerte. O
      // anti-FOUC de verdade roda no <script> server-rendered do RootLayout
      // (ver src/app/layout.tsx).
      scriptProps={{ type: "application/json" }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
