/**
 * OS DOIS BALDES DE CRÉDITO — regra pura, sem banco.
 *
 * Ditada pelo dono em 23/09/2026:
 *
 *   · 100 créditos = 1.000.000 de tokens (1 crédito = 10 mil);
 *   · o CONTRATADO renova a cada ciclo e NÃO acumula — o que sobra morre
 *     na virada;
 *   · o ADICIONAL comprado acumula e NUNCA vence;
 *   · o consumo sai SEMPRE do contratado primeiro;
 *   · com saldo zerado o chat continua, mas só com a documentação — e
 *     esse consumo NÃO desconta crédito.
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
  /** Renova a cada ciclo; não acumula. */
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
   * Consumo que não coube em balde nenhum — o que rodou em modo
   * documentação depois de zerar. Não é cobrado; existe para a tela poder
   * dizer quanto foi, em vez de o número sumir.
   */
  consumoSemCobertura: number;
};

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
  let ultimo: SaldoCreditos | null = null;

  for (const c of ciclos) {
    const contratado = Math.max(0, c.contratado);
    const consumo = Math.max(0, c.consumo);
    // A compra do ciclo entra ANTES de calcular o gasto: foi o que o dono
    // descreveu ("consumiu os 1000 e comprou mais 400 → saldo 400").
    const extraDisponivel = extraAcumulado + Math.max(0, c.compras);

    const contratadoConsumido = Math.min(consumo, contratado);
    const excedente = Math.max(consumo - contratado, 0);
    const extraConsumido = Math.min(excedente, extraDisponivel);
    // O que sobra do excedente rodou em modo documentação. Não sai de balde.
    const semCobertura = excedente - extraConsumido;

    const extraSaldo = extraDisponivel - extraConsumido;
    const disponivel = contratado + extraDisponivel;
    const saldo = Math.max(disponivel - consumo, 0);

    ultimo = {
      cicloInicio: c.ciclo_inicio,
      cicloFim: c.ciclo_fim,
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
      consumoSemCobertura: arred(semCobertura),
    };

    // A VIRADA: o contratado que sobrou morre aqui. Só o extra atravessa.
    extraAcumulado = extraSaldo;
  }

  return ultimo;
}

/** O que o chat pode fazer com este saldo. */
export type ModoCredito = "normal" | "somente_documentacao";

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
  return saldo.saldo > 0 ? "normal" : "somente_documentacao";
}

/** Está acabando? É o gatilho do aviso no painel de quem está usando. */
export function precisaAvisar(saldo: SaldoCreditos | null, temPlano = true): boolean {
  // Sem contrato não há cota para acabar — avisar seria inventar um limite.
  if (!temPlano) return false;
  if (!saldo || saldo.disponivel <= 0) return false;
  return saldo.pctRestante > 0 && saldo.pctRestante <= LIMIAR_AVISO_PCT;
}
