/**
 * Memória de recuperação por conversa — a política, sem IO.
 *
 * ── O que resolve ──────────────────────────────────────────────────────────
 *
 * Hoje cada pergunta recupera do zero e substitui o contexto documental do
 * turno anterior. Numa conversa de ~5 turnos:
 *
 *   turno 1  "quantos dias de férias o João tem?"   → regra de período aquisitivo
 *   turno 2  "e o parcelamento?"                    → regra de parcelas (a anterior SAI)
 *   turno 3  "então pode em outubro?"               → regra de prazo (as duas anteriores SAÍRAM)
 *
 * No turno 3 a resposta certa depende das três regras. O modelo tem uma.
 *
 * ── Por que boost e não fixação ─────────────────────────────────────────────
 *
 * O caminho óbvio seria acumular: manter tudo o que já veio. Mas contexto
 * demais degrada a recuperação tanto quanto contexto de menos, e diluição custa
 * assertividade — que é o que não se pode perder.
 *
 * Então a memória não FIXA nada: ela dá vantagem. Quem decide continua sendo a
 * fusão RRF; a memória só desempata a favor da continuidade quando o trecho já
 * apareceu na conversa. Um trecho que era relevante no turno 2 e virou ruído no
 * turno 5 perde naturalmente — não fica pendurado.
 *
 * Efeito colateral desejado: o bloco de RAG passa a mudar MENOS entre turnos, o
 * que o torna mais amigável ao cache de prefixo. Mas isso é consequência, não
 * objetivo — a decisão foi tomada pela qualidade da resposta.
 */

/** Uma entrada da memória: o nó recuperado e em que turno ele entrou. */
export type EntradaMemoria = {
  /** Nó do artigo. Nulo quando a fonte é um arquivo da base de conhecimento. */
  node_id: string | null;
  /** Documento da base. Nulo quando a fonte é um artigo. */
  document_id: string | null;
  /** Turno em que entrou (1-based). Serve para envelhecer os mais antigos primeiro. */
  turno: number;
};

/**
 * Teto da memória.
 *
 * Doze porque a recuperação normal traz até 8 por turno: o teto precisa caber
 * mais de um turno de história (senão não há continuidade) sem chegar perto de
 * dominar a próxima fusão (senão vira a diluição que se quer evitar).
 */
export const TETO_MEMORIA = 12;

/**
 * Quantos turnos uma entrada sobrevive sem reaparecer.
 *
 * Três é o alcance de um assunto numa conversa de ~5 turnos: o suficiente para
 * a regra do turno 1 ainda valer no turno 3, curto o bastante para o assunto
 * antigo sair quando a pessoa muda de tema.
 */
export const JANELA_TURNOS = 3;

/** Chave de identidade de uma entrada — artigo e documento vivem em espaços diferentes. */
const chave = (e: { node_id: string | null; document_id: string | null }) =>
  `${e.node_id ?? ""}|${e.document_id ?? ""}`;

/**
 * Lê a memória crua do banco tolerando lixo.
 *
 * A coluna é `jsonb` livre: uma versão anterior, uma escrita parcial ou um
 * registro editado à mão não podem derrubar o chat. Entrada malformada é
 * descartada em silêncio — perder continuidade é aceitável, quebrar não é.
 */
export function lerMemoria(raw: unknown): EntradaMemoria[] {
  if (!Array.isArray(raw)) return [];
  const out: EntradaMemoria[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const node_id = typeof o.node_id === "string" && o.node_id ? o.node_id : null;
    const document_id = typeof o.document_id === "string" && o.document_id ? o.document_id : null;
    const turno = typeof o.turno === "number" && Number.isFinite(o.turno) ? o.turno : 0;
    if (!node_id && !document_id) continue; // entrada sem identidade não serve para nada
    out.push({ node_id, document_id, turno });
  }
  return out;
}

/**
 * Nós que a recuperação deste turno deve priorizar.
 *
 * Só o que ainda está dentro da janela — memória velha é ruído com aparência de
 * contexto.
 */
export function nosParaBoost(memoria: EntradaMemoria[], turnoAtual: number): string[] {
  return memoria
    .filter((e) => e.node_id && turnoAtual - e.turno < JANELA_TURNOS)
    .map((e) => e.node_id as string);
}

/**
 * Nova memória depois deste turno.
 *
 * O que foi recuperado agora entra (ou tem o turno renovado, se já estava lá — é
 * assim que um trecho recorrente sobrevive), e o resto envelhece. O corte é por
 * turno mais recente primeiro, e o teto é aplicado no fim.
 *
 * Não muta a entrada.
 */
export function atualizarMemoria(
  memoria: EntradaMemoria[],
  recuperadosAgora: { node_id: string | null; document_id: string | null }[],
  turnoAtual: number,
): EntradaMemoria[] {
  const porChave = new Map<string, EntradaMemoria>();
  // Primeiro o histórico, para que o turno renovado abaixo sobrescreva.
  for (const e of memoria) {
    if (turnoAtual - e.turno >= JANELA_TURNOS) continue; // já saiu da janela
    porChave.set(chave(e), { ...e });
  }
  for (const r of recuperadosAgora) {
    if (!r.node_id && !r.document_id) continue;
    porChave.set(chave(r), { node_id: r.node_id, document_id: r.document_id, turno: turnoAtual });
  }
  return [...porChave.values()]
    .sort((a, b) => b.turno - a.turno)
    .slice(0, TETO_MEMORIA);
}
