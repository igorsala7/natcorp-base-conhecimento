import type { NextConfig } from "next";

/**
 * Caminho público quando o app NÃO fica na raiz do domínio — a Natcorp serve em
 * `https://www.natcorpbr.com.br/natcorp/ia`, atrás de um nginx. O Next então gera
 * links, rotas e assets já com o prefixo; sem isso o navegador pede `/_next/...`
 * na raiz do domínio e leva 404.
 *
 * Vazio (padrão) = app na raiz, que é o caso em desenvolvimento.
 * IMPORTANTE: o nginx precisa repassar o caminho COMPLETO (proxy_pass sem barra
 * no fim). Ver DEPLOY.md.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
  // Builds de VERIFICAÇÃO (CI local, agente) podem apontar para outro
  // diretório: `NEXT_DIST_DIR=.next-verify npm run build`. Sem isso, um
  // `next build` rodado enquanto o `next dev` está de pé sobrescreve o
  // `.next` em uso e mistura chunks — a página passa a hidratar com bundle
  // antigo contra HTML novo (erro real que aconteceu).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // O Playwright (usado no fallback de scraping para sites com proteção anti-bot,
  // ver `capture/browser.ts`) é nativo e pesado — nunca deve ser empacotado pelo
  // bundler das Server Actions; carrega do node_modules em runtime.
  // Geradores de arquivo (relatórios do chat: Excel/Word/PowerPoint) são CJS
  // pesados que referenciam módulos nativos — carregam do node_modules em
  // runtime, sem passar pelo empacotador (senão o import dinâmico quebra).
  serverExternalPackages: ["playwright", "playwright-core", "exceljs", "docx", "pptxgenjs", "@resvg/resvg-js"],
  // Expor o localhost por um túnel (Cloudflare) para outra pessoa testar: o
  // navegador manda Origin = xxx.trycloudflare.com, que NÃO bate com o Host, e
  // o Next recusa as Server Actions por CSRF — resultado: vários botões do
  // portal "não fazem nada". Liberar o domínio do túnel resolve. (Em produção,
  // com domínio próprio, Origin == Host e nada disto é necessário.)
  allowedDevOrigins: ["*.trycloudflare.com"],
  typescript: {
    // Falhas de tipo quebram o build (regra da spec: tipos são fonte da verdade).
    ignoreBuildErrors: false,
  },
  images: {
    // Imagens de tamanho fixo do Storage do Supabase passam por next/image.
    // (Imagens de conteúdo, de dimensão desconhecida, seguem como <img> lazy.)
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  experimental: {
    // Origens confiáveis para Server Actions (checagem anti-CSRF do Next). O
    // curinga cobre os subdomínios aleatórios do túnel rápido do Cloudflare.
    serverActions: {
      // Em produção atrás de proxy, o Origin é o domínio público. Sem ele na lista,
      // o Next recusa as Server Actions por CSRF e os botões do admin "não fazem nada".
      allowedOrigins: [
        "localhost:3008",
        "*.trycloudflare.com",
        ...(process.env.NEXT_PUBLIC_SITE_URL ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).host] : []),
      ],
      /**
       * O padrão é 1 MB, e ele derrubava a ingestão do APEX.
       *
       * O metadado de uma aplicação inteira — objetos, tabelas, campos e labels —
       * passa de 1 MB com folga. Estourado o limite, o Next não devolve erro de
       * validação: devolve uma resposta que o cliente não sabe ler, e o console
       * mostra "An unexpected response was received from the server". Do lado de
       * quem usa, a tela simplesmente quebra, sem dizer que o problema era
       * TAMANHO — o diagnóstico menos provável de alguém adivinhar.
       *
       * 8 MB cobre o metadado de aplicação grande. Acima disso o caminho certo é
       * arquivo em Storage e job, não Server Action: manter o corpo pequeno é o
       * que evita segurar um worker de Next com megabytes na memória.
       */
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        // Páginas de INCORPORAÇÃO (iframe em outros sites): NÃO podem levar
        // X-Frame-Options; `frame-ancestors *` libera o embed em qualquer host.
        // Mantém noindex e nosniff. Só serve conteúdo público (a rota barra o resto).
        source: "/embed/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // O widget roda DENTRO do sistema do cliente e é atualizado com o deploy.
        // Sem cabeçalho explícito, navegador e proxy guardam a versão antiga por
        // tempo indeterminado — e o bug "que não foi corrigido" era só cache velho.
        // `no-cache` NÃO desliga o cache: obriga a REVALIDAR (304 quando não mudou).
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, no-cache, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Tudo, MENOS o widget e o /embed: ambos rodam DENTRO do site do
        // cliente, então não podem levar frame-ancestors/X-Frame-Options.
        source: "/((?!widget\\.js|embed/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Sistema NÃO indexável — reforça robots.txt + a meta `robots` em
          // qualquer resposta (inclui sitemap.xml, OG image, API). Google e Bing
          // honram este cabeçalho.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // Destino dos relatórios (Reporting API v1, usada pelo Chrome). O
          // Safari/Firefox usam o `report-uri` da própria política, abaixo.
          { key: "Reporting-Endpoints", value: `csp="${basePath}/api/csp-report"` },
          {
            // AINDA report-only: uma CSP de bloqueio HOJE quebraria o GA4 do
            // portal (googletagmanager) e TODOS os iframes — YouTube, Vimeo,
            // Figma, Maps, Loom — porque `frame-src` não está declarado e cai
            // no `default-src 'self'`.
            //
            // A primeira versão disto dizia que o console do navegador seria o
            // consumidor. Não era: sem destino de relatório, o navegador ignora
            // a política inteira ("the policy will have no effect") e a medição
            // nunca aconteceu. Daí o `report-uri`/`report-to`.
            //
            // ANTES DE LIGAR O BLOQUEIO, com base no que o log `[csp]` mostrar:
            //   · frame-src com os provedores de vídeo/embed em uso;
            //   · script-src/connect-src com os hosts do GA4, se o portal usar.
            // `frame-ancestors` NÃO entra aqui: é ignorado em report-only (o
            // navegador reclama), e o X-Frame-Options acima já o garante nestas
            // mesmas rotas.
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "base-uri 'self'",
              "form-action 'self'",
              `report-uri ${basePath}/api/csp-report`,
              "report-to csp",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
