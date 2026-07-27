import "server-only";
import { gzipSync, gunzipSync } from "node:zlib";
import { makeZip } from "@/lib/content/zip";
import { readZip } from "@/lib/backup/unzip";

/**
 * Motor de backup/restauração.
 *
 * Backup = dump lógico de TODAS as tabelas do schema `public` (embeddings
 * convertidos para texto; a coluna gerada `tsv` é ignorada e recalcula sozinha)
 * + os arquivos dos buckets de conteúdo. Tudo vai para o bucket privado
 * `backups`, em `<jobId>/db/<tabela>.json.gz`, `<jobId>/storage/<bucket>/<path>`
 * e `<jobId>/manifest.json`.
 *
 * Restauração = carrega o backup de volta. O banco é restaurado numa ÚNICA
 * transação com `session_replication_role = replica` (desliga gatilhos e a
 * checagem de FK durante a carga, como faz o `pg_restore`): trunca as tabelas e
 * reinsere os dados exatos. Se algo falhar, faz rollback — nada se perde.
 *
 * Usado pelo worker (que fornece a conexão `pg` crua e o client service-role).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgClient = { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any; // client service-role do Supabase (a API de Storage não é tipada aqui)
type OnProgress = (phase: string, pct: number) => void | Promise<void>;

export const BACKUP_BUCKET = "backups";
/** Buckets de conteúdo que entram no backup (não incluímos `imports`, efêmero, nem `backups`, ele mesmo). */
export const CONTENT_BUCKETS = ["assets", "avatars"] as const;
/** Tabelas operacionais/efêmeras que NÃO entram (evita corromper o próprio job de restore). */
const EXCLUDED_TABLES = new Set(["backup_jobs", "backup_settings", "rate_limits"]);
/** Casts necessários na reinserção por tipo de coluna. */
const CAST: Record<string, string> = { jsonb: "::jsonb", json: "::json", vector: "::vector", ltree: "::ltree" };

type ColMeta = { name: string; generated: boolean; udt: string };

async function publicTables(pg: PgClient): Promise<string[]> {
  const { rows } = await pg.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  return rows.map((r) => r.table_name as string).filter((t) => !EXCLUDED_TABLES.has(t));
}

async function columns(pg: PgClient, table: string): Promise<ColMeta[]> {
  const { rows } = await pg.query(
    `select column_name, is_generated, udt_name from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table],
  );
  return rows.map((r) => ({ name: r.column_name, generated: r.is_generated === "ALWAYS", udt: r.udt_name }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function encodeParam(value: any, udt: string): any {
  if (value === null || value === undefined) return null;
  if (udt === "jsonb" || udt === "json") return JSON.stringify(value);
  // vector/ltree chegam como texto; arrays (udt "_*") o node-pg formata sozinho.
  return value;
}

// ── Storage helpers ──────────────────────────────────────────────────────────
type StoredFile = { path: string; size: number };

async function listAll(supabase: Supa, bucket: string, prefix = ""): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000, offset, sortBy: { column: "name", order: "asc" },
    });
    if (error || !data || data.length === 0) break;
    for (const e of data) {
      const full = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null || e.id === undefined) out.push(...(await listAll(supabase, bucket, full))); // pasta
      else out.push({ path: full, size: Number(e.metadata?.size ?? 0) }); // arquivo
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return out;
}

async function download(supabase: Supa, bucket: string, path: string): Promise<Buffer | null> {
  const { data } = await supabase.storage.from(bucket).download(path);
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function put(supabase: Supa, path: string, bytes: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BACKUP_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Falha ao enviar ${path}: ${error.message}`);
}

/**
 * Copia um objeto entre buckets. Tenta a cópia SERVER-SIDE (sem trafegar bytes
 * pelo worker); se falhar (ex.: destino já existe, na restauração), cai para
 * baixar-e-reenviar com upsert.
 */
/** Executa `fn` sobre os itens com no máximo `limit` em paralelo. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

async function copyObject(supabase: Supa, fromBucket: string, fromPath: string, toBucket: string, toPath: string): Promise<void> {
  const { error } = await supabase.storage.from(fromBucket).copy(fromPath, toPath, { destinationBucket: toBucket });
  if (!error) return;
  const bytes = await download(supabase, fromBucket, fromPath);
  if (!bytes) return;
  await supabase.storage.from(toBucket).upload(toPath, bytes, { upsert: true });
}

/**
 * Empacota um backup (pasta `<id>/…` no bucket) num único `.zip` na memória —
 * para download e para envio ao GitHub. Nomes ficam relativos ao backup
 * (`db/…`, `storage/…`, `manifest.json`).
 */
