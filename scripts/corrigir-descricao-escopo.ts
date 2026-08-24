/**
 * A DESCRIÇÃO DIZIA "DO PRÓPRIO COLABORADOR"; O SERVIDOR ENTREGA A EQUIPE.
 *
 * `consultar_ferias` e `consultar_marcacoes` têm
 * `panel_scope = {"PC":"proprios","PG":"equipe","PO":"todos"}` — quem pergunta
 * do Painel do Gestor recebe a EQUIPE, e do Painel do Operador recebe TODOS.
 * A descrição afirmava o contrário, com todas as letras.
 *
 * Então o gestor pergunta "marcações de ponto da minha equipe" e o catálogo diz
 * ao modelo que aquela ferramenta é só dele. Cinco casos do gabarito batem
 * nisso (4 `devia_chamar` + 1 `tool_errada`).
 *
 * ── O QUE ESTA CORREÇÃO NÃO RESOLVEU, e é honesto dizer ────────────────────
 * Medido no recorte de 19 casos (8 afetados + 11 controles), gemini-3.5-flash:
 * 9/19 antes, 10/19 depois. **+1 está dentro do ruído** — não é melhora
 * demonstrada. Os casos-alvo de `consultar_marcacoes` continuaram sem chamar.
 *
 * A razão apareceu na conferência dos parâmetros: `consultar_marcacoes.empresa`
 * é `origem=modelo` e OBRIGATÓRIO — o modelo teria de inventar o código da
 * empresa. `consultar_ferias` já usa `origem=identidade` e por isso funciona.
 * Enquanto isso não mudar, nenhuma descrição destrava a pergunta de gestor.
 *
 * Aplico assim mesmo porque a frase era FALSA sobre o comportamento do próprio
 * sistema. Corrigir informação errada no catálogo não depende de o placar subir.
 *
 * ── AS DUAS DE ESCRITA FICARAM DE FORA, DE PROPÓSITO ───────────────────────
 * `atualizar_email` e `atualizar_telefone` têm a mesma contradição, e ZERO casos
 * no gabarito. Ali a pergunta é outra: gestor alterar o e-mail PESSOAL de um
 * subordinado pode ser o `panel_scope` que está errado, não a descrição. É
 * decisão do dono, não minha.
 *
 *   npx tsx --env-file=.env.local scripts/corrigir-descricao-escopo.ts [--desfazer]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CHAVES = ["consultar_ferias", "consultar_marcacoes"];
const BACKUP = ".audit/desc-antes-escopo.json";
const NOTA =
  " O ESCOPO (eu / minha equipe / a empresa) é aplicado pelo SERVIDOR conforme o painel e o " +
  'perfil de quem pergunta — logo, pergunta sobre "minha equipe", "meus liderados" ou "os ' +
  'colaboradores da empresa" USA ESTA MESMA ferramenta, não outra.';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("faltam as variáveis do Supabase"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } });

  if (process.argv.includes("--desfazer")) {
    if (!existsSync(BACKUP)) { console.error(`sem ${BACKUP} — nada a desfazer`); process.exit(1); }
    for (const t of JSON.parse(readFileSync(BACKUP, "utf8")) as { key: string; description: string }[]) {
      const { error } = await db.from("ai_tools").update({ description: t.description }).eq("key", t.key);
      console.log(`${error ? "ERRO " + error.message : "restaurado"}  ${t.key}`);
    }
    console.log("\nRegere os vetores: npm run embed:tools && npm run embed:tools:base");
    return;
  }

  const { data, error } = await db.from("ai_tools").select("key, description, panel_scope").in("key", CHAVES);
  if (error) { console.error(error.message); process.exit(1); }
  if (!existsSync(BACKUP)) writeFileSync(BACKUP, JSON.stringify(data, null, 2));

  for (const t of data ?? []) {
    const atual = String((t as { description: string }).description);
    if (atual.includes("aplicado pelo SERVIDOR")) { console.log(`já corrigida  ${t.key}`); continue; }
    const nova = atual.replace(/do pr[óo]prio colaborador/gi, "do colaborador") + NOTA;
    const { error: e } = await db.from("ai_tools").update({ description: nova }).eq("key", (t as { key: string }).key);
    console.log(`${e ? "ERRO " + e.message : "corrigida   "}  ${t.key}`);
  }

  // O embedding é gerado no SAVE pelo construtor; mudando por SQL ele fica velho.
  console.log("\nAgora regere os vetores, senão o roteamento usa a descrição antiga:");
  console.log("  npm run embed:tools -- (zere ai_tools.embedding das 2 antes)");
  console.log("  npm run embed:tools:base");
}

main().catch((e) => { console.error(e); process.exit(1); });
