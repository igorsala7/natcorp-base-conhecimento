/**
 * `provedor:modelo` → modelo do AI SDK, para os scripts de avaliação.
 *
 * Espelha `instanciar` de `src/lib/ai/config.ts` (que não dá para importar
 * daqui: arrasta `server-only` e o cliente do Supabase). Ficava copiado em três
 * scripts, e um provedor novo (Maritaca) caía no `createOpenAI` padrão — o
 * endereço da OpenAI — sem erro claro. Um lugar só, então.
 */
import type { LanguageModel } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROVIDER_BASE_URL, recusaTemperatura } from "../src/lib/ai/catalog";
import { tryDecryptSecret } from "../src/lib/crypto/secrets";

export async function modeloPorSpec(kind: string, nome: string, apiKey: string): Promise<LanguageModel> {
  if (kind === "google") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    return createGoogleGenerativeAI({ apiKey })(nome);
  }
  if (kind === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const modelo = createAnthropic({ apiKey })(nome);
    // Mesma regra da produção (catalog.ts). Sem ela, `eval:cenarios-modelo`
    // (que passa `temperature: 0`) mediu 125 erros e zero respostas.
    if (!recusaTemperatura("anthropic", nome)) return modelo;
    const { wrapLanguageModel } = await import("ai");
    return wrapLanguageModel({
      model: modelo,
      middleware: {
        specificationVersion: "v3",
        transformParams: async ({ params }) => ({ ...params, temperature: undefined }),
      },
    });
  }
  const { createOpenAI } = await import("@ai-sdk/openai");
  // Maritaca: protocolo OpenAI, mas só pela Chat Completions e no endereço dela.
  if (kind === "maritaca") {
    return createOpenAI({ apiKey, baseURL: PROVIDER_BASE_URL.maritaca, name: "maritaca" }).chat(nome);
  }
  return createOpenAI({ apiKey })(nome);
}

/**
 * Resolvedor `provedor:modelo` com as chaves DO SISTEMA (ai_provider_keys,
 * cifradas) — é assim que a produção chama, e chave de variável de ambiente
 * mediria uma configuração que não existe. Nome sem prefixo vale como Google,
 * para não quebrar quem já chamava só com o nome do Gemini.
 */
export async function montarResolver(db: SupabaseClient) {
  const { data } = await db.from("ai_providers").select("kind, ai_provider_keys(api_key_enc)").eq("active", true);
  const porKind = new Map<string, string>();
  for (const p of data ?? []) {
    const rel = (p as unknown as { ai_provider_keys?: { api_key_enc?: string } | { api_key_enc?: string }[] }).ai_provider_keys;
    const k = tryDecryptSecret(Array.isArray(rel) ? rel[0]?.api_key_enc : rel?.api_key_enc);
    if (k) porKind.set(String(p.kind), k);
  }
  return async (spec: string): Promise<LanguageModel> => {
    const [kind, ...r] = spec.includes(":") ? spec.split(":") : ["google", spec];
    const apiKey = porKind.get(kind!);
    if (!apiKey) throw new Error(`sem chave para "${kind}"`);
    return modeloPorSpec(kind!, r.join(":"), apiKey);
  };
}
