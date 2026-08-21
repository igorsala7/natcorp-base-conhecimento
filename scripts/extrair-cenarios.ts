/**
 * CENÁRIOS DE AVALIAÇÃO, COM O CONTEXTO QUE O TURNO REALMENTE TINHA.
 *
 * `eval/casos.jsonl` manda a pergunta ISOLADA, e isso derruba o teto: metade
 * das perguntas reais são continuações ("Ela tem alguma avaliação>", "e o
 * Tony?"), e sem o turno anterior nenhum modelo tem como acertar. Medindo
 * assim, todos ficam em 25–50% e a comparação vira ruído.
 *
 * Aqui cada caso carrega o que o turno tinha: histórico da conversa, presença
 * de relatório na tela e as ferramentas que chegaram ao modelo.
 *
 * ── Os sete cenários, e por que eles ────────────────────────────────────────
 * O que decide um turno é a COMBINAÇÃO de fontes disponíveis. Classificado
 * sobre 1.176 turnos reais (20 dias):
 *
 *   tela+rag           43%     nada (social)      23%
 *   rag+tool           11%     tela+rag+tool       9%
 *   rag                 8%     tela                5%
 *   tela+tool           1%     tool                0,1%
 *
 * "Só ferramenta" quase não existe — o RAG entra em 71% dos turnos, inclusive
 * quando a resposta vem de uma API. Um conjunto de teste com cenários puros
 * mediria um sistema que não é este.
 *
 * A amostragem é por cenário com PISO, não proporcional: `tela+tool` tem 6
 * turnos em 20 dias e sumiria numa amostra proporcional — mas é onde o modelo
 * precisa escolher entre duas fontes de dado, que é justamente o caso difícil.
 *
 * ── O que é fiel e o que é aproximado ───────────────────────────────────────
 * FIEL: a pergunta, o histórico da conversa, quais ferramentas chegaram ao
 * modelo, o que ele chamou, o desfecho.
 * APROXIMADO: o CONTEÚDO da tabela da tela. O trace guarda as colunas e a
 * contagem de linhas, não as células. O caso registra colunas + total, que é o
 * que a decisão de roteamento usa — inventar linhas seria pior que declarar a
 * limitação.
 *
 *   npm run eval:cenarios
 *   npm run eval:cenarios -- --por-cenario 6 --dias 20
 */
import pg from "pg";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
const POR_CENARIO = Number(arg("por-cenario", "6"));
const DIAS = Number(arg("dias", "20"));
const SAIDA = arg("saida", "eval/cenarios.jsonl");

/** Os cenários, na ordem em que valem a pena ser lidos. */
const CENARIOS = [
  "social", "rag", "tool", "rag+tool", "tela", "tela+rag", "tela+tool", "tela+rag+tool",
] as const;
type Cenario = (typeof CENARIOS)[number];

type PassoTrace = { passo: string; info?: Record<string, unknown> | null };
type Turno = {
  conversation_id: string | null;
  pergunta: string;
  desfecho: string | null;
  passos: PassoTrace[] | null;
  p_portal: string | null;
  created_at: string;
};

const passo = (t: Turno, n: string) => (t.passos ?? []).find((x) => x.passo === n)?.info ?? null;
const todos = (t: Turno, n: string) => (t.passos ?? []).filter((x) => x.passo === n).map((x) => x.info);

/** Em qual cenário este turno caiu — pelo que ENTROU no prompt, não pelo texto. */
function classificar(t: Turno): Cenario | null {
  const blocos = (passo(t, "prompt_blocks")?.blocos ?? {}) as Record<string, number>;
  const rag = (blocos.rag ?? 0) > 0;
  const tela = (blocos.report ?? 0) > 0 || (blocos.tables ?? 0) > 0;
  const tool = todos(t, "tool_call").some((x) => x?.familia === "integracao");
  if (!rag && !tela && !tool) {
    // Sem fonte nenhuma: social de verdade, ou um turno que falhou antes de
    // montar o prompt. O segundo não serve de caso.
    return passo(t, "social") || (passo(t, "resposta")?.tokens_total as number ?? 0) < 12_000 ? "social" : null;
  }
  const partes = [tela ? "tela" : null, rag ? "rag" : null, tool ? "tool" : null].filter(Boolean).join("+");
  return (CENARIOS as readonly string[]).includes(partes) ? (partes as Cenario) : null;
}

/** Preserva a anotação humana entre reextrações — é a parte cara do conjunto. */
function anotacoes(caminho: string): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  if (!existsSync(caminho)) return m;
  for (const l of readFileSync(caminho, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try {
      const c = JSON.parse(l) as Record<string, unknown>;
      if (typeof c.pergunta === "string") m.set(c.pergunta, c);
    } catch { /* linha corrompida não derruba as outras */ }
  }
  return m;
}

