import type { TrackingKey } from "@/lib/chat/tracking";
import { CHAVE_DE_DIMENSAO, DIMENSOES, type Dimensao, type Identidade, type Regra } from "./dimensoes";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * ESTA REGRA TAMBÉM EXISTE EM SQL (`public.elegivel`), e não por preguiça.
 *
 * O corte tem de acontecer no banco porque `widget.js` é público: mandar a
 * lista inteira para o navegador filtrar entregaria ao cliente os nomes de
 * tudo que ele NÃO pode ver. E a frase tem de existir aqui porque a tela a
 * mostra enquanto o admin digita.
 *
 * Duas implementações da mesma regra divergem; é questão de quando. As duas
 * lêem `casos.json` e `scripts/verificar-elegibilidade.ts` falha se
 * discordarem em um único caso.
 *
 * Quatro decisões que parecem detalhe e não são:
 *
 * · lista efetivamente vazia LIBERA (convenção do projeto, igual a
 *   `cardinality = 0` no SQL);
 * · valor ausente contra dimensão restrita FECHA (decisão do dono: a
 *   alternativa faria um PDF de um centro de custo vazar para a empresa
 *   inteira sem ninguém notar);
 * · brancos saem da lista ANTES de comparar, senão ausência casaria com
 *   branco e abriria o que deveria fechar (foi exatamente o furo encontrado
 *   em `allowlist_casa` em 24/09);
 * · dentro da dimensão OU, entre dimensões E.
 */
/** As doze, para rejeitar chave que não é dimensão. */
const CONHECIDAS = new Set<string>(DIMENSOES);

/**
 * As entradas de uma regra que VEM DE UMA COLUNA `jsonb`, sem derrubar nunca.
 *
 * `Object.entries(null)` e `Object.entries(undefined)` levantam `TypeError`, e
 * as três funções deste arquivo são guarda: guarda que derruba não é guarda.
 * Regra que não é objeto não tem chave a percorrer, e o que fazer com ela é
 * decisão de cada função — o predicado FECHA, as duas do caminho de gravação
 * não têm campo nenhum a reportar.
 *
 * Todas as três iteram ISTO, e não a lista fixa `DIMENSOES`. Iterar a lista
 * fixa foi o defeito de 24/09: chave desconhecida era ignorada, e ignorar ABRE.
 */
function entradasDaRegra(regra: unknown): [string, unknown][] {
  if (!regra || typeof regra !== "object" || Array.isArray(regra)) return [];
  return Object.entries(regra as Record<string, unknown>);
}

/** `String(x)` espelha o `x #>> '{}'` do SQL, que leva qualquer escalar a texto. */
const comoTexto = (x: unknown) => norm(x === null || x === undefined ? "" : String(x));

export function alcanca(regra: Regra, ident: Identidade): boolean {
  /**
   * Itera as chaves DA REGRA, e não a lista fixa de dimensões.
   *
   * Iterar `DIMENSOES` fazia uma chave desconhecida ser ignorada em silêncio, e
   * ignorar ABRE: uma regra gravada com `centro_custos` (plural, typo) não
   * restringiria nada. O gêmeo em SQL usa `jsonb_each(regra)`, ou seja, já
   * iterava a regra, e por isso os dois divergiam justamente no caso de typo.
   *
   * Agora os dois iteram a regra e os dois FECHAM em chave desconhecida.
   */
  for (const [chave, bruto] of Object.entries(regra)) {
    /**
     * `unknown` e não `string[]`, porque a regra vem de uma coluna `jsonb`: o
     * tipo não garante NADA em tempo de execução. A primeira versão fazia
     * `(regra[d] ?? []).map(...)` e tinha dois defeitos de uma vez — `.map` num
     * string derrubava o turno inteiro, e o gêmeo em SQL, que não derrubava,
     * simplesmente IGNORAVA a dimensão e abria o conteúdo.
     *
     * Regra malformada FECHA, nos dois lados, inclusive quando a identidade
     * casaria. Não se adivinha intenção de dado malformado, e quem impede a
     * regra malformada de EXISTIR é `chavesProblematicasDaRegra` no caminho de
     * gravação — `normalizarRegra` só limpa, e por isso ela nunca roda sozinha.
     */
    if (bruto === null || bruto === undefined) continue; // não configurada
    // Chave que não é uma das doze: regra malformada, fecha. Antes do teste de
    // array, na mesma ordem do SQL (que exclui `null` antes de tudo).
    if (!CONHECIDAS.has(chave)) return false;
    if (!Array.isArray(bruto)) return false; // malformada: fecha

    // `comoTexto` espelha o `x #>> '{}'` do SQL, que converte qualquer escalar
    // jsonb para texto. Sem isso, regra com número casaria de um lado só.
    const lista = bruto.map(comoTexto).filter((x) => x !== "");
    if (lista.length === 0) continue; // lista vazia ou só de brancos: libera
    const valor = norm(ident[chave as Dimensao]);
    if (valor === "") return false; // ausência fecha
    if (!lista.includes(valor)) return false;
  }
  return true;
}

