/**
 * REFAZ OS ARTIGOS QUE PRODUZIRAM CHUNKS-FRAGMENTO.
 *
 * Um heading seguido direto de outro heading virava um chunk com o título e
 * nada mais: "Ativar Processos", 16 caracteres. Medido no acervo, 300 dos 365
 * chunks com menos de 40 caracteres eram exatamente isso.
 *
 * O estrago não é ocupar espaço — é COMPETIR. Um trecho minúsculo casa por
 * semelhança de letras com quase qualquer pergunta curta e ganha de conteúdo de
 * verdade. Foi assim que a pergunta "preencha o campo" recuperava um documento
 * inteiro por causa de um chunk de 22 caracteres que dizia só "Campo de
 * Preenchimento" — cabeçalho de uma tabela. E, com `ragLimit` em torno de 4,
 * cada fragmento premiado ocupa uma das quatro vagas que o modelo vai ler.
 *
 * `chunkArticle` já foi corrigido (o título órfão agora viaja para o próximo
 * chunk). Reindexar é o conserto do que já está gravado — roda o mesmo
 * `reindexNodeChunks` da publicação, sem caminho novo e sem regra nova.
 *
 * FORA DE ESCOPO: os 58 fragmentos vindos de ARQUIVOS importados
 * (`chunkExtracted`, 15 documentos). Refazê-los exige rebaixar e reparsear o
 * arquivo do Storage — os blocos extraídos não ficam guardados. Eles se
 * corrigem sozinhos no próximo reprocessamento do arquivo.
 *
 *   npx tsx --env-file=.env.local scripts/reindexar-fragmentos.ts --seco
 *   npx tsx --env-file=.env.local scripts/reindexar-fragmentos.ts
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { reindexNodeChunks } from "../src/lib/content/chunk";
import { chunkArticle } from "../src/lib/content/chunk-split";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import type { Database } from "../src/lib/database.types";

/** Piso de contexto: abaixo disto o trecho não se sustenta sozinho na busca. */
const PISO = 120;
const SECO = process.argv.includes("--seco");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
const db = createClient<Database>(url, serviceRole, { auth: { persistSession: false } });

/**
 * A medição vai por SQL direto, não pelo PostgREST: `length(content)` não é
 * filtrável pela API, e puxar o conteúdo de 10 mil chunks para medir no cliente
 * é caro e esbarra no teto de 1.000 linhas por página — o mesmo teto que já
 * fez uma varredura deste projeto ler 1.014 de 5.569 linhas achando que tinha
 * lido tudo.
 */
/**
 * Conexão PRÓPRIA a cada medição, aberta e fechada na hora.
 *
 * A primeira versão abria um `pg.Client` no início e só voltava a usá-lo depois
 * do laço — 45 minutos ociosa. O servidor derrubou (`ECONNRESET`) e o script
 * morreu DEPOIS de ter feito todo o trabalho, sem imprimir o resultado. O dado
 * estava certo e o relatório se perdeu.
 */
async function medir() {
  const c = new pg.Client(parseDbConfig());
  await c.connect();
  try {
    return await medirCom(c);
  } finally {
    await c.end();
  }
}

async function medirCom(c: pg.Client) {
  const { rows } = await c.query<{
    total: string; fragmentos: string; menor: string; so_titulo: string;
  }>(`
    select count(*) as total,
           count(*) filter (where length(content) < ${PISO}) as fragmentos,
           min(length(content)) as menor,
           count(*) filter (
             where length(content) < ${PISO}
               and btrim(content) = btrim(split_part(heading_path, ' > ',
                     array_length(string_to_array(heading_path,' > '),1)))
           ) as so_titulo
      from chunks where document_id is null`);
  return rows[0]!;
}

