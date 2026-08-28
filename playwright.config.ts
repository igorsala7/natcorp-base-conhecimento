import { defineConfig, devices } from "@playwright/test";
import { config as carregarEnv } from "dotenv";

/**
 * O PLAYWRIGHT NÃO LÊ `.env` — O `next build` LÊ.
 *
 * Sem isto, o build assa o `basePath` vindo do `.env` e este arquivo não faz
 * ideia: `NEXT_PUBLIC_BASE_PATH` chega `undefined` no processo do Playwright, e
 * a URL de espera continua na raiz. Os dois lados precisam enxergar o MESMO
 * valor, senão o conserto abaixo não conserta nada.
 *
 * Precedência igual à do Next — ambiente do shell > `.env.local` > `.env`. O
 * `dotenv` não sobrescreve o que já existe em `process.env`, então basta
 * carregar do mais forte para o mais fraco. Na CI só existe o `.env`
 * (versionado); o `.env.local` é o override por máquina e nem sobe.
 */
carregarEnv({ path: ".env.local", quiet: true });
carregarEnv({ path: ".env", quiet: true });

/**
 * ESTA SUÍTE EXIGE O APP NA RAIZ, E O MOTIVO NÃO É PREGUIÇA.
 *
 * `NEXT_PUBLIC_BASE_PATH` faz o Next assar um prefixo em TODAS as rotas
 * (`/natcorp/ia` em produção, atrás do nginx — ver `next.config.ts`), e o `.env`
 * de produção é VERSIONADO: a CI e qualquer máquina sem `.env.local` o herdam.
 * Foi isso que quebrou o e2e por dez dias — o app servia
 * `/natcorp/ia/admin/login` e o Playwright pedia `/admin/login`, levando 404 por
 * 120 s antes de desistir com uma mensagem que culpava o servidor.
 *
 * PREFIXAR O `baseURL` NÃO RESOLVE, e essa é a parte que engana: `page.goto()`
 * com caminho ABSOLUTO descarta o caminho do baseURL. Com
 * `baseURL = http://localhost:3008/natcorp/ia`, um `goto("/admin/conteudo")`
 * resolve para `http://localhost:3008/admin/conteudo` — a raiz de novo. A
 * espera do webServer (URL absoluta) passa, os testes seguem indo para 404, e o
 * placar mente dizendo que o formulário sumiu.
 *
 * Então o e2e roda com o prefixo VAZIO, e a CI o zera explicitamente (ver
 * `ci.yml`). O guard abaixo existe para que uma configuração prefixada falhe
 * DIZENDO o que fazer, em vez de virar 404 disfarçado de teste quebrado.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
const origem = "http://localhost:3008";

if (basePath && !process.env.E2E_BASE_URL) {
  throw new Error(
    `NEXT_PUBLIC_BASE_PATH="${basePath}" — esta suíte navega por caminho absoluto ` +
      `(page.goto("/admin/login")) e só funciona com o app na raiz.\n` +
      `Rode assim:  NEXT_PUBLIC_BASE_PATH= npm run build && NEXT_PUBLIC_BASE_PATH= npm run test:e2e\n` +
      `(o build assa o prefixo, então zerar só no teste não basta)`,
  );
}

/** E2E dos fluxos críticos. Sobe o app real (`npm run start`) e testa no Chromium. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    // Sem prefixo: o guard acima garante que `basePath` está vazio aqui.
    baseURL: process.env.E2E_BASE_URL ?? origem,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: `${origem}/admin/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    /**
     * A SAÍDA DO SERVIDOR FICA VISÍVEL — foi ela que resolveu o caso.
     *
     * O padrão do Playwright é DESCARTAR o stdout do webServer. Sem isso, dez
     * dias de CI vermelha imprimiram uma única linha ("Timed out waiting
     * 120000ms from config.webServer") e nada mais, e três hipóteses razoáveis
     * — porta errada, Supabase placeholder travando o middleware, boot
     * bloqueado — foram levantadas e derrubadas sem que nenhuma fosse a certa.
     *
     * Ligado, o primeiro log já dizia tudo: "✓ Ready in 77ms". O servidor
     * estava perfeito, e o defeito era a URL de espera (ver `basePath` acima).
     *
     * Fica ligado. Custa nada e é a diferença entre uma falha que se lê e uma
     * que se adivinha.
     */
    stdout: "pipe",
    stderr: "pipe",
  },
});
