/**
 * TROCA DO MODELO DE EMBEDDING, SEM JANELA DE VETORES MISTURADOS.
 *
 * Vetor de um modelo não se compara com vetor de outro: durante uma troca feita
 * "por partes" (muda a configuração, depois reindexa), a pergunta sai no modelo
 * novo e é comparada com documentos no velho — a busca devolve lixo plausível,
 * sem erro nenhum. Por isso duas fases:
 *
 *   1. CALCULAR (padrão) — vetoriza TUDO com o modelo novo, a partir do texto
 *      já guardado, e escreve num arquivo. Não grava nada no banco.
 *        · chunks              → mesmo texto de `textoParaEmbedding` (prefixo do
 *                                manual/arquivo + frase de contexto guardada +
 *                                trilha + conteúdo). NÃO refatia: só o modelo muda,
 *                                para a medição de antes/depois isolar essa variável.
 *        · ai_tools            → `toolCatalogText`, como `embed:tools`.
 *        · ai_tool_base_embeddings → `textosDaBase` (com a ontologia), todas as bases.
 *        · ai_tool_uso         → a `consulta` guardada, que é o texto vetorizado.
 *
 *   2. GRAVAR (`--gravar`) — numa transação só: os ~11 mil vetores, a
 *      proveniência dos chunks, a atribuição de Embeddings em Sistema → IA e a
 *      auditoria. Depois: refaz o que nasceu entre as duas fases (chunk publicado,
 *      uso novo) e apaga do Redis o cache de vetor de pergunta (`emb:*`), cuja
 *      chave é só o texto.
 *
 *   npm run embed:trocar -- --modelo gemini-embedding-2              # calcular
 *   npm run embed:trocar -- --modelo gemini-embedding-2 --gravar     # gravar
 *
 * Antes de gravar: `npm run embed:calibrar` (os cortes de cosseno do código são
 * do modelo atual) e `npm run embed:comparar-rag`.
 */
import { createClient } from "@supabase/supabase-js";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { embedMany, type EmbeddingModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { Database } from "../src/lib/database.types";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { tryDecryptSecret } from "../src/lib/crypto/secrets";
import { EMBEDDING_DIM, precisaDimensoes } from "../src/lib/ai/catalog";
import { textoParaEmbedding, prefixoDoArtigo, uuidDeLabel } from "../src/lib/content/chunk";
import { textosDaBase, toolCatalogText } from "../src/lib/integrations/tool-catalog";
import { getInfra } from "../src/lib/settings/infra";

const arg = (n: string, p: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : p;
};
const MODELO = arg("modelo", "");
const GRAVAR = process.argv.includes("--gravar");
const ARQUIVO = arg("arquivo", join(tmpdir(), `reembed-${MODELO}.jsonl`));

/** Uma linha do arquivo: qual registro, e o vetor novo. */
type Linha =
  | { t: "chunk"; id: string; v: number[] }
  | { t: "tool"; id: string; v: number[] }
  | { t: "base"; base: string; tool: string; hash: string; v: number[] }
  | { t: "uso"; id: string; v: number[] };
type Chave<L> = L extends Linha ? Omit<L, "v"> : never;
type Item = { chave: Chave<Linha>; texto: string };

const vec = (v: number[]) => `[${v.join(",")}]`;

async function chaveDoProvedor(db: pg.Client) {
  const { rows: [r] } = await db.query<{ kind: string; base_url: string | null; api_key_enc: string; model: string }>(
    `select p.kind, p.base_url, k.api_key_enc, a.model
       from ai_assignments a join ai_providers p on p.id = a.provider_id
       join ai_provider_keys k on k.provider_id = p.id
      where a.purpose = 'embedding' and a.base_code = ''`,
  );
  if (!r) throw new Error("Sem atribuição de Embeddings em Sistema → IA.");
  const apiKey = tryDecryptSecret(r.api_key_enc);
  if (!apiKey) throw new Error("A chave do provedor de embeddings não abriu (APP_ENCRYPTION_KEY?).");
  return { kind: r.kind, baseUrl: r.base_url ?? undefined, apiKey, atual: r.model };
}

function modeloDe(kind: string, apiKey: string, baseUrl?: string): { model: EmbeddingModel; opcoes?: Record<string, Record<string, number>> } {
  const opts = { apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) };
  // Mesma regra de `embeddingModel`/`embeddingCallOptions` em src/lib/ai/config.ts.
  const opcoes: Record<string, Record<string, number>> | undefined = !precisaDimensoes(MODELO)
    ? undefined
    : kind === "google" ? { google: { outputDimensionality: EMBEDDING_DIM } } : { openai: { dimensions: EMBEDDING_DIM } };
  const model = kind === "google"
    ? createGoogleGenerativeAI(opts).textEmbeddingModel(MODELO)
    : createOpenAI(opts).textEmbeddingModel(MODELO);
  return { model, opcoes };
}

