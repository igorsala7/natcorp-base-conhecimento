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
      return boss;
    })();
  }
  return bossPromise;
}

export async function enqueueImport(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("import", { jobId });
}
