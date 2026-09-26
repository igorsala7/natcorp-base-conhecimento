import {
  DIMENSOES,
  normalizarRegra,
  nomeDoPortal,
  type Dimensao,
  type Regra,
} from "@/lib/elegibilidade";
import { dimensaoUI } from "./dimensoes-ui";

/**
 * AS DUAS REGRAS VALEM AO MESMO TEMPO, e é isso que esta tela precisa dizer.
 *
 * A sobreposição de uma base não SUBSTITUI a regra da Natcorp: quem alcança
 * precisa satisfazer as duas (é a decisão do dono, implementada em
 * `public.escopo_documentacao` pela tarefa 9). A consequência para a tela é uma
 * armadilha e um defeito:
 *
 * ── Por que NÃO existe aqui uma "regra resultante" ───────────────────────
 * O caminho óbvio seria interseccionar as duas listas e mandar a regra
 * resultante para `resumoElegibilidade`. Isso INVERTE o sentido num caso real:
 * Natcorp com `portal: ["PG"]` e base com `portal: ["PO"]` dá interseção `[]`, e
 * neste motor **lista vazia LIBERA** — a frase diria "todos alcançam" onde
 * ninguém alcança. É a mesma armadilha de `normalizarRegra`, que por isso nunca
 * roda sem o validador na frente. A tela mostra então DUAS frases e a conjunção,
 * cada uma com a regra que é dela.
 *
 * ── E o caso em que salvar não é intenção de ninguém ─────────────────────
 * Quando as duas listas de uma mesma dimensão são disjuntas, o resultado é uma
 * documentação que ninguém alcança. Isso nunca é o que se quis: quem quer
 * esconder usa o interruptor de ocultar. Daí `exclusoesEntreRegras`, que a tela
 * usa para avisar e a action usa para RECUSAR — o efeito seria silencioso, como
 * nas outras três travas da gravação.
 *
 * Puro de propósito (nada de `server-only`): a tela é `"use client"` e a action
 * precisa da mesma decisão, e duas implementações divergiriam.
 */

export type ExclusaoDeRegra = {
  dimensao: Dimensao;
  /** Valores que a Natcorp permite, como ela os escreveu. */
  permitidos: string[];
  /** Valores que a base escolheu, como foram escolhidos. */
  escolhidos: string[];
};

/** Os valores de uma dimensão como estão escritos, só sem branco. */
function comoEstao(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
}

/** Esta regra restringe alguma coisa? Regra vazia (ou só de brancos) não. */
export function regraRestringeAlgo(regra: Regra): boolean {
  return Object.keys(normalizarRegra(regra)).length > 0;
}

/**
 * As dimensões em que as duas regras se EXCLUEM: as duas restringem, e nenhum
 * valor é comum.
 *
 * Dimensão presente em só uma das duas NÃO é exclusão — a ausente libera, e a
 * combinação vale a que restringe. Lista vazia também libera, pela convenção do
 * motor.
 *
 * A comparação passa por `normalizarRegra`, que é a MESMA normalização do
 * predicado (`textoComoNoJsonb` + aparo + caixa): sem isso `"PG"` e `" pg "`
 * seriam lidos como exclusão e a tela recusaria uma escolha legítima. Como
 * `normalizarRegra` DESCARTA chave desconhecida e valor que não é lista, esta
 * função tem a mesma obrigação dela no caminho de gravação: rodar DEPOIS de
 * `chavesProblematicasDaRegra`, nunca antes.
 */
export function exclusoesEntreRegras(natcorp: Regra, daBase: Regra): ExclusaoDeRegra[] {
  const a = normalizarRegra(natcorp);
  const b = normalizarRegra(daBase);
  const fora: ExclusaoDeRegra[] = [];
  for (const d of DIMENSOES) {
    const permitidos = a[d] ?? [];
    const escolhidos = b[d] ?? [];
    if (permitidos.length === 0 || escolhidos.length === 0) continue;
    if (permitidos.some((v) => escolhidos.includes(v))) continue;
    fora.push({
      dimensao: d,
      permitidos: comoEstao(natcorp[d]),
      escolhidos: comoEstao(daBase[d]),
    });
  }
  return fora;
}

/** Portal aparece por nome nas frases da tela; os outros, pelo código. */
function paraLeitura(d: Dimensao, valores: string[]): string {
  return (d === "portal" ? valores.map(nomeDoPortal) : valores).join(", ");
}

/**
 * A mensagem de recusa, em português de operador.
 *
 * Mora aqui para a TELA e a ACTION dizerem a mesma coisa. Aponta para o
 * interruptor de ocultar porque é ele que atende a intenção "não quero que isso
 * apareça" — que é a única leitura razoável de quem escolheu valores que não
 * alcançam ninguém.
 *
 * A dimensão de CLIENTE não lista valores: ela só pode ter sido preenchida pela
 * Natcorp (a tela do cliente não a oferece), e nomear os valores imprimiria o
 * código de outro cliente na tela deste.
 */
export function mensagemDeExclusao(exclusoes: ExclusaoDeRegra[]): string {
  const partes = exclusoes.map((e) => {
    const rotulo = dimensaoUI(e.dimensao).rotulo;
    if (e.dimensao === "base") {
      return `${rotulo}: há uma restrição definida pela Natcorp que a sua escolha não atende.`;
    }
    return (
      `${rotulo}: a Natcorp permite ${paraLeitura(e.dimensao, e.permitidos)} nesta documentação, ` +
      `e você escolheu ${paraLeitura(e.dimensao, e.escolhidos)}.`
    );
  });
  return (
    `${partes.join(" ")} As duas condições valem ao mesmo tempo, então ninguém da sua empresa ` +
    `alcançaria. Escolha um valor que a Natcorp permite — ou use "Ocultar", se a intenção é ` +
    `esconder esta documentação dos seus usuários.`
  );
}