export async function packBackup(supabase: Supa, storagePath: string): Promise<Uint8Array> {
  const files = await listAll(supabase, BACKUP_BUCKET, storagePath);
  const entries: { name: string; data: Uint8Array }[] = [];
  await mapLimit(files, 8, async (f) => {
    const bytes = await download(supabase, BACKUP_BUCKET, f.path);
    if (bytes) entries.push({ name: f.path.slice(storagePath.length + 1), data: new Uint8Array(bytes) });
  });
  return makeZip(entries);
}

/** Desempacota um `.zip` de backup (upload/GitHub) para a pasta `<destPath>/…`. */
export async function unpackBackup(
  supabase: Supa, zipBytes: Uint8Array, destPath: string,
): Promise<{ files: number; manifest: { db?: unknown[]; storage?: unknown[]; include_storage?: boolean } | null }> {
  const entries = readZip(zipBytes);
  if (!entries.some((e) => e.name === "manifest.json")) {
    throw new Error("Arquivo inválido: não parece um backup (sem manifest.json).");
  }
  let manifest: { db?: unknown[]; storage?: unknown[]; include_storage?: boolean } | null = null;
  await mapLimit(entries, 8, async (e) => {
    if (e.name === "manifest.json") {
      try { manifest = JSON.parse(Buffer.from(e.data).toString()); } catch { /* segue */ }
    }
    const ct = e.name.endsWith(".gz") ? "application/gzip"
      : e.name.endsWith(".json") ? "application/json" : "application/octet-stream";
    await put(supabase, `${destPath}/${e.name}`, Buffer.from(e.data), ct);
  });
  return { files: entries.length, manifest };
}

/** Apaga todos os arquivos de um backup (usado no excluir e na retenção). */
export async function deleteBackupObjects(supabase: Supa, storagePath: string): Promise<void> {
  const files = (await listAll(supabase, BACKUP_BUCKET, storagePath)).map((f) => f.path);
  for (let i = 0; i < files.length; i += 100) {
    await supabase.storage.from(BACKUP_BUCKET).remove(files.slice(i, i + 100));
  }
}

