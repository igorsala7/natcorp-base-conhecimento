import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";

/**
 * MODELO DE RESERVA — o provedor principal falhou, a MESMA chamada é refeita
 * em outro (migration 20261014150000_modelo_reserva.sql).
 *
 * Existe por causa da Maritaca: crédito pré-pago (403 `insufficient_funds`
 * durante horas na madrugada de 14/10/2026) e nível inicial de 10 mil tokens
 * de saída por minuto. Antes disto, provedor fora do ar = turno sem resposta.
 *
 * Puro e sem IO: o fecho recebe os dois modelos já montados (cada um com o
 * próprio registro de consumo), então a fatura sai no provedor que respondeu.
 */

/**
 * A falha justifica tentar a reserva?
 *
 * SIM — o provedor não pode atender agora: chave/crédito (401, 402, 403),
 * modelo descontinuado (404), limite (429), indisponível (5xx), rede, timeout
 * do provedor e disjuntor aberto.
 *
 * NÃO — e é a parte que importa:
 *  · o usuário clicou em Parar, ou o nosso prazo acabou (sinal abortado):
 *    refazer seria responder a quem desistiu, ou estourar o prazo de novo;
 *  · erro de REQUISIÇÃO (400, 422): o defeito é nosso, não do provedor. A
 *    reserva provavelmente falharia igual, e se passasse esconderia o defeito.
 */
export function deveUsarReserva(err: unknown, sinal?: AbortSignal): boolean {
  if (sinal?.aborted) return false;
  const e = err as { name?: unknown; statusCode?: unknown; status?: unknown; message?: unknown } | null;
  const nome = typeof e?.name === "string" ? e.name : "";
  if (nome === "AbortError") return false;
  if (nome === "CircuitOpenError") return true;
  const code = typeof e?.statusCode === "number" ? e.statusCode : typeof e?.status === "number" ? e.status : null;
  if (code !== null) {
    if ([401, 402, 403, 404, 408, 429].includes(code) || code >= 500) return true;
    return false; // 400, 409, 413, 422…: requisição nossa
  }
  const msg = `${nome} ${typeof e?.message === "string" ? e.message : ""}`.toLowerCase();
  return /timeout|timed out|econnreset|econnrefused|enotfound|fetch failed|network|socket hang|rate.?limit|overloaded|too many requests|service unavailable|insufficient|credit|cr[ée]dito|quota/.test(
    msg,
  );
}

/**
 * Tira do texto do erro qualquer pedaço de chave.
 *
 * A Maritaca devolve "Incorrect API key provided: chave*****teste" — o começo e
 * o fim da chave, mascarados no meio. Medido em 14/10 ao provar a reserva: o
 * aviso ia para o log do servidor com esse trecho. Chave não vai para log nem
 * em parte (regra do projeto).
 */
export function semChave(msg: string): string {
  return msg
    .replace(/(api[ _-]?key[^:]{0,20}:\s*)\S+/gi, "$1[oculta]")
    .replace(/\b(sk|pk|key|AIza)[-_A-Za-z0-9*]{12,}\b/g, "[oculta]");
}

/** Quem trocou e por quê — vai para o log do servidor (o consumo já mostra o provedor). */
export type AvisoReserva = { principal: string; reserva: string; motivo: string };

/**
 * Envolve o principal: falhou ao gerar ou ao ABRIR o stream com erro de
 * provedor, refaz com os mesmos parâmetros na reserva.
 *
 * Erro no MEIO do stream não é refeito: parte da resposta já saiu para o
 * usuário, e emendar a de outro modelo produziria um texto com duas metades.
 * Falha de crédito, chave e limite acontece na abertura, que é o caso coberto.
 */
export function comReserva(
  principal: LanguageModelV3,
  reserva: LanguageModelV3,
  rotulos: { principal: string; reserva: string },
  avisar: (a: AvisoReserva) => void = (a) =>
    console.warn(`[ia] reserva: ${a.principal} falhou (${a.motivo}); refazendo em ${a.reserva}`),
): LanguageModelV3 {
  const motivo = (e: unknown) => {
    const x = e as { statusCode?: unknown; message?: unknown } | null;
    return `${typeof x?.statusCode === "number" ? x.statusCode + " " : ""}${semChave(String(x?.message ?? e)).slice(0, 160)}`;
  };
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate();
      } catch (e) {
        if (!deveUsarReserva(e, params.abortSignal)) throw e;
        avisar({ ...rotulos, motivo: motivo(e) });
        return reserva.doGenerate(params);
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream();
      } catch (e) {
        if (!deveUsarReserva(e, params.abortSignal)) throw e;
        avisar({ ...rotulos, motivo: motivo(e) });
        return reserva.doStream(params);
      }
    },
  };
  return wrapLanguageModel({ model: principal, middleware });
}
