/**
 * PROPÕE o nó responsável por cada termo da ontologia, pelo título do artigo.
 *
 * `ontology_terms.node_id` marca o artigo/diretório RESPONSÁVEL por um termo.
 * Quando ele existe, `rag.ts` garante que o responsável entre no contexto mesmo
 * que a fusão o tenha deixado de fora (`rag.ts:284`, injeção forçada, no máximo
 * UM resultado por turno). O caminho está pronto e correto — e nunca rodou:
 * medido em 20/08/2026, `node_id` é NULL em 5.569 de 5.569 termos.
 *
 * O vínculo não precisa ser adivinhado quando o termo se chama EXATAMENTE como
 * um artigo publicado do mesmo espaço. São 499 casos; 84 casam com dois ou mais
 * artigos e ficam de fora, porque vínculo ambíguo é chute com cara de dado.
 *
 * ── Por que isto NÃO liga tudo sozinho ──────────────────────────────────────
 * Entre os 415 inequívocos há termos como "Acesso", "Gestor", "Calcular" e
 * "Destacar" — palavras que aparecem em qualquer pergunta. Vincular essas
 * forçaria o artigo "Calcular" no contexto toda vez que alguém dissesse
 * "calcular", que é exatamente o ruído que a injeção forçada deveria evitar.
 *
 * Então o critério separa:
 *
 *   SEGURO   termo de 2+ palavras ("Adicional Noturno Especial"), ou sigla em
 *            caixa alta ("PPP", "SEFIP", "G.R.R.F") — não casam por acaso.
 *   REVISAR  palavra única comum. Vai para a lista, não para o banco: quem
 *            decide qual artigo responde por "Gestor" é quem escreveu a
 *            documentação, na tela de Ontologia.
 *
 *   npx tsx --env-file=.env.local scripts/vincular-termo-ao-artigo.ts
 *   npx tsx --env-file=.env.local scripts/vincular-termo-ao-artigo.ts --aplicar
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
const db = createClient<Database>(url, serviceRole, { auth: { persistSession: false } });

/** Sigla: tudo em caixa alta, 2+ caracteres, só letras/ponto/hífen. */
const ehSigla = (t: string) => /^[A-ZÀ-Ý][A-ZÀ-Ý.\-]+$/.test(t.trim());
/** Palavra única e comum é o que não pode entrar sozinho. */
const ehSeguro = (t: string) => t.trim().split(/\s+/).length >= 2 || ehSigla(t);

type Linha = { term_id: string; term: string; node_id: string; titulo: string };

async function main() {
  // Uma varredura só, montando o índice de títulos publicados por espaço.
  const titulos = new Map<string, { id: string; titulo: string }[]>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("nodes")
      .select("id, space_id, title, type, status")
      .eq("type", "article")
      .eq("status", "published")
      .range(de, de + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const n of data) {
      if (!n.title) continue;
      const chave = `${n.space_id}|${n.title.trim().toLowerCase()}`;
      titulos.set(chave, [...(titulos.get(chave) ?? []), { id: n.id, titulo: n.title }]);
    }
    if (data.length < 1000) break;
  }

  const seguros: Linha[] = [];
  const revisar: Linha[] = [];
  let ambiguos = 0;
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("ontology_terms")
      .select("id, term, space_id, node_id")
      .is("node_id", null)
      .range(de, de + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const t of data) {
      const casos = titulos.get(`${t.space_id}|${t.term.trim().toLowerCase()}`);
      if (!casos?.length) continue;
      if (casos.length > 1) { ambiguos++; continue; }
      const linha: Linha = { term_id: t.id, term: t.term, node_id: casos[0]!.id, titulo: casos[0]!.titulo };
      (ehSeguro(t.term) ? seguros : revisar).push(linha);
    }
    if (data.length < 1000) break;
  }

  console.log(`\n  ${seguros.length} vínculos SEGUROS (2+ palavras ou sigla)`);
  console.log(`  ${revisar.length} para REVISAR na tela de Ontologia (palavra única comum)`);
  console.log(`  ${ambiguos} descartados por ambiguidade (o termo casa 2+ artigos)`);

  if (revisar.length) {
    console.log("\n  a revisar — decida na tela quem responde por cada um:");
    for (const r of revisar) console.log(`    "${r.term}"`);
  }

  if (!APLICAR) {
    console.log("\n  ENSAIO — nada foi escrito. Rode com --aplicar para gravar os seguros.\n");
    return;
  }

  let ok = 0, erros = 0;
  for (const s of seguros) {
    const { error } = await db.from("ontology_terms").update({ node_id: s.node_id }).eq("id", s.term_id);
    if (error) { erros++; console.error(`  falhou "${s.term}": ${error.message}`); } else ok++;
  }
  console.log(`\n  ${ok} vinculados · ${erros} falha(s)`);
  console.log("  A injeção forçada passa a valer para esses termos (rag.ts:284).\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
