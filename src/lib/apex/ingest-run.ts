import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizarApexJson } from "./metadata";
import { colunasParaResolver, construirLinhasDicionario, type ResolucaoColunas } from "./ingest";
import { resolverColunasRegiao } from "@/lib/ai/apex-resolve";
import { alimentarOntologiaDeColunas } from "@/lib/data-dictionary/ontology-feed";
import { enfileirarTraducoesPendentes } from "@/lib/ai/ontology-translate-enqueue";
import { carregarMetaApex } from "./carregar-meta";
import { gravarDicionario, deduplicar } from "@/lib/data-dictionary/gravar";

type DbClient = SupabaseClient<Database>;

/**
 * Executa um job de INGESTÃO de app APEX: resolve as colunas por região (IA lê o SQL),
 * grava o `data_dictionary` (re-ingest idempotente por app) e alimenta a ontologia (auto-
 * traduzida). Atualiza progresso. O metadado vem de `job.input` — inline
 * (`meta`) ou do Storage (`storagePath`). Ver `carregarMetaApex`.
 */
export async function runApexIngest(supabase: DbClient, jobId: string): Promise<{ componentes: number; colunas: number; termos: number }> {
  const vazio = { componentes: 0, colunas: 0, termos: 0 };
  const { data: job } = await supabase.from("data_dictionary_jobs").select("space_id, input").eq("id", jobId).single();
  if (!job) return vazio;
  const spaceId = job.space_id;
  const meta = await carregarMetaApex(supabase, job.input);
  if (!meta) {
    await supabase.from("data_dictionary_jobs").update({ status: "error", error: "Metadado APEX inválido (esperado o JSON de pkg_apex_meta)." }).eq("id", jobId);
    return vazio;
  }

  const regioes = colunasParaResolver(meta);
  const total = regioes.length + 2;
  await supabase.from("data_dictionary_jobs").update({ status: "running", total, done: 0, progress: 0 }).eq("id", jobId);

  const resolvido: ResolucaoColunas = new Map();
  let done = 0;
  for (const r of regioes) {
    resolvido.set(r.regionId, await resolverColunasRegiao(r.sql, r.entradas.map((e) => e.entrada)));
    done += 1;
    await supabase.from("data_dictionary_jobs").update({ done, progress: Math.round((done / total) * 100) }).eq("id", jobId);
  }

  const linhas = construirLinhasDicionario(spaceId, meta, resolvido);
  const appId = meta.app.id || "";
  await supabase.from("data_dictionary").delete().eq("space_id", spaceId).eq("source", "apex_dict").eq("app_id", appId);
  const grav = await gravarDicionario(supabase, linhas);
  if (grav.erro) {
    await supabase
      .from("data_dictionary_jobs")
      .update({ status: "error", progress: 100, result: { ...grav }, error: grav.erro })
      .eq("id", jobId);
    return vazio;
  }
  done += 1;
  await supabase.from("data_dictionary_jobs").update({ done, progress: Math.round((done / total) * 100) }).eq("id", jobId);

  const termos = await alimentarOntologiaDeColunas(supabase, spaceId, linhas);
  try {
    await enfileirarTraducoesPendentes(supabase, spaceId, null);
  } catch {
    /* best-effort */
  }

  // Contadas sobre o que sobreviveu à deduplicação — antes vinham do ARRAY em
  // memória, e por isso o job publicava 13.710 quando o banco tinha 10.710.
  const { unicas } = deduplicar(linhas);
  const componentes = unicas.filter((l) => l.kind !== "column").length;
  const colunas = unicas.filter((l) => l.kind === "column").length;

  /**
   * ZERO COLUNAS COM ESTRUTURA LIDA É FALHA, NÃO SUCESSO.
   *
   * Passou despercebido três vezes em 16/08/2026, sempre igual: o job terminava
   * `done`, a barra ia a 100%, o `found` dizia 0 — e nada distinguia isso de um
   * processamento bem-sucedido. Duas causas diferentes produziram exatamente a
   * mesma tela silenciosa (o normalizador que não entendia o dump das views, e
   * depois o worker rodando código antigo).
   *
   * Extrair o mapa tabela·coluna é a razão de ser desta ingestão. Ler 1.568
   * componentes e nenhuma coluna nunca é um resultado legítimo — é sintoma. E
   * `componentes > 0` é o que separa isso de um arquivo genuinamente vazio, que
   * merece outra mensagem.
   */
  if (componentes > 0 && colunas === 0) {
    await supabase
      .from("data_dictionary_jobs")
      .update({
        status: "error",
        progress: 100,
        result: { componentes, colunas, termos },
        error:
          `Li ${componentes.toLocaleString("pt-BR")} componentes da aplicação mas NENHUMA ligação coluna↔tabela — ` +
          "que é justamente o que esta ingestão existe para extrair. " +
          "Causa mais comum: o worker está rodando uma versão antiga do código (reinicie o `npm run worker` após o deploy). " +
          "Se o worker estiver atualizado, o JSON provavelmente não traz `database_items`.",
      })
      .eq("id", jobId);
    return { componentes, colunas, termos };
  }

  await supabase.from("data_dictionary_jobs").update({ status: "done", progress: 100, found: termos, result: { componentes, colunas, termos } }).eq("id", jobId);
  return { componentes, colunas, termos };
}
