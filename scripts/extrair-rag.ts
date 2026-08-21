/**
 * GABARITO DE RECUPERAÇÃO — as perguntas reais e QUAL artigo deveria vir.
 *
 * O RAG entra em 71% dos turnos e nunca teve um número: nem precisão@k, nem
 * cobertura. Os treze instrumentos do repositório cobrem ferramenta, modelo,
 * endpoint e ponta a ponta — nenhum cobre recuperação. Sem isto, mexer em peso
 * de RRF, em `p_group_limit` ou em chunking é trocar um defeito por outro com
 * número na mão: mediu-se que MUDA (95% dos turnos), nunca que MELHORA.
 *
 * ── Três tipos, porque falham por motivos diferentes ────────────────────────
 *
 *   NOMEAÇÃO   "banco de horas" — sintagma sem verbo. O usuário nomeia o
 *              assunto e espera o artigo daquele assunto. Falha quando o termo
 *              é ambíguo entre manuais.
 *   ELÍPTICA   "e o de gozo?" — só faz sentido com o turno anterior. Falha
 *              quando a reescrita da consulta perde o sujeito.
 *   COMPLETA   "como faço para lançar hora extra noturna?" — frase inteira.
 *              Falha quando o vocabulário do usuário não é o da documentação.
 *
 * Amostra com PISO por tipo, não proporcional: elíptica é minoria e é
 * justamente onde a recuperação quebra.
 *
 * ── O que é gabarito e o que é referência ──────────────────────────────────
 * `espera_nos` é o GABARITO e só o dono preenche. `candidatos` é o que a busca
 * de HOJE devolve — referência para anotar escolhendo, em vez de digitar id de
 * artigo. Anotar caro é anotar pouco, e abaixo de 30 casos não se conclui nada.
 *
 * O trace NÃO guarda qual artigo veio (só posição, tokens e score), então os
 * candidatos são gerados rodando a busca agora. Isso é melhor para o gabarito:
 * reflete o estado atual, que é contra o que se vai medir.
 *
 *   npx tsx --env-file=.env.local scripts/extrair-rag.ts
 *   npx tsx --env-file=.env.local scripts/extrair-rag.ts --por-tipo 14 --dias 25
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import pg from "pg";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { retrievePublicContext } from "../src/lib/ai/rag";

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
const POR_TIPO = Number(arg("por-tipo", "14"));
const DIAS = Number(arg("dias", "25"));
const SAIDA = arg("saida", "eval/rag.jsonl");
const CANDIDATOS = 8;

const TIPOS = ["nomeacao", "eliptica", "completa"] as const;
type Tipo = (typeof TIPOS)[number];

type Turno = {
  conversation_id: string | null;
  space_id: string;
  space_slug: string;
  pergunta: string;
  created_at: string;
  fontes: number;
};

/**
 * Classifica pelo TEXTO, não pelo desfecho — o desfecho é o que está sob
 * suspeita e usá-lo circularmente confirmaria o comportamento atual.
 */
