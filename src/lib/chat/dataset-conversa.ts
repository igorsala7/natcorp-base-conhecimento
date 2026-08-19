import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { putDatasetRows, readDatasetRows } from "@/lib/widget/dataset-store";
import { registrarTabelaTela, newRegistry, type DatasetRegistry } from "./datasets";
import { celulaDataset } from "./dataset-sanitize";

/**
 * AS TABELAS SOBREVIVEM À CONVERSA, NÃO SÓ AO TURNO.
 *
 * "Os usuários vão fazer muitas conferências, então às vezes em 20 mensagens
 * ele ainda está citando o resultado da quinta" (Igor, 19/08/2026).
 *
 * O texto da conversa já atravessava os turnos — pergunta e resposta. As LINHAS
 * não. Então o agente lembrava que consultou 2.777 marcações de ponto e não
 * conseguia contar, agrupar nem filtrar aquilo: tentava `dados_de: "ds1"`,
 * recebia "nenhuma tabela carregada neste turno" e refazia a chamada à API.
 * Custou um passo e uma ida ao ORDS em cada continuação.
 *
 * É a diferença entre lembrar que viu uma planilha e ainda ter a planilha
 * aberta.
 *
 * ── Retenção (decisão do Igor) ──────────────────────────────────────────────
 * As 10 mais recentes por conversa, expirando em 24h de inatividade.
 * Conferência é trabalho de sessão; no dia seguinte o dado mudou de qualquer
 * jeito. E são linhas com matrícula, nome e salário — guardar além do
 * necessário é acumular dado pessoal em repouso sem ninguém ter pedido.
 *
 * Se o agente pedir uma tabela que já saiu, ele recebe o mesmo erro de sempre e
 * reconsulta: a degradação é o comportamento de hoje, não uma falha nova.
 */

type DbClient = SupabaseClient<Database>;

/** Quantas tabelas ficam vivas por conversa. */
export const MAX_POR_CONVERSA = 10;
/** Janela de inatividade antes de a tabela deixar de ser reidratada. */
export const HORAS_ATE_EXPIRAR = 24;
/** Teto de linhas persistidas por tabela — acima disto o valor está no `total`. */
const MAX_LINHAS = 100_000;

/** `ds3` → 3. Devolve null quando o id não tem número (não deveria acontecer). */
export function numeroDoId(id: string): number | null {
  const m = String(id ?? "").match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * Linhas do registro para a forma do store (`string[][]`), na ordem das colunas.
 *
 * O registro guarda cada célula DUAS vezes — por índice (`c0`) e pelo nome da
 * coluna — para o modelo poder referenciar das duas formas. Persistir as duas
 * dobraria o tamanho à toa: a reidratação reconstrói ambas a partir das colunas.
 */
export function linhasParaStore(rows: Record<string, unknown>[], colunas: string[]): string[][] {
  return rows.slice(0, MAX_LINHAS).map((r) =>
    colunas.map((nome, i) => celulaDataset(r[nome] ?? r["c" + i])),
  );
}

type Escopo = {
  conversationId: string;
  spaceId: string;
  userRef: string;
  widgetKeyId?: string | null;
};

/**
 * Grava as tabelas do turno e apaga as que passaram do teto.
 *
 * Best-effort: perder a persistência degrada para o comportamento de hoje (o
 * agente reconsulta), enquanto derrubar o turno por causa dela seria trocar uma
 * economia por uma falha. Por isso nada aqui lança.
 */
export async function salvarDatasetsDaConversa(db: DbClient, escopo: Escopo, reg: DatasetRegistry): Promise<void> {
  try {
    const expiraEm = new Date(Date.now() + HORAS_ATE_EXPIRAR * 3_600_000).toISOString();
    for (const d of reg.list) {
      const seq = numeroDoId(d.id);
      if (seq == null || !d.rows.length) continue;
      const colunas = d.headers ?? d.colunas;
      const linhas = linhasParaStore(d.rows as unknown as Record<string, unknown>[], colunas);
      const clientKey = `conv:${escopo.conversationId}:${seq}`;
      const guardado = await putDatasetRows(db, {
        spaceId: escopo.spaceId,
        userRef: escopo.userRef,
        clientKey,
        rows: linhas,
      });
      await db.from("widget_datasets").upsert(
        {
          space_id: escopo.spaceId,
          widget_key_id: escopo.widgetKeyId ?? null,
          user_ref: escopo.userRef,
          // `client_key` é único por (espaço, usuário) e não pode ficar vazio;
          // a conversa + o número dão a chave natural desta linha.
          client_key: clientKey,
          conversation_id: escopo.conversationId,
          seq,
          source_name: d.id,
          columns: colunas as never,
          total: d.rows.length,
          expires_at: expiraEm,
          rows: guardado.rows as never,
          storage_path: guardado.storagePath,
        } as never,
        { onConflict: "space_id,user_ref,client_key" },
      );
    }
    await podarExcedente(db, escopo.conversationId);
  } catch (e) {
    console.error("[dataset-conversa] não persistiu:", e instanceof Error ? e.message : e);
  }
}

/** Mantém só as `MAX_POR_CONVERSA` mais recentes — as antigas saem por inteiro. */
async function podarExcedente(db: DbClient, conversationId: string): Promise<void> {
  const { data } = await db
    .from("widget_datasets")
    .select("id, seq")
    .eq("conversation_id", conversationId)
    .order("seq", { ascending: false });
  const sobrando = (data ?? []).slice(MAX_POR_CONVERSA).map((r) => r.id as string);
  if (sobrando.length) await db.from("widget_datasets").delete().in("id", sobrando);
}

/**
 * Devolve um registro já com as tabelas da conversa, e a numeração continuando
 * de onde parou.
 *
 * Sem conversa (primeiro turno, portal) devolve um registro novo — o
 * comportamento de sempre.
 */
export async function reidratarDatasets(db: DbClient, conversationId: string | null | undefined): Promise<DatasetRegistry> {
  if (!conversationId) return newRegistry();
  try {
    const { data } = await db
      .from("widget_datasets")
      .select("seq, source_name, columns, rows, storage_path, total, expires_at")
      .eq("conversation_id", conversationId)
      .gt("expires_at", new Date().toISOString())
      .order("seq", { ascending: true })
      .limit(MAX_POR_CONVERSA);
    if (!data?.length) return newRegistry();

    // O contador continua DEPOIS do maior número já usado — inclusive dos que
    // expiraram. Reaproveitar um número liberado faria o agente pedir a tabela
    // antiga e receber a nova, que é a colisão silenciosa que tudo isto evita.
    const { data: topo } = await db
      .from("widget_datasets")
      .select("seq")
      .eq("conversation_id", conversationId)
      .order("seq", { ascending: false })
      .limit(1);
    const maior = (topo?.[0]?.seq as number | undefined) ?? 0;
    const reg = newRegistry(maior + 1);

    for (const linha of data) {
      const colunas = Array.isArray(linha.columns) ? (linha.columns as string[]) : [];
      const rows = await readDatasetRows(db, linha);
      if (!colunas.length || !rows.length) continue;
      registrarTabelaTela(reg, colunas, rows, String(linha.source_name ?? `ds${linha.seq}`));
    }
    return reg;
  } catch (e) {
    console.error("[dataset-conversa] não reidratou:", e instanceof Error ? e.message : e);
    return newRegistry();
  }
}
