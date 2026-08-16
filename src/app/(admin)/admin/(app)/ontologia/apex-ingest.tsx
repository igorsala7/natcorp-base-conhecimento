"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Search, ChevronLeft, ChevronRight, FileJson, Boxes, Download, FileText, FileUp, Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  dataDictionaryCsv,
  gerarDocsApex,
  ingestApexJson,
  listApexJobs,
  listDataDictionaryColumns,
  type ApexJob,
  type DicColuna,
} from "./apex-actions";
import { createClient } from "@/lib/supabase/client";
import { useAcompanharJobs } from "./use-acompanhar-jobs";

/**
 * Ingestão de app APEX (Produto 1): cola/sobe o JSON de pkg_apex_meta → extrai o
 * dicionário de dados (tabela·coluna·label), alimenta a ontologia e exporta a planilha.
 */
/** Cem por página: o que cabe numa rolagem sem virar rolagem infinita. */
const POR_PAGINA = 100;

export function ApexIngest({ spaceId, initialCols }: { spaceId: string; initialCols: DicColuna[] }) {
  const toast = useToast();
  const [json, setJson] = useState("");
  /** Arquivo grande já no Storage: o job leva o caminho, não o conteúdo. */
  const [arquivo, setArquivo] = useState<{ nome: string; path: string; bytes: number } | null>(null);
  const [subindo, setSubindo] = useState(false);
  const supabase = createClient();
  const [cols, setCols] = useState<DicColuna[]>(initialCols);
  /**
   * Acompanha até o job TERMINAR, e começa sozinho na montagem — recarregar a
   * página no meio de uma importação de 20 minutos mostrava tela limpa.
   */
  const { jobs, acompanhar } = useAcompanharJobs<ApexJob>(
    () => listApexJobs(spaceId),
    () => void listDataDictionaryColumns(spaceId).then(setCols),
  );
  const [pend, start] = useTransition();
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);



  /**
   * O limite de corpo de Server Action (8 MB, ver next.config) não avisa quando
   * estoura: o Next devolve uma resposta que o cliente não sabe ler, o console
   * mostra "An unexpected response was received from the server" e a tela
   * quebra. TAMANHO é o diagnóstico menos provável de alguém adivinhar a partir
   * disso, então checamos antes de enviar.
   */
  const bytes = new Blob([json]).size;

  /** O que mandar para a action: o caminho do Storage vence o textarea. */
  function entradaAtual() {
    return arquivo ? { storagePath: arquivo.path } : { jsonText: json };
  }

  function processar() {
    start(async () => {
      const r = await ingestApexJson(spaceId, entradaAtual());
      if (r.ok) { toast.success("Ingestão enfileirada — progresso abaixo."); acompanhar(); }
      else toast.error(r.error);
    });
  }

  function documentar() {
    start(async () => {
      const r = await gerarDocsApex(spaceId, entradaAtual());
      if (r.ok) { toast.success("Documentação enfileirada — 2 artigos por página (usuário + técnica) na base."); acompanhar(); }
      else toast.error(r.error);
    });
  }

  function baixarCsv() {
    start(async () => {
      const r = await dataDictionaryCsv(spaceId);
      if (!r.ok) { toast.error(r.error); return; }
      const blob = new Blob(["﻿" + r.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "dicionario-de-dados.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  /**
   * Arquivo PEQUENO vai para o textarea; GRANDE vai direto para o Storage.
   *
   * O `f200.json` real tem 22 MB. Ler isso no textarea trava o navegador —
   * React re-renderiza a cada keystroke de um valor de 22 milhões de
   * caracteres — e depois nem sai daqui, porque estoura a Server Action. O
   * navegador manda direto para o Storage, e o job leva só o caminho.
   *
   * O corte em 1 MB não é o limite técnico (são ~7 MB); é onde o textarea
   * deixa de ser útil. Ninguém revisa 1 MB de JSON numa caixa de texto.
   */
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (f.size <= 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        setJson(String(reader.result ?? ""));
        setArquivo(null);
      };
      reader.readAsText(f);
      return;
    }

    setSubindo(true);
    try {
      const path = `${spaceId}/apex-${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("imports").upload(path, f, { contentType: "application/json" });
      if (error) {
        toast.error(`Falha no upload: ${error.message}`);
        return;
      }
      setJson("");
      setArquivo({ nome: f.name, path, bytes: f.size });
      toast.success("Arquivo enviado. Agora clique em Processar ou Documentar.");
    } finally {
      setSubindo(false);
    }
  }

  /**
   * Em curso + os que falharam. Concluído não é notícia.
   *
   * Sem corte por tempo: `listApexJobs` já devolve os seis mais recentes em
   * ordem decrescente, então um erro nessa lista é recente por construção.
   * A primeira versão filtrava por `Date.now()` no render — e o lint estava
   * certo em recusar: função impura no render pode ser reavaliada e dar
   * resultados diferentes para a mesma árvore. A resposta não era memoizar a
   * impureza, era não precisar dela.
   */
  /**
   * Filtro e paginação no CLIENTE.
   *
   * As 78 mil colunas já vieram para cá — é o que permite conferir o total sem
   * confiar num contador. Filtrar 78 mil strings no navegador leva milissegundos;
   * o que travava era DESENHAR todas. Antes havia um `slice(0, 500)` mudo: a
   * tabela mostrava 500 e nada dizia que havia mais.
   *
   * `useMemo` porque o filtro roda a cada tecla, e sem ele o React refaria a
   * varredura em toda re-renderização, inclusive nas que não têm a ver com a
   * busca.
   */
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cols;
    // Termos separados por espaço, todos precisam casar: "centro cod" acha
    // CENTRO_DE_CUSTO.COD sem exigir a ordem exata nem o separador certo.
    const termos = q.split(/\s+/);
    return cols.filter((c) => {
      const alvo = `${c.table ?? ""} ${c.column ?? ""} ${c.label ?? ""}`.toLowerCase();
      return termos.every((t) => alvo.includes(t));
    });
  }, [cols, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const daPagina = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const jobsAcompanhados = jobs.filter(
    (j) => j.status === "queued" || j.status === "running" || j.status === "error",
  );

  return (
    <Surface elevation={1} padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="size-4 text-text-muted" />
        <h2 className="text-base font-semibold">Ingestão de aplicação APEX → dicionário de dados</h2>
      </div>
      <p className="text-sm text-text-muted">
        Cole (ou suba) o JSON de <code>pkg_apex_meta.f_app_json(app_id)</code>. Extraímos o mapa
        <strong> tabela·coluna·label</strong> (itens e colunas de relatório, resolvendo o SQL das
        regiões por IA), alimentamos a ontologia (a label vira termo; a coluna do banco vira sinônimo,
        já traduzida) e você exporta a planilha.
      </p>

      <textarea
        className={`${controlClass} min-h-[8rem] w-full font-mono text-xs`}
        placeholder='Cole aqui o JSON de pkg_apex_meta.f_app_json(100)…'
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void onFile(e)} />
      {/* O tamanho fica visível ANTES do clique: descobrir que não cabe depois
          de esperar o envio é a pior ordem possível. */}
      {/* Qual das duas entradas está valendo. Sem isto, quem sobe um arquivo e
          depois cola algo no textarea não sabe qual dos dois vai ser
          processado — e o caminho do Storage vence. */}
      {arquivo ? (
        <p className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-2xs">
          <FileJson className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium text-text">{arquivo.nome}</span>
          <span className="tabular-nums text-text-muted">{(arquivo.bytes / 1024 / 1024).toFixed(1)} MB</span>
          <Button variant="ghost" size="sm" className="h-auto p-0 text-2xs" onClick={() => setArquivo(null)}>
            Remover
          </Button>
        </p>
      ) : (
        bytes > 0 && <p className="text-2xs tabular-nums text-text-muted">{(bytes / 1024).toFixed(0)} KB colados</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={processar} disabled={pend || subindo || (!json.trim() && !arquivo)}>
          {pend ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Processar
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={pend} loading={subindo} loadingLabel="Enviando…">
          <FileUp className="size-4" /> Subir JSON
        </Button>
        <Button variant="ghost" onClick={documentar} disabled={pend || subindo || (!json.trim() && !arquivo)} title="Gera 2 artigos por página (usuário + técnica) na base de conhecimento">
          <FileText className="size-4" /> Gerar documentação
        </Button>
        <span className="text-xs text-text-muted">Precisa do worker rodando (npm run worker).</span>
      </div>

      {/* Mostra o que está rodando E o que falhou. Antes, o filtro pegava só
          queued/running: um job que dava erro sumia da tela, sem explicação —
          e some justamente quando a pessoa mais precisa saber o que houve. */}
      {jobsAcompanhados.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {jobsAcompanhados.map((j) => {
            const erro = j.status === "error";
            return (
              <div key={j.id} className="text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs">
                  <span className={erro ? "font-medium text-rose-700 dark:text-rose-300" : "text-text-muted"}>
                    {erro ? "Falhou" : j.status === "queued" ? "Na fila…" : "Processando…"}
                  </span>
                  {/* done/total diz MAIS que a porcentagem num job longo: "1.200
                      de 78.000" mostra que anda; "1%" parado parece travado. */}
                  {!erro && j.total ? (
                    <span className="tabular-nums text-text-muted">
                      {j.done?.toLocaleString("pt-BR")} de {j.total.toLocaleString("pt-BR")}
                    </span>
                  ) : null}
                  <span className="ml-auto tabular-nums text-text-muted">{erro ? "" : `${j.progress}%`}</span>
                </div>
                {erro ? (
                  <p className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                    {j.error ?? "sem detalhe"}
                  </p>
                ) : (
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full bg-primary transition-all" style={{ width: `${j.progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {cols.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              Dicionário de colunas{" "}
              <span className="tabular-nums text-text-muted">({cols.length.toLocaleString("pt-BR")})</span>
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={async () => setCols(await listDataDictionaryColumns(spaceId))}>
                <RefreshCw className="size-4" /> Recarregar
              </Button>
              <Button variant="ghost" onClick={baixarCsv} disabled={pend}>
                <Download className="size-4" /> Baixar planilha (CSV)
              </Button>
            </div>
          </div>

          {/* A busca cobre tabela, coluna E label numa caixa só. Três campos
              obrigariam a saber de antemão em qual deles o termo está — e quem
              procura "centro de custo" não sabe se é nome de tabela ou label. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                className={`${controlClass} pl-8`}
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
                placeholder="Buscar tabela, coluna ou label…"
                aria-label="Buscar no dicionário"
              />
            </div>
            <span aria-live="polite" className="shrink-0 text-xs tabular-nums text-text-muted">
              {busca
                ? `${filtradas.length.toLocaleString("pt-BR")} de ${cols.length.toLocaleString("pt-BR")}`
                : `${cols.length.toLocaleString("pt-BR")} colunas`}
            </span>
          </div>

          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Tabela</th>
                  <th className="px-3 py-2 font-medium">Coluna</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                </tr>
              </thead>
              <tbody>
                {daPagina.map((c, i) => (
                  <tr key={`${c.table}.${c.column}-${i}`} className="border-t border-border">
                    <td className="px-3 py-1.5 font-mono text-xs">{c.table ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{c.column ?? "—"}</td>
                    <td className="px-3 py-1.5">{c.label ?? <span className="text-text-muted">—</span>}</td>
                  </tr>
                ))}
                {daPagina.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-text-muted">
                      Nada encontrado para “{busca}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0}>
                <ChevronLeft /> Anterior
              </Button>
              {/* Intervalo, não só o número da página: "1.001–1.100 de 78.126"
                  diz ONDE se está num acervo grande; "página 11" não diz nada. */}
              <span className="text-xs tabular-nums text-text-muted">
                {(pagina * POR_PAGINA + 1).toLocaleString("pt-BR")}–
                {Math.min((pagina + 1) * POR_PAGINA, filtradas.length).toLocaleString("pt-BR")} de{" "}
                {filtradas.length.toLocaleString("pt-BR")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={pagina >= totalPaginas - 1}
              >
                Próxima <ChevronRight />
              </Button>
              {/* Ir direto: com 782 páginas, chegar ao fim clicando é inviável. */}
              <label className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
                Página
                <input
                  type="number"
                  min={1}
                  max={totalPaginas}
                  value={pagina + 1}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 1 && n <= totalPaginas) setPagina(n - 1);
                  }}
                  className={`${controlClass} w-20 text-center tabular-nums`}
                  aria-label="Ir para a página"
                />
                de {totalPaginas.toLocaleString("pt-BR")}
              </label>
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}
