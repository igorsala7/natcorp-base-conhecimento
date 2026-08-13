/**
 * Simula o CORPO que cada ferramenta de férias vai postar, sem tocar no Oracle.
 *
 * Existe porque um erro aqui não faz barulho: o corpo sai bem formado, a API
 * responde 200, e o valor foi para o campo errado. Foi assim que se descobriu
 * que o motor REMOVE do array as parcelas não preenchidas — o que quebrava a
 * leitura por posição no PL/SQL (hoje o despacho é pelo campo `n`).
 *
 * Confere três coisas:
 *   · todo placeholder do body_template tem um parâmetro correspondente;
 *   · a identidade sai aninhada como o pacote espera;
 *   · que TIPO cada valor tem de verdade (empresa vem do token como "1", texto —
 *     é por isso que o pacote lê número com num_de e não com get_number).
 *
 * Rodar: npm run smoke:ferias
 */
import ws from "ws";
if (!globalThis.WebSocket) { (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws; }
import { createClient } from "@supabase/supabase-js";
import { resolveParams, chaveDoModelo } from "../src/lib/integrations/params";
import { buildHttpRequest } from "../src/lib/integrations/executor";
import { parametrosDoTemplate } from "../src/lib/integrations/body-template";
import type { ToolParam } from "../src/lib/integrations/tools";

const IDENT = { usuario: "IGOR", cod_empresa: "1", matricula: "12345", perfil: "MASTER", portal: "po", base: "natcorp" } as never;

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await db.from("ai_tools").select("key,method,path_template,params,body_template,body_mode")
    .like("key", "ferias\\_%").order("key");

  for (const t of data ?? []) {
    const params = t.params as unknown as ToolParam[];
    // Placeholders do template que NÃO existem como parâmetro = campo que nunca chega.
    const nomes = new Set(params.map((p) => p.nome));
    const orfaos = parametrosDoTemplate(t.body_template).filter((n) => !nomes.has(n));

    // Argumentos que o modelo mandaria (só os obrigatórios + alguns típicos).
    const modelArgs: Record<string, unknown> = {};
    for (const p of params) {
      if (p.origem !== "modelo" && p.origem !== "pessoa") continue;
      const k = chaveDoModelo(p.nome);
      if (p.nome === "cod_solicitacao") modelArgs[k] = 57463;
      else if (p.nome === "status") modelArgs[k] = "A";
      else if (p.nome === "justificativa") modelArgs[k] = "Equipe coberta.";
      else if (p.nome === "matricula") modelArgs[k] = 12345;
      else if (p.nome === "dt_saida_1") modelArgs[k] = "2026-09-01";
      else if (p.nome === "num_dias_1") modelArgs[k] = 30;
      else if (p.nome === "dt_inic_per_ferias") modelArgs[k] = "2025-03-01";
      else if (p.nome === "dt_fim_per_ferias") modelArgs[k] = "2026-02-28";
      else if (p.nome === "opcao_ferias") modelArgs[k] = 1;
    }

    const buckets = resolveParams(params, modelArgs, IDENT);
    const req = buildHttpRequest(
      { ...t, params, body_template: t.body_template, body_mode: t.body_mode } as never,
      "https://x/apex/rh/natcorp",
      buckets,
    );
    console.log(`\n━━ ${t.key}  ${req.method} ${req.url.replace("https://x", "")}`);
    if (orfaos.length) console.log(`   ⚠ placeholders sem parâmetro: ${orfaos.join(", ")}`);
    console.log("   " + JSON.stringify(JSON.parse(req.body ?? "{}")).slice(0, 900));
  }
}
main().catch((e) => { console.error("FALHOU:", e?.message ?? e); process.exit(1); });
