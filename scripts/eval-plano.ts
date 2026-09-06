/**
 * PLANO ÚNICO DE INTENÇÃO × os classificadores de hoje — read-only.
 *
 * Roda `planejarIntencao` sobre perguntas REAIS gravadas em `ai_chat_traces` e
 * compara com o que `interpretarConsulta` e `analisarPedido` decidiram naquele
 * turno. Não toca em produção e não altera nada: é o "shadow mode" do §B do
 * plano externo, feito onde ele custa menos — contra o registro, e não ao vivo.
 *
 * ── POR QUE NÃO SHADOW AO VIVO ──────────────────────────────────────────────
 * Shadow ao vivo acrescenta uma QUARTA ida ao modelo no caminho crítico de todo
 * turno, para medir uma mudança cujo objetivo é justamente tirar uma ida. Paga-se
 * latência e custo no usuário para produzir um número que o registro já permite
 * produzir. A diretriz do projeto é explícita: simular contra os traces, com a
 * informação que o código TERÁ — não com hindsight.
 *
 * ── O QUE ESTE PLACAR PODE E NÃO PODE DIZER ─────────────────────────────────
 * PODE: onde o planner unificado DIVERGE do de hoje, e quanto custa em tempo.
 * NÃO PODE: quem está certo. Não há gabarito de intenção — `eval/cenarios.jsonl`
 * rotula FERRAMENTA esperada, não módulo esperado. Divergência aqui é um pedido
 * de inspeção humana, nunca um veredito. Por isso a saída lista os casos.
 *
 *   npx tsx --env-file=.env.local scripts/eval-plano.ts --n 40
 *   npx tsx --env-file=.env.local scripts/eval-plano.ts --n 40 --base natcorp
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { planejarIntencao } from "../src/lib/ia/plano-intencao";
import type { ModuleTag } from "../src/lib/integrations/module-match";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const arg = (nome: string, padrao = "") => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
const N = Number(arg("n", "30"));
const BASE = arg("base", "");
const DIAS = Number(arg("dias", "20"));

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Passo = { passo: string; info?: Record<string, unknown> | null };

const { data: traces } = await db
  .from("ai_chat_traces")
  .select("id, created_at, base_code, space_id, pergunta, passos, conversation_id")
  .gte("created_at", new Date(Date.now() - DIAS * 864e5).toISOString())
  .not("pergunta", "is", null)
  .order("created_at", { ascending: false })
  .limit(600);

const infoDe = (ps: Passo[], nome: string) => ps.find((p) => p.passo === nome)?.info ?? null;

const casos = (traces ?? [])
  .filter((t) => !BASE || t.base_code === BASE)
  .map((t) => {
    const ps = (t.passos as unknown as Passo[]) ?? [];
    const analise = infoDe(ps, "integracoes:analise");
    const rewrite = infoDe(ps, "query_rewrite");
    return { t, analise, rewrite };
  })
  // Só serve o turno em que o classificador REALMENTE rodou: quando ele foi
  // pulado, não há decisão com que comparar.
  .filter((c) => c.analise && c.rewrite && c.rewrite.pulado !== true && c.t.base_code && c.t.space_id)
  .slice(0, N);

if (!casos.length) {
  console.log("Nenhum turno com `integracoes:analise` e reescrita não pulada na janela. Aumente --dias.");
  process.exit(0);
}

/** Tags do catálogo daquela base — o mesmo vocabulário que `analisarPedido` viu. */
const tagsPorBase = new Map<string, ModuleTag[]>();
async function tagsDe(baseCode: string): Promise<ModuleTag[]> {
  const cache = tagsPorBase.get(baseCode);
  if (cache) return cache;
  const { data: base } = await db.from("ai_bases").select("id").ilike("base_code", baseCode).maybeSingle();
  if (!base) return [];
  const { data: vinculos } = await db.from("ai_base_tools").select("tool_id").eq("base_id", base.id);
  const ids = (vinculos ?? []).map((v) => v.tool_id);
  const tags: ModuleTag[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("ai_tool_modules").select("modulo, submodulo, tool_id").in("tool_id", ids.slice(i, i + 200));
    for (const m of data ?? []) tags.push({ modulo: m.modulo, submodulo: m.submodulo ?? null });
  }
  tagsPorBase.set(baseCode, tags);
  return tags;
}

/**
 * O HISTÓRICO E A TELA TÊM DE IR JUNTO — a primeira rodada deste script os
 * omitiu e o placar saiu em 7% de consulta equivalente. Não era o planner: era
 * eu mandando ele resolver "Dessa tela aberta" e "Ok, agora crie" sem conversa
 * e sem tela, enquanto o `interpretarConsulta` de produção recebe as duas.
 * Comparar assim mede o arreio, não o cavalo.
 *
 * `interpretarConsulta` fatia `slice(-6, -1)` — ou seja, espera a pergunta
 * corrente como ÚLTIMO item. Reproduz-se isso aqui.
 */
