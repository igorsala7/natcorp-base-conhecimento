import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Falhas de tipo quebram o build (regra da spec: tipos são fonte da verdade).
    ignoreBuildErrors: false,
  },
  images: {
    // Imagens de tamanho fixo do Storage do Supabase passam por next/image.
    // (Imagens de conteúdo, de dimensão desconhecida, seguem como <img> lazy.)
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