/**
 * Cota por minuto do provedor: o Google conta CADA texto do lote como uma
 * requisição (gemini-embedding-2 no nível pago 2: 5.000/min). Estourar não
 * derruba nada em produção — a cota é por modelo —, mas aborta a troca.
 */
const POR_MINUTO = Number(arg("por-minuto", "3500"));
const enviados: { em: number; n: number }[] = [];
async function aguardarCota(n: number) {
  for (;;) {
    const agora = Date.now();
    while (enviados.length && agora - enviados[0]!.em > 60_000) enviados.shift();
    const noMinuto = enviados.reduce((a, e) => a + e.n, 0);
    if (noMinuto + n <= POR_MINUTO) { enviados.push({ em: agora, n }); return; }
    await new Promise((r) => setTimeout(r, 60_000 - (agora - enviados[0]!.em) + 50));
  }
}

/** Vetoriza em lotes de 100, 2 em paralelo, dentro da cota, com nova tentativa. */
async function vetorizar(itens: Item[], m: ReturnType<typeof modeloDe>, aoGravar: (l: Linha) => void) {
  const lotes: Item[][] = [];
  for (let i = 0; i < itens.length; i += 100) lotes.push(itens.slice(i, i + 100));
  let feitos = 0, prox = 0;
  const trabalhador = async () => {
    while (prox < lotes.length) {
      const lote = lotes[prox++]!;
      for (let tentativa = 1; ; tentativa++) {
        await aguardarCota(lote.length);
        try {
          const { embeddings } = await embedMany({ model: m.model, values: lote.map((x) => x.texto), providerOptions: m.opcoes, maxRetries: 0 });
          embeddings.forEach((v, i) => {
            if (v.length !== EMBEDDING_DIM) throw new Error(`vetor com ${v.length} dimensões (esperado ${EMBEDDING_DIM})`);
            aoGravar({ ...lote[i]!.chave, v: v.map((x) => Math.round(x * 1e7) / 1e7) } as Linha);
          });
          break;
        } catch (e) {
          if (tentativa >= 6) throw e;
          // O provedor diz quanto esperar ("retry in 12.9s"); sem isso, recuo crescente.
          const dica = /retry in ([\d.]+)s/i.exec(e instanceof Error ? e.message : "");
          await new Promise((r) => setTimeout(r, dica ? Number(dica[1]) * 1000 + 1000 : 5000 * tentativa));
        }
      }
      feitos += lote.length;
      process.stdout.write(`\r  ${feitos}/${itens.length}`);
    }
  };
  await Promise.all(Array.from({ length: 2 }, trabalhador));
  if (itens.length) console.log("");
}

