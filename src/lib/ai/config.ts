import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Configuração de IA por env var (spec: "provedor configurável por env var").
 * Chat: Anthropic + claude-opus-4-8 (AI_API_KEY).
 * Embeddings: OpenAI text-embedding-3-small (EMBEDDING_API_KEY) — a Anthropic
 * não tem API de embeddings própria.
 */
export const AI_PROVIDER = process.env.AI_PROVIDER || "anthropic";
export const CHAT_MODEL = process.env.CHAT_MODEL || "claude-opus-4-8";
export const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openai";
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";
/** Dimensão do vetor — deve casar com a coluna chunks.embedding. */
export const EMBEDDING_DIM = 1536;

export function hasAiKey(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.length > 0);
}

export function hasEmbeddingKey(): boolean {
  return Boolean(
    process.env.EMBEDDING_API_KEY && process.env.EMBEDDING_API_KEY.length > 0,
  );
}

/** Modelo de chat (generateObject/generateText/streamText). */
export function chatModel() {
  if (!hasAiKey()) {
    throw new Error(
      "AI_API_KEY não configurada — preencha no .env.local para usar as etapas de IA.",
    );
  }
  const anthropic = createAnthropic({ apiKey: process.env.AI_API_KEY });
  return anthropic(CHAT_MODEL);
}

/** Modelo de embeddings (para embed/embedMany). */
export function embeddingModel() {
  if (!hasEmbeddingKey()) {
    throw new Error(
      "EMBEDDING_API_KEY não configurada — preencha no .env.local para gerar embeddings.",
    );
  }
  const openai = createOpenAI({ apiKey: process.env.EMBEDDING_API_KEY });
  return openai.textEmbeddingModel(EMBEDDING_MODEL);
}
