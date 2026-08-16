"use server";

import { revalidatePath } from "next/cache";
import { motivoFila } from "@/lib/jobs/motivo-fila";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { enqueueApexIngest, enqueueApexDocs, enqueueDbIngest, enqueueDbDocs } from "@/lib/jobs/boss";
import { normalizarApexJson } from "@/lib/apex/metadata";
import { normalizarDbJson } from "@/lib/dbobjects/metadata";
import { normalizarTermo } from "@/lib/ai/ontology";
import { idiomaNome } from "@/lib/i18n/languages";
import type { Json } from "@/lib/database.types";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { lerDicionario } from "@/lib/apex/dicionario-csv";
import { importarDicionarioCsv } from "./csv-actions";

/**
 * `dicionario` marca o caso em que a lista de colunas caiu no cartão de objetos
 * e foi tratada como dicionário. Sem ele a tela diria "ingestão enfileirada"
 * para algo que já terminou e não é um job — mentindo sobre o que aconteceu e
 * mandando a pessoa esperar uma barra que nunca vai aparecer.
 */
type Ok = { ok: true; jobId?: string; dicionario?: number } | { ok: false; error: string };

/** Recebe o JSON de `pkg_apex_meta.f_app_json` (colado/upload) → cria e enfileira o job. */
/**
 * O metadado vem por UM de dois caminhos, e a escolha é de tamanho:
 *
 *  · `jsonText` — colado no textarea. Cabe até ~7 MB, o limite prático de uma
 *    Server Action, e é o caminho natural para app pequeno.
 *  · `storagePath` — o arquivo já subiu para o Storage pelo navegador. É o
 *    único caminho possível para os 22 MB de um `f200.json` real: um corpo
 *    desse tamanho numa Server Action seria carregado inteiro na memória de um
 *    worker do Next, que não é onde esse trabalho pertence.
 *
 * Validar o conteúdo aqui exigiria BAIXAR os 22 MB de volta só para conferir o
 * formato — a validação fica no worker, que é quem já vai lê-lo de qualquer
 * jeito. O que se valida aqui é o que é barato: que veio um dos dois.
 */
