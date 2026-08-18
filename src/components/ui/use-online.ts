"use client";

import { useSyncExternalStore } from "react";

/**
 * ESTÁ CONECTADO?
 *
 * O produto não tinha nenhuma leitura disso — zero ocorrências de
 * `navigator.onLine` em toda a base. A consequência aparecia no lugar mais
 * visível: no assistente do portal, uma queda de conexão fazia o `fetch`
 * lançar e a pessoa lia
 *
 *     Erro: Failed to fetch
 *
 * em inglês, técnico, sem dizer o que houve nem o que fazer. É o exemplo de
 * manual de mensagem de erro ruim: não explica, não orienta e ainda expõe o
 * nome interno da falha.
 *
 * ── O que `navigator.onLine` promete, e o que não promete ───────────────────
 * Ele responde "existe uma interface de rede ativa", não "a internet
 * funciona". Wi-Fi de hotel com portal cativo diz `true` e não passa nada.
 * Por isso ele NÃO é usado para bloquear ação — é usado para EXPLICAR uma
 * falha que já aconteceu, que é onde ele acerta quase sempre: se o fetch
 * falhou E o navegador se diz offline, a causa é essa.
 *
 * `useSyncExternalStore` em vez de `useState` + efeito: o valor do servidor é
 * sempre `true` (não há navegador para perguntar), então a marcação que chega
 * do SSR nunca discorda da primeira renderização do cliente.
 */
function inscrever(aoMudar: () => void): () => void {
  window.addEventListener("online", aoMudar);
  window.addEventListener("offline", aoMudar);
  return () => {
    window.removeEventListener("online", aoMudar);
    window.removeEventListener("offline", aoMudar);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    inscrever,
    () => navigator.onLine,
    // No servidor, assume conectado: renderizar "sem conexão" no HTML seria
    // pior que o silêncio — a página chegou, logo havia conexão.
    () => true,
  );
}

/**
 * A falha foi de REDE?
 *
 * `fetch` rejeita com `TypeError` para qualquer problema de transporte — DNS,
 * conexão recusada, CORS, cabo arrancado. A mensagem varia por navegador
 * ("Failed to fetch", "NetworkError when attempting to fetch resource",
 * "Load failed"), então comparar texto é frágil; o tipo é estável.
 */
export function ehFalhaDeRede(e: unknown): boolean {
  return e instanceof TypeError;
}
