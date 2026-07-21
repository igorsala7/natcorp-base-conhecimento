import "server-only";
import PgBoss from "pg-boss";
import { parseDbConfig } from "./db-config";

/**
 * Singleton do pg-boss para enfileirar jobs a partir das Server Actions.
 * O processamento acontece no worker (worker/index.ts, `npm run worker`).
 */
let bossPromise: Promise<PgBoss> | null = null;

async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({ ...parseDbConfig(), schema: "pgboss" });
      await boss.start();
      await boss.createQueue("import");
      await boss.createQueue("import-improve");
      return boss;
    })();
  }
  return bossPromise;
}

export async function enqueueImport(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("import", { jobId });
}

/**
 * Melhoria de layout pós-importação: a IA reformata cada artigo criado.
 * Os ids vão no payload — o job de importação já está 'done' para a árvore,
 * e esta fase só toca os artigos listados.
 */
export async function enqueueImportImprove(jobId: string, nodeIds: string[]): Promise<void> {
  const boss = await getBoss();
  await boss.send("import-improve", { jobId, nodeIds });
}
