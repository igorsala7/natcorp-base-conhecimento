/**
 * Gera `ai_tools.descricao_usuario` — o texto MOSTRADO ao usuário nos botões de
 * fonte do chat — resumindo a `description` técnica de cada ferramenta.
 *
 * Por que existe: `description` é escrita para o MODELO decidir qual ferramenta
 * usar. É longa, cita endpoint e às vezes outra ferramenta. Com 100+ tools
 * cadastradas, pedir que alguém reescreva todas à mão antes de a tela melhorar
 * transformaria a melhoria em trabalho. Aqui a IA resume; a revisão fica na tela
 * de edição, campo a campo, quando alguém quiser refinar.
 *
 * O resumo NÃO inventa: recebe só nome + descrição + campos, e é instruído a
 * reformular. Se a descrição técnica estiver errada, o resumo herda o erro — não
 * é um verificador de conteúdo.
 *
 *   npm run gen:descricao-usuario              # só as vazias (não sobrescreve)
 *   npm run gen:descricao-usuario -- --all     # regenera TODAS as ativas
 *   npm run gen:descricao-usuario -- --dry     # imprime sem gravar (revisão)
 *
 * NÃO precisa re-embedar depois: este campo fica fora do vetor do catálogo de
 * propósito — é um resumo do que `description` já diz, e somá-lo ao embedding só
 * diluiria o sinal de roteamento.
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
import { limparResumo, MAX_DESC_USUARIO as MAX } from "../src/lib/integrations/resumo-usuario";

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
  const dry = process.argv.includes("--dry");

  const { data: tools, error } = await db
    .from("ai_tools")
    .select("id, key, name, description, params, descricao_usuario")
    .eq("active", true)
    .order("name");
  if (error) {
    console.error("Falha ao ler ai_tools:", error.message);
    process.exit(1);
  }
  // Sem --all, o que já foi escrito à mão é INTOCÁVEL: o script é para preencher
  // o vazio, não para desfazer revisão humana.
  const alvo = (tools ?? []).filter((t) => todas || !String(t.descricao_usuario ?? "").trim());
  console.log(
    `Tools ativas: ${tools?.length ?? 0} | a gerar: ${alvo.length}` +
      `${todas ? " (--all: SOBRESCREVE as preenchidas à mão)" : ""}${dry ? " (--dry: nada será gravado)" : ""}`,
  );
  if (!alvo.length) {
    console.log("Nada a fazer.");
    return;
  }

  const model = await languageModel("query_rewrite"); // modelo RÁPIDO (fallback → Chat)
  let ok = 0;
  const falhas: string[] = [];
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
Descrição técnica (escrita para um modelo de IA): ${t.description ?? ""}
Campos: ${campos || "—"}

Escreva como ESTA ferramenta seria apresentada A UM USUÁRIO — um analista de RH, um gestor ou um colaborador — num botão que ele vai clicar para escolher de onde buscar a informação.

REGRAS:
- 1 ou 2 frases, no máximo ${MAX} caracteres no total.
- Diga o que a pessoa VAI OBTER, não como o sistema funciona.
- Português do Brasil, linguagem do dia a dia do RH.
- PROIBIDO: nome de endpoint, nome de parâmetro, nome de outra ferramenta, "API", "consulta o serviço", "retorna um JSON", instruções para a IA ("use quando...", "chame antes de...").
- Não repita o nome da ferramenta no começo — ele já aparece como título acima da frase.
- Não invente nada que não esteja na descrição técnica acima.

Responda APENAS a frase, sem aspas e sem rótulo.`;
    try {
      const { text } = await generateText({ model, prompt });
      const val = limparResumo(text);
      if (!val) {
        falhas.push(`${t.key}: resposta vazia`);
      } else if (dry) {
        console.log(`\n  ${t.name}\n    → ${val}`);
        ok++;
      } else {
        const up = await db.from("ai_tools").update({ descricao_usuario: val }).eq("id", t.id);
        if (up.error) falhas.push(`${t.key}: ${up.error.message}`);
        else ok++;
      }
    } catch (e) {
      falhas.push(`${t.key}: erro na IA — ${(e as Error).message}`);
    }
    if (!dry) process.stdout.write(`\r  ${ok}/${alvo.length}`);
  }
  console.log(`\n✓ ${ok} de ${alvo.length} ferramenta(s)${dry ? " (simulação)" : " gravada(s)"}.`);
  if (falhas.length) {
    console.log(`\n${falhas.length} falha(s) — estas continuam mostrando só o título no chat:`);
    for (const f of falhas.slice(0, 20)) console.log(`  · ${f}`);
    if (falhas.length > 20) console.log(`  … e mais ${falhas.length - 20}`);
  }
  console.log("\nRevise e ajuste em Admin → Integrações → (a ferramenta) → Descrição para o usuário.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
