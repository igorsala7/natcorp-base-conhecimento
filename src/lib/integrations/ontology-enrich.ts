/**
 * Seleção PURA das formas da ontologia que enriquecem o vetor de cada ferramenta.
 *
 * Fica separado de `tool-catalog.ts` (que puxa provedor de IA e Supabase) para ser
 * testável isolado — mesmo padrão de `module-match` × `module-select` e
 * `guard-catalog` × `guards`.
 */
import { contemTermo, normalizarTermo, type EntradaOntologia } from "@/lib/ai/ontology";

/** Teto de formas da ontologia por tool — um conceito muito genérico não pode inchar o vetor. */
const MAX_FORMAS_ONTOLOGIA = 40;
/**
 * Gatilho curto demais é bomba de ambiguidade: o alias "SO" (de "Jornada Sobreaviso")
 * casava dentro do texto de `atualizar_telefone` e colava 11 formas sobre sobreaviso
 * numa ferramenta que troca número de celular. 4 caracteres é o piso.
 */
const MIN_GATILHO = 4;
/**
 * Gatilho presente em mais de 20% do catálogo não distingue nada ("colaborador",
 * "cadastro", "dados", "pessoal" aparecem em quase toda descrição). Conceito
 * disparado SÓ por termo assim é descartado — é o mesmo princípio do IDF: o que
 * está em tudo não informa nada, e ainda dilui o vetor para longe do seu assunto.
 */
const TETO_FREQUENCIA = 0.2;

/**
 * Escolhe, para cada ferramenta, as formas da ontologia que merecem entrar no vetor.
 * PURA (testável): recebe os textos das ferramentas e as entradas da ontologia.
 *
 * Duas passadas, porque o critério é comparativo:
 *  1. casa os conceitos por gatilho com ao menos `MIN_GATILHO` caracteres, e conta em
 *     quantas ferramentas cada gatilho aparece;
 *  2. mantém só o conceito com ao menos um gatilho RARO no catálogo (≤ `TETO_FREQUENCIA`).
 *
 * Sem isso o enriquecimento vira sopa: o alias "SO" (de "Jornada Sobreaviso") casava
 * dentro de `atualizar_telefone` e colava 11 formas de sobreaviso numa ferramenta de
 * trocar celular — que passou a ser a 1ª colocada para "Jornada Sobreaviso".
 */
export function selecionarFormasOntologia(
  textos: Map<string, string>,
  entradas: EntradaOntologia[],
  opts: { minGatilho?: number; tetoFrequencia?: number; max?: number } = {},
): Map<string, string[]> {
  const minGatilho = opts.minGatilho ?? MIN_GATILHO;
  const tetoFreq = opts.tetoFrequencia ?? TETO_FREQUENCIA;
  const max = opts.max ?? MAX_FORMAS_ONTOLOGIA;
  const casadas = new Map<string, { forms: string[]; gatilhos: string[] }[]>();
  const freq = new Map<string, number>();

  for (const [id, texto] of textos) {
    const tn = normalizarTermo(texto);
    const cs = entradas
      .map((e) => ({ forms: e.forms, gatilhos: e.matchNorms.filter((n) => n.length >= minGatilho && contemTermo(tn, n)) }))
      .filter((c) => c.gatilhos.length > 0);
    casadas.set(id, cs);
    for (const g of new Set(cs.flatMap((c) => c.gatilhos))) freq.set(g, (freq.get(g) ?? 0) + 1);
  }

  const tetoDocs = Math.max(1, Math.floor(textos.size * tetoFreq));
  const out = new Map<string, string[]>();
  for (const [id, cs] of casadas) {
    const formas = [
      ...new Set(
        cs
          .filter((c) => c.gatilhos.some((g) => (freq.get(g) ?? 0) <= tetoDocs))
          .flatMap((c) => c.forms.map((f) => f.trim()))
          .filter(Boolean),
      ),
    ];
    out.set(id, formas.slice(0, max));
  }
  return out;
}