async function contexto(convId: string | null, quando: string, pergunta: string) {
  if (!convId) return { historico: [{ role: "user", content: pergunta }], tela: "" };
  const [{ data: msgs }, { data: conv }] = await Promise.all([
    db.from("messages").select("role, content, created_at").eq("conversation_id", convId).lt("created_at", quando).order("created_at", { ascending: true }).limit(40),
    db.from("conversations").select("page").eq("id", convId).maybeSingle(),
  ]);
  const historico = (msgs ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => ({ role: m.role as string, content: String(m.content ?? "") }));
  historico.push({ role: "user", content: pergunta });
  return { historico, tela: String((conv as { page?: string } | null)?.page ?? "") };
}

const chave = (m: ModuleTag) => `${m.modulo}${m.submodulo ? `/${m.submodulo}` : ""}`;
const conjunto = (ms: ModuleTag[]) => [...new Set(ms.map(chave))].sort().join(" | ") || "(todos)";

let igualDados = 0, igualModulos = 0, sobrepoe = 0, igualConsulta = 0, msTotal = 0, falhou = 0;
const divergencias: string[] = [];

for (const c of casos) {
  const tags = await tagsDe(c.t.base_code!);
  const antesDados = (c.analise as { precisaDados?: boolean }).precisaDados !== false;
  const antesModulos = (((c.analise as { modulos?: unknown }).modulos ?? []) as unknown[]).map((m) =>
    typeof m === "string" ? { modulo: m, submodulo: null } : (m as ModuleTag),
  );
  const antesConsulta = String((c.rewrite as { consulta?: string }).consulta ?? "");

  const ctx = await contexto(c.t.conversation_id, c.t.created_at, c.t.pergunta!);
  const t0 = Date.now();
  const plano = await planejarIntencao({
    spaceIds: c.t.space_id!,
    pergunta: c.t.pergunta!,
    historico: ctx.historico,
    contextoTela: ctx.tela,
    tags,
  });
  msTotal += Date.now() - t0;
  if (plano.origem !== "modelo") { falhou++; continue; }

  const mesmoDados = plano.precisaDados === antesDados;
  const a = conjunto(antesModulos), b = conjunto(plano.modulos);
  const mesmoModulos = a === b;
  const setA = new Set(antesModulos.map(chave)), setB = new Set(plano.modulos.map(chave));
  const temSobreposicao = [...setB].some((k) => setA.has(k)) || (!setA.size && !setB.size);
  // A reescrita é texto livre: comparar por igualdade seria ruído. Compara o
  // conjunto de palavras com 4+ letras, que é o que o embedding vê de fato.
  const palavras = (s: string) => new Set(s.toLowerCase().match(/[a-zà-ú]{4,}/g) ?? []);
  const pa = palavras(antesConsulta), pb = palavras(plano.consulta);
  const inter = [...pb].filter((w) => pa.has(w)).length;
  const jaccard = pa.size || pb.size ? inter / new Set([...pa, ...pb]).size : 1;

  if (mesmoDados) igualDados++;
  if (mesmoModulos) igualModulos++;
  if (temSobreposicao) sobrepoe++;
  if (jaccard >= 0.6) igualConsulta++;

  if (!mesmoDados || !mesmoModulos || jaccard < 0.6) {
    divergencias.push(
      `  "${c.t.pergunta!.slice(0, 60)}"\n` +
        (mesmoDados ? "" : `      precisaDados: ${antesDados} → ${plano.precisaDados}\n`) +
        (mesmoModulos ? "" : `      módulos: ${a}  →  ${b}\n`) +
        (jaccard >= 0.6 ? "" : `      consulta: "${antesConsulta.slice(0, 50)}" → "${plano.consulta.slice(0, 50)}" (jaccard ${jaccard.toFixed(2)})\n`) +
        `      confiança ${plano.confianca.toFixed(2)}`,
    );
  }
}

const n = casos.length - falhou;
const pct = (v: number) => `${((100 * v) / (n || 1)).toFixed(0)}%`;
console.log(`\n${casos.length} turnos reais · ${falhou} fallback do planner · ${n} comparáveis\n`);
console.log("── CONCORDÂNCIA COM OS CLASSIFICADORES DE HOJE ──────────────");
console.log(`  precisaDados igual        ${igualDados}/${n}  ${pct(igualDados)}`);
console.log(`  recorte de módulos igual  ${igualModulos}/${n}  ${pct(igualModulos)}`);
console.log(`  recorte com sobreposição  ${sobrepoe}/${n}  ${pct(sobrepoe)}   ← divergir aqui não é errar`);
console.log(`  consulta equivalente      ${igualConsulta}/${n}  ${pct(igualConsulta)}   (jaccard ≥ 0,60)`);
console.log(`\n  latência do planner ÚNICO  ${Math.round(msTotal / (casos.length || 1))} ms/turno`);
console.log(`  hoje, as duas idas que ele substituiria: 745 ms (query_rewrite) + 1.648 ms (analise) = 2.393 ms`);
console.log(`\nNÃO HÁ GABARITO DE INTENÇÃO. Divergência abaixo é pedido de inspeção, não veredito.`);
if (divergencias.length) {
  console.log(`\n── DIVERGÊNCIAS (${divergencias.length}) ──────────────────────────────────`);
  console.log(divergencias.join("\n"));
}
