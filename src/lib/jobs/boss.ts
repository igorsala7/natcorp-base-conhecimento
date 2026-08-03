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
      await boss.createQueue("capture");
      await boss.createQueue("quality-scan");
      await boss.createQueue("embeddings-generate");
      await boss.createQueue("node-embedding");
      await boss.createQueue("ontology-scan");
      await boss.createQueue("ontology-import");
      await boss.createQueue("ontology-translate");
      await boss.createQueue("apex-ingest");
      await boss.createQueue("apex-docs");
      await boss.createQueue("db-ingest");
      await boss.createQueue("db-docs");
      await boss.createQueue("bulk-process");
      await boss.createQueue("analyze");
      await boss.createQueue("analyze-semantic");
      await boss.createQueue("backup");
      await boss.createQueue("backup-restore");
      await boss.createQueue("backup-reschedule");
      await boss.createQueue("backup-import");
      await boss.createQueue("backup-github-save");
      await boss.createQueue("backup-github-import");
      return boss;
    })();
  }
  return bossPromise;
}

export async function enqueueImport(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("import", { jobId });
}

/** Tamanho (pendentes) das filas operacionais — para /api/metrics. */
const FILAS_METRICAS = [
  "analyze",
  "node-embedding",
  "embeddings-generate",
  "bulk-process",
  "ontology-scan",
  "import",
  "capture",
] as const;
export async function filaMetrics(): Promise<Record<string, number>> {
  const boss = await getBoss();
  const out: Record<string, number> = {};
  await Promise.all(
    FILAS_METRICAS.map(async (q) => {
      try {
        out[q] = await boss.getQueueSize(q);
      } catch {
        out[q] = -1; // fila indisponível/não criada
      }
    }),
  );
  return out;
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

/** Captura de telas (Playwright) de uma URL — estado em capture_jobs. */
export async function enqueueCapture(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("capture", { jobId });
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

/**
 * Gera os embeddings de UM nó publicado, em segundo plano e com retentativa.
 * O "Publicar" faz só o rápido/confiável (status + versão + chunk léxico) e
 * delega os vetores ao worker — evita o timeout da server action ao publicar
 * artigo grande ou pasta inteira. Reprocessar o mesmo nó é idempotente.
 */
export async function enqueueNodeEmbedding(
  nodeId: string,
  spaceId: string,
  embeddedBy?: string | null,
): Promise<void> {
  const boss = await getBoss();
  await boss.send(
    "node-embedding",
    { nodeId, spaceId, embeddedBy: embeddedBy ?? null },
    { retryLimit: 3, retryDelay: 30, retryBackoff: true },
  );
}

/** Varredura de ontologia pela IA (Gemini lê os artigos e sugere termos). */
export async function enqueueOntologyScan(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("ontology-scan", { jobId });
}

/** Importação de termos por ARQUIVO: worker extrai palavras e gera sinônimos. */
export async function enqueueOntologyImport(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("ontology-import", { jobId });
}

/** Tradução da ontologia (bulk por espaço+idioma / auto-migração de novos termos). */
export async function enqueueOntologyTranslate(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("ontology-translate", { jobId });
}

/** Ingestão de uma aplicação APEX → dicionário de dados + ontologia. */
export async function enqueueApexIngest(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("apex-ingest", { jobId });
}

/** Documentação por página de uma aplicação APEX → artigos na base de conhecimento. */
export async function enqueueApexDocs(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("apex-docs", { jobId });
}

/** Ingestão de objetos de banco (tabelas/views/código) → dicionário de dados + ontologia. */
export async function enqueueDbIngest(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("db-ingest", { jobId });
}

/** Documentação técnica dos objetos de banco → artigos na base de conhecimento. */
export async function enqueueDbDocs(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("db-docs", { jobId });
}

/** Processamento em lote (publicar → embedding → ontologia) da seleção. */
export async function enqueueBulkProcess(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("bulk-process", { jobId });
}

/** Análise de dados em lote (map-reduce/OCR) — o worker processa e grava o
 *  resultado em analysis_jobs; o chamador faz poll ou recebe no chat. */
export async function enqueueAnalyze(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("analyze", { jobId }, { retryLimit: 2, retryDelay: 20, retryBackoff: true });
}

/** Análise SEMÂNTICA por linha (modo B do widget) — worker classifica em lotes e grava
 *  em widget_analysis_jobs; o widget faz poll e o resultado também é postado no chat. */
export async function enqueueSemanticAnalyze(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("analyze-semantic", { jobId }, { retryLimit: 2, retryDelay: 20, retryBackoff: true });
}

/** Backup do sistema (banco + arquivos) em segundo plano, com progresso. */
export async function enqueueBackup(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("backup", { jobId });
}

/** Restauração de um backup (destrutivo — substitui os dados atuais). */
export async function enqueueRestore(jobId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("backup-restore", { jobId });
}

/** Pede ao worker para reler `backup_settings` e reprogramar o backup automático. */
export async function enqueueBackupReschedule(): Promise<void> {
  const boss = await getBoss();
  await boss.send("backup-reschedule", {});
}

/** Importa (desempacota) um .zip de backup enviado para o bucket. */
export async function enqueueBackupImport(jobId: string, incomingPath: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("backup-import", { jobId, incomingPath });
}

/** Envia um backup existente para o GitHub. */
export async function enqueueGithubSave(jobId: string, sourceBackupId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("backup-github-save", { jobId, sourceBackupId });
}

/** Traz um backup do GitHub para a lista (depois o usuário restaura). */
export async function enqueueGithubImport(jobId: string, filePath?: string): Promise<void> {
  const boss = await getBoss();
  await boss.send("backup-github-import", { jobId, filePath });
}