// ── Backup ───────────────────────────────────────────────────────────────────
export async function performBackup(opts: {
  pg: PgClient; supabase: Supa; jobId: string; includeStorage: boolean; onProgress?: OnProgress;
}): Promise<{ storagePath: string; tablesCount: number; rowsCount: number; filesCount: number; bytes: number }> {
  const { pg, supabase, jobId, includeStorage, onProgress } = opts;
  const base = jobId;
  const tables = await publicTables(pg);
  let rowsTotal = 0, bytesTotal = 0, filesTotal = 0;
  const dbManifest: { table: string; rows: number }[] = [];
  const dbShare = includeStorage ? 60 : 95;

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]!;
    const cols = (await columns(pg, t)).filter((c) => !c.generated);
    const selectExprs = cols.map((c) => (c.udt === "vector" ? `"${c.name}"::text as "${c.name}"` : `"${c.name}"`));
    const { rows } = await pg.query(`select ${selectExprs.join(", ")} from "public"."${t}"`);
    const gz = gzipSync(Buffer.from(JSON.stringify({ table: t, rows })));
    await put(supabase, `${base}/db/${t}.json.gz`, gz, "application/gzip");
    rowsTotal += rows.length; bytesTotal += gz.length;
    dbManifest.push({ table: t, rows: rows.length });
    await onProgress?.("banco", Math.round(((i + 1) / tables.length) * dbShare));
  }

  const storageManifest: { bucket: string; files: number }[] = [];
  if (includeStorage) {
    for (let b = 0; b < CONTENT_BUCKETS.length; b++) {
      const bucket = CONTENT_BUCKETS[b]!;
      const files = await listAll(supabase, bucket);
      await mapLimit(files, 8, async (f) => {
        await copyObject(supabase, bucket, f.path, BACKUP_BUCKET, `${base}/storage/${bucket}/${f.path}`);
        filesTotal++; bytesTotal += f.size;
      });
      storageManifest.push({ bucket, files: files.length });
      await onProgress?.("arquivos", 60 + Math.round(((b + 1) / CONTENT_BUCKETS.length) * 35));
    }
  }

  const manifest = {
    version: 1,
    created_at: new Date().toISOString(),
    include_storage: includeStorage,
    db: dbManifest,
    storage: storageManifest,
    bytes: bytesTotal,
  };
  await put(supabase, `${base}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)), "application/json");
  await onProgress?.("finalizando", 100);
  return { storagePath: base, tablesCount: tables.length, rowsCount: rowsTotal, filesCount: filesTotal, bytes: bytesTotal };
}

async function insertRows(pg: PgClient, table: string, cols: ColMeta[], rows: Record<string, unknown>[]): Promise<void> {
  const names = cols.map((c) => `"${c.name}"`).join(", ");
  const perBatch = Math.max(1, Math.floor(2000 / cols.length));
  for (let i = 0; i < rows.length; i += perBatch) {
    const batch = rows.slice(i, i + perBatch);
    const tuples: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    for (const row of batch) {
      const ph = cols.map((c) => {
        params.push(encodeParam(row[c.name], c.udt));
        return `$${params.length}${CAST[c.udt] ?? ""}`;
      });
      tuples.push(`(${ph.join(",")})`);
    }
    await pg.query(`insert into "public"."${table}" (${names}) values ${tuples.join(",")}`, params);
  }
}

// ── Restauração ────────────────────────────────────────────────────────────────
export async function performRestore(opts: {
  pg: PgClient; supabase: Supa; sourcePath: string; onProgress?: OnProgress;
}): Promise<{ tablesCount: number; rowsCount: number; filesCount: number }> {
  const { pg, supabase, sourcePath, onProgress } = opts;
  const manBytes = await download(supabase, BACKUP_BUCKET, `${sourcePath}/manifest.json`);
  if (!manBytes) throw new Error("manifest.json do backup não encontrado.");
  const manifest = JSON.parse(manBytes.toString()) as {
    include_storage: boolean;
    db: { table: string }[];
    storage: { bucket: string }[];
  };
  const tables = manifest.db.map((d) => d.table);
  let rowsTotal = 0, filesTotal = 0;

  // Banco: tudo em UMA transação. Rollback em qualquer erro → nada é perdido.
  await pg.query("begin");
  try {
    await pg.query("set session_replication_role = replica");
    const list = tables.map((t) => `"public"."${t}"`).join(", ");
    if (list) await pg.query(`truncate ${list} cascade`);
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]!;
      const gz = await download(supabase, BACKUP_BUCKET, `${sourcePath}/db/${t}.json.gz`);
      if (!gz) continue;
      const parsed = JSON.parse(gunzipSync(gz).toString()) as { rows: Record<string, unknown>[] };
      if (parsed.rows.length) {
        const cols = (await columns(pg, t)).filter((c) => !c.generated);
        await insertRows(pg, t, cols, parsed.rows);
        rowsTotal += parsed.rows.length;
      }
      await onProgress?.("restaurando (banco)", Math.round(((i + 1) / tables.length) * (manifest.include_storage ? 60 : 95)));
    }
    await pg.query("set session_replication_role = default");
    await pg.query("commit");
  } catch (e) {
    await pg.query("rollback").catch(() => {});
    throw e;
  }

  // Storage: fora da transação (não é transacional). Reenvia por cima (upsert).
  if (manifest.include_storage && manifest.storage?.length) {
    for (let b = 0; b < manifest.storage.length; b++) {
      const bucket = manifest.storage[b]!.bucket;
      const prefix = `${sourcePath}/storage/${bucket}`;
      const files = await listAll(supabase, BACKUP_BUCKET, prefix);
      await mapLimit(files, 8, async (f) => {
        const rel = f.path.slice(prefix.length + 1);
        await copyObject(supabase, BACKUP_BUCKET, f.path, bucket, rel);
        filesTotal++;
      });
      await onProgress?.("restaurando (arquivos)", 60 + Math.round(((b + 1) / manifest.storage.length) * 39));
    }
  }
  await onProgress?.("concluído", 100);
  return { tablesCount: tables.length, rowsCount: rowsTotal, filesCount: filesTotal };
}
