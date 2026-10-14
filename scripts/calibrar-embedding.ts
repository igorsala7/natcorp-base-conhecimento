/**
 * TROCAR O MODELO DE EMBEDDING SEM QUEBRAR OS LIMIARES — read-only.
 *
 * O roteamento de ferramentas tem ~20 cortes em COSSENO ABSOLUTO (0,56 para
 * oferecer, 0,70 para ir direto, pisos do top-K, 0,60 do aprendizado…), todos
 * calibrados no modelo atual. Cada modelo tem a sua escala: o mesmo par de
 * textos dá 0,72 num e 0,58 noutro. Trocar o modelo sem converter os cortes
 * desliga o roteamento direto sem erro nenhum no log.
 *
 * O que este script faz, sem gravar nada:
 *   1. vetoriza com os DOIS modelos as perguntas reais do gabarito
 *      (`ai_tool_casos`) e o texto de cada ferramenta da base — o mesmo texto
 *      que o sync grava (`textosDaBase`);
 *   2. compara a QUALIDADE: em que posição a ferramenta certa aparece
 *      (acerto@1, @5, @12 — o top-K que chega ao modelo é 12);
 *   3. converte cada corte por QUANTIL: o corte novo deixa passar a mesma
 *      fração de pares que o antigo deixava. Cortes que olham o MELHOR
 *      candidato (direto, oferta, piso) usam a distribuição do top-1 de cada
 *      pergunta; margens aditivas usam a razão das dispersões.
 *
 *   npm run embed:calibrar -- --novo gemini-embedding-2
 *   npm run embed:calibrar -- --novo gemini-embedding-2 --base natcorp
 */
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Database } from "../src/lib/database.types";
import { tryDecryptSecret } from "../src/lib/crypto/secrets";
import { textosDaBase } from "../src/lib/integrations/tool-catalog";
import { EMBEDDING_DIM } from "../src/lib/ai/catalog";

const arg = (n: string, p: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : p;
};
const NOVO = arg("novo", "gemini-embedding-2");
const BASE = arg("base", "natcorp");

/** Cortes ABSOLUTOS do código, com o que cada um olha. */
const CORTES: { nome: string; valor: number; dist: "top1" | "pares" | "consultas" }[] = [
  { nome: "route LIMIAR_COMPOSTO_FORTE", valor: 0.75, dist: "top1" },
  { nome: "route LIMIAR_DIRETO / matchBaseTools padrão", valor: 0.70, dist: "top1" },
  { nome: "tool-narrow MIN_SEM", valor: 0.60, dist: "top1" },
  { nome: "tool-narrow MIN_ANTIFLOOD", valor: 0.58, dist: "top1" },
  { nome: "route LIMIAR_OFERTA", valor: 0.56, dist: "top1" },
  { nome: "tool-narrow MIN_SEM_RELAX", valor: 0.55, dist: "pares" },
  { nome: "route pool largo (clarify)", valor: 0.45, dist: "pares" },
  { nome: "tool-narrow MIN_SEM_FACETA", valor: 0.45, dist: "pares" },
  { nome: "route 'outra fonte'", valor: 0.35, dist: "pares" },
  { nome: "saved-reports LIMIAR", valor: 0.33, dist: "pares" },
  { nome: "SQL tool_uso_vizinhos p_min_sim", valor: 0.60, dist: "consultas" },
];
const MARGENS: { nome: string; valor: number }[] = [
  { nome: "tool-narrow MARGEM_SEM / MARGEM_FACETA / route MARGEM_TOP*", valor: 0.08 },
  { nome: "tool-narrow MARGEM_SEM_RELAX", valor: 0.16 },
  { nome: "route MARGEM_TOP", valor: 0.06 },
  { nome: "tool-narrow FAIXA_DISPUTA", valor: 0.05 },
  { nome: "aprendizado MAX_BONUS", valor: 0.06 },
];

