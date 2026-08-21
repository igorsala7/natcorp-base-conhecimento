/**
 * LEVA OS CASOS DE COMPORTAMENTO DO GABARITO DE RAG PARA O DE CENÁRIOS.
 *
 * O gabarito de recuperação (`eval/rag.jsonl`) tem 42 casos anotados, e 18
 * deles NÃO são de recuperação: o certo ali é chamar uma ferramenta, perguntar,
 * ou analisar o relatório da tela. Eles ficaram sem avaliador nenhum — quase
 * metade do tráfego real fora de qualquer medição.
 *
 * Não faz sentido construir um placar novo: `eval:cenarios-modelo` já mede
 * exatamente isso (`espera_tool` + `espera_clarify`) e já isola o MODELO da
 * seleção, remontando cada turno com as ferramentas que o funil de fato
 * entregou. Este script faz a ponte.
 *
 * ── O que ele busca no trace, e por quê ─────────────────────────────────────
 * `ofertadas` é o que torna o placar honesto: um caso cujo gabarito exige uma
 * ferramenta que o funil NÃO entregou é falha de FUNIL, não de modelo, e o
 * avaliador o separa. Sem esse campo o número mistura as duas coisas e não diz
 * o que corrigir. Vem do passo `ferramentas` do trace daquele turno.
 *
 * ── O mapeamento é do dono, não meu ─────────────────────────────────────────
 * Cada `espera_tool` abaixo foi ditado em 21/08/2026. Os quatro casos de férias
 * mostram por que a regra não pode ser "o assunto decide a ferramenta":
 * abertura de fluxo vai para `ferias_situacao` (sem saldo e período aquisitivo
 * não há pedido a montar), e o turno que JÁ traz as datas vai para
 * `ferias_validar`. O gabarito antigo, anotado em outra sessão, chegou sozinho
 * à mesma distinção — "15 15, início 01/10 e depois 01/11" já estava como
 * `ferias_validar`.
 *
 *   npx tsx --env-file=.env.local scripts/rag-para-cenarios.ts --seco
 *   npx tsx --env-file=.env.local scripts/rag-para-cenarios.ts
 */
import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const SECO = process.argv.includes("--seco");
const RAG = "eval/rag.jsonl";
const CEN = "eval/cenarios.jsonl";

/** pergunta → o que o dono determinou. `tool: null` = nenhuma ferramenta. */
const MAPA: Record<string, { tool: string | null; clarify: boolean; fonte: string; porque: string }> = {
  "Quero pedir férias":
    { tool: "ferias_situacao", clarify: false, fonte: "tool", porque: "abertura de fluxo: sem saldo e período aquisitivo não há pedido a montar" },
  "quero sair de férias":
    { tool: "ferias_situacao", clarify: false, fonte: "tool", porque: "abertura de fluxo" },
  "Quero tirar férias, já estou muito cansado":
    { tool: "ferias_situacao", clarify: false, fonte: "tool", porque: "abertura de fluxo; o tom não muda a ferramenta" },
  "Mas eu disse 01/11 e 01/12":
    { tool: "ferias_validar", clarify: false, fonte: "tool", porque: "o turno JÁ traz as datas — valida antes de gravar" },
  "envie um e-mail para igorsala7@gmail.com":
    { tool: "ms_email_enviar", clarify: false, fonte: "tool", porque: "indicar endereço é sinal de envio; executa com a conta conectada" },
  "Mas esse não é o Espelho de Ponto que utilizamos":
    { tool: "relatorio_espelho_ponto", clarify: false, fonte: "tool", porque: "qual modelo o cliente usa se resolve no sistema, não no catálogo de modelos" },
  "preciso cosultar um colaborador, matricula dele é 751525":
    { tool: "informacoes_pessoais_funcionais_resumido", clarify: false, fonte: "tool", porque: "ferramenta nomeada pelo dono, com a matrícula como parâmetro" },
  "como é feita esse procedimento para localizar algo?":
    { tool: null, clarify: true, fonte: "rag", porque: "'localizar algo' não diz o quê — perguntar qual aplicação antes de buscar" },
  "Me traz mais informações dele":
    { tool: "candidatos_externos", clarify: false, fonte: "tool", porque: "dados do candidato; a documentação não responde 'quem é Bruno'" },
  "Quais são meus compromissos pra esse mês?":
    { tool: "ms_agenda_periodo", clarify: false, fonte: "tool", porque: "agenda Microsoft/Google conectada" },
  "Gostaria de gerar o PDF por aquu":
    { tool: "relatorio_recibo_pagamento", clarify: false, fonte: "tool", porque: "gerar holerite é tarefa de ferramenta" },
  "Não retornou todos os 96, apenas 25":
    { tool: null, clarify: false, fonte: "tela", porque: "recoleta in-session do relatório APEX, paginando até o fim — não é tool do catálogo" },
  "Faça uma analise desse comparativo do histórico financeiro da folha, comparando esses dois meses, me apontando as maiores diferenças e o que preciso validar":
    { tool: null, clarify: false, fonte: "tela", porque: "análise do relatório da tela, respeitando a Base de Dados escolhida no chat" },
  "você apenas exibiu o colaborador com maior horas faltou o colaborador com a menor horas.":
    { tool: null, clarify: false, fonte: "tela", porque: "correção sobre dados já exibidos" },
  "Valida essas informações do relatório e me aponte o que pode ser essas diferenças menores do que -10%":
    { tool: null, clarify: false, fonte: "tela", porque: "análise do relatório da tela, respeitando a Base de Dados escolhida no chat" },
};

