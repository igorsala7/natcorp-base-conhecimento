/**
 * "1" É UMA RESPOSTA, NÃO UMA PERGUNTA.
 *
 * Quando o próprio agente oferece opções numeradas e a pessoa responde com o
 * número, a mensagem seguinte é literalmente `"1"` — e o pipeline inteiro a
 * trata como pergunta nova. Medido em produção (19/08/2026):
 *
 *   Agente: "Você quer: 1. Todos os colaboradores da empresa? 2. De um grupo
 *            específico? 3. Alguns em particular?"
 *   Pessoa: "1"
 *   Agente: "Vejo que o contexto trouxe informações sobre mergulho e
 *            descompressão (NR-15), que não tem relação com sua pergunta…"
 *
 * A cadeia: `interpretarConsulta` ignora mensagem com menos de 3 caracteres
 * (`query-understanding.ts`), então "1" segue cru; o RAG busca por "1" e traz o
 * que der; a seleção de ferramentas não casa com nada (`casou_tools: []`); e o
 * agente conclui que a ferramenta de ponto "não está disponível" — a mesma que
 * ele havia chamado no turno anterior.
 *
 * Nada disso é o modelo sendo ruim. É o sistema perdendo a pergunta que ELE
 * mesmo fez uma mensagem atrás.
 *
 * Puro e sem I/O.
 */

/** Teto do texto devolvido — vira consulta, não parágrafo. */
const MAX_OPCAO = 160;

/** A mensagem é SÓ uma escolha? "1", "opção 2", "a 3", "2)" — nada além disso. */
const RX_SO_NUMERO = /^\s*(?:op[çc][ãa]o\s*|alternativa\s*|item\s*|a\s+|o\s+)?(\d{1,2})\s*[).\]]?\s*$/i;

/** Ordinais que valem como escolha ("a primeira", "segunda"). */
const ORDINAIS: Record<string, number> = {
  primeira: 1, primeiro: 1, segunda: 2, segundo: 2, terceira: 3, terceiro: 3,
  quarta: 4, quarto: 4, quinta: 5, quinto: 5,
};
const RX_ORDINAL = /^\s*(?:a\s+|o\s+)?(primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|quint[ao])\s*$/i;
/** Linha de opção: `1.`, `1)` ou `1 -` no começo. */
const RX_LINHA_OPCAO = /^\s*(\d{1,2})\s*[).\-–]\s+(.+)$/;

/** Número escolhido pela pessoa, ou null se a mensagem não é uma escolha pura. */
export function numeroEscolhido(pergunta: string): number | null {
  const t = String(pergunta ?? "").trim();
  if (!t || t.length > 24) return null;
  const m = t.match(RX_SO_NUMERO);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= 20 ? n : null;
  }
  const o = t.match(RX_ORDINAL);
  if (o) return ORDINAIS[o[1]!.toLowerCase()] ?? null;
  return null;
}

/**
 * As opções numeradas de uma mensagem do assistente.
 *
 * Tira a marcação de negrito e corta o rótulo — o que importa é o texto da
 * opção, não o parêntese explicativo que vem depois.
 */
export function opcoesOferecidas(resposta: string): string[] {
  const achadas = new Map<number, string>();
  for (const linha of String(resposta ?? "").split(/\r?\n/)) {
    const m = linha.match(RX_LINHA_OPCAO);
    if (!m) continue;
    const n = Number(m[1]);
    if (n < 1 || n > 20 || achadas.has(n)) continue;
    const texto = m[2]!.replace(/\*\*/g, "").replace(/[*_`]/g, "").trim().slice(0, MAX_OPCAO).trim();
    if (texto) achadas.set(n, texto);
  }
  // Só vale como MENU se começa em 1 e tem ao menos duas opções — senão um passo
  // a passo ("1. Abra a tela  2. Clique em salvar") viraria menu, e responder
  // "2" reescreveria a pergunta para "clique em salvar".
  if (!achadas.has(1) || achadas.size < 2) return [];
  const out: string[] = [];
  for (let i = 1; achadas.has(i); i++) out.push(achadas.get(i)!);
  return out;
}

/**
 * A pergunta que a pessoa realmente fez ao responder com um número.
 *
 * Devolve `null` quando a mensagem não é escolha pura, quando a resposta
 * anterior não oferecia menu, ou quando o número está fora da lista — aí o
 * fluxo normal continua valendo, e forçar uma reescrita seria inventar intenção.
 */
export function resolverEscolha(pergunta: string, ultimaRespostaAssistente: string): string | null {
  const n = numeroEscolhido(pergunta);
  if (n == null) return null;
  const opcoes = opcoesOferecidas(ultimaRespostaAssistente);
  return opcoes[n - 1] ?? null;
}