function cos(a: number[], b: number[]): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
const ordenar = (xs: number[]) => [...xs].sort((a, b) => a - b);
/** Fração dos valores ≥ t. */
const fracAcima = (ord: number[], t: number) => ord.filter((x) => x >= t).length / ord.length;
/** O valor que deixa a fração `f` acima dele. */
const quantilAcima = (ord: number[], f: number) => {
  if (f <= 0) return ord[ord.length - 1]! + 0.001;
  const i = Math.min(ord.length - 1, Math.max(0, Math.round((1 - f) * (ord.length - 1))));
  return ord[i]!;
};
const desvio = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const pct = (ord: number[], p: number) => ord[Math.min(ord.length - 1, Math.floor(p * (ord.length - 1)))]!;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) { console.error("Faltam credenciais do Supabase."); process.exit(1); }
  const db = createClient<Database>(url, chave, { auth: { persistSession: false } });

  const { data: atrib } = await db.from("ai_assignments").select("model, provider_id").eq("purpose", "embedding").eq("base_code", "").single();
  const { data: prov } = await db.from("ai_providers").select("kind, ai_provider_keys(api_key_enc)").eq("id", atrib!.provider_id).single();
  if (prov?.kind !== "google") { console.error("Este script compara modelos Google (o provedor de embedding atual não é)."); process.exit(1); }
  const rel = (prov as unknown as { ai_provider_keys?: { api_key_enc?: string } | { api_key_enc?: string }[] }).ai_provider_keys;
  const apiKey = tryDecryptSecret(Array.isArray(rel) ? rel[0]?.api_key_enc : rel?.api_key_enc);
  if (!apiKey) { console.error("Chave do Google não abriu."); process.exit(1); }
  const ATUAL = atrib!.model;
  if (ATUAL === NOVO) { console.error(`O modelo atual já é ${NOVO}.`); process.exit(1); }
  const g = createGoogleGenerativeAI({ apiKey });

  const vetorizar = async (modelo: string, textos: string[]) => {
    const out: number[][] = [];
    for (let i = 0; i < textos.length; i += 100) {
      const { embeddings } = await embedMany({
        model: g.textEmbeddingModel(modelo),
        values: textos.slice(i, i + 100),
        providerOptions: { google: { outputDimensionality: EMBEDDING_DIM } },
      });
      out.push(...(embeddings as number[][]));
    }
    return out;
  };

  // Gabarito: a ferramenta CERTA de cada pergunta (rótulo do dono vence a escolhida).
  const { data: casos } = await db
    .from("ai_tool_casos")
    .select("pergunta, tool_correta, tool_escolhida, veredito")
    .ilike("base_code", BASE)
    .range(0, 4999);
  const porPergunta = new Map<string, string>();
  for (const c of casos ?? []) {
    const certa = c.tool_correta || (c.veredito === "certo" ? c.tool_escolhida : null);
    const p = String(c.pergunta ?? "").trim();
    if (p && certa && !porPergunta.has(p)) porPergunta.set(p, certa);
  }
  const montado = await textosDaBase(db, BASE);
  if (!montado?.itens.length) { console.error(`Base "${BASE}" sem ferramentas.`); process.exit(1); }
  const tools = montado.itens;
  const chaves = new Set(tools.map((t) => t.key));
  const perguntas = [...porPergunta.entries()].filter(([, k]) => chaves.has(k));
  const { data: usos } = await db.from("ai_tool_uso").select("consulta").range(0, 4999);
  const consultas = [...new Set((usos ?? []).map((u) => String(u.consulta ?? "").trim()).filter(Boolean))].slice(0, 300);

  console.log(`\n${ATUAL} × ${NOVO} · base ${BASE}`);
  console.log(`${perguntas.length} perguntas com ferramenta certa · ${tools.length} ferramentas · ${consultas.length} consultas do aprendizado\n`);

  type Med = { top1: number[]; pares: number[]; consultas: number[]; rank: number[] };
  const medir = async (modelo: string): Promise<Med> => {
    const vt = await vetorizar(modelo, tools.map((t) => t.fonte));
    const vq = await vetorizar(modelo, perguntas.map(([p]) => p));
    const vc = await vetorizar(modelo, consultas);
    const m: Med = { top1: [], pares: [], consultas: [], rank: [] };
    perguntas.forEach(([, certa], i) => {
      const sims = vt.map((v) => cos(vq[i]!, v));
      m.pares.push(...sims);
      m.top1.push(Math.max(...sims));
      const sCerta = sims[tools.findIndex((t) => t.key === certa)]!;
      m.rank.push(1 + sims.filter((s) => s > sCerta).length);
    });
    // Consulta × consulta (o aprendizado compara a pergunta nova com as já resolvidas).
    vq.forEach((q) => vc.forEach((c) => m.consultas.push(cos(q, c))));
    return m;
  };

  const a = await medir(ATUAL);
  const n = await medir(NOVO);

  const acerto = (r: number[], k: number) => `${((r.filter((x) => x <= k).length / r.length) * 100).toFixed(1)}%`;
  console.log("── QUALIDADE (posição da ferramenta certa) ─────────────────────");
  console.log(`  modelo                     @1       @5       @12      posição média`);
  for (const [nome, m] of [[ATUAL, a], [NOVO, n]] as const) {
    const media = (m.rank.reduce((x, y) => x + y, 0) / m.rank.length).toFixed(2);
    console.log(`  ${nome.padEnd(24)} ${acerto(m.rank, 1).padStart(7)} ${acerto(m.rank, 5).padStart(8)} ${acerto(m.rank, 12).padStart(8)}   ${media}`);
  }
  let melhorou = 0, piorou = 0;
  a.rank.forEach((r, i) => { if (n.rank[i]! < r) melhorou++; else if (n.rank[i]! > r) piorou++; });
  console.log(`  por pergunta: ${melhorou} subiram, ${piorou} caíram, ${a.rank.length - melhorou - piorou} iguais`);

  const ord = { a: { top1: ordenar(a.top1), pares: ordenar(a.pares), consultas: ordenar(a.consultas) }, n: { top1: ordenar(n.top1), pares: ordenar(n.pares), consultas: ordenar(n.consultas) } };
  console.log("\n── ESCALA ─────────────────────────────────────────────────────");
  for (const d of ["top1", "pares", "consultas"] as const) {
    const f = (o: number[]) => `p10 ${pct(o, 0.1).toFixed(3)} · p50 ${pct(o, 0.5).toFixed(3)} · p90 ${pct(o, 0.9).toFixed(3)} · máx ${o[o.length - 1]!.toFixed(3)}`;
    console.log(`  ${d.padEnd(9)} ${ATUAL.padEnd(22)} ${f(ord.a[d])}`);
    console.log(`  ${"".padEnd(9)} ${NOVO.padEnd(22)} ${f(ord.n[d])}`);
  }

  console.log("\n── CORTES ABSOLUTOS convertidos por quantil ───────────────────");
  console.log(`  corte                                          atual   passa   →  novo`);
  for (const c of CORTES) {
    const f = fracAcima(ord.a[c.dist], c.valor);
    const novo = quantilAcima(ord.n[c.dist], f);
    console.log(`  ${c.nome.padEnd(46)} ${c.valor.toFixed(2)}  ${(f * 100).toFixed(1).padStart(5)}%  →  ${novo.toFixed(3)}`);
  }
  const razao = desvio(n.top1) / desvio(a.top1);
  const razaoPares = desvio(n.pares) / desvio(a.pares);
  console.log(`\n── MARGENS ADITIVAS (dispersão: top-1 ×${razao.toFixed(3)} · pares ×${razaoPares.toFixed(3)}) ──`);
  for (const m of MARGENS) console.log(`  ${m.nome.padEnd(58)} ${m.valor.toFixed(2)}  →  ${(m.valor * razao).toFixed(3)}`);
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
