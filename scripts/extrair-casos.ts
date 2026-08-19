/**
 * EXTRAI CASOS DE AVALIAÇÃO DE PERGUNTAS REAIS — read-only.
 *
 * O eval set precisa parecer com o uso real, não com o que a gente imagina que
 * as pessoas perguntam. Foi medido em 14 dias (883 perguntas) que **57% têm 8
 * palavras ou menos**. Um conjunto escrito à mão teria frases completas e
 * mediria justamente o caso mais fácil.
 *
 * Por isso a amostragem é ESTRATIFICADA: cada faixa de tamanho entra na mesma
 * proporção em que aparece em produção. Um sistema que acerta 90% nas perguntas
 * longas e 40% nas curtas precisa mostrar isso separado, não diluído numa média
 * que esconde qual metade dos usuários está sendo mal servida.
 *
 * ── Por que os casos saem pré-preenchidos ───────────────────────────────────
 * O gabarito é a única parte que a máquina não pode produzir: se ela soubesse a
 * resposta certa, não haveria o que avaliar. Mas anotar 60 casos em branco é
 * trabalho que ninguém termina — e um eval que não existe não mede nada.
 *
 * Então cada caso sai com o que o sistema REALMENTE fez (campos `foi_*`), e a
 * anotação vira conferência: apagar `revisar` quando estiver certo, corrigir
 * `espera_*` quando estiver errado.
 *
 * ATENÇÃO: `foi_*` NÃO é gabarito — é o comportamento atual, que é exatamente o
 * que está sob suspeita. Confirmar sem ler transforma o eval numa máquina de
 * carimbar o status quo, que é pior que não ter eval: dá confiança falsa.
 *
 * ── Por que 24, e não 60 ────────────────────────────────────────────────────
 * A referência de eval-driven prompt engineering pede "10–20 casos no MÍNIMO".
 * O limite real aqui não é estatístico, é humano: um conjunto de 60 casos
 * meio-anotado vale ZERO, e um de 24 anotado por inteiro vale tudo. Comece
 * pequeno e cresça com `--n` quando a anotação virar rotina.
 *
 *   npm run eval:extrair                    # 24 casos, 14 dias
 *   npm run eval:extrair -- --n 60
 *   npm run eval:extrair -- --dias 30
 */
import pg from "pg";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { parseDbConfig } from "../src/lib/jobs/db-config";

type PassoTrace = { passo: string; info?: Record<string, unknown> | null };
type Turno = {
  pergunta: string;
  desfecho: string | null;
  passos: PassoTrace[] | null;
  p_portal: string | null;
  created_at: string;
};

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};

const ALVO = Number(arg("n", "24"));
const DIAS = Number(arg("dias", "14"));
const SAIDA = arg("saida", "eval/casos.jsonl");

/** As quatro faixas medidas em produção. */
const FAIXAS = [
  { nome: "telegrafica", min: 1, max: 3 },
  { nome: "curta", min: 4, max: 8 },
  { nome: "media", min: 9, max: 20 },
  { nome: "detalhada", min: 21, max: Number.MAX_SAFE_INTEGER },
] as const;

const palavras = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Resposta ao próprio agente ("1", "sim") — não é pergunta e não entra.
 *
 * Sem este filtro, 21% da faixa telegráfica seria seleção de menu, e o eval
 * mediria a capacidade de ler um número.
 */
const ehRespostaAoAgente = (p: string): boolean =>
  /^\s*(\d+([.,]\d+)?|sim|n[ãa]o|ok|isso|todos|todas|s|n)\s*$/i.test(p);

/** Normaliza para deduplicar — a mesma pergunta repetida não mede duas coisas. */
const chave = (p: string): string =>
  p
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const passo = (t: Turno, nome: string): Record<string, unknown> | null =>
  (t.passos ?? []).find((p) => p.passo === nome)?.info ?? null;

const todos = (t: Turno, nome: string): Array<Record<string, unknown> | null | undefined> =>
  (t.passos ?? []).filter((p) => p.passo === nome).map((p) => p.info);

