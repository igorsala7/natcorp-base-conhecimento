import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * Configuração de IA por env var (spec: "provedor configurável por env var").
 * Padrão: Anthropic + claude-opus-4-8. A AI_API_KEY é obrigatória para as
 * etapas de LLM (inferência de estrutura e "melhorar layout").
 */
export const AI_PROVIDER = process.env.AI_PROVIDER || "anthropic";
export const CHAT_MODEL = process.env.CHAT_MODEL || "claude-opus-4-8";
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

export function hasAiKey(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.length > 0);
}

/** Modelo de chat configurado (para generateObject/generateText). */
export function chatModel() {
  if (!hasAiKey()) {
    throw new Error(
      "AI_API_KEY não configurada — preencha no .env.local para usar as etapas de IA.",
    );
  }
  // Hoje só Anthropic está fiado; outros providers entram aqui.
  const anthropic = createAnthropic({ apiKey: process.env.AI_API_KEY });
  return anthropic(CHAT_MODEL);
}
