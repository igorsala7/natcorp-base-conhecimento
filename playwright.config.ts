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
 * O APP NEM SEMPRE MORA NA RAIZ, E O E2E PRECISA SABER DISSO.
 *
 * `NEXT_PUBLIC_BASE_PATH` faz o Next assar um prefixo em todas as rotas
 * (`/natcorp/ia` em produção, atrás do nginx — ver `next.config.ts`). E o `.env`
 * de produção é VERSIONADO, então a CI e qualquer máquina de desenvolvimento o
 * herdam: o app sobe servindo `/natcorp/ia/admin/login`, e `/admin/login` na
 * raiz devolve 404.
 *
 * Foi isto que quebrou o e2e por dez dias. O servidor subia em 77 ms e ficava
 * perfeito; o Playwright é que esperava a URL errada e pedia um 404 durante
 * 120 s antes de desistir — com uma mensagem ("Timed out ... from
 * config.webServer") que aponta para o servidor, o lugar onde o defeito não
 * estava.
 *
 * Normalizado igual ao `next.config.ts`, para os dois não divergirem.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
const origem = "http://localhost:3008";

/** E2E dos fluxos críticos. Sobe o app real (`npm run start`) e testa no Chromium. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `${origem}${basePath}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: `${origem}${basePath}/admin/login`,
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
