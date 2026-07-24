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
      await boss.createQueue("quality-scan");
      await boss.createQueue("embeddings-generate");
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

/** Varredura de qualidade/SEO de uma documentação (painel Otimizar em massa). */
export async function enqueueQualityScan(spaceId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("quality-scan", { spaceId });
}

/** Geração de embeddings em segundo plano (com progresso via embedding_jobs). */
export async function enqueueEmbeddings(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("embeddings-generate", { jobId });
}