async function main() {
  const client = new pg.Client(parseDbConfig());
  await client.connect();
  const { rows } = await client.query<Turno>(
    `select conversation_id, pergunta, desfecho, passos, p_portal, created_at
       from ai_chat_traces
      where created_at > now() - ($1 || ' days')::interval
        and pergunta is not null and passos is not null
      order by created_at desc`,
    [String(DIAS)],
  );

  const porCenario = new Map<Cenario, Turno[]>(CENARIOS.map((c) => [c, [] as Turno[]]));
  const vistos = new Set<string>();
  for (const t of rows) {
    const p = String(t.pergunta).trim();
    if (!p || p.length < 2 || vistos.has(p.toLowerCase())) continue;
    const cen = classificar(t);
    if (!cen) continue;
    vistos.add(p.toLowerCase());
    porCenario.get(cen)!.push(t);
  }

  const anteriores = anotacoes(SAIDA);
  const casos: Record<string, unknown>[] = [];
  let preservados = 0;

  for (const cen of CENARIOS) {
    const pool = porCenario.get(cen)!;
    // Espaçado no pool: um dia ruim de uma integração não domina o cenário.
    const salto = Math.max(1, Math.floor(pool.length / POR_CENARIO));
    for (let i = 0, n = 0; i < pool.length && n < POR_CENARIO; i += salto, n++) {
      const t = pool[i]!;
      const pergunta = String(t.pergunta).slice(0, 400);

      // HISTÓRICO REAL até o instante do turno — é o que dá sentido a "e o Tony?".
      const { rows: msgs } = await client.query<{ role: string; content: string }>(
        `select role, content from messages
          where conversation_id = $1 and created_at < $2::timestamptz
          order by created_at desc limit 6`,
        [t.conversation_id, t.created_at],
      );
      // A mensagem do usuário é gravada ANTES de o trace fechar, então ela entra
      // como "anterior" e a pergunta aparece duplicada dentro do próprio
      // histórico. Medir assim entregaria a resposta ao modelo junto do enunciado.
      const historico = msgs
        .reverse()
        .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 700) }))
        .filter((m, i, arr) => !(i === arr.length - 1 && m.role === "user" && m.content.trim() === pergunta.trim()));

      const reg = (passo(t, "dataset:registro")?.itens ?? []) as { id: string; linhas: number; cols: string[] }[];
      const tela = reg.filter((d) => String(d.id).startsWith("tela"));
      const chamadas = todos(t, "tool_call").map((x) => String(x?.tool ?? "")).filter(Boolean);
      const ofertadas = (passo(t, "ferramentas")?.tools ?? []) as string[];
      // Desabafo e agradecimento não medem roteamento: não há fonte certa para
      // "desisto, você está me atrapalhando". Ficam fora do conjunto.
      if (/^\s*(bom,?\s*)?(desisto|obrigad|valeu|nada a ver|voc[êe] (est[áa]|n[ãa]o))/i.test(pergunta) && pergunta.length > 40) continue;
      const ant = anteriores.get(pergunta);
      if (ant) preservados++;

      casos.push({
        cenario: cen,
        pergunta,
        historico,
        portal: t.p_portal,
        // Colunas e contagem — o conteúdo das células não está no trace.
        tela: tela.map((d) => ({ id: d.id, linhas: d.linhas, colunas: (d.cols ?? []).slice(0, 12) })),
        // Sem corte: a produção chega a entregar 104 ferramentas num turno, e cortar
        // aqui inventaria "falha de funil" onde o funil não falhou.
        ofertadas,

        // ── ANOTAR: o que DEVERIA acontecer ───────────────────────────────
        espera_tool: ant ? ant.espera_tool : (chamadas[0] ?? null),
        espera_fonte: ant ? ant.espera_fonte : cen,
        espera_clarify: ant ? ant.espera_clarify : String(t.desfecho ?? "").startsWith("clarify"),
        // A NOTA é a parte cara: é o RACIOCÍNIO do gabarito, não um enfeite. Uma
        // reextração que a descarta apaga por que cada caso foi decidido daquele
        // jeito — e sem isso ninguém revisa a decisão depois. (Perdido uma vez em
        // 19/08/2026 e recuperado do git.)
        ...(ant?.nota ? { nota: ant.nota } : {}),
        ...(ant && !ant.revisar ? {} : { revisar: true }),

        // ── O QUE ACONTECEU: referência, não gabarito ─────────────────────
        foi_tools: chamadas,
        foi_desfecho: t.desfecho,
        foi_tokens: (passo(t, "resposta")?.tokens_total as number | undefined) ?? null,
        foi_em: t.created_at,
      });
    }
  }
  await client.end();

  /**
   * CASO ANOTADO NUNCA SE PERDE, mesmo fora da amostra desta rodada.
   *
   * A amostragem é por cenário com piso: reextrair sorteia turnos diferentes, e
   * quem já foi anotado e não caiu no novo sorteio simplesmente sumiria. Pior,
   * some sem aviso — o arquivo continua parecendo íntegro, só menor.
   *
   * Custou perto: 15 casos migrados à mão de `eval/rag.jsonl` em 21/08/2026
   * (turnos de COMPORTAMENTO, que este extrator nem procura) seriam apagados
   * pela primeira reextração. Anotação é a parte cara do conjunto; o sorteio é
   * a barata.
   */
  const novos = new Set(casos.map((c) => String(c.pergunta)));
  const herdados = [...anteriores.values()].filter(
    (c) => !c.revisar && !novos.has(String(c.pergunta)),
  );
  const finais = [...casos, ...herdados];

  const dir = SAIDA.slice(0, SAIDA.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SAIDA, finais.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");

  console.log(`\n${rows.length} turnos · ${casos.length} casos na amostra · ${finais.length} no arquivo`);
  if (preservados) console.log(`${preservados} já anotados — gabarito PRESERVADO`);
  if (herdados.length) console.log(`${herdados.length} anotados FORA desta amostra — mantidos`);
  console.log("\ncenário          casos   no total de 20 dias");
  for (const cen of CENARIOS) {
    const n = casos.filter((c) => c.cenario === cen).length;
    const real = porCenario.get(cen)!.length;
    console.log(`  ${cen.padEnd(16)} ${String(n).padStart(3)}   ${String(real).padStart(5)}${real < POR_CENARIO ? "  ← cenário raro; todos entraram" : ""}`);
  }
  console.log(`\nEscrito em ${SAIDA}`);
  console.log("\nA ANOTAR em cada caso: `espera_tool`, `espera_fonte`, `espera_clarify` — e apagar `revisar`.");
  console.log("Os campos `foi_*` são o comportamento ATUAL, que é o que está sob suspeita.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
