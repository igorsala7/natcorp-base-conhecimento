import type { TrackingKey } from "@/lib/chat/tracking";
import { CHAVE_DE_DIMENSAO, DIMENSOES, type Dimensao, type Identidade, type Regra } from "./dimensoes";

/**
 * A ORDEM DE CHAVE DO `jsonb`, medida no banco em 25/09: TAMANHO EM BYTES
 * primeiro, depois byte a byte.
 *
 * Não é alfabética, e a diferença aparece no primeiro exemplo que alguém tentar:
 *
 *   {"b":1,"aa":2}  ->  {"b": 1, "aa": 2}     (curta primeiro, apesar de b > a)
 *   {"B":1,"a":2}   ->  {"B": 1, "a": 2}      (byte 0x42 antes de 0x61)
 *   {"ç":1,"a":2}   ->  {"a": 2, "ç": 1}      (ç tem 2 bytes em UTF-8)
 */
function ordemDeChaveJsonb(a: string, b: string): number {
  const codificador = new TextEncoder();
  const ba = codificador.encode(a);
  const bb = codificador.encode(b);
  if (ba.length !== bb.length) return ba.length - bb.length;
  for (let i = 0; i < ba.length; i++) {
    if (ba[i] !== bb[i]) return ba[i]! - bb[i]!;
  }
  return 0;
}

/** Serialização de um valor DENTRO de uma estrutura: texto sai com aspas. */
function jsonbDentro(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(jsonbDentro).join(", ")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const chaves = Object.keys(o).sort(ordemDeChaveJsonb);
    return `{${chaves.map((k) => `${JSON.stringify(k)}: ${jsonbDentro(o[k])}`).join(", ")}}`;
  }
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

/**
 * O `#>> '{}'` DO SQL, EM TYPESCRIPT — e ele NÃO é `String(x)`.
 *
 * Tanto o valor da identidade (`identidade #>> array[dim]`) quanto cada item da
 * lista da regra (`array_agg(x #>> '{}')`) passam por essa extração no gêmeo em
 * SQL. Replicar aqui é o que faz os dois lados compararem o MESMO texto.
 *
 * `String(x)` erra em dois lugares, e um deles ABRE:
 *
 *   String(["PG"])          = "PG"        o SQL dá '["PG"]'  -> casaria com uma
 *                                         regra ["PG"] e liberaria quem o SQL
 *                                         nega. Este é o perigo.
 *   String({a:1})           = "[object Object]"   o SQL dá '{"a": 1}'
 *
 * Medido no banco em 25/09, e por isso a serialização tem `", "`, `": "` e a
 * ordem de chave acima: `JSON.stringify` sozinho NÃO serve — ele não põe espaço
 * depois da vírgula nem dos dois-pontos, e não ordena chave.
 *
 * No TOPO o comportamento difere de dentro da estrutura, e também é medido:
 * texto sai SEM aspas (`{"v":"PG"} #>> '{v}'` é `PG`) e `null` sai como SQL NULL,
 * que a allowlist lê como vazio — ou seja, AUSÊNCIA, que fecha.
 *
 * Dois limites que não dão para cobrir, e nenhum é alcançável:
 * `1.0` e `1e21` chegam do banco como `'1.0'` e `'1000000000000000000000'`,
 * enquanto o JavaScript só tem o número 1 e `'1e+21'` — a forma escrita não
 * sobrevive ao `JSON.parse`, então a divergência é do tipo, não do código.
 */
export function textoComoNoJsonb(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return jsonbDentro(v);
  return String(v);
}

/**
 * Normaliza para comparar: o texto do jsonb, aparado e sem caixa.
 *
 * Recebe `unknown` e não `string`, e isso é a correção de um defeito medido:
 * `(v ?? "").trim()` DERRUBAVA quando a identidade não era texto —
 * `alcanca({centro_custo:["100"]}, {centro_custo: 100})` levantava
 * `TypeError: (v ?? "").trim is not a function`, enquanto `public.elegivel`
 * devolvia um booleano sem exceção. É o mesmo princípio que esta onda aplicou à
 * REGRA e tinha esquecido na IDENTIDADE: autorização que estoura devolve 500
 * onde devia devolver negação, e aqui derrubaria o turno do chat inteiro.
 *
 * Hoje `identidadeDoRastreio` só produz texto. Dispara quando a identidade
 * passar a ser montada a partir de coluna do banco.
 */
const norm = (v: unknown) => textoComoNoJsonb(v).trim().toLowerCase();

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

/**
 * Item da lista da regra e valor da identidade usam a MESMA conversão, porque no
 * SQL os dois passam pelo mesmo `#>> '{}'` — o item por
 * `array_agg(x #>> '{}')`, o valor por `identidade #>> array[dim]`.
 *
 * Eram duas funções aqui, e a do item usava `String(x)`: uma regra com
 * `[["PG"]]` dentro (lista de lista) comparava `"PG"` de um lado e `'["PG"]'` do
 * outro. Uma conversão só remove a chance de consertar uma e esquecer a outra.
 */
const comoTexto = norm;

export function alcanca(regra: Regra, ident: Identidade): boolean {
  /**
   * A REGRA INTEIRA malformada, antes de olhar chave nenhuma.
   *
   * Os dois lados divergiam aqui, e o corpus não cobria:
   *
   *   regra = null        SQL true    ·  TypeScript DERRUBAVA
   *   regra = 7           SQL erro    ·  TypeScript true — ABRIA
   *   regra = ["PG"]      SQL erro    ·  TypeScript false
   *
   * Decisão do dono: `null`/`undefined` é "sem regra" e não restringe (é o
   * `coalesce(regra,'{}')` do SQL); qualquer outra coisa que não seja objeto —
   * número, texto, array — é regra malformada e FECHA nos dois lados.
   *
   * `Object.entries(7)` devolve `[]`, e era por isso que o pior caso abria: a
   * regra malformada parecia regra vazia.
   */
  if (regra === null || regra === undefined) return true; // sem regra
  if (typeof regra !== "object" || Array.isArray(regra)) return false; // malformada: fecha

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
  for (const [chave, bruto] of entradasDaRegra(regra)) {
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
