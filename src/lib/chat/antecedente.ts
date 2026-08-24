/**
 * O QUE O SERVIDOR ENTENDEU DO PEDIDO — dito ao modelo, não só ao funil.
 *
 * O funil recebe a mensagem com o antecedente colado (`consultaTools`,
 * `route.ts:789`) e o modelo recebe o texto cru (`route.ts:1762`). Numa mensagem
 * de uma a seis palavras — "Tudo junto", "Ao tony mesmo", "excel" — quem escolhe
 * a ferramenta sabe do que se fala e quem decide usá-la não sabe.
 *
 * Medido em 24/08/2026 sobre 1.424 turnos: 519 (36%) tinham ferramenta de
 * integração na mesa e não chamaram nenhuma; 158 desses são mensagens de até 6
 * palavras. E o acerto em mensagem curta é 27% contra 50% nas longas
 * (`portao-acao.ts`).
 *
 * ── ISTO NÃO É INFORMAÇÃO NOVA ─────────────────────────────────────────────
 * O histórico já vai no payload. O que muda é SALIÊNCIA: dizer qual é o
 * antecedente em vez de esperar que o modelo o encontre. Por isso o texto é
 * curto e rotulado como leitura DO SISTEMA — nunca substitui a fala da pessoa,
 * que continua indo íntegra para o banco e para o histórico.
 *
 * ── O QUE A MEDIÇÃO SUSTENTA, E O QUE NÃO ──────────────────────────────────
 * 125 casos, gemini-3.5-flash, `--funil`, duas rodadas por braço:
 *
 *                 ferramenta   pergunta   perguntou demais
 *   baseline        59 · 60    111 · 113       5 · 3
 *   com antecedente 59 · 59    113 · 115       1 · 2
 *
 * · FERRAMENTA: plano. A hipótese do plano de 21/08 (18 casos de ferramenta)
 *   NÃO se confirmou, e é preciso dizer isso — este bloco foi construído para
 *   aquele eixo.
 * · PERGUNTA: as faixas SE SOBREPÕEM (113 aparece nos dois braços). Não dá para
 *   reivindicar ganho aqui.
 * · PERGUNTOU DEMAIS: 3–5 contra 1–2, faixas SEM sobreposição. É o único efeito
 *   que sobrevive à repetição — o agente para de pedir contexto que já está na
 *   mesa. Ganho de experiência (menos ida e volta), não de assertividade.
 *
 * Custo: +14 tok por turno na média (11.680 → 11.694), 0,1%.
 *
 * ── PURO DE PROPÓSITO ──────────────────────────────────────────────────────
 * Sem `server-only`, sem IO. É o que permite ao eval espelhar exatamente o que a
 * rota faz, como já acontece com `portao-acao` e `entrega`. Diretiva que a
 * bancada não consegue reproduzir é diretiva que não se consegue medir.
 */
import { comAntecedente } from "@/lib/ai/rewrite-gate";

/** Rollback por variável de ambiente, como `PORTAO_ACAO_OFF`. */
export function antecedenteLigado(): boolean {
  return process.env.ANTECEDENTE_NO_MODELO !== "0";
}

type Msg = { role: string; content: string };

/**
 * A última fala do usuário que não é a pergunta atual.
 *
 * Mesma expressão que `route.ts:790` usa para montar `consultaTools` — e é o
 * ponto: as duas pontas passam a ler o MESMO antecedente. Se divergirem, o
 * defeito volta calado.
 */
export function ultimaDoUsuario(question: string, messages: readonly Msg[]): string | undefined {
  return [...messages].reverse().find((m) => m.role === "user" && m.content !== question)?.content;
}

/**
 * O bloco pronto, ou "" quando não há antecedente (o compositor omite vazio).
 *
 * `comAntecedente` devolve `pergunta\nantecedente` cortado em 120 chars. Aqui o
 * texto é rotulado, porque o modelo precisa saber que a segunda linha é leitura
 * do sistema e não algo que a pessoa escreveu agora.
 */
export function antecedenteDoTurno(question: string, messages: readonly Msg[]): string {
  const ant = ultimaDoUsuario(question, messages);
  const comAnt = comAntecedente(question, ant);
  if (comAnt === question) return ""; // não havia antecedente
  const soOAntecedente = comAnt.slice(question.length).trim();
  if (!soOAntecedente) return "";
  // Rótulo CURTO de propósito: ele paga em 33% dos turnos. A primeira versão
  // gastava ~105 chars de etiqueta para ~30 de conteúdo. As duas coisas que o
  // rótulo precisa dizer são "veio do turno anterior" e "é leitura do sistema,
  // não fala do usuário" — o resto é enfeite caro.
  return `ASSUNTO DO TURNO ANTERIOR (leitura do sistema): «${soOAntecedente}»`;
}