async function main() {
  const antes = await medir();
  console.log(
    `\nANTES  ${antes.total} chunks de artigo · ${antes.fragmentos} abaixo de ${PISO} chars` +
      ` (${((+antes.fragmentos / +antes.total) * 100).toFixed(2)}%)` +
      ` · ${antes.so_titulo} são SÓ o título · menor tem ${antes.menor}`,
  );

  const c = new pg.Client(parseDbConfig());
  await c.connect();
  const { rows: alvos } = await c.query<{ node_id: string; article_id: string; space_id: string }>(`
    select distinct node_id, article_id, space_id
      from chunks
     where document_id is null and length(content) < ${PISO}
       and node_id is not null and article_id is not null and space_id is not null`);

  console.log(`${alvos.length} artigos a refazer${SECO ? "   (ensaio — nada será escrito)" : ""}\n`);

  /**
   * ENSAIO QUE PREVÊ, não que conta.
   *
   * Roda o chunker NOVO em memória sobre o conteúdo real dos alvos e diz quantos
   * fragmentos sobrariam. Contar alvos não prova nada — prova é ver o número
   * cair sobre o acervo de verdade, que tem formas que teste de unidade não
   * cobre. E isto roda antes de apagar qualquer linha.
   */
  if (SECO) {
    let antesAmostra = 0, depoisAmostra = 0, artigos = 0, semConteudo = 0;
    for (const a of alvos) {
      const { data: art } = await db
        .from("articles")
        .select("content_json")
        .eq("id", a.article_id)
        .maybeSingle();
      if (!art?.content_json) { semConteudo++; continue; }
      const novos = chunkArticle(art.content_json);
      const { rows: atuais } = await c.query<{ n: string }>(
        `select count(*) filter (where length(content) < ${PISO}) as n
           from chunks where node_id = $1`, [a.node_id]);
      antesAmostra += +(atuais[0]?.n ?? 0);
      depoisAmostra += novos.filter((x) => x.content.length < PISO).length;
      artigos++;
      if (artigos % 100 === 0) console.log(`  simulados ${artigos}/${alvos.length}…`);
    }
    console.log(
      `\nPREVISÃO sobre ${artigos} artigos reais:` +
        `\n  fragmentos hoje ....... ${antesAmostra}` +
        `\n  fragmentos depois ..... ${depoisAmostra}` +
        `\n  eliminados ............ ${antesAmostra - depoisAmostra}` +
        (semConteudo ? `\n  sem conteúdo publicado  ${semConteudo} (serão pulados)` : ""),
    );
    console.log("\nNada foi escrito. Rode sem --seco para aplicar.\n");
    await c.end();
    return;
  }

  // Fecha ANTES do laço: ele leva dezenas de minutos e não usa mais o pg.
  await c.end();

  let feitos = 0, pulados = 0, falhas = 0;
  for (const a of alvos) {
    // Fonte da verdade = o artigo PUBLICADO, igual ao caminho de publicação.
    // Rascunho não é indexado, e indexá-lo aqui vazaria conteúdo não publicado
    // para a busca do portal.
    const { data: art } = await db
      .from("articles")
      .select("id, content_json")
      .eq("id", a.article_id)
      .maybeSingle();
    if (!art?.content_json) { pulados++; continue; }
    try {
      await reindexNodeChunks(db as never, {
        nodeId: a.node_id,
        articleId: art.id,
        spaceId: a.space_id,
        doc: art.content_json,
        withEmbeddings: true,
        embeddedBy: null, // sistema
      });
      feitos++;
      if (feitos % 25 === 0) console.log(`  ${feitos}/${alvos.length}…`);
    } catch (e) {
      falhas++;
      console.error(`  falhou ${a.node_id}: ${(e as Error).message.slice(0, 90)}`);
    }
  }

  const depois = await medir();
  console.log(
    `\nDEPOIS ${depois.total} chunks de artigo · ${depois.fragmentos} abaixo de ${PISO} chars` +
      ` (${((+depois.fragmentos / +depois.total) * 100).toFixed(2)}%)` +
      ` · ${depois.so_titulo} são só o título · menor tem ${depois.menor}`,
  );
  console.log(`\nrefeitos ${feitos} · pulados ${pulados} (sem conteúdo publicado) · falhas ${falhas}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
