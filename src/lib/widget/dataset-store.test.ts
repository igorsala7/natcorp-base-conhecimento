import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { putDatasetRows, readDatasetRows } from "./dataset-store";

/** Storage falso em memória: guarda os bytes por caminho, imita upload/download/remove. */
function fakeDb() {
  const store = new Map<string, Buffer>();
  const db = {
    _store: store,
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Buffer) => {
          store.set(path, Buffer.from(bytes));
          return { error: null };
        },
        download: async (path: string) => {
          const b = store.get(path);
          if (!b) return { data: null };
          const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
          return { data: { arrayBuffer: async () => ab } };
        },
        remove: async () => ({ error: null }),
      }),
    },
  };
  return db as unknown as SupabaseClient<Database> & { _store: Map<string, Buffer> };
}

const rowsPequenas = [["a", "1"], ["b", "2"], ["c", "3"]];
// > 1 MB serializado: força o caminho de Storage (gzip).
const rowsGrandes = Array.from({ length: 20000 }, (_, i) => [String(i), "x".repeat(60)]);

describe("putDatasetRows", () => {
  it("conjunto pequeno fica INLINE (sem Storage)", async () => {
    const db = fakeDb();
    const r = await putDatasetRows(db, { spaceId: "sp1", userRef: "b:u1", clientKey: "k1", rows: rowsPequenas });
    expect(r.storagePath).toBeNull();
    expect(r.rows).toEqual(rowsPequenas);
    expect(db._store.size).toBe(0);
  });

  it("conjunto grande vai para o Storage (gzip) e `rows` fica nulo", async () => {
    const db = fakeDb();
    const r = await putDatasetRows(db, { spaceId: "sp1", userRef: "b:u1", clientKey: "k1", rows: rowsGrandes });
    expect(r.rows).toBeNull();
    expect(r.storagePath).toMatch(/^sp1\/[0-9a-f]{40}\.json\.gz$/);
    expect(db._store.has(r.storagePath!)).toBe(true);
  });

  it("caminho é DETERMINÍSTICO por (espaço, usuário, recorte)", async () => {
    const db = fakeDb();
    const a = await putDatasetRows(db, { spaceId: "sp1", userRef: "b:u1", clientKey: "k1", rows: rowsGrandes });
    const b = await putDatasetRows(db, { spaceId: "sp1", userRef: "b:u1", clientKey: "k1", rows: rowsGrandes });
    expect(a.storagePath).toBe(b.storagePath);
    const c = await putDatasetRows(db, { spaceId: "sp1", userRef: "b:u2", clientKey: "k1", rows: rowsGrandes });
    expect(c.storagePath).not.toBe(a.storagePath);
  });
});

describe("readDatasetRows", () => {
  it("inline: devolve as linhas de `rows`", async () => {
    const db = fakeDb();
    const linhas = await readDatasetRows(db, { rows: rowsPequenas, storage_path: null });
    expect(linhas).toEqual(rowsPequenas);
  });

  it("Storage: round-trip gzip devolve as MESMAS linhas", async () => {
    const db = fakeDb();
    const posto = await putDatasetRows(db, { spaceId: "sp1", userRef: "b:u1", clientKey: "k1", rows: rowsGrandes });
    const linhas = await readDatasetRows(db, { rows: null, storage_path: posto.storagePath });
    expect(linhas).toEqual(rowsGrandes);
  });

  it("Storage ausente/corrompido: devolve vazio sem lançar", async () => {
    const db = fakeDb();
    const linhas = await readDatasetRows(db, { rows: null, storage_path: "sp1/naoexiste.json.gz" });
    expect(linhas).toEqual([]);
  });
});
