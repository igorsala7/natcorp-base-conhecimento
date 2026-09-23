"use client";

import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Rotas que NÃO seguem a preferência de tema da pessoa.
 *
 * `/gestao` é servida em iFrame dentro do APEX do cliente, que é claro. Deixar
 * o tema do sistema operacional decidir fazia a tela nascer escura dentro de
 * uma página clara — parece defeito, e ali não há seletor de tema para
 * corrigir. `usePathname` já vem sem o basePath, então a comparação vale igual
 * em produção (onde a URL real é /natcorp/ia/gestao).
 */
const SEMPRE_CLARO = ["/gestao"];

/**
 * Providers globais do cliente:
 *  - ThemeProvider (next-themes): dark/light por classe, respeita o sistema.
 *  - QueryClientProvider (TanStack Query): infra de dados no cliente (uso real
 *    a partir da Fase 1; montado aqui para não reescrever a árvore depois).
 */
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const claroForcado = SEMPRE_CLARO.some((p) => pathname === p || pathname.startsWith(`${p}/`));

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
      /**
       * Sem isto a gestão escureceria UM SEGUNDO DEPOIS de aberta: o script
       * anti-FOUC da área (src/components/gestao/tema-claro.tsx) acerta o
       * primeiro paint, e a hidratação do next-themes reaplicaria o tema
       * salvo/do sistema por cima. Piscar de claro para escuro é pior que
       * nascer escuro.
       *
       * `forcedTheme` não grava nada: a preferência da pessoa continua
       * valendo em todas as outras áreas.
       */
      forcedTheme={claroForcado ? "light" : undefined}
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
