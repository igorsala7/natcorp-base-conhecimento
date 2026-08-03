import type { DbMeta } from "./metadata";
import type { Database } from "@/lib/database.types";

type LinhaDic = Database["public"]["Tables"]["data_dictionary"]["Insert"];

/** Constrói as linhas do `data_dictionary` a partir dos objetos de banco. Determinístico. */
export function construirLinhasDb(spaceId: string, meta: DbMeta): LinhaDic[] {
  const linhas: LinhaDic[] = [];
  for (const t of meta.tables) {
    linhas.push({ space_id: spaceId, kind: "table", name: t.name, label: t.comment, source: "db_ddl", metadata: { columns: t.columns.length } });
    for (const c of t.columns) {
      linhas.push({
        space_id: spaceId,
        kind: "column",
        name: c.name,
        parent_name: t.name,
        db_table: t.name,
        db_column: c.name,
        label: c.comment,
        source: "db_ddl",
        metadata: { type: c.type, nullable: c.nullable, labels: c.comment ? [c.comment] : [] },
      });
    }
  }
  for (const v of meta.views) linhas.push({ space_id: spaceId, kind: "view", name: v.name, label: v.comment, source: "db_ddl", metadata: { text: v.text } });
  for (const c of meta.code) linhas.push({ space_id: spaceId, kind: c.kind, name: c.name, parent_name: c.table, source: "db_ddl", metadata: { source: c.source } });
  return linhas;
}
