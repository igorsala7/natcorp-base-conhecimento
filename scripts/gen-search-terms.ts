/**
 * Gera `ai_tools.search_terms` (SINÔNIMOS + EXEMPLOS de pergunta) por IA, a partir do
 * nome/descrição/campos de cada tool. Enriquece o embedding do catálogo (matching
 * semântico entende o vocabulário do usuário). NÃO inventa funções — só reformula.
 *
 * Depois de rodar, RE-EMBEDE para valer:  npm run embed:tools -- --all
 *
 *   npm run gen:search-terms           # só as tools com search_terms vazio
 *   npm run gen:search-terms -- --all  # regenera todas as ativas
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY e o provedor de chat
 * configurado (Sistema → IA). Roda com a condição `react-server` (guard server-only).
 */
import { WebSocket } from "undici";
(globalThis as { WebSocket?: unknown }).WebSocket ??= WebSocket;
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { languageModel } from "../src/lib/ai/config";
import type { Database } from "../src/lib/database.types";

type Param = { nome?: string; descricao?: string };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const db = createClient<Database>(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const todas = process.argv.includes("--all");

  const { data: tools, error } = await db
    .from("ai_tools")
    .select("id, name, description, params, search_terms")
    .eq("active", true);
  if (error) {
    console.error("Falha ao ler ai_tools:", error.message);
    process.exit(1);
  }
  const alvo = (tools ?? []).filter((t) => todas || !String(t.search_terms ?? "").trim());
  console.log(`Tools ativas: ${tools?.length ?? 0} | a gerar: ${alvo.length}${todas ? " (--all)" : ""}`);
  if (!alvo.length) {
    console.log("Nada a fazer.");
    return;
  }

  const model = await languageModel("query_rewrite"); // modelo RÁPIDO (fallback → Chat)
  let ok = 0;
  for (const t of alvo) {
    const campos = Array.isArray(t.params)
      ? (t.params as Param[])
          .map((p) => [p?.nome, p?.descricao].filter(Boolean).join(": "))
          .filter(Boolean)
          .slice(0, 20)
          .join("; ")
      : "";
    const prompt = `Ferramenta de um sistema de RH/DP.
Nome: ${t.name}
Descrição: ${t.description ?? ""}
Campos: ${campos || "—"}

Gere SINÔNIMOS e de 4 a 6 EXEMPLOS de perguntas que um usuário faria e que ESTA ferramenta responde, no vocabulário do dia a dia (ex.: "holerite", "salário", "férias", "ponto", "admissão"). NÃO invente dados nem funções além das descritas acima. Responda APENAS os termos e perguntas, UM POR LINHA, sem numeração e sem comentários.`;
    try {
      const { text } = await generateText({ model, prompt });
      const val = String(text ?? "").trim().slice(0, 1500);
      if (val) {
        const up = await db.from("ai_tools").update({ search_terms: val }).eq("id", t.id);
        if (up.error) console.error(`\n  ${t.name}: erro ao gravar — ${up.error.message}`);
        else ok++;
      }
    } catch (e) {
      console.error(`\n  ${t.name}: erro na IA — ${(e as Error).message}`);
    }
    process.stdout.write(`\r  ${ok}/${alvo.length}`);
  }
  console.log(`\n✓ ${ok} tool(s) com search_terms gerado. Agora rode:  npm run embed:tools -- --all`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
