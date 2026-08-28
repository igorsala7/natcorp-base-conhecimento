import { defineConfig, devices } from "@playwright/test";

/** E2E dos fluxos críticos. Sobe o app real (`npm run start`) e testa no Chromium. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3008",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3008/admin/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    /**
     * SEM ISTO A FALHA NÃO É DIAGNOSTICÁVEL.
     *
     * O padrão do Playwright é DESCARTAR a saída do webServer. Quando o servidor
     * não sobe, a CI imprime exatamente uma linha — "Timed out waiting 120000ms
     * from config.webServer" — e nada do que o `next start` disse. O e2e falha
     * assim desde pelo menos 24/08 e o log não permite saber por quê: não é a
     * porta (`next start -p 3008` bate com a URL), não é o Supabase placeholder
     * (`placeholder.supabase.co` dá NXDOMAIN em 40 ms, falha rápido, não trava),
     * não há `instrumentation.ts` nem `output: standalone`.
     *
     * Piped, a próxima rodada mostra o que o servidor imprimiu antes de morrer
     * ou de não escutar. Isto é INSTRUMENTO, não conserto — o conserto vem
     * depois, quando houver o que ler.
     */
    stdout: "pipe",
    stderr: "pipe",
  },
});
