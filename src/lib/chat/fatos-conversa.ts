/**
 * O QUE A CONVERSA JÁ ESTABELECEU — e que cada turno redescobria do zero.
 *
 * Hoje um turno enxerga o texto das mensagens e as tabelas persistidas, e nada
 * mais. Os FATOS resolvidos — de quem se fala, de que período, de qual centro de
 * custo, de qual evento — não atravessam: cada turno tenta deduzi-los de novo a
 * partir das últimas mensagens, e falha quando a conversa fica longa.
 *
 * ── O que isso custou, medido ───────────────────────────────────────────────
 * Conversa real de 20/08. No turno 19 ficaram estabelecidos o centro de custo
 * 10970104, o evento FGTS e as competências FEV/2025 e MAR/2025. No turno 23 o
 * usuário escreveu "por colaborador os valores do evento de FGTS para os dois
 * meses" — e o sistema, olhando só as três últimas mensagens, não achou período
 * nenhum e bloqueou CATORZE chamadas com "PERÍODO NÃO INFORMADO". A resposta
 * seguinte do usuário foi "Desisto".
 *
 * O agente não estava perdido. O sistema é que tinha perdido o fio.
 *
 * ── De onde os fatos vêm, e por que daí ─────────────────────────────────────
 * Dos PARÂMETROS das chamadas de ferramenta que DERAM CERTO. É a fonte mais
 * confiável que existe aqui e não custa nada: o sistema já resolveu aquele valor,
 * já o mandou para a API e a API respondeu. Não há inferência, não há segunda ida
 * ao modelo, não há o que alucinar.
 *
 * A alternativa — pedir a um LLM que extraia entidades da conversa — custaria uma
 * chamada por turno para produzir algo menos confiável do que o registro do que
 * de fato aconteceu.
 *
 * ── O que NÃO entra ─────────────────────────────────────────────────────────
 * Nome de pessoa, valor de salário, conteúdo de linha. Só CÓDIGOS e DATAS que já
 * transitaram na conversa: são o suficiente para reencontrar o dado e não
 * acumulam dado pessoal em repouso além do que a conversa já guarda.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Uma coisa que a conversa fixou. */
export type Fato = {
  /** Chave canônica: `periodo_ini`, `matricula`, `centro_custo`… */
  chave: string;
  valor: string;
  /** Ferramenta cuja chamada bem-sucedida estabeleceu o fato. */
  tool: string;
  /** ISO — o mais recente vence, e a idade aparece no prompt. */
  em: string;
};

/** Quantos fatos ficam vivos por conversa. Acima disso, os mais antigos saem. */
export const MAX_FATOS = 12;

/**
 * Nomes de parâmetro → chave canônica.
 *
 * As APIs do cliente chamam a mesma coisa de cinco jeitos (`matricula`,
 * `p_matricula`, `cod_matricula`…). Sem normalizar, o quadro de fatos vira uma
 * lista de sinônimos e o modelo tem de desempatar — que é justamente o trabalho
 * que este módulo existe para poupar.
 */
const CANONICO: { rx: RegExp; chave: string }[] = [
  { rx: /^(p_)?(cod_)?matricula(_alvo)?$/i, chave: "matricula" },
  { rx: /^(p_)?(cod_)?empresa$/i, chave: "empresa" },
  { rx: /^(p_)?(cod_)?filial$/i, chave: "filial" },
  { rx: /^(p_)?(cod_)?centro(_de)?_custo$/i, chave: "centro_custo" },
  { rx: /^(p_)?(cod_)?(ocorrencia|evento|rubrica)$/i, chave: "ocorrencia" },
  { rx: /^(p_)?(dt_|data_)?(ini|inicio|inicial)$|^(p_)?data_ini(cial)?$|^periodo_ini$/i, chave: "periodo_ini" },
  { rx: /^(p_)?(dt_|data_)?(fim|final)$|^(p_)?data_fim$|^periodo_fim$/i, chave: "periodo_fim" },
  { rx: /^(p_)?(competencia|mes_referencia|data)$/i, chave: "competencia" },
];

/** Rótulo humano para o bloco do prompt. */
const ROTULO: Record<string, string> = {
  matricula: "matrícula",
  empresa: "empresa",
  filial: "filial",
  centro_custo: "centro de custo",
  ocorrencia: "ocorrência/evento",
  periodo_ini: "período (início)",
  periodo_fim: "período (fim)",
  competencia: "competência",
};

function canonizar(nome: string): string | null {
  const n = String(nome ?? "").trim();
  for (const { rx, chave } of CANONICO) if (rx.test(n)) return chave;
  return null;
}

