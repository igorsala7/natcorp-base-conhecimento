/**
 * Quando vale repetir uma chamada de ferramenta que não respondeu.
 *
 * Módulo PURO de propósito: a decisão precisa de teste, e o executor importa
 * `server-only`. Mesmo motivo de `chunk-split.ts`.
 *
 * O QUE A MEDIÇÃO DIZ (3.807 chamadas em `ai_tool_runs`, medido em 28/08):
 *
 *   aborts            17  (0,45%)
 *   acima de 14s      22  (0,58%)  ← 17 destes são os aborts
 *   p99             8,7s
 *   p99.9          15,0s            ← o teto, não a demanda
 *
 * Duas leituras importam:
 *
 *  1. Os 17 aborts se espalham por SEIS ferramentas diferentes
 *     (`informacoes_pessoais_funcionais` 9, `consultar_beneficios` 3,
 *     `linha_tempo` 2, e mais três com 1). Não existe "a ferramenta lenta" —
 *     existe lentidão ESPORÁDICA do ORDS. Intermitência é exatamente o defeito
 *     que um retry conserta, e subir o teto de uma ferramenta específica não
 *     consertaria.
 *
 *  2. Quase tudo que passa de 14s MORRE no teto. O timeout não está
 *     protegendo o turno; está cortando a chamada.
 *
 * O CUSTO DE ERRAR PARA CADA LADO NÃO É SIMÉTRICO:
 *
 *  · repetir uma LEITURA à toa custa alguns segundos;
 *  · repetir uma ESCRITA à toa marca férias duas vezes, envia dois e-mails,
 *    aprova a mesma requisição duas vezes. O contrato de férias já registra que
 *    a operação "nasce concluída" e que não há atomicidade do lado ORDS — não há
 *    a quem pedir para desfazer.
 *
 * Por isso o padrão aqui é RECUSAR, e só liberar o que é comprovadamente
 * seguro repetir.
 */

/** O que o executor sabe sobre a chamada que falhou. */
export type TentativaFalha = {
  /** Método HTTP efetivo da chamada. */
  metodo: string;
  /** Mensagem de erro que a chamada levantou. */
  erro: string;
  /** Quantas tentativas já foram feitas (1 = a original). */
  tentativas: number;
};

/** Teto de tentativas. Duas no total: a original e uma repetição. */
export const MAX_TENTATIVAS = 2;

/** O erro é de "não respondeu a tempo", e não de "respondeu que não"? */
export function ehFalhaDeEspera(erro: string): boolean {
  return /abort|timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up|fetch failed|network/i.test(erro);
}

/**
 * Métodos que podem ser repetidos sem risco de efeito duplicado.
 *
 * GET e HEAD são idempotentes por definição do HTTP. POST não é — e no ORDS da
 * Natcorp é justamente onde moram as ações (marcar férias, enviar, aprovar).
 */
const METODOS_SEGUROS = new Set(["GET", "HEAD"]);

/**
 * Vale repetir esta chamada?
 *
 * Três condições, todas obrigatórias: ainda há tentativa no orçamento, o erro é
 * de espera (não um "não" da API), e o método não pode ter efeito colateral.
 */
export function deveTentarDeNovo(f: TentativaFalha): boolean {
  if (f.tentativas >= MAX_TENTATIVAS) return false;
  if (!ehFalhaDeEspera(f.erro)) return false;
  return METODOS_SEGUROS.has(f.metodo.toUpperCase());
}

/**
 * A mensagem que o MODELO recebe quando a fonte não respondeu nem na repetição.
 *
 * Por que não devolver o erro técnico: em 27/08 `linha_tempo` abortou nas duas
 * facetas (Cargo e Salário) e o modelo recebeu "This operation was aborted".
 * Sem instrução, ele foi buscar em `informacoes_pessoais_funcionais` e
 * apresentou os dados ATUAIS do colaborador como se fossem o histórico — sem
 * avisar que o histórico não veio. O usuário só descobriu conferindo o banco.
 *
 * Uma fonte que não respondeu é uma LACUNA a declarar, nunca um convite a
 * substituir a fonte em silêncio.
 */
export function recadoDeFalhaDeEspera(nomeAmigavel: string): string {
  return (
    `A consulta de ${nomeAmigavel} não respondeu a tempo (tentei duas vezes). ` +
    `ISTO NÃO SIGNIFICA QUE NÃO EXISTEM DADOS — significa que a fonte não respondeu. ` +
    `DIGA ao usuário, com estas palavras, que não foi possível consultar ${nomeAmigavel} agora e que ele pode pedir de novo. ` +
    `NÃO substitua por outra fonte sem avisar: se usar dado de outra consulta, diga explicitamente de onde ele veio e que NÃO é ${nomeAmigavel}.`
  );
}
