import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme-script";

/**
 * Inter — grotesca neutra, padrão de documentação enterprise. Servida pelo
 * próprio Next (auto-hospedada no build): sem requisição a terceiros em
 * runtime e sem texto invisível durante o carregamento.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

/* Mono da REFERÊNCIA (JetBrains Mono). A var mantém o nome antigo para não
   tocar em todos os consumidores. */
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Natcorp — Base de Conhecimento",
    template: "%s · Natcorp",
  },
  description: "Plataforma de base de conhecimento da Natcorp.",
  // Sistema NÃO rastreável por buscadores. Herdado por TODAS as páginas (as que
  // definem seu próprio metadata não sobrescrevem `robots`). Ver também
  // src/app/robots.ts e o cabeçalho X-Robots-Tag em next.config.ts.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      // Variáveis de fonte expostas para o Tailwind (--font-sans / --font-mono).
      className={`${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Anti-FOUC: injeta o script de tema no HTML pelo servidor, fora da
            árvore reconciliada no cliente (evita o aviso do React 19.2). */}
        <ThemeScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