/** Valor utilizável: escalar curto e não vazio. Lista de um item conta. */
function valorUtil(v: unknown): string | null {
  const bruto = Array.isArray(v) ? (v.length === 1 ? v[0] : null) : v;
  if (bruto == null || typeof bruto === "object" || typeof bruto === "boolean") return null;
  const s = String(bruto).trim();
  if (!s || s.length > 40 || /^(null|undefined|todos|all)$/i.test(s)) return null;
  return s;
}

/**
 * Extrai fatos dos parâmetros de chamadas BEM-SUCEDIDAS.
 *
 * Chamada que falhou não estabelece nada: se a API recusou, o parâmetro pode ter
 * sido justamente o motivo.
 */
export function extrairFatos(
  chamadas: readonly { tool: string; params: unknown; ok: boolean }[],
  agora = new Date().toISOString(),
): Fato[] {
  const fora: Fato[] = [];
  for (const c of chamadas) {
    if (!c.ok || !c.params || typeof c.params !== "object") continue;
    for (const [nome, v] of Object.entries(c.params as Record<string, unknown>)) {
      const chave = canonizar(nome);
      const valor = chave ? valorUtil(v) : null;
      if (chave && valor) fora.push({ chave, valor, tool: c.tool, em: agora });
    }
  }
  return fora;
}

/**
 * Junta os fatos novos aos antigos: o mais RECENTE de cada chave vence.
 *
 * Sobrescrever em vez de acumular é a decisão que importa. Uma conversa que
 * falou de março e depois de abril fixou ABRIL; guardar os dois faria o modelo
 * escolher, que é o problema de origem.
 */
export function mesclarFatos(antigos: readonly Fato[], novos: readonly Fato[]): Fato[] {
  const porChave = new Map<string, Fato>();
  for (const f of [...antigos, ...novos]) {
    const atual = porChave.get(f.chave);
    if (!atual || f.em >= atual.em) porChave.set(f.chave, f);
  }
  return [...porChave.values()].sort((a, b) => b.em.localeCompare(a.em)).slice(0, MAX_FATOS);
}

/**
 * O bloco que vai ao prompt. Curto de propósito: entra em TODO turno da conversa,
 * e um quadro de fatos que custa mil tokens paga caro pelo que economiza.
 */
export function blocoDeFatos(fatos: readonly Fato[]): string {
  if (!fatos.length) return "";
  const linhas = fatos.map((f) => `- ${ROTULO[f.chave] ?? f.chave}: ${f.valor}`);
  return [
    "## JÁ ESTABELECIDO NESTA CONVERSA",
    "Estes valores foram usados em consultas que deram certo antes, nesta mesma conversa.",
    "REAPROVEITE-OS quando a mensagem atual não disser outro: é o que a pessoa já informou,",
    "e pedir de novo é fazê-la repetir o que já disse.",
    ...linhas,
    "Se a mensagem atual indicar valor DIFERENTE, o dela vence — estes são o padrão, não uma trava.",
  ].join("\n");
}

/** A conversa já fixou um período? Alimenta o portão de período. */
export function temPeriodoFixado(fatos: readonly Fato[]): boolean {
  return fatos.some((f) => f.chave === "periodo_ini" || f.chave === "competencia");
}

type DbClient = SupabaseClient<Database>;

/** Lê o quadro de fatos da conversa. Nunca lança: sem fatos, o turno segue como sempre seguiu. */
export async function carregarFatos(db: DbClient, convId: string | null | undefined): Promise<Fato[]> {
  if (!convId) return [];
  try {
    const { data } = await db.from("conversations").select("fatos").eq("id", convId).maybeSingle();
    const bruto = (data as { fatos?: unknown } | null)?.fatos;
    if (!Array.isArray(bruto)) return [];
    return bruto.filter(
      (f): f is Fato =>
        !!f && typeof f === "object" &&
        typeof (f as Fato).chave === "string" && typeof (f as Fato).valor === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Grava o quadro mesclado. Dispara sem esperar: o quadro serve ao turno SEGUINTE,
 * e segurar a resposta do usuário por causa dele seria trocar o barato pelo caro.
 */
export function salvarFatos(db: DbClient, convId: string | null | undefined, fatos: readonly Fato[]): void {
  if (!convId || !fatos.length) return;
  void db.from("conversations").update({ fatos: fatos as never }).eq("id", convId)
    .then(({ error }) => { if (error) console.error("[fatos] falha ao gravar:", error.message); });
}
