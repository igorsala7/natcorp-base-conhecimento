/**
 * "TOTAL DE REMUNERAÇÃO" NÃO ESTÁ EM LUGAR NENHUM DAS DUAS DESCRIÇÕES.
 *
 * Regra do dono (24/08/2026): Total de Remuneração = Salário + Remuneração
 * Variável. São coisas diferentes.
 *
 * O `_resumido` diz que traz "salário" e nada sobre variável ou total; o
 * completo lista documentos e dados bancários e também não menciona. Quem
 * pergunta "faça pelo total da remuneração" não tem como o modelo saber qual das
 * duas responde — e no gabarito ele foi para o resumido, que não tem o campo.
 *
 * ── POR QUE REESCREVER, E NÃO ACRESCENTAR ─────────────────────────────────
 * Em 23/08 eu pendurei cláusulas de "quando NÃO usar" no fim de três descrições
 * e MEDI: 16 → 13/14. Piorou. A hipótese (não provada) é que veto no fim desloca
 * a atenção do que a ferramenta FAZ. Aqui o fato entra DENTRO da lista de
 * campos, que é onde o modelo procura o que a ferramenta responde.
 *
 * ── O QUE FOI MEDIDO, E O QUE NÃO SAIU COMO O DESENHO ─────────────────────
 * Recorte de 31 casos do par + controles, `--funil`, gemini-3.5-flash:
 *
 *     ANTES   8 · 8 · 8       DEPOIS   9 · 9 · 9
 *
 * O agregado sobe 1 e é reprodutível dos dois lados. Mas a atribuição caso a
 * caso desmente o mecanismo:
 *
 *   consertou   "E o Tony Oliveira?"  ·  "calcule utlizando este anexo"
 *   QUEBROU     "Então faça pelo total da remuneração"  ← o alvo da reescrita
 *
 * Ou seja: ela erra o caso que motivou o texto e acerta dois por um caminho que
 * eu não controlo. A composição das falhas ainda varia entre rodadas mesmo com
 * o placar estável, então o +1 é agregado, não é um caso específico ganho.
 *
 * Aplicada assim mesmo por um motivo que não é o placar: o texto ficou
 * VERDADEIRO. "Total de Remuneração = Salário + Remuneração Variável" é regra do
 * dono (24/08), e nenhuma das duas descrições dizia qual delas tem o campo.
 * Corrigir informação ausente não depende do número subir — e o número que não
 * subiu do jeito planejado está escrito aqui para ninguém contar como vitória.
 *
 *   npx tsx --env-file=.env.local scripts/reescrever-cadastro-remuneracao.ts [--seco|--desfazer]
 *
 * Depois: npm run embed:tools:base (a mudança por SQL não regera o vetor).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BACKUP = ".audit/desc-antes-remuneracao.json";

const EDICOES: { key: string; de: string; para: string }[] = [
  {
    key: "informacoes_pessoais_funcionais_resumido",
    de: "cargo, função, salário, vínculo e sindicato.",
    para:
      "cargo, função, SALÁRIO BASE (não traz remuneração variável nem o total da remuneração), " +
      "vínculo e sindicato.",
  },
  {
    key: "informacoes_pessoais_funcionais",
    de: "dados bancários e histórico.",
    para:
      "dados bancários, histórico e a REMUNERAÇÃO COMPLETA — salário base, remuneração VARIÁVEL e " +
      "o TOTAL DA REMUNERAÇÃO (salário + variável), que o resumido NÃO tem.",
  },
];

async function main() {
  const seco = process.argv.includes("--seco");
  const desfazer = process.argv.includes("--desfazer");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("faltam as variáveis do Supabase"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } });

  if (desfazer) {
    if (!existsSync(BACKUP)) { console.error(`sem ${BACKUP}`); process.exit(1); }
    for (const t of JSON.parse(readFileSync(BACKUP, "utf8")) as { key: string; description: string }[]) {
      const { error } = await db.from("ai_tools").update({ description: t.description }).eq("key", t.key);
      console.log(`${error ? "ERRO " + error.message : "restaurado"}  ${t.key}`);
    }
    return;
  }

  const chaves = EDICOES.map((e) => e.key);
  const { data, error } = await db.from("ai_tools").select("key, description").in("key", chaves);
  if (error) { console.error(error.message); process.exit(1); }
  if (!existsSync(BACKUP) && !seco) writeFileSync(BACKUP, JSON.stringify(data, null, 2));
  const atual = new Map((data ?? []).map((t) => [(t as { key: string }).key, String((t as { description: string }).description)]));

  for (const e of EDICOES) {
    const desc = atual.get(e.key);
    if (!desc) { console.log(`AUSENTE  ${e.key}`); continue; }
    if (desc.includes(e.para)) { console.log(`já feita ${e.key}`); continue; }
    if (!desc.includes(e.de)) { console.error(`TRECHO NÃO ENCONTRADO em ${e.key} — a descrição mudou; revise antes.`); process.exit(1); }
    console.log(`\n■ ${e.key}`);
    console.log(`  − ${e.de}`);
    console.log(`  + ${e.para}`);
    if (seco) continue;
    const { error: err } = await db.from("ai_tools").update({ description: desc.replace(e.de, e.para) }).eq("key", e.key);
    if (err) console.error(`  ERRO: ${err.message}`);
  }
  console.log(seco ? "\n--seco: nada gravado." : "\nAplicado. Agora regere os vetores.");
}

main().catch((e) => { console.error(e); process.exit(1); });