/** Textos de TODOS os chunks com vetor (ou só dos ids pedidos). */
async function itensDeChunks(db: pg.Client, ids?: string[]): Promise<Item[]> {
  const { rows } = await db.query<{
    id: string; heading_path: string | null; content: string;
    node_id: string | null; titulo: string | null; path: string | null; ctx_art: string | null;
    document_id: string | null; arquivo: string | null; ctx_doc: string | null;
  }>(
    `select c.id, c.heading_path, c.content,
            c.node_id, n.title as titulo, n.path::text as path, a.embedding_context as ctx_art,
            c.document_id, d.original_name as arquivo, d.embedding_context as ctx_doc
       from chunks c
       left join nodes n on n.id = c.node_id
       left join articles a on a.id = c.article_id
       left join knowledge_documents d on d.id = c.document_id
      where c.embedding is not null ${ids ? "and c.id = any($1)" : ""}`,
    ids ? [ids] : [],
  );
  // Título do manual (diretório de 1º nível) de cada artigo, numa consulta só.
  const raizes = [...new Set(rows.map((r) => uuidDeLabel(String(r.path ?? "").split(".")[0] ?? "")).filter((x): x is string => !!x))];
  const { rows: tr } = await db.query<{ id: string; title: string }>("select id, title from nodes where id = any($1)", [raizes]);
  const tituloRaiz = new Map(tr.map((r) => [r.id, r.title]));
  return rows.map((r) => {
    let contexto = "", ctxIa = "";
    if (r.node_id) {
      const raiz = uuidDeLabel(String(r.path ?? "").split(".")[0] ?? "");
      const manual = raiz && raiz !== r.node_id ? tituloRaiz.get(raiz) ?? null : null;
      contexto = r.titulo ? prefixoDoArtigo(manual, r.titulo) : "";
      ctxIa = r.ctx_art ?? "";
    } else if (r.document_id) {
      contexto = r.arquivo ? `Documento: ${r.arquivo}` : "";
      ctxIa = r.ctx_doc ?? "";
    }
    return { chave: { t: "chunk", id: r.id }, texto: textoParaEmbedding(contexto, r.heading_path ?? "", r.content, ctxIa) };
  });
}

async function itensDeUso(db: pg.Client, ids?: string[]): Promise<Item[]> {
  const { rows } = await db.query<{ id: string; consulta: string }>(
    `select id, consulta from ai_tool_uso where embedding is not null and coalesce(trim(consulta),'') <> '' ${ids ? "and id = any($1)" : ""}`,
    ids ? [ids] : [],
  );
  return rows.map((r) => ({ chave: { t: "uso", id: r.id }, texto: r.consulta }));
}

async function calcular(db: pg.Client, sb: ReturnType<typeof createClient<Database>>, m: ReturnType<typeof modeloDe>) {
  const itens: Item[] = [];
  itens.push(...(await itensDeChunks(db)));
  const nChunks = itens.length;

  const { rows: tools } = await db.query<{ id: string; key: string; name: string; description: string; search_terms: string | null; response_hint: string | null }>(
    "select id, key, name, description, search_terms, response_hint from ai_tools where embedding is not null",
  );
  const { rows: todas } = await db.query<{ key: string }>("select key from ai_tools");
  const chaves = new Set(todas.map((t) => t.key.toLowerCase()));
  for (const t of tools) {
    const outras = new Set(chaves); outras.delete(t.key.toLowerCase());
    itens.push({ chave: { t: "tool", id: t.id }, texto: toolCatalogText(t.name, t.description, { searchTerms: t.search_terms, responseHint: t.response_hint, chavesDeOutras: outras }) });
  }

  // Vetores por base: TODAS as bases que têm linha, ligadas ou não.
  const { rows: bases } = await db.query<{ base_code: string }>(
    "select distinct b.base_code from ai_tool_base_embeddings e join ai_bases b on b.id = e.base_id",
  );
  let nBase = 0;
  for (const { base_code } of bases) {
    const montado = await textosDaBase(sb, base_code, undefined, true);
    for (const it of montado?.itens ?? []) {
      itens.push({ chave: { t: "base", base: montado!.baseId, tool: it.toolId, hash: it.hash }, texto: it.fonte });
      nBase++;
    }
  }
  const uso = await itensDeUso(db);
  itens.push(...uso);
  console.log(`chunks ${nChunks} · tools ${tools.length} · por base ${nBase} (${bases.length} bases) · aprendizado ${uso.length}`);

  const saida = createWriteStream(ARQUIVO);
  saida.write(JSON.stringify({ modelo: MODELO, em: new Date().toISOString(), total: itens.length }) + "\n");
  await vetorizar(itens, m, (l) => saida.write(JSON.stringify(l) + "\n"));
  await new Promise<void>((r) => saida.end(r));
  console.log(`✓ ${itens.length} vetores em ${ARQUIVO}. Nada foi gravado no banco.`);
}

