/**
 * REPARTICIONA OS ARTIGOS QUE FICARAM COM UM CHUNK SÓ.
 *
 * 78 chunks de artigo passam de 700 tokens; o maior tem 60.027 (240.106
 * caracteres). O `chunkArticle` de hoje NÃO consegue produzi-los: `flush()`
 * fatia todo parágrafo acima de `CHUNK_MAX` (2.000 caracteres). São restos de
 * uma versão anterior do particionador — todos com a forma `1/1` (o artigo
 * inteiro num chunk), embutidos entre 24 e 30/07 e nunca refeitos desde.
 *
 * Por que isso importa mais do que o tamanho sugere: gigantes são 0,82% do
 * corpus e 40,2% do que a busca ENTREGA. E o custo não são os tokens — é a
 * vaga: com `ragLimit` médio de 4, cada gigante ocupa uma das quatro fontes
 * que o modelo vai ler. Um artigo inteiro entra onde caberiam quatro trechos
 * certos.
 *
 * Reindexar é o conserto completo porque o defeito estava no chunker, e o
 * chunker já foi consertado. Roda o mesmo `reindexNodeChunks` da publicação —
 * nenhum caminho novo, nenhuma regra nova.
 *
 *   npx tsx --env-file=.env.local scripts/reindexar-chunks-gigantes.ts --seco
 *   npx tsx --env-file=.env.local scripts/reindexar-chunks-gigantes.ts
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createClient } from "@supabase/supabase-js";
import { reindexNodeChunks } from "../src/lib/content/chunk";
import type { Database } from "../src/lib/database.types";

const LIMITE = 700;
const SECO = process.argv.includes("--seco");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
const db = createClient<Database>(url, serviceRole, { auth: { persistSession: false } });

/** As duas métricas que decidem: o corpus e — a que importa — o que é RECUPERADO. */
async function medir(): Promise<{ total: number; acima: number; maior: number; media: number }> {
  let total = 0, acima = 0, maior = 0, soma = 0;
  for (let de = 0; ; de += 1000) {
    const { data: pag, error } = await db
      .from("chunks")
      .select("token_count")
      .is("document_id", null)
      .range(de, de + 999);
    if (error) throw error;
    if (!pag?.length) break;
    for (const c of pag) {
      const t = c.token_count ?? 0;
      total++; soma += t;
      if (t > LIMITE) acima++;
      if (t > maior) maior = t;
    }
    if (pag.length < 1000) break;
  }
  return { total, acima, maior, media: total ? Math.round(soma / total) : 0 };
}

async function main() {
  const antes = await medir();
  console.log(
    `\nANTES  ${antes.total} chunks de artigo · ${antes.acima} acima de ${LIMITE} tok ` +
      `(${((antes.acima / antes.total) * 100).toFixed(2)}%) · maior ${antes.maior} · média ${antes.media}`,
  );

  // Os nós a refazer: quem tem PELO MENOS um chunk acima do limite.
  const alvos = new Map<string, { articleId: string; spaceId: string }>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("chunks")
      .select("node_id, article_id, space_id, token_count")
      .is("document_id", null)
      .gt("token_count", LIMITE)
      .range(de, de + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const c of data) {
      if (c.node_id && c.article_id && c.space_id) {
        alvos.set(c.node_id, { articleId: c.article_id, spaceId: c.space_id });
      }
    }
    if (data.length < 1000) break;
  }
  console.log(`${alvos.size} artigos a reparticionar${SECO ? "  (ensaio — nada será escrito)" : ""}\n`);
  if (SECO) return;

  let feitos = 0, pulados = 0, falhas = 0;
  for (const [nodeId, { articleId, spaceId }] of alvos) {
    // Fonte da verdade = o artigo PUBLICADO, igual ao caminho de publicação.
    // Rascunho não é indexado, e indexá-lo aqui vazaria conteúdo não publicado
    // para a busca do portal.
    const { data: art } = await db
      .from("articles")
      .select("id, content_json")
      .eq("id", articleId)
      .maybeSingle();
    if (!art?.content_json) { pulados++; continue; }
    try {
      await reindexNodeChunks(db as never, {
        nodeId,
        articleId: art.id,
        spaceId,
        doc: art.content_json,
        withEmbeddings: true,
        embeddedBy: null, // sistema
      });
      feitos++;
      if (feitos % 10 === 0) console.log(`  ${feitos}/${alvos.size}…`);
    } catch (e) {
      falhas++;
      console.error(`  falhou ${nodeId}: ${(e as Error).message.slice(0, 90)}`);
    }
  }

  const depois = await medir();
  console.log(
    `\nDEPOIS ${depois.total} chunks de artigo · ${depois.acima} acima de ${LIMITE} tok ` +
      `(${((depois.acima / depois.total) * 100).toFixed(2)}%) · maior ${depois.maior} · média ${depois.media}`,
  );
  console.log(`\n${feitos} reindexados · ${pulados} sem conteúdo publicado · ${falhas} falha(s)`);
  console.log(
    "\nO número do corpus é o fácil. O que decide é a média de tokens por fonte\n" +
      "RECUPERADA — meça de novo com o gabarito antes de declarar ganho.\n",
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