/** Monta a identidade a partir dos parâmetros de rastreio do turno. */
export function identidadeDoRastreio(
  t: Partial<Record<TrackingKey, string>>,
): Identidade {
  const out: Identidade = {};
  for (const d of DIMENSOES) {
    const v = t[CHAVE_DE_DIMENSAO[d]];
    if (typeof v === "string" && v.trim()) out[d] = v;
  }
  return out;
}

/**
 * Limpa a regra para gravação: fora os brancos, fora a caixa, fora duplicata.
 *
 * O predicado já ignora branco ao comparar, então isto não muda alcance — muda
 * o que fica GRAVADO. Sem normalizar na entrada, o banco acumula
 * `["PG", "pg", "", " PG "]`, a tela mostra quatro chips onde há um valor, e a
 * pessoa que for conferir a regra conta errado.
 *
 * DESCARTA chave desconhecida e valor que não é lista, e isso só é seguro
 * porque quem ACUSA é `chavesProblematicasDaRegra`, chamada ANTES no caminho de
 * gravação. A versão de 24/09 descartava sem ninguém acusar, e o efeito medido
 * era o pior possível: `{centro_custos:["100"]}` (typo no plural, o erro mais
 * provável) virava `{}`, ou seja uma regra que FECHA era gravada como regra que
 * ABRE. Nunca use esta função sem o validador na frente.
 */
export function normalizarRegra(regra: Regra): Regra {
  const out: Regra = {};
  for (const [chave, bruto] of entradasDaRegra(regra)) {
    if (!CONHECIDAS.has(chave)) continue; // acusada pelo validador
    if (!Array.isArray(bruto)) continue; // idem
    const itens = [...new Set(bruto.map(comoTexto).filter((x) => x !== ""))];
    if (itens.length) out[chave as Dimensao] = itens;
  }
  return out;
}

/**
 * O VALIDADOR DO CAMINHO DE GRAVAÇÃO: quais chaves da regra são problema.
 *
 * Três problemas, e cada um seria gravado sem erro nenhum se ninguém olhasse:
 *
 * · chave que não é uma das doze — typo como `centro_custos` no plural. O
 *   predicado FECHA nela (as duas implementações), então a regra não alcança
 *   ninguém, e a tela diria que alcança;
 * · valor que não é lista — `"PG"` em vez de `["PG"]`. O predicado também
 *   FECHA;
 * · lista cujos itens são TODOS em branco — aí o predicado faz o contrário:
 *   trata como "não restringe" e LIBERA, que é o oposto da intenção de quem
 *   digitou. A pessoa quis restringir e abriu.
 *
 * Devolve as chaves, e não um booleano, porque a mensagem de erro precisa
 * nomear QUAL campo está errado. São chaves da regra (`string`), e não
 * `Dimensao`: a chave desconhecida é justamente uma das coisas reportadas.
 *
 * Lista VAZIA e valor `null` não são problema: são as duas formas legítimas de
 * "esta dimensão não restringe".
 *
 * Regra INTEIRA que não é objeto não tem chave a reportar e sai daqui como
 * `[]`. Quem fecha nesse caso é `alcanca`/`public.elegivel`; o formulário não
 * consegue produzir uma.
 */
export function chavesProblematicasDaRegra(regra: Regra): string[] {
  const problemas: string[] = [];
  for (const [chave, bruto] of entradasDaRegra(regra)) {
    if (bruto === null || bruto === undefined) continue; // não configurada
    if (!CONHECIDAS.has(chave) || !Array.isArray(bruto)) {
      problemas.push(chave);
      continue;
    }
    if (bruto.length === 0) continue; // sem restrição, legítimo
    if (bruto.every((x) => comoTexto(x) === "")) problemas.push(chave); // restringe para ninguém
  }
  return problemas;
}
