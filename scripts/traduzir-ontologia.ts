/**
 * COMPLETA A TRADUÇÃO DA ONTOLOGIA de um espaço.
 *
 * Existe porque o job só era disparado pela tela do admin, e o run tinha um
 * defeito de paginação: lia os 1.000 primeiros termos, achava todos já
 * traduzidos e se declarava concluído com `0/0 (100%)`. Medido em 23/08/2026:
 * 1.000 traduções para 4.424 termos no espaço `natcorp`.
 *
 * Corrigido em `ontology-translate-run.ts` (agora usa `fetchAllPaged`), mas o
 * conserto sozinho não traduz nada — alguém precisa mandar rodar de novo. Isto
 * aqui é esse alguém, para não depender de clicar na tela.
 *
 *   npx tsx --env-file=.env.local scripts/traduzir-ontologia.ts <space-slug> [idioma]
 *   npx tsx --env-file=.env.local scripts/traduzir-ontologia.ts natcorp en --seco
 *
 * `--seco` só informa quantos faltam. CUSTA CHAMADAS DE IA — confira o número
 * antes de rodar de verdade.
 */
import { createClient } from "@supabase/supabase-js";
import { runTraducaoOntologia } from "@/lib/ai/ontology-translate-run";
import { fetchAllPaged } from "@/lib/supabase/paginate";

async function main() {
  const [slug, lang = "en"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const seco = process.argv.includes("--seco");
  if (!slug) { console.error("uso: scripts/traduzir-ontologia.ts <space-slug> [idioma] [--seco]"); process.exit(1); }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("faltam as variáveis do Supabase"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: space } = await db.from("spaces").select("id, name").eq("slug", slug).maybeSingle();
  if (!space) { console.error(`espaço "${slug}" não encontrado`); process.exit(1); }
  const spaceId = (space as { id: string }).id;

  // Paginado pelo mesmo motivo que o run: contar por cima do teto de 1.000 daria
  // o número errado justamente na medição que decide se vale gastar com IA.
  const termos = await fetchAllPaged<{ id: string }>((de, ate) =>
    db.from("ontology_terms").select("id").eq("space_id", spaceId).order("id", { ascending: true }).range(de, ate),
  );
  const traduzidos = await fetchAllPaged<{ term_id: string }>((de, ate) =>
    db.from("ontology_translations").select("term_id").eq("lang", lang).order("term_id", { ascending: true }).range(de, ate),
  );
  const jaTem = new Set(traduzidos.map((t) => t.term_id));
  const faltam = termos.filter((t) => !jaTem.has(t.id)).length;

  console.log(`espaço ${slug} · idioma ${lang}`);
  console.log(`  termos: ${termos.length} · já traduzidos: ${termos.length - faltam} · FALTAM ${faltam}`);
  if (seco) { console.log("\n--seco: nada foi traduzido."); return; }
  if (!faltam) { console.log("\nnada a fazer."); return; }

  const { data: job, error } = await db
    .from("ontology_translation_jobs")
    .insert({ space_id: spaceId, lang, status: "queued", total: 0, done: 0, progress: 0 })
    .select("id").single();
  if (error) { console.error("falhou ao criar o job:", error.message); process.exit(1); }

  console.log(`\njob ${(job as { id: string }).id} — traduzindo…`);
  const t0 = Date.now();
  const { traduzidos: n, naoTraduzidos } = await runTraducaoOntologia(db as never, (job as { id: string }).id, (done, total) => {
    if (done % 200 === 0 || done === total) {
      console.log(`   ${done}/${total} (${Math.round((done / Math.max(1, total)) * 100)}%) · ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  });
  console.log(`\ntraduzidos: ${n} em ${Math.round((Date.now() - t0) / 1000)}s`);
  if (naoTraduzidos) {
    console.error(`ATENÇÃO: ${naoTraduzidos} termo(s) ficaram sem tradução (lote que falhou ou resposta curta do modelo).`);
    console.error("Rode de novo — é idempotente e pega só o que faltou.");
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
