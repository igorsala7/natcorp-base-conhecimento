/**
 * Grava a anotação humana em `eval/rag.jsonl` resolvendo TÍTULO → node_id.
 *
 * Anotar digitando uuid é anotar errado: ninguém confere 36 caracteres, e um
 * gabarito com id trocado é pior que gabarito nenhum — ele mede com confiança
 * a coisa errada. Aqui o dono responde por TÍTULO e o script resolve, falhando
 * alto quando o título não existe ou casa mais de um artigo.
 *
 *   npx tsx --env-file=.env.local scripts/anotar-rag.ts '<json>'
 *
 * O json é um array de { pergunta, titulos?, nota?, comportamento?, descartar? }:
 *
 *   titulos       artigos que DEVERIAM vir, do melhor para o pior. `[]` quer
 *                 dizer "não está documentado" — resposta válida, e das mais
 *                 úteis: mede se o agente admite não ter fonte em vez de
 *                 inventar a partir do conhecimento geral do modelo.
 *   comportamento quando o certo não é "qual artigo" e sim o que a resposta
 *                 precisa FAZER. Caso que motivou o campo: pergunta com a tela
 *                 aberta ("me explica esse seguro de vida"), onde a resposta
 *                 certa combina a documentação com os valores da tela — e um
 *                 gabarito só de artigo mediria metade da tarefa.
 *   descartar     não é pergunta de documentação (confirmação, desabafo,
 *                 reclamação sobre o produto). Sai do placar em vez de virar
 *                 ruído com aparência de dado.
 */
import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const ARQ = "eval/rag.jsonl";

type Anotacao = {
  pergunta: string;
  titulos?: string[];
  nota?: string;
  comportamento?: string;
  descartar?: boolean;
};

async function main() {
  const entrada = JSON.parse(process.argv[2] ?? "[]") as Anotacao[];
  if (!Array.isArray(entrada) || !entrada.length) {
    console.error("Passe um array JSON de anotações.");
    process.exit(1);
  }

  const db = new pg.Client(parseDbConfig());
  await db.connect();

  const casos = readFileSync(ARQ, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  const porPergunta = new Map(casos.map((c) => [c.pergunta as string, c]));

  let ok = 0;
  for (const a of entrada) {
    const caso = porPergunta.get(a.pergunta);
    if (!caso) {
      console.error(`  ✗ pergunta não encontrada: "${String(a.pergunta).slice(0, 60)}"`);
      continue;
    }

    if (a.descartar) {
      caso.descartado = true;
      caso.espera_nos = null;
      delete caso.revisar;
      if (a.nota) caso.nota = a.nota;
      console.log(`  ↓ descartado: "${String(caso.pergunta).slice(0, 56)}"`);
      ok++;
      continue;
    }

    // Resolve PRIMEIRO contra os candidatos do próprio caso: é de lá que o
    // título veio, e é lá que ele tem o id exato. Buscar direto em `nodes` pelo
    // `space_id` da conversa erra nos artigos HERDADOS do espaço-pai — que a
    // busca entrega normalmente, mas que não moram no espaço do chat.
    const candidatos = (caso.candidatos ?? []) as {
      node_id: string | null; document_id: string | null; titulo: string;
    }[];
    const ids: string[] = [];
    const docs: string[] = [];
    let falhou = false;
    for (const titulo of a.titulos ?? []) {
      // ARQUIVO da base de conhecimento (as NRs, a CLT) é fonte legítima, não
      // ruído — o dono confirmou em "aceite do ppm": quando a documentação do
      // produto não cobre, a norma embutida responde. Ele vive em
      // `document_id`, não em `nodes`, e um gabarito só de artigo contaria
      // essas respostas como erro.
      const doc = candidatos.filter((c) => c.document_id && c.titulo?.toLowerCase() === titulo.toLowerCase());
      if (doc.length === 1) { docs.push(doc[0]!.document_id!); continue; }

      const doCaso = candidatos.filter((c) => c.node_id && c.titulo?.toLowerCase() === titulo.toLowerCase());
      if (doCaso.length === 1) { ids.push(doCaso[0]!.node_id!); continue; }

      // Arquivo que NÃO está entre os candidatos: é o caso mais interessante do
      // gabarito — a fonte certa que a busca não devolveu. Resolve pelo nome do
      // arquivo, já que `knowledge_documents` não tem título.
      const { rows: arq } = await db.query<{ id: string }>(
        `select id from knowledge_documents
          where (space_id = $1 or space_id = (select parent_space_id from spaces where id = $1))
            and lower(original_name) = lower($2)`,
        [caso.space_id, titulo],
      );
      // Duplicata NÃO é ambiguidade aqui: medido em 21/08/2026, a CLT está
      // carregada 3× no mesmo espaço (o mesmo arquivo competindo consigo mesmo
      // por vaga). Qualquer uma das cópias satisfaz "a CLT veio", então todas
      // entram como alternativas equivalentes — quem pontuar deve exigir UMA
      // delas, não todas.
      if (arq.length >= 1) { docs.push(...arq.map((r) => r.id)); continue; }

      const { rows } = await db.query<{ id: string }>(
        `select n.id from nodes n
           join spaces s on s.id = n.space_id
          where (n.space_id = $1 or n.space_id = (select parent_space_id from spaces where id = $1))
            and n.type = 'article' and n.status = 'published'
            and n.deleted_at is null and lower(n.title) = lower($2)`,
        [caso.space_id, titulo],
      );
      if (rows.length === 0) { console.error(`  ✗ título não existe: "${titulo}"`); falhou = true; continue; }
      if (rows.length > 1) { console.error(`  ✗ título ambíguo (${rows.length} artigos): "${titulo}"`); falhou = true; continue; }
      ids.push(rows[0]!.id);
    }
    // Gabarito pela metade é pior que gabarito ausente: seria contado como
    // acerto parcial num caso que ninguém decidiu.
    if (falhou) { console.error(`    → "${String(caso.pergunta).slice(0, 50)}" NÃO gravado`); continue; }

    caso.espera_nos = ids;
    if (docs.length) caso.espera_docs = docs;
    if (a.nota) caso.nota = a.nota;
    if (a.comportamento) caso.comportamento = a.comportamento;
    delete caso.revisar;
    const alvo = a.titulos?.length ? a.titulos.join(" · ") : "(não documentado)";
    console.log(`  ✓ "${String(caso.pergunta).slice(0, 52)}" → ${alvo}`);
    ok++;
  }
  await db.end();

  writeFileSync(ARQ, casos.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
  const anotados = casos.filter((c) => !c.revisar).length;
  console.log(`\n  ${ok} gravado(s) · ${anotados}/${casos.length} casos anotados`);
}

main().catch((e) => { console.error(e); process.exit(1); });