type Passo = { passo: string; info?: Record<string, unknown> | null };

async function main() {
  const rag = readFileSync(RAG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  const cen = readFileSync(CEN, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  const jaTem = new Set(cen.map((c) => String(c.pergunta).toLowerCase()));

  const db = new pg.Client(parseDbConfig());
  await db.connect();

  const novos: Record<string, unknown>[] = [];
  const pulados: string[] = [];

  for (const c of rag) {
    const p = String(c.pergunta);
    const m = MAPA[p];
    if (!m) continue;
    if (jaTem.has(p.toLowerCase())) { pulados.push(`já existe: "${p.slice(0, 50)}"`); continue; }

    // O turno REAL: as ferramentas que o funil entregou, a tela, o portal.
    const { rows } = await db.query<{ passos: Passo[]; p_portal: string | null; desfecho: string | null; created_at: string }>(
      `select passos, p_portal, desfecho, created_at from ai_chat_traces
        where pergunta = $1 and passos is not null order by created_at desc limit 1`,
      [p],
    );
    if (!rows.length) { pulados.push(`sem trace: "${p.slice(0, 50)}"`); continue; }
    const t = rows[0]!;
    const passo = (n: string) => (t.passos ?? []).find((x) => x.passo === n)?.info ?? null;
    const todos = (n: string) => (t.passos ?? []).filter((x) => x.passo === n).map((x) => x.info);

    const ofertadas = (passo("ferramentas")?.tools ?? []) as string[];
    const reg = (passo("dataset:registro")?.itens ?? []) as { id: string; linhas: number; cols: string[] }[];
    const tela = reg.filter((d) => String(d.id).startsWith("tela"))
      .map((d) => ({ id: d.id, linhas: d.linhas, colunas: (d.cols ?? []).slice(0, 12) }));
    const chamadas = todos("tool_call").map((x) => String(x?.tool ?? "")).filter(Boolean);

    // Ferramenta exigida que o funil não entregou é falha de FUNIL. Não some
    // do conjunto — o avaliador a separa —, mas fica registrado aqui também.
    const foraDoFunil = m.tool && !ofertadas.includes(m.tool) ? ` [FUNIL: ${m.tool} não foi ofertada]` : "";

    novos.push({
      cenario: c.tipo === "eliptica" ? "rag+tool" : m.fonte === "tela" ? "tela+rag" : "rag+tool",
      pergunta: p,
      historico: c.historico ?? [],
      portal: t.p_portal,
      tela,
      ofertadas,
      espera_tool: m.tool,
      espera_fonte: m.fonte,
      espera_clarify: m.clarify,
      nota: `${m.porque}${foraDoFunil} — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl`,
      foi_tools: chamadas,
      foi_desfecho: t.desfecho,
      foi_tokens: (passo("resposta")?.tokens_total as number | undefined) ?? null,
      foi_em: t.created_at,
    });
  }
  await db.end();

  console.log(`\n  ${novos.length} casos a acrescentar em ${CEN} (hoje: ${cen.length})`);
  for (const n of novos) {
    const fora = String(n.nota).includes("FUNIL") ? "  ⚠ fora do funil" : "";
    console.log(`    ${String(n.espera_tool ?? (n.espera_clarify ? "perguntar" : "nenhuma")).padEnd(42)} ${String(n.pergunta).slice(0, 40)}${fora}`);
  }
  for (const s of pulados) console.log(`    ↓ ${s}`);

  if (SECO) { console.log(`\n  ENSAIO — nada escrito.\n`); return; }
  writeFileSync(CEN, [...cen, ...novos].map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
  console.log(`\n  ${CEN} agora tem ${cen.length + novos.length} casos.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
