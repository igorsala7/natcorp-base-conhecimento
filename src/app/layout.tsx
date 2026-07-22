import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