async function lerArquivo(): Promise<Linha[]> {
  if (!existsSync(ARQUIVO)) throw new Error(`Arquivo ${ARQUIVO} não existe: rode sem --gravar antes.`);
  const linhas: Linha[] = [];
  let cab: { modelo: string } | null = null;
  for await (const l of createInterface({ input: createReadStream(ARQUIVO) })) {
    if (!l.trim()) continue;
    if (!cab) { cab = JSON.parse(l); continue; }
    linhas.push(JSON.parse(l));
  }
  if (cab?.modelo !== MODELO) throw new Error(`O arquivo é de ${cab?.modelo}, não de ${MODELO}.`);
  return linhas;
}

/** UPDATE em lotes de 200, dentro da transação aberta. */
async function gravarLinhas(db: pg.Client, linhas: Linha[], kind: string) {
  const por = <T extends Linha["t"]>(t: T) => linhas.filter((l): l is Extract<Linha, { t: T }> => l.t === t);
  const lotes = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 200) }, (_, i) => xs.slice(i * 200, i * 200 + 200));
  let n = 0;
  for (const lote of lotes(por("chunk"))) {
    const r = await db.query(
      `update chunks c set embedding = v.e::vector, embedding_provider = $4, embedding_model = $2, embedded_at = now()
         from unnest($1::uuid[], $3::text[]) as v(id, e) where c.id = v.id`,
      [lote.map((l) => l.id), MODELO, lote.map((l) => vec(l.v)), kind],
    );
    n += r.rowCount ?? 0;
  }
  for (const lote of lotes(por("tool")))
    n += (await db.query("update ai_tools t set embedding = v.e::vector from unnest($1::uuid[], $2::text[]) as v(id, e) where t.id = v.id",
      [lote.map((l) => l.id), lote.map((l) => vec(l.v))])).rowCount ?? 0;
  for (const lote of lotes(por("base")))
    n += (await db.query(
      `update ai_tool_base_embeddings b set embedding = v.e::vector, fonte_hash = v.h, updated_at = now()
         from unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[]) as v(base, tool, h, e)
        where b.base_id = v.base and b.tool_id = v.tool`,
      [lote.map((l) => l.base), lote.map((l) => l.tool), lote.map((l) => l.hash), lote.map((l) => vec(l.v))])).rowCount ?? 0;
  for (const lote of lotes(por("uso")))
    n += (await db.query("update ai_tool_uso u set embedding = v.e::vector from unnest($1::uuid[], $2::text[]) as v(id, e) where u.id = v.id",
      [lote.map((l) => l.id), lote.map((l) => vec(l.v))])).rowCount ?? 0;
  return n;
}

