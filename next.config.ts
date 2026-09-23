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

/**
 * OS DOIS HOSTS DO SITE — `www` e sem `www` — para a checagem anti-CSRF.
 *
 * O Next recusa uma Server Action quando o `Origin` do navegador não bate com
 * o `x-forwarded-host` que o proxy manda, a não ser que o Origin esteja nesta
 * lista. Até 23/09 ela tinha só o host de `NEXT_PUBLIC_SITE_URL`, que é
 * `www.natcorpbr.com.br`.
 *
 * ── O que isso custou ────────────────────────────────────────────────
 * O iFrame do APEX foi movido de `www.natcorpbr.com.br` para
 * `natcorpbr.com.br` na semana de 16/09 (com `www` o navegador recusava o
 * framing). A partir dali TODOS os botões da área de gestão pararam — comprar
 * crédito, salvar regra de acesso, criar categoria de prompt — porque o Origin
 * passou a ser o host sem `www`, que não estava na lista. A falha não diz isso
 * a ninguém: o cliente vê "A aplicação não conseguiu carregar" e um digest.
 *
 * Medido em 23/09, reproduzindo os cabeçalhos do proxy contra o build local:
 *
 *   Origin sem-www + x-forwarded-host sem-www  → 200
 *   Origin sem-www + x-forwarded-host com-www  → 500
 *   Origin sem-www + sem x-forwarded-host      → 500
 *   Origin com-www + x-forwarded-host sem-www  → 200  (só porque www estava na lista)
 *
 * E a mensagem que o servidor registra, e que produção omite:
 *   "`x-forwarded-host` header with value `localhost:3008` does not match
 *    `origin` header with value `natcorpbr.com.br`. Aborting the action."
 *
 * ── Por que os DOIS, e não trocar a variável ─────────────────────────
 * `NEXT_PUBLIC_SITE_URL` é a URL canônica: alimenta sitemap, e-mail e OG.
 * Trocá-la para resolver um problema de allowlist mudaria o canônico de
 * tabela junto, o que é decisão de produto. Para o navegador, `www` e apex
 * são a mesma origem; aceitar as duas é o que descreve a realidade.
 */
function hostsDoSite(): string[] {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) return [];
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    // URL malformada na env não pode derrubar o build inteiro.
    return [];
  }
  return host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];
}

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
      allowedOrigins: ["localhost:3008", "*.trycloudflare.com", ...hostsDoSite()],
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
        // ÁREA DE GESTÃO — embutida num iFrame de uma página do APEX, no Painel
        // do Operador. Como /embed, não pode levar X-Frame-Options.
        //
        // Diferente de /embed, `frame-ancestors` NÃO é `*`: ali é documentação
        // pública, aqui há consumo, fatura e histórico de conversas. A lista sai
        // de GESTAO_FRAME_ANCESTORS (os hosts do APEX, separados por espaço).
        // Sem a variável fica `self`, e a página não abre em iFrame nenhum — a
        // falha fechada correta: melhor não abrir do que abrir em qualquer lugar.
        source: "/gestao/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Content-Security-Policy",
            // `'self'` entra SEMPRE, não só quando a variável está vazia: a
            // mesma página é embutida por /admin/gestao para o suporte interno,
            // que é mesma origem. Sem isto, configurar os hosts do APEX
            // derrubaria a tela de suporte — e o sintoma seria um iframe em
            // branco, sem erro de servidor, só uma linha no console.
            value:
              "frame-ancestors 'self'" +
              (process.env.GESTAO_FRAME_ANCESTORS?.trim()
                ? ` ${process.env.GESTAO_FRAME_ANCESTORS.trim()}`
                : ""),
          },
        ],
      },
      {
        // Tudo, MENOS o widget, o /embed e a /gestao: os três rodam DENTRO do
        // site do cliente, então não podem levar frame-ancestors/X-Frame-Options.
        source: "/((?!widget\\.js|embed/|gestao).*)",
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
