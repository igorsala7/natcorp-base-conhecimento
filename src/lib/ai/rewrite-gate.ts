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

/** Palavras que não distinguem assunto nenhum — fora da comparação. */
const VAZIAS = new Set([
  "o", "a", "os", "as", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas",
  "um", "uma", "para", "por", "com", "que", "qual", "quais", "me", "meu", "minha", "meus",
  "minhas", "ao", "aos", "à", "às", "se", "eu", "ele", "ela", "isso", "esse", "essa", "este",
  "esta", "mais", "mes", "mês", "ano", "dia", "quero", "traga", "mostre", "faca", "faça",
]);

const conteudo = (t: string): Set<string> =>
  new Set(
    String(t ?? "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4 && !VAZIAS.has(p)),
  );

/**
 * A REESCRITA SUBSTITUIU A PERGUNTA, em vez de esclarecê-la?
 *
 * Reescrever "quanto ganho" como "remuneração" é o que a reescrita existe para
 * fazer. Reescrever "Compara com o mês de Abril" como "Recibo de Pagamento" —
 * o TÍTULO DA TELA — é outra coisa: a pergunta desapareceu.
 *
 * Medido: a reescrita troca a pergunta por completo em 34% dos turnos, quase
 * sempre pelo título da tela. Isso não é fatal onde ela só amplia a busca, e por
 * isso descartá-la em bloco foi medido e REJEITADO (custou mais casos do que
 * salvou, 19/08). É fatal onde uma ÚNICA ferramenta é forçada a partir dela:
 * numa conversa real, "Compara com o mês de Abril" virou "Recibo de Pagamento",
 * o roteador viu 0,71 contra 0,62 e mandou só `relatorio_recibo_pagamento` ao
 * modelo — descartando `historico_financeiro`, que o top-K tinha mantido.
 *
 * A assimetria é o que justifica ser conservador só aqui: não forçar custa o
 * modelo chamar duas ferramentas parecidas; forçar errado custa a resposta.
 */
export function reescritaPerdeuAPergunta(original: string, reescrita: string): boolean {
  const o = conteudo(original);
  const r = conteudo(reescrita);
  // Sem palavra de conteúdo de um dos lados não há o que comparar — não bloqueia.
  if (o.size === 0 || r.size === 0) return false;
  for (const p of r) if (o.has(p)) return false;
  return true;
}
