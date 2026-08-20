/**
 * Quando vale reescrever a consulta antes de buscar.
 *
 * O gate antigo (`temTelaAtiva && !perguntaComposta`) pulava a reescrita sempre que
 * havia uma tabela na tela — que é o caso NORMAL dentro de um relatório do APEX. Na
 * prática ela quase nunca rodava, e um follow-up anafórico ("e em abril?", "e do time
 * do João?") chegava CRU ao embedding. Isso não afeta só a documentação: `consultaRag`
 * alimenta a SELEÇÃO DE FERRAMENTAS, então "e em abril?" não casava ferramenta nenhuma.
 *
 * A troca é o critério: em vez de "tem tela?", pergunta-se "esta mensagem depende do
 * turno anterior para fazer sentido?". No 1º turno — a maioria — o custo continua zero.
 *
 * Puro (sem IO): testável isolado.
 */

/** Mensagem que só faz sentido com o que veio antes. */
const RX_ANAFORA =
  /^\s*(e|ok|certo|agora|tamb[ée]m|ent[ãa]o)\b|\b(dele|dela|deles|delas|desse|dessa|disso|nele|nela|aquele|aquela|o mesmo|a mesma|idem)\b|^\s*e?\s*(em|no|na|do|da|dos|das|pro|para o|para a)\s/i;

export type MotivoPular = "social" | "base_exclusiva" | "modo_relatorio" | "tela_ativa" | null;

export type EntradaGate = {
  question: string;
  /** Só as mensagens do USUÁRIO contam: é o histórico que dá o antecedente. */
  mensagensDoUsuario: number;
  social: boolean;
  baseExclusiva: boolean;
  temTelaAtiva: boolean;
  perguntaComposta: boolean;
  modoRelatorioCedo: boolean;
};

export function deveReescrever(e: EntradaGate): { pular: boolean; motivo: MotivoPular; precisaContexto: boolean } {
  const q = String(e.question ?? "").trim();
  const curta = q.split(/\s+/).filter(Boolean).length <= 6;
  const temHistorico = e.mensagensDoUsuario >= 2;
  const precisaContexto = temHistorico && (curta || RX_ANAFORA.test(q));

  // `social` e `baseExclusiva` são absolutos: não há o que reescrever nem para onde.
  if (e.social) return { pular: true, motivo: "social", precisaContexto };
  if (e.baseExclusiva) return { pular: true, motivo: "base_exclusiva", precisaContexto };

  const pularPorContexto = e.modoRelatorioCedo || (e.temTelaAtiva && !e.perguntaComposta);
  if (pularPorContexto && !precisaContexto) {
    return { pular: true, motivo: e.modoRelatorioCedo ? "modo_relatorio" : "tela_ativa", precisaContexto };
  }
  return { pular: false, motivo: null, precisaContexto };
}

/**
 * Antecedente colado na consulta de ROTEAMENTO, de graça.
 *
 * Rede para quando a reescrita é pulada ou falha: sem isto, "e em abril?" vira um
 * vetor sem assunto e nenhuma ferramenta casa. O corte curto evita diluir o vetor.
 */
export function comAntecedente(question: string, ultimaDoUsuario: string | undefined, max = 120): string {
  const ant = String(ultimaDoUsuario ?? "").trim();
  if (!ant) return question;
  return `${question}\n${ant.slice(0, max)}`;
}