export async function ingestApexJson(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_apex_meta.f_app_json." };
    }
    if (!normalizarApexJson(meta)) {
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_apex_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "apex_ingest", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueApexIngest(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/** Gera a DOCUMENTAÇÃO por página (usuário + técnica) na base, a partir do mesmo JSON. */
/**
 * O metadado vem por UM de dois caminhos, e a escolha é de tamanho:
 *
 *  · `jsonText` — colado no textarea. Cabe até ~7 MB, o limite prático de uma
 *    Server Action, e é o caminho natural para app pequeno.
 *  · `storagePath` — o arquivo já subiu para o Storage pelo navegador. É o
 *    único caminho possível para os 22 MB de um `f200.json` real: um corpo
 *    desse tamanho numa Server Action seria carregado inteiro na memória de um
 *    worker do Next, que não é onde esse trabalho pertence.
 *
 * Validar o conteúdo aqui exigiria BAIXAR os 22 MB de volta só para conferir o
 * formato — a validação fica no worker, que é quem já vai lê-lo de qualquer
 * jeito. O que se valida aqui é o que é barato: que veio um dos dois.
 */
export async function gerarDocsApex(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("content.create", spaceId);
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão (precisa criar conteúdo + configurar IA)." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_apex_meta.f_app_json." };
    }
    if (!normalizarApexJson(meta)) {
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_apex_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "apex_docs", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueApexDocs(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/** Recebe o JSON de `pkg_db_meta.f_schema_json` (objetos de banco) → cria e enfileira a ingestão. */
/**
 * O arquivo no Storage é uma lista de colunas, e não o metadado de objetos?
 *
 * Baixa só os primeiros 4 KB. Um `all_tab_columns.json` tem 8 MB e um schema
 * completo pode ter mais — baixar inteiro só para decidir o roteamento seria
 * pagar duas vezes pelo mesmo download.
 *
 * O sinal é a PRIMEIRA chave do primeiro objeto: a lista de colunas começa com
 * `[{"TABLE_NAME"...`, e o envelope do pkg_db_meta começa com `{"ok"` ou
 * `{"tables"`. Não precisa parsear o JSON inteiro para ver isso.
 */
async function pareceListaDeColunas(storagePath: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage.from("imports").download(storagePath);
    if (!data) return false;
    const inicio = (await data.slice(0, 4096).text()).trimStart();
    if (!inicio.startsWith("[")) return false;
    return /"(TABLE_NAME|tabela|table)"\s*:/i.test(inicio);
  } catch {
    return false;
  }
}

export async function ingestDbJson(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    // Arquivo grande: o conteúdo não passou por aqui, então a checagem de
    // formato acontece baixando só o começo — o suficiente para distinguir a
    // lista de colunas do envelope do pkg_db_meta.
    if (await pareceListaDeColunas(entrada.storagePath)) {
      const r = await importarDicionarioCsv(spaceId, entrada);
      return r.ok ? { ok: true, dicionario: r.gravadas } : r;
    }
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_db_meta.f_schema_json." };
    }
    if (!normalizarDbJson(meta)) {
      /**
       * LISTA DE COLUNAS caiu no cartão errado — e é fácil cair.
       *
       * Os dois cartões desta página aceitam arquivo JSON, e nada na tela dizia
       * qual formato é de qual. Um dump de `all_tab_columns` chegava aqui e
       * recebia "Metadado de banco inválido": resposta correta sobre a pergunta
       * errada, que obriga a pessoa a adivinhar onde era.
       *
       * Reconhecer e TRATAR é melhor que recusar com instrução: o arquivo já
       * está aqui, tem 8 MB, e mandar refazer o upload noutro cartão é cobrar
       * pela ambiguidade que o produto criou.
       */
      if (lerDicionario(entrada.jsonText).linhas.length > 0) {
        const r = await importarDicionarioCsv(spaceId, entrada);
        return r.ok ? { ok: true, dicionario: r.gravadas } : r;
      }
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_db_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "db_objects", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueDbIngest(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/** Gera a DOCUMENTAÇÃO TÉCNICA dos objetos de banco (um artigo por objeto) na base. */
export async function gerarDbDocs(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("content.create", spaceId);
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão (precisa criar conteúdo + configurar IA)." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_db_meta.f_schema_json." };
    }
    if (!normalizarDbJson(meta)) {
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_db_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "db_docs", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueDbDocs(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/**
 * `total`, `done` e `created_at` faltavam, e eram justamente o que permite
 * ACOMPANHAR. Sem total/done a tela só mostra a porcentagem — e num job de 78
 * mil colunas, "1%" parado por um minuto parece travado, enquanto "1.200 de
 * 78.126" mostra que anda. Sem `created_at` não dá para distinguir a falha de
 * agora da de ontem.
 */
export type ApexJob = {
  id: string;
  kind: string;
  status: string;
  progress: number;
  total: number | null;
  done: number | null;
  found: number;
  error: string | null;
  result: unknown;
  created_at: string;
};

/** Jobs de ingestão recentes (progresso). */
export async function listApexJobs(spaceId: string): Promise<ApexJob[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_dictionary_jobs")
    .select("id, kind, status, progress, total, done, found, error, result, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []) as ApexJob[];
}

export type DicColuna = { table: string | null; column: string | null; label: string | null; labels: string[] };

export type PaginaDic = { linhas: DicColuna[]; total: number };

/**
 * UMA PÁGINA do dicionário, filtrada e contada no BANCO.
 *
 * A versão que carregava tudo derrubava a página: 78.126 colunas viajavam no
 * HTML inicial do servidor — alguns megabytes de JSON serializado antes de o
 * navegador desenhar o primeiro pixel. Filtrar e paginar no cliente resolvia a
 * RENDERIZAÇÃO e não o transporte, que era o gargalo maior.
 *
 * Agora o servidor devolve cem linhas e o total. O `count: "exact"` numa
 * consulta só evita a segunda ida ao banco: sem ele, a paginação não sabe
 * quantas páginas existem, e "página 11 de ?" é pior que não paginar.
 *
 * A busca vai para o SQL. Filtrar no cliente exigiria ter tudo no cliente, que
 * é justamente o que não pode acontecer.
 */
export async function listDicPagina(
  spaceId: string,
  opts: { busca?: string; pagina?: number; porPagina?: number } = {},
): Promise<PaginaDic> {
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return { linhas: [], total: 0 };
  }
  const porPagina = Math.min(500, Math.max(1, opts.porPagina ?? 100));
  const de = Math.max(0, opts.pagina ?? 0) * porPagina;

  const supabase = await createClient();
  let q = supabase
    .from("data_dictionary")
    .select("db_table, db_column, label, metadata", { count: "exact" })
    .eq("space_id", spaceId)
    .eq("kind", "column");

  const termo = (opts.busca ?? "").trim();
  if (termo) {
    // Cada termo precisa casar em ALGUM dos três campos — é o que faz
    // "centro cod" achar CENTRO_DE_CUSTO.COD sem exigir ordem nem separador.
    // O `%` e o `,` do PostgREST são escapados: um termo com vírgula quebraria
    // a sintaxe do `.or()` e viraria erro de consulta.
    for (const t of termo.split(/\s+/).slice(0, 5)) {
      const seguro = t.replace(/[%,()]/g, "");
      if (!seguro) continue;
      q = q.or(`db_table.ilike.%${seguro}%,db_column.ilike.%${seguro}%,label.ilike.%${seguro}%`);
    }
  }

  const { data, count } = await q
    .order("db_table", { ascending: true })
    .order("db_column", { ascending: true })
    .range(de, de + porPagina - 1);

  return {
    linhas: (data ?? []).map((r) => {
      const labels = (r.metadata as { labels?: unknown } | null)?.labels;
      return {
        table: r.db_table,
        column: r.db_column,
        label: r.label,
        labels: Array.isArray(labels) ? labels.map(String) : [],
      };
    }),
    total: count ?? 0,
  };
}

/** O dicionário de COLUNAS (tabela·coluna·label) — a "planilha" para revisar/exportar. */
export async function listDataDictionaryColumns(spaceId: string): Promise<DicColuna[]> {
  const supabase = await createClient();
  /**
   * PAGINADO — sem isto, tela e CSV paravam em 1.000.
   *
   * A importação gravou 78.126 colunas e a tela mostrava mil. O PostgREST tem
   * teto padrão de linhas por resposta e uma consulta sem `.range()` PARA nele:
   * não dá erro, não avisa, só devolve menos. E como o export de CSV chama esta
   * mesma função, quem tentava conferir pelo arquivo via o mesmo número — o
   * caminho de auditoria repetindo o defeito que deveria denunciar.
   *
   * É a terceira vez que este teto morde este projeto: primeiro a árvore de
   * conteúdo, depois a ontologia, agora o dicionário. A regra `select-sem-teto`
   * na catraca existe por causa disso, e `data_dictionary` não estava na lista
   * de tabelas que ela vigia — está agora.
   */
  const data = await fetchAllPaged<{
    db_table: string | null;
    db_column: string | null;
    label: string | null;
    metadata: unknown;
  }>((from, to) =>
    supabase
      .from("data_dictionary")
      .select("db_table, db_column, label, metadata")
      .eq("space_id", spaceId)
      .eq("kind", "column")
      .order("db_table", { ascending: true })
      .order("db_column", { ascending: true })
      .range(from, to),
  );
  return data.map((r) => {
    const labels = (r.metadata as { labels?: unknown } | null)?.labels;
    return { table: r.db_table, column: r.db_column, label: r.label, labels: Array.isArray(labels) ? labels.map(String) : [] };
  });
}

/** CSV (;) do dicionário de colunas — MULTILÍNGUE (uma coluna por idioma habilitado,
 *  com a tradução da label vinda da ontologia). Para baixar a planilha. */
export async function dataDictionaryCsv(spaceId: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  try {
    await requirePermission("content.view", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();
  const cols = await listDataDictionaryColumns(spaceId);

  // Idiomas ativos + traduções das labels (via ontologia: label → term_norm → tradução).
  const { data: langsData } = await supabase.from("space_languages").select("lang").eq("space_id", spaceId).eq("active", true);
  const langs = (langsData ?? []).map((r) => r.lang);
  const tradPorNorm = new Map<string, Map<string, string>>(); // term_norm → (lang → termo)
  if (langs.length) {
    // Paginado: são 2.240 termos no maior espaço, e sem `.range()` o PostgREST
    // devolvia 1.000. O tradutor então "não encontrava" tradução para 1.240
    // termos que existiam — e o sintoma seria lacuna de tradução, não erro.
    const terms = await fetchAllPaged<{ id: string; term_norm: string }>((from, to) =>
      supabase.from("ontology_terms").select("id, term_norm").eq("space_id", spaceId).range(from, to),
    );
    const normPorId = new Map(terms.map((t) => [t.id, t.term_norm]));
    const ids = [...normPorId.keys()];
    for (let i = 0; i < ids.length; i += 200) {
      // 200 termos × N idiomas passa de 1000 com cinco idiomas.
      const data = await fetchAllPaged<{ term_id: string; lang: string; term: string }>((from, to) =>
        supabase
          .from("ontology_translations")
          .select("term_id, lang, term")
          .in("lang", langs)
          .in("term_id", ids.slice(i, i + 200))
          .range(from, to),
      );
      for (const r of data) {
        const norm = normPorId.get(r.term_id);
        if (!norm) continue;
        let m = tradPorNorm.get(norm);
        if (!m) { m = new Map(); tradPorNorm.set(norm, m); }
        m.set(r.lang, r.term);
      }
    }
  }

  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const cab = ["Tabela", "Coluna", "Label (PT)", "Outras labels", ...langs.map((l) => idiomaNome(l) ?? l)];
  const linhas = [cab.map(esc).join(";")];
  for (const c of cols) {
    const norm = c.label ? normalizarTermo(c.label) : "";
    const tr = tradPorNorm.get(norm);
    const cells = [
      c.table ?? "",
      c.column ?? "",
      c.label ?? "",
      c.labels.filter((l) => l !== c.label).join(" | "),
      ...langs.map((l) => tr?.get(l) ?? ""),
    ];
    linhas.push(cells.map(esc).join(";"));
  }
  return { ok: true, csv: linhas.join("\n") };
}

export type LinhaResumoDic = {
  origem: string;
  linhas: number;
  tabelas: number;
  com_label: number;
  com_descricao: number;
  com_tipo: number;
  atualizado_em: string | null;
};

/**
 * O ESTADO do dicionário, por origem — não o resultado do último evento.
 *
 * "Não dá pra saber se realmente foi, se substituiu o anterior, se apenas
 * adicionou" (Igor, 16/08/2026). As três perguntas são sobre o que EXISTE, e o
 * toast só responde sobre o que ACONTECEU — por cinco segundos, numa importação
 * que leva doze.
 */
export async function resumoDicionario(spaceId: string): Promise<LinhaResumoDic[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resumo_dicionario", { p_space_id: spaceId });
  if (error) {
    console.error("[resumoDicionario]", error.message);
    return [];
  }
  return (data ?? []) as LinhaResumoDic[];
}
