import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Falhas de tipo quebram o build (regra da spec: tipos são fonte da verdade).
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