function classificar(p: string, temHistorico: boolean): Tipo {
  const t = p.trim().toLowerCase();
  const palavras = t.split(/\s+/).filter(Boolean);

  // Elíptica: abre com conectivo, ou é curta e aponta para algo já dito.
  const abreConectivo = /^(e|ou|mas|entao|então)\b/.test(t);
  const temAnafora = /\b(ele|ela|isso|isto|esse|essa|aquele|aquela|dele|dela|lá|ali|mesmo|também)\b/.test(t);
  if (temHistorico && (abreConectivo || (temAnafora && palavras.length <= 8))) return "eliptica";

  // Nomeação: sintagma sem interrogação nem verbo de pergunta.
  const interroga = t.includes("?") || /^(como|qual|quais|quando|onde|quem|por que|porque|o que|posso|preciso|tem|existe)\b/.test(t);
  if (!interroga && palavras.length <= 5) return "nomeacao";

  return "completa";
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
    `select t.conversation_id, c.space_id, s.slug space_slug, t.pergunta, t.created_at,
            coalesce((p->'info'->>'fontes')::int, 0) fontes
       from ai_chat_traces t
       join jsonb_array_elements(t.passos) p on p->>'passo' = 'rag'
       join conversations c on c.id = t.conversation_id
       join spaces s on s.id = c.space_id
      where t.created_at > now() - ($1 || ' days')::interval
        and t.pergunta is not null and length(trim(t.pergunta)) > 8
        -- SO 'normal'. O RAG entra em 71% dos turnos, entao "rodou o RAG" nao
        -- quer dizer "pergunta de documentação" — e os outros motivos são
        -- exatamente os turnos onde ele é incidental:
        --   pergunta_de_dado / roteado_tool  a resposta veio de ferramenta
        --   modo_relatorio*                  análise da tabela da tela
        --   operacao_tela                    comando de interface
        -- A primeira extração ignorou isso e trouxe "Confirmado" e "Esse veio
        -- certo" como casos de recuperação. Não existe artigo certo para eles,
        -- e anotar isso poluiria o gabarito com ruído que parece dado.
        and coalesce(p->'info'->>'motivo', '') = 'normal'
        and coalesce((p->'info'->>'fontes')::int, 0) > 0
      order by t.created_at desc`,
    [String(DIAS)],
  );

  const porTipo = new Map<Tipo, Turno[]>(TIPOS.map((t) => [t, [] as Turno[]]));
  const vistos = new Set<string>();
  const historicoDe = new Map<string, { role: string; content: string }[]>();

  for (const t of rows) {
    const p = t.pergunta.trim();
    if (vistos.has(p.toLowerCase())) continue;

    const { rows: msgs } = await client.query<{ role: string; content: string }>(
      `select role, content from messages
        where conversation_id = $1 and created_at < $2::timestamptz
        order by created_at desc limit 4`,
      [t.conversation_id, t.created_at],
    );
    // A mensagem do usuário é gravada ANTES de o trace fechar, então ela entra
    // como "anterior" e a pergunta apareceria duplicada dentro do histórico.
    const historico = msgs
      .reverse()
      .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 400) }))
      .filter((m, i, arr) => !(i === arr.length - 1 && m.role === "user" && m.content.trim() === p));

    vistos.add(p.toLowerCase());
    historicoDe.set(p, historico);
    porTipo.get(classificar(p, historico.length > 0))!.push(t);
  }

  const anteriores = anotacoes(SAIDA);
  const casos: Record<string, unknown>[] = [];
  let preservados = 0;

  for (const tipo of TIPOS) {
    const pool = porTipo.get(tipo)!;
    // Espaçado no pool: um dia ruim de um assunto não domina o tipo.
    const salto = Math.max(1, Math.floor(pool.length / POR_TIPO));
    for (let i = 0, n = 0; i < pool.length && n < POR_TIPO; i += salto, n++) {
      const t = pool[i]!;
      const pergunta = t.pergunta.trim().slice(0, 400);
      const ant = anteriores.get(pergunta);
      if (ant) preservados++;

      // O que a busca de HOJE devolve — referência para anotar escolhendo.
      let candidatos: Record<string, unknown>[] = [];
      try {
        const fontes = await retrievePublicContext(t.space_id, pergunta, CANDIDATOS);
        candidatos = fontes.map((f) => ({
          node_id: f.node_id,
          document_id: f.document_id,
          titulo: f.title,
          manual: f.origin,
          heading: f.heading_path,
          trecho: (f.content ?? "").replace(/\s+/g, " ").slice(0, 160),
        }));
      } catch (e) {
        candidatos = [{ erro: (e as Error).message.slice(0, 120) }];
      }

      casos.push({
        tipo,
        pergunta,
        historico: historicoDe.get(t.pergunta.trim()) ?? [],
        espaco: t.space_slug,
        space_id: t.space_id,

        // ── ANOTAR ────────────────────────────────────────────────────────
        // `espera_nos`: os node_id que DEVERIAM vir, do melhor para o pior.
        // `[]` é resposta válida e útil: significa "isto não está documentado",
        // e mede a honestidade do "não encontrei" tanto quanto um acerto.
        espera_nos: ant ? ant.espera_nos : null,
        ...(ant?.nota ? { nota: ant.nota } : {}),
        ...(ant && ant.espera_nos !== null && ant.espera_nos !== undefined ? {} : { revisar: true }),

        // ── REFERÊNCIA: o que a busca traz hoje, não o que deveria ────────
        candidatos,
      });
    }
  }
  await client.end();

  const dir = SAIDA.slice(0, SAIDA.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SAIDA, casos.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");

  console.log(`\n${rows.length} turnos de documentação · ${casos.length} casos extraídos`);
  if (preservados) console.log(`${preservados} já anotados — gabarito PRESERVADO`);
  console.log("\ntipo         casos   no total de " + DIAS + " dias");
  for (const tipo of TIPOS) {
    const n = casos.filter((c) => c.tipo === tipo).length;
    const real = porTipo.get(tipo)!.length;
    console.log(`  ${tipo.padEnd(12)} ${String(n).padStart(3)}   ${String(real).padStart(5)}${real < POR_TIPO ? "  ← tipo raro; todos entraram" : ""}`);
  }
  console.log(`\nEscrito em ${SAIDA}`);
  console.log("\nA ANOTAR: `espera_nos` — os node_id certos, do melhor para o pior.");
  console.log("`[]` quer dizer \"não está documentado\", e é um resultado tão útil quanto um acerto.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
