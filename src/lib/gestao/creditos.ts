/**
 * OS DOIS BALDES DE CRÉDITO — regra pura, sem banco.
 *
 * Ditada pelo dono em 23/09/2026:
 *
 *   · 100 créditos = 1.000.000 de tokens (1 crédito = 10 mil);
 *   · o CONTRATADO renova a cada ciclo e NÃO acumula — o que sobra morre
 *     na virada;
 *   · o ADICIONAL comprado acumula e NUNCA vence;
 *   · o consumo sai SEMPRE do contratado primeiro.
 *
 * A quinta regra mudou duas vezes em dois dias, então vale o histórico:
 * em 23/09 saldo zerado deixava o chat só com a documentação e o consumo
 * não descontava nada; em 24/09 as ferramentas voltaram (modelo mais
 * barato) e o consumo passou a SAIR DA MENSALIDADE SEGUINTE, encadeando
 * por quantos meses precisar. Quem ler só o nome `consumoSemCobertura`
 * vai supor a regra velha.
 *
 * O exemplo que ele deu, que virou o teste principal:
 *
 *   contratado 1000/mês
 *   mês 1: consome 1000, compra 400          → fecha com extra 400
 *   mês 2: abre com 1400, consome 800        → contratado 200, extra 400
 *   virada: os 200 morrem, os 400 ficam      → mês 3 abre com 1400
 *
 * ── Por que aqui e não no banco ─────────────────────────────────────
 * O saldo do extra é um fold com teto em cada passo: o de hoje depende do
 * de ontem. Em SQL vira `with recursive` que ninguém relê e que só se
 * testa contra produção. Mesma escolha já feita em `pricing.ts` — o banco
 * entrega fato por ciclo (`gestao_ciclos`), a regra mora aqui, com teste.
 *
 * ── O teto do gasto, que é a parte fácil de errar ───────────────────
 * `gastoExtra = min(excedente, disponível)`. Sem esse `min`, o consumo em
 * modo documentação (que acontece JUSTAMENTE depois do saldo zerar)
 * viraria dívida silenciosa e comeria a próxima compra: o cliente pagaria
 * por 400 créditos e receberia menos, sem nada na tela explicando.
 */

/** Um ciclo, como `gestao_ciclos` devolve. */
export type CicloFato = {
  ciclo_inicio: string;
  ciclo_fim: string;
  /** Contratado VIGENTE naquele ciclo (o plano é versionado). */
  contratado: number;
  /** Consumo do ciclo, já em créditos. */
  consumo: number;
  /** Compras de adicional feitas DENTRO deste ciclo. */
  compras: number;
};

export type SaldoCreditos = {
  cicloInicio: string;
  cicloFim: string;
  /** O que o plano concede neste ciclo, antes de qualquer desconto. */
  contratadoPlano: number;
  /**
   * Quanto da mensalidade deste ciclo foi embora pagando adiantamento tomado
   * em ciclos anteriores. O cliente abre o mês devendo isto.
   */
  contratadoAbatido: number;
  /** `contratadoPlano − contratadoAbatido`: o que sobrou para usar. Não acumula. */
  contratadoTotal: number;
  contratadoConsumido: number;
  contratadoSaldo: number;
  /** Acumulado de ciclos anteriores + comprado neste. */
  extraDisponivel: number;
  extraConsumido: number;
  extraSaldo: number;
  /** `contratado + extra` no início do ciclo, e o que sobrou. */
  disponivel: number;
  consumido: number;
  saldo: number;
  /** 0 a 100. É o número que decide o aviso de 10%. */
  pctRestante: number;
  /**
   * MESES FUTUROS JÁ COMIDOS, em créditos, no fim deste ciclo.
   *
   * Zerar contratado e adicional não para mais o consumo nem vira prejuízo da
   * Natcorp: passa a sair da mensalidade seguinte, que abre reduzida. Se nem
   * ela bastar, sobra para a próxima, sem limite de profundidade (decisão do
   * dono, 24/09). É por isso que este número pode passar de uma mensalidade.
   */
  adiantado: number;
  /** Parcela do `adiantado` que nasceu NESTE ciclo. */
  adiantadoNoCiclo: number;
  /**
   * Consumo que não coube em balde nenhum E não pôde virar adiantamento, por
   * não haver mensalidade futura de onde tirar (plano zerado ou inexistente).
   * Aí sim é CUSTO DA NATCORP.
   *
   * Com plano ativo isto é sempre zero, e é de propósito: o adiantamento
   * existe justamente para que a sangria de quem contratou não fique sem dono.
   */
  consumoSemCobertura: number;
};

