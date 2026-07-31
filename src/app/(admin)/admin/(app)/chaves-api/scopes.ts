/**
 * Escopos oferecidos às chaves de API (permissões RBAC + APIs de dados).
 * Fica FORA do arquivo `"use server"` (actions.ts) porque um módulo de server
 * actions só pode exportar funções async — exportar esta constante de lá faz ela
 * virar uma referência de server-action no cliente (e `API_SCOPES.map` quebra).
 */
export const API_SCOPES = [
  "content.view",
  "content.create",
  "content.edit",
  "content.publish",
  "data.analyze",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
