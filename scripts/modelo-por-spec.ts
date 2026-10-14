/**
 * `provedor:modelo` → modelo do AI SDK, para os scripts de avaliação.
 *
 * Espelha `instanciar` de `src/lib/ai/config.ts` (que não dá para importar
 * daqui: arrasta `server-only` e o cliente do Supabase). Ficava copiado em três
 * scripts, e um provedor novo (Maritaca) caía no `createOpenAI` padrão — o
 * endereço da OpenAI — sem erro claro. Um lugar só, então.
 */
import type { LanguageModel } from "ai";
import { PROVIDER_BASE_URL } from "../src/lib/ai/catalog";

export async function modeloPorSpec(kind: string, nome: string, apiKey: string): Promise<LanguageModel> {
  if (kind === "google") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    return createGoogleGenerativeAI({ apiKey })(nome);
  }
  if (kind === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    return createAnthropic({ apiKey })(nome);
  }
  const { createOpenAI } = await import("@ai-sdk/openai");
  // Maritaca: protocolo OpenAI, mas só pela Chat Completions e no endereço dela.
  if (kind === "maritaca") {
    return createOpenAI({ apiKey, baseURL: PROVIDER_BASE_URL.maritaca, name: "maritaca" }).chat(nome);
  }
  return createOpenAI({ apiKey })(nome);
}
