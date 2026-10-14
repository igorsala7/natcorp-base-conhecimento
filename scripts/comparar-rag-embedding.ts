/**
 * O MODELO NOVO DE EMBEDDING RECUPERA MELHOR A DOCUMENTAÇÃO? — read-only.
 *
 * Compara, nas perguntas anotadas de `eval/rag.jsonl`, a posição da fonte certa
 * no ramo VETORIAL da busca com o modelo atual (vetores do banco) e com o novo
 * (vetores calculados por `embed:trocar`, ainda no arquivo, sem gravar).
 *
 * Só o ramo vetorial, de propósito: é a única parte da busca híbrida que a troca
 * de modelo muda. O léxico e a fusão RRF são iguais nos dois lados, então a
 * diferença aqui é a diferença que a troca causa. Uma fonte é um artigo ou um
 * arquivo; vale o melhor trecho dela.
 *
 *   npm run embed:comparar-rag -- --modelo gemini-embedding-2 --arquivo /tmp/reembed-gemini-embedding-2.jsonl
 */
import { createReadStream } from "node:fs";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { embedMany } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { tryDecryptSecret } from "../src/lib/crypto/secrets";
import { EMBEDDING_DIM } from "../src/lib/ai/catalog";

const arg = (n: string, p: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : p;
};
const NOVO = arg("modelo", "gemini-embedding-2");
const ARQUIVO = arg("arquivo", join(tmpdir(), `reembed-${NOVO}.jsonl`));
const JANELA = 4;

type Caso = { pergunta: string; space_id: string; espera_nos?: string[] | null; espera_docs?: string[]; descartado?: boolean };

function cos(a: Float32Array | number[], b: Float32Array | number[]): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function main() {
  const casos = readFileSync("eval/rag.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso)
    .filter((c) => !c.descartado && ((c.espera_nos ?? []).length > 0 || (c.espera_docs ?? []).length > 0));

  const db = new pg.Client(parseDbConfig());
  await db.connect();
  const { rows: [p] } = await db.query<{ kind: string; api_key_enc: string; model: string }>(
    `select p.kind, k.api_key_enc, a.model from ai_assignments a join ai_providers p on p.id = a.provider_id
       join ai_provider_keys k on k.provider_id = p.id where a.purpose = 'embedding' and a.base_code = ''`);
  const ATUAL = p!.model;
  const g = createGoogleGenerativeAI({ apiKey: tryDecryptSecret(p!.api_key_enc)! });
  const vetQ = async (modelo: string) => (await embedMany({
    model: g.textEmbeddingModel(modelo), values: casos.map((c) => c.pergunta),
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIM } },
  })).embeddings;
  const [qA, qN] = [await vetQ(ATUAL), await vetQ(NOVO)];

  // Vetores novos dos chunks, do arquivo do `embed:trocar`.
  const novos = new Map<string, Float32Array>();
  let cab = true;
  for await (const l of createInterface({ input: createReadStream(ARQUIVO) })) {
    if (cab) { cab = false; if (JSON.parse(l).modelo !== NOVO) throw new Error("arquivo de outro modelo"); continue; }
    const o = JSON.parse(l) as { t: string; id: string; v: number[] };
    if (o.t === "chunk") novos.set(o.id, Float32Array.from(o.v));
  }

  console.log(`\n${ATUAL} × ${NOVO} · ramo vetorial · ${casos.length} perguntas anotadas · janela @${JANELA}`);
  if (casos.length < 30) console.log("⚠ abaixo de 30 casos: acha defeito, não conclui melhora.\n");

  const res: { a: number; n: number }[] = [];
  const espacos = new Map<string, { id: string; fonte: string; v: Float32Array }[]>();
  for (const [i, c] of casos.entries()) {
    if (!espacos.has(c.space_id)) {
      const { rows } = await db.query<{ id: string; fonte: string; e: string }>(
        `select c.id, coalesce(c.node_id, c.document_id)::text as fonte, c.embedding::text as e
           from chunks c where c.embedding is not null
            and c.space_id in (select id from spaces where id = $1 union select parent_space_id from spaces where id = $1)`,
        [c.space_id]);
      espacos.set(c.space_id, rows.map((r) => ({ id: r.id, fonte: r.fonte, v: Float32Array.from(JSON.parse(r.e) as number[]) })));
    }
    const chunks = espacos.get(c.space_id)!;
    const esperadas = new Set([...(c.espera_nos ?? []), ...(c.espera_docs ?? [])]);
    const posicao = (q: number[], vetor: (ch: (typeof chunks)[number]) => Float32Array | undefined) => {
      const melhor = new Map<string, number>();
      for (const ch of chunks) {
        const v = vetor(ch);
        if (!v) continue;
        const s = cos(q, v);
        if (s > (melhor.get(ch.fonte) ?? -1)) melhor.set(ch.fonte, s);
      }
      const ordem = [...melhor.entries()].sort((x, y) => y[1] - x[1]).map(([f]) => f);
      const i = ordem.findIndex((f) => esperadas.has(f));
      return i < 0 ? 999 : i + 1;
    };
    const a = posicao(qA[i]!, (ch) => ch.v);
    const n = posicao(qN[i]!, (ch) => novos.get(ch.id));
    res.push({ a, n });
    const seta = n < a ? "↑" : n > a ? "↓" : " ";
    console.log(`  ${seta} ${String(a).padStart(4)} → ${String(n).padEnd(4)} ${c.pergunta.slice(0, 70)}`);
  }
  await db.end();

  const em = (xs: number[], k: number) => `${xs.filter((x) => x <= k).length}/${xs.length}`;
  const A = res.map((r) => r.a), N = res.map((r) => r.n);
  console.log(`\n  modelo                    @1     @${JANELA}     @8`);
  console.log(`  ${ATUAL.padEnd(24)} ${em(A, 1).padStart(5)} ${em(A, JANELA).padStart(6)} ${em(A, 8).padStart(6)}`);
  console.log(`  ${NOVO.padEnd(24)} ${em(N, 1).padStart(5)} ${em(N, JANELA).padStart(6)} ${em(N, 8).padStart(6)}`);
  console.log(`  por pergunta: ${res.filter((r) => r.n < r.a).length} subiram, ${res.filter((r) => r.n > r.a).length} caíram\n`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