/**
 * O LOTE EM QUE O ADICIONAL É VENDIDO — e em que se fala dele.
 *
 * O dono descreve o preço assim: "US$3,50 cada 100 créditos". Mostrar
 * US$0,035 por crédito seria a mesma coisa e pior de duas formas: ninguém
 * negocia nessa unidade, e `fmtUsd` arredonda para **US$0,04**, que é
 * visivelmente errado. O lote é a unidade honesta.
 */
export const CREDITOS_POR_LOTE = 100;

/**
 * Preço do crédito ADICIONAL: US$3,50 por 100 créditos.
 *
 * Mora aqui, e não em `actions.ts`, porque a TELA e a AÇÃO precisam do mesmo
 * número — e foi exatamente a falta disso que produziu o defeito de 23/09: o
 * formulário cotava pelo `usd_por_credito` do PLANO (US$0,05, o contratado) e
 * a ação gravava US$0,035. Cem créditos apareciam como US$5,00 e eram
 * cobrados a US$3,50. A cotação mentia — a favor do cliente, mas mentia, e uma
 * tela de compra que erra o total não é confiável em direção nenhuma.
 *
 * Um arquivo `"use server"` não exporta constante (lá todo export precisa ser
 * função assíncrona), então este é o lugar que os dois lados alcançam.
 *
 * NÃO sai de `ai_cliente_plano.usd_por_credito`: aquele é o preço do
 * CONTRATADO, e o adicional é compra avulsa, 30% mais barata por ser fora do
 * compromisso mensal. O valor vai gravado em cada linha de compra, então mudar
 * esta constante não reescreve o que já foi vendido.
 */
export const USD_POR_CREDITO_EXTRA = 0.035;

/** Quanto custa comprar `creditos` adicionais, em dólar. */
export function precoDoAdicional(creditos: number): number {
  return Math.max(0, creditos) * USD_POR_CREDITO_EXTRA;
}

/** Abaixo disto a tela e o painel avisam que está acabando. */
export const LIMIAR_AVISO_PCT = 10;

const arred = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Percorre os ciclos em ordem e devolve o saldo no último.
 *
 * `ciclos` precisa vir ordenado do mais antigo para o mais novo, que é
 * como `gestao_ciclos` entrega. Lista vazia devolve `null` — quem chama
 * decide o que isso significa (base sem plano não é base sem serviço).
 */
