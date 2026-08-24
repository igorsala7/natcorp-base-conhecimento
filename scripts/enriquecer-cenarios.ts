/**
 * ACRESCENTA AO GABARITO O QUE O TRACE JÁ SABE — e o caso jogava fora.
 *
 * `eval/cenarios.jsonl` guarda pergunta, histórico, tela, ofertadas e o veredito
 * do dono. Não guarda de que CLIENTE o turno era, em que ESPAÇO aconteceu, nem
 * com que PERFIL. Sem isso, todo eval roda com `--base natcorp` fixo.
 *
 * ── O QUE ISSO JÁ CUSTOU ───────────────────────────────────────────────────
 * Medido em 24/08: 30 dos 138 casos são de OUTRO cliente (stefanini 9, leadec 9,
 * incor 5, saude 4, teste_fatura 2, stefanini-dev 1) e 18 estão em outro espaço.
 * Então **22% das simulações de funil rodaram contra o catálogo errado** — e
 * isso inclui as minhas de 23 e 24/08, que foram usadas para aprovar e reprovar
 * mudanças. Não é um erro futuro a evitar: é medição já tomada como verdade.
 *
 * ── A JUNÇÃO ───────────────────────────────────────────────────────────────
 * Mesma de `carregar-casos-rotulados.ts`: pergunta idêntica + instante do
 * `foi_em` dentro de 3s. Provada em 138/138.
 *
 *   npx tsx --env-file=.env.local scripts/enriquecer-cenarios.ts [--seco]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const ARQUIVO = "eval/cenarios.jsonl";
const SECO = process.argv.includes("--seco");

type Trace = {
  id: string; pergunta: string; space_id: string; base_code: string | null;
  p_perfil: string | null; conversation_id: string | null; created_at: string;
  passos: { passo?: string; info?: Record<string, unknown> }[] | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("faltam as variáveis do Supabase"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Paginado: o PostgREST corta em 1000 SEM AVISAR.
  const traces: Trace[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("ai_chat_traces")
      .select("id, pergunta, space_id, base_code, p_perfil, conversation_id, created_at, passos")
      .range(de, de + 999);
    if (error) { console.error("falhou ao ler os traces:", error.message); process.exit(1); }
    traces.push(...((data ?? []) as unknown as Trace[]));
    if (!data || data.length < 1000) break;
  }

  const linhas = readFileSync(ARQUIVO, "utf8").trim().split("\n").filter(Boolean);
  const casos = linhas.map((l) => JSON.parse(l) as Record<string, unknown>);

  let casou = 0;
  const porBase: Record<string, number> = {};
  const saida = casos.map((c) => {
    const pergunta = String(c.pergunta ?? "");
    const iguais = traces.filter((t) => t.pergunta === pergunta);
    let t: Trace | undefined = iguais[0];
    if (c.foi_em && iguais.length > 1) {
      const alvo = new Date(String(c.foi_em)).getTime();
      t = iguais.find((x) => Math.abs(new Date(x.created_at).getTime() - alvo) < 3000) ?? iguais[0];
    }
    if (!t) return c;
    casou++;
    // Minúsculas: o mesmo cliente aparece como "natcorp" e "NATCORP" nos traces,
    // e duas grafias viram dois catálogos na hora de simular.
    const base = (t.base_code ?? "").trim().toLowerCase() || null;
    if (base) porBase[base] = (porBase[base] ?? 0) + 1;
    /**
     * A DOSE DO RAG É PARTE DA HIPÓTESE, não detalhe de execução.
     *
     * `ragLimit` varia 0/1/2/3/4/6/8/18 conforme o turno (`route.ts:1163`):
     * pergunta de dado recebe 4 trechos, documental recebe 8-18. Recomputar com
     * limite FIXO mediria uma competição documentação × ferramenta que aquele
     * turno nunca teve.
     *
     * `lexico` idem: em modo relatório ou roteado a tool, a produção PULA o
     * embedding. Recomputar híbrido ali inventaria qualidade de recuperação.
     */
    const passoRag = (t.passos ?? []).find((p) => p?.passo === "rag")?.info ?? {};
    return {
      ...c,
      base_code: base,
      space_id: t.space_id,
      p_perfil: t.p_perfil,
      trace_id: t.id,
      rag_limite: typeof passoRag.limite === "number" ? passoRag.limite : null,
      rag_lexico: passoRag.lexico === true,
      rag_motivo: typeof passoRag.motivo === "string" ? passoRag.motivo : null,
      rag_fontes: typeof passoRag.fontes === "number" ? passoRag.fontes : null,
    };
  });

  console.log(`${casos.length} casos · ${traces.length} traces · casaram ${casou}`);
  console.log(`clientes: ${Object.entries(porBase).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(" · ")}`);
  const foraDaNatcorp = casou - (porBase.natcorp ?? 0);
  console.log(`\ncasos que NÃO são natcorp: ${foraDaNatcorp} (${Math.round((foraDaNatcorp / Math.max(1, casou)) * 100)}%) — rodavam contra o catálogo errado`);

  if (SECO) { console.log("\n--seco: nada foi gravado."); return; }
  writeFileSync(ARQUIVO, saida.map((x) => JSON.stringify(x)).join("\n") + "\n");
  console.log(`\n${ARQUIVO} enriquecido com base_code, space_id, p_perfil e trace_id.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