/** Apaga `emb:*` do Upstash: vetor de pergunta do modelo velho, guardado por 1 h. */
async function limparCacheDePergunta() {
  // Mesma fonte do app (`infra_settings` no banco, com o env de reserva): ler só
  // o env aqui dava "Redis não configurado" com o Redis da produção no ar.
  const { redisUrl: url, redisToken: token } = await getInfra();
  if (!url || !token) { console.log("  Redis não configurado: o cache em memória some com o reinício do app."); return; }
  const cmd = async (c: (string | number)[]) =>
    (await (await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(c) })).json()) as { result: unknown };
  let cursor = "0", apagadas = 0;
  do {
    const { result } = await cmd(["SCAN", cursor, "MATCH", "emb:*", "COUNT", 1000]);
    const [prox, chaves] = result as [string, string[]];
    cursor = prox;
    if (chaves.length) { await cmd(["DEL", ...chaves]); apagadas += chaves.length; }
  } while (cursor !== "0");
  console.log(`  cache de pergunta: ${apagadas} chave(s) emb:* apagada(s) do Redis.`);
}

async function gravar(db: pg.Client, m: ReturnType<typeof modeloDe>, atual: string, kind: string) {
  const linhas = await lerArquivo();
  console.log(`${linhas.length} vetores de ${MODELO} lidos de ${ARQUIVO}.`);
  await db.query("begin");
  try {
    const n = await gravarLinhas(db, linhas, kind);
    const { rowCount } = await db.query(
      "update ai_assignments set model = $1, updated_at = now() where purpose = 'embedding' and base_code = '' and model = $2",
      [MODELO, atual],
    );
    if (rowCount !== 1) throw new Error("a atribuição de Embeddings mudou desde o cálculo — nada gravado");
    const { rows: [autor] } = await db.query(
      "select actor_id from audit_log where after->>'via' like 'script Claude Code%' order by created_at desc limit 1",
    );
    await db.query(
      "insert into audit_log (actor_id, action, entity_type, entity_id, before, after) values ($1,'space.update','ai_assignment','embedding',$2,$3)",
      [autor?.actor_id ?? null, JSON.stringify({ model: atual }), JSON.stringify({ model: MODELO, vetores: n, via: "script Claude Code (embed:trocar)" })],
    );
    await db.query("commit");
    console.log(`✓ ${n} vetores gravados e Embeddings → ${MODELO}, na mesma transação.`);
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  }

  // O que nasceu entre CALCULAR e GRAVAR ficou no modelo velho: refaz agora.
  const { rows: cs } = await db.query<{ id: string }>(
    "select id from chunks where embedding is not null and embedding_model is distinct from $1", [MODELO]);
  const vistos = new Set(linhas.filter((l) => l.t === "uso").map((l) => (l as { id: string }).id));
  const { rows: us } = await db.query<{ id: string }>("select id from ai_tool_uso where embedding is not null");
  const usoNovo = us.map((u) => u.id).filter((id) => !vistos.has(id));
  const resto = [...(cs.length ? await itensDeChunks(db, cs.map((c) => c.id)) : []), ...(usoNovo.length ? await itensDeUso(db, usoNovo) : [])];
  if (resto.length) {
    console.log(`  ${resto.length} registro(s) criado(s) durante o cálculo: refazendo.`);
    const novos: Linha[] = [];
    await vetorizar(resto, m, (l) => novos.push(l));
    await gravarLinhas(db, novos, kind);
  }
  await limparCacheDePergunta();
  console.log("  Os processos do app pegam o modelo novo em até 30 s (cache de configuração).");
}

async function main() {
  if (!MODELO) { console.error("Informe --modelo <nome>."); process.exit(1); }
  const db = new pg.Client(parseDbConfig());
  await db.connect();
  try {
    const p = await chaveDoProvedor(db);
    if (p.atual === MODELO && GRAVAR && !process.argv.includes("--so-limpar-cache")) throw new Error(`Embeddings já está em ${MODELO}.`);
    const m = modeloDe(p.kind, p.apiKey, p.baseUrl);
    if (process.argv.includes("--so-limpar-cache")) await limparCacheDePergunta();
    else if (GRAVAR) await gravar(db, m, p.atual, p.kind);
    else {
      const sb = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      await calcular(db, sb, m);
    }
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error("\n" + (e instanceof Error ? e.message : String(e))); process.exit(1); });
