import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Builds de VERIFICAÇÃO (CI local, agente) podem apontar para outro
  // diretório: `NEXT_DIST_DIR=.next-verify npm run build`. Sem isso, um
  // `next build` rodado enquanto o `next dev` está de pé sobrescreve o
  // `.next` em uso e mistura chunks — a página passa a hidratar com bundle
  // antigo contra HTML novo (erro real que aconteceu).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    // Falhas de tipo quebram o build (regra da spec: tipos são fonte da verdade).
    ignoreBuildErrors: false,
  },
  images: {
    // Imagens de tamanho fixo do Storage do Supabase passam por next/image.
    // (Imagens de conteúdo, de dimensão desconhecida, seguem como <img> lazy.)
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  async headers() {
    return [
      {
        // Tudo, MENOS o widget: ele existe para rodar dentro do site do
        // cliente, então não pode levar frame-ancestors/X-Frame-Options.
        source: "/((?!widget\\.js).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            // Report-only de propósito nesta primeira volta: o portal usa
            // dangerouslySetInnerHTML para o JSON-LD e o editor injeta estilo
            // inline, então uma CSP de bloqueio entra depois de medir o que
            // ela quebraria. Sem report-uri ainda — o console do navegador é
            // o consumidor por ora.
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
