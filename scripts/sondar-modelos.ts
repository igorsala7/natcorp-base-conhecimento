/**
 * SONDAGEM DE DISPONIBILIDADE — quais modelos de TEXTO as chaves alcançam.
 *
 * Rodar uma bateria de 37 casos contra 25 modelos e descobrir no meio que sete
 * não existem para esta conta desperdiça dezenas de minutos e chamadas pagas.
 * Aqui cada candidato recebe UM prompt trivial; o que responder entra na
 * medição, o que falhar sai com o motivo.
 *
 * Só geração de TEXTO: embeddings e transcrição (whisper) ficam de fora — não
 * escrevem, e medi-los com os mesmos casos não significaria nada.
 *
 *   npm run sondar:modelos
 */
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import type { Database } from "../src/lib/database.types";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

/** Catálogo de texto dos três provedores, conferido nas páginas de preço em 19/08/2026. */
export const CANDIDATOS: string[] = [
  // Anthropic — a linha atual, sem os aposentados (opus-4-1, opus-4, sonnet-4, haiku-3-5)
  "anthropic:claude-fable-5",
  "anthropic:claude-mythos-5",
  "anthropic:claude-opus-5",
  "anthropic:claude-opus-4-8",
  "anthropic:claude-opus-4-7",
  "anthropic:claude-opus-4-6",
  "anthropic:claude-opus-4-5",
  "anthropic:claude-sonnet-5",
  "anthropic:claude-sonnet-4-6",
  "anthropic:claude-sonnet-4-5",
  "anthropic:claude-haiku-4-5",
  // OpenAI
  "openai:gpt-5.6-sol",
  "openai:gpt-5.6-terra",
  "openai:gpt-5.6-luna",
  "openai:gpt-5.5",
  "openai:gpt-5.2",
  "openai:gpt-4o",
  "openai:gpt-4o-mini",
  "openai:gpt-3.5-turbo",
  // Google
  "google:gemini-3.6-flash",
  "google:gemini-3.5-flash",
  "google:gemini-3.5-flash-lite",
  "google:gemini-3.1-flash-lite",
  "google:gemini-2.5-flash",
  "google:gemini-2.5-pro",
];

export async function montarProvedores(db: ReturnType<typeof createClient<Database>>) {
  const { tryDecryptSecret } = await import("../src/lib/crypto/secrets");
  const { data } = await db.from("ai_providers").select("kind, ai_provider_keys(api_key_enc)").eq("active", true);
  const porKind = new Map<string, string>();
  for (const p of data ?? []) {
    const rel = (p as unknown as { ai_provider_keys?: { api_key_enc?: string } | { api_key_enc?: string }[] }).ai_provider_keys;
    const enc = Array.isArray(rel) ? rel[0]?.api_key_enc : rel?.api_key_enc;
    const k = tryDecryptSecret(enc);
    if (k) porKind.set(String(p.kind), k);
  }
  return async (spec: string) => {
    const [kind, ...r] = spec.split(":");
    const nome = r.join(":");
    const apiKey = porKind.get(kind!);
    if (!apiKey) throw new Error(`sem chave para o provedor "${kind}"`);
    if (kind === "google") {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey })(nome);
    }
    if (kind === "anthropic") {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey })(nome);
    }
    const { createOpenAI } = await import("@ai-sdk/openai");
    return createOpenAI({ apiKey })(nome);
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) { console.error("Faltam credenciais do Supabase."); process.exit(1); }
  const db = createClient<Database>(url, chave, { auth: { persistSession: false } });
  const resolver = await montarProvedores(db);

  console.log(`\nSondando ${CANDIDATOS.length} modelos de texto…\n`);
  const vivos: string[] = [], mortos: { spec: string; erro: string }[] = [];
  for (const spec of CANDIDATOS) {
    try {
      const model = await resolver(spec);
      const r = await generateText({ model, prompt: "Responda apenas: ok", maxOutputTokens: 2000 });
      const txt = (r.text ?? "").trim();
      vivos.push(spec);
      console.log(`  OK   ${spec.padEnd(34)} "${txt.slice(0, 24)}"`);
    } catch (e) {
      const erro = (e as Error).message.replace(/\s+/g, " ").slice(0, 96);
      mortos.push({ spec, erro });
      console.log(`  --   ${spec.padEnd(34)} ${erro}`);
    }
  }
  console.log(`\n${vivos.length} disponíveis · ${mortos.length} fora`);
  console.log(`\nPara medir:\n  --modelos ${vivos.join(",")}\n`);
}

if (process.argv[1]?.includes("sondar-modelos")) main().catch((e) => { console.error(e); process.exit(1); });
