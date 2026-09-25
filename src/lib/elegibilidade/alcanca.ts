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
     * regra malformada de existir é `normalizarRegra` no caminho de gravação.
     */
    if (bruto === null || bruto === undefined) continue; // não configurada
    // Chave que não é uma das doze: regra malformada, fecha. Antes do teste de
    // array, na mesma ordem do SQL (que exclui `null` antes de tudo).
    if (!CONHECIDAS.has(chave)) return false;
    if (!Array.isArray(bruto)) return false; // malformada: fecha

    // `String(x)` espelha o `x #>> '{}'` do SQL, que converte qualquer escalar
    // jsonb para texto. Sem isso, regra com número casaria de um lado só.
    const lista = bruto
      .map((x) => norm(x === null || x === undefined ? "" : String(x)))
      .filter((x) => x !== "");
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
 */
export function normalizarRegra(regra: Regra): Regra {
  const out: Regra = {};
  for (const d of DIMENSOES) {
    const itens = [...new Set((regra[d] ?? []).map(norm).filter((x) => x !== ""))];
    if (itens.length) out[d] = itens;
  }
  return out;
}

/**
 * A regra tem dimensão que RESTRINGE PARA NINGUÉM?
 *
 * Acontece quando alguém salva uma lista cujos itens são todos em branco. Pelo
 * predicado isso vira "não restringe", que é o OPOSTO da intenção de quem
 * digitou: a pessoa quis restringir e liberou. O caminho de gravação recusa,
 * em vez de gravar algo que age ao contrário do que foi pedido.
 *
 * Devolve as dimensões problemáticas, e não um booleano, porque a mensagem de
 * erro precisa dizer QUAL campo está em branco.
 */
export function dimensoesComRestricaoVazia(regra: Regra): Dimensao[] {
  return DIMENSOES.filter((d) => {
    const bruto = regra[d];
    if (!bruto || bruto.length === 0) return false; // ausente = sem restrição, legítimo
    return bruto.every((x) => norm(x) === ""); // tem itens, e todos em branco
  });
}