export function calcularSaldo(ciclos: CicloFato[]): SaldoCreditos | null {
  if (!ciclos.length) return null;

  let extraAcumulado = 0;
  /** Meses futuros já comidos, carregado de um ciclo para o outro. */
  let adiantado = 0;
  let ultimo: SaldoCreditos | null = null;

  for (const c of ciclos) {
    const contratadoPlano = Math.max(0, c.contratado);
    const consumo = Math.max(0, c.consumo);

    /**
     * A DÍVIDA COBRA ANTES DO CLIENTE GASTAR.
     *
     * Quem adiantou no mês passado abre este devendo: a mensalidade paga o
     * adiantamento primeiro e só o resto fica disponível. Se a dívida for
     * maior que a mensalidade inteira, o que não coube segue para o mês
     * seguinte, e é assim que o encadeamento sem limite acontece sem nenhum
     * caso especial no código.
     */
    const contratadoAbatido = Math.min(adiantado, contratadoPlano);
    const contratado = contratadoPlano - contratadoAbatido;
    const dividaQueSobrou = adiantado - contratadoAbatido;

    // A compra do ciclo entra ANTES de calcular o gasto: foi o que o dono
    // descreveu ("consumiu os 1000 e comprou mais 400 → saldo 400"). É também
    // o que faz uma compra feita no MESMO mês reduzir o adiantamento daquele
    // mês, sem precisar de regra de quitação: o ciclo é recalculado do fato.
    const extraDisponivel = extraAcumulado + Math.max(0, c.compras);

    const contratadoConsumido = Math.min(consumo, contratado);
    const excedente = Math.max(consumo - contratado, 0);
    const extraConsumido = Math.min(excedente, extraDisponivel);
    const descoberto = excedente - extraConsumido;

    /**
     * SÓ SE ADIANTA CONTRA UM PLANO QUE DÁ CRÉDITO.
     *
     * Base sem contrato tem `contratado = 0` em todo ciclo: não existe
     * mensalidade futura de onde tirar, e tratar o consumo dela como
     * adiantamento criaria uma dívida que nenhum mês futuro abate e que
     * cresceria para sempre contra um cliente que nunca contratou nada. Nesse
     * caso o consumo continua sem cobertura, que é a mesma postura de
     * `modoDoSaldo`: sem contrato não é sem serviço.
     */
    const temMensalidade = contratadoPlano > 0;
    const novoAdiantamento = temMensalidade ? descoberto : 0;
    const semCobertura = temMensalidade ? 0 : descoberto;

    const extraSaldo = extraDisponivel - extraConsumido;
    const disponivel = contratado + extraDisponivel;
    const saldo = Math.max(disponivel - consumo, 0);

    ultimo = {
      cicloInicio: c.ciclo_inicio,
      cicloFim: c.ciclo_fim,
      contratadoPlano: arred(contratadoPlano),
      contratadoAbatido: arred(contratadoAbatido),
      contratadoTotal: arred(contratado),
      contratadoConsumido: arred(contratadoConsumido),
      contratadoSaldo: arred(contratado - contratadoConsumido),
      extraDisponivel: arred(extraDisponivel),
      extraConsumido: arred(extraConsumido),
      extraSaldo: arred(extraSaldo),
      disponivel: arred(disponivel),
      consumido: arred(consumo),
      saldo: arred(saldo),
      pctRestante: disponivel <= 0 ? 0 : arred((saldo / disponivel) * 100),
      adiantado: arred(dividaQueSobrou + novoAdiantamento),
      adiantadoNoCiclo: arred(novoAdiantamento),
      consumoSemCobertura: arred(semCobertura),
    };

    // A VIRADA: o contratado que sobrou morre aqui. O extra atravessa, e a
    // dívida também. Sobra não acumula, excesso acumula: a assimetria é
    // deliberada, e é ela que protege a Natcorp de quem consome acima do plano.
    extraAcumulado = extraSaldo;
    adiantado = dividaQueSobrou + novoAdiantamento;
  }

  return ultimo;
}

/**
 * O que o chat faz com este saldo.
 *
 * `economico` substituiu `somente_documentacao` em 24/09. O nome velho passou
 * a mentir: crédito zerado não corta mais ferramenta nenhuma, só troca o
 * modelo por um mais barato (configurado em Sistema → Qual IA faz o quê).
 * Manter o nome antigo faria o próximo leitor procurar um corte que não
 * existe mais.
 */
export type ModoCredito = "normal" | "economico";

export function modoDoSaldo(saldo: SaldoCreditos | null, temPlano = true): ModoCredito {
  /**
   * SEM PLANO NÃO É SEM SERVIÇO — e este parâmetro existe porque eu errei aqui.
   *
   * A primeira versão olhava só o saldo. Base sem contrato cadastrado tem
   * `contratado = 0`; qualquer consumo a deixa com saldo zero, e ela caía em
   * modo documentação. Pego contra o banco real: a NATCORP, que é o cliente
   * principal e não tem plano, perderia TODAS as ferramentas — o produto
   * inteiro — por uma regra que existe para cobrar quem contratou.
   *
   * É a mesma postura que o portão já tinha em SQL ("transformar 'ainda não
   * passou pelo comercial' em 'cliente sem serviço' derrubaria todo mundo"),
   * e ela precisava atravessar junto com a regra.
   */
  if (!temPlano) return "normal";
  if (!saldo) return "normal";
  return saldo.saldo > 0 ? "normal" : "economico";
}

/** Está acabando? É o gatilho do aviso no painel de quem está usando. */
export function precisaAvisar(saldo: SaldoCreditos | null, temPlano = true): boolean {
  // Sem contrato não há cota para acabar — avisar seria inventar um limite.
  if (!temPlano) return false;
  if (!saldo || saldo.disponivel <= 0) return false;
  return saldo.pctRestante > 0 && saldo.pctRestante <= LIMIAR_AVISO_PCT;
}