async function main() {
  const client = new pg.Client(parseDbConfig());
  await client.connect();
  const { rows } = await client.query<Turno>(
    `select pergunta, desfecho, passos, p_portal, created_at
       from ai_chat_traces
      where created_at > now() - ($1 || ' days')::interval
        and pergunta is not null and passos is not null
      order by created_at desc`,
    [String(DIAS)],
  );
  await client.end();

  // 1) Limpa: fora resposta-ao-agente e duplicata (fica o turno mais recente).
  const vistos = new Map<string, Turno>();
  for (const t of rows) {
    const p = String(t.pergunta).trim();
    if (!p || ehRespostaAoAgente(p)) continue;
    const k = chave(p);
    if (k.length < 2 || vistos.has(k)) continue;
    vistos.set(k, t);
  }
  const limpos = [...vistos.values()];
  if (limpos.length === 0) {
    console.error(`Nenhuma pergunta nos últimos ${DIAS} dias. Tente --dias maior.`);
    process.exit(1);
  }

  // 2) Estratifica pela proporção REAL, não por cota igual entre faixas.
  const porFaixa = new Map<string, Turno[]>(FAIXAS.map((f) => [f.nome, [] as Turno[]]));
  for (const t of limpos) {
    const n = palavras(String(t.pergunta));
    const f = FAIXAS.find((x) => n >= x.min && n <= x.max);
    if (f) porFaixa.get(f.nome)!.push(t);
  }

  const casos: Record<string, unknown>[] = [];
  for (const f of FAIXAS) {
    const pool = porFaixa.get(f.nome)!;
    if (!pool.length) continue;
    const cota = Math.max(1, Math.round((pool.length / limpos.length) * ALVO));
    // Espaçado ao longo do pool, não só os mais recentes: um dia ruim de uma
    // integração inteira não pode dominar o conjunto.
    const salto = Math.max(1, Math.floor(pool.length / cota));
    for (let i = 0, n = 0; i < pool.length && n < cota; i += salto, n++) {
      const t = pool[i]!;
      const chamadas = todos(t, "tool_call")
        .map((x) => (x?.tool as string | undefined) ?? null)
        .filter((x): x is string => !!x);
      const rag = passo(t, "rag");
      const resp = passo(t, "resposta");
      const perfil = (rag?.perfil as Array<{ score?: number }> | undefined) ?? [];
      casos.push({
        pergunta: String(t.pergunta).slice(0, 400),
        faixa: f.nome,
        palavras: palavras(String(t.pergunta)),
        portal: t.p_portal,

        // ── ANOTAR AQUI: o que DEVERIA acontecer ──────────────────────────
        espera_tool: chamadas[0] ?? null,
        espera_params: chamadas.length ? {} : null,
        espera_clarify: String(t.desfecho ?? "").startsWith("clarify"),
        espera_nos: [] as string[],
        revisar: true,

        // ── O QUE ACONTECEU: referência, NÃO gabarito ─────────────────────
        foi_tools: chamadas,
        foi_desfecho: t.desfecho,
        foi_fontes_rag: (rag?.fontes as number | undefined) ?? 0,
        foi_score_topo: perfil[0]?.score ?? null,
        foi_tokens: (resp?.tokens_total as number | undefined) ?? null,
        foi_passos: (resp?.passos_usados as number | undefined) ?? null,
        foi_em: t.created_at,
      });
    }
  }

  const dir = SAIDA.slice(0, SAIDA.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SAIDA, casos.map((x) => JSON.stringify(x)).join("\n") + "\n", "utf8");

  console.log(`\n${rows.length} turnos · ${limpos.length} perguntas únicas · ${casos.length} casos\n`);
  console.log("Distribuição (espelha produção):");
  for (const f of FAIXAS) {
    const real = porFaixa.get(f.nome)!.length;
    if (!real) continue;
    const n = casos.filter((x) => x.faixa === f.nome).length;
    console.log(
      `  ${f.nome.padEnd(12)} ${String(n).padStart(3)} casos   produção: ${String(
        Math.round((real / limpos.length) * 100),
      ).padStart(2)}%`,
    );
  }
  const comTool = casos.filter((x) => (x.foi_tools as string[]).length > 0).length;
  console.log(`\n  ${comTool} usaram ferramenta · ${casos.length - comTool} só documentação/conversa`);
  console.log(`\nEscrito em ${SAIDA}\n`);
  console.log("PRÓXIMO PASSO — a anotação é humana:");
  console.log("  Confira cada `espera_*` contra o que DEVERIA ter acontecido e");
  console.log('  apague `"revisar":true`. Os campos `foi_*` são o comportamento');
  console.log("  ATUAL, que é o que está sob suspeita — não carimbe.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
