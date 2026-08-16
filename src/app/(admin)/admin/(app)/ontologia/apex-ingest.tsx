"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, ChevronLeft, ChevronRight, FileJson, Boxes, Download, FileText, FileUp, Loader2, Play, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dispensarAtividade } from "../atividade-actions";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  dataDictionaryCsv,
  gerarDocsApex,
  ingestApexJson,
  listApexJobs,
  listDicPagina,
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

export function ApexIngest({ spaceId, onMudou }: { spaceId: string; onMudou?: () => void }) {
  const toast = useToast();
  const [json, setJson] = useState("");
  /** Arquivo grande já no Storage: o job leva o caminho, não o conteúdo. */
  const [arquivo, setArquivo] = useState<{ nome: string; path: string; bytes: number } | null>(null);
  const [subindo, setSubindo] = useState(false);
  const supabase = createClient();
  /**
   * Acompanha até o job TERMINAR, e começa sozinho na montagem — recarregar a
   * página no meio de uma importação de 20 minutos mostrava tela limpa.
   */
  /**
   * Sem `aoTerminar` aqui: recarregar o dicionário quando o job acaba exigiria
   * ler `busca`/`pagina`, que só são declarados abaixo. Quem recarrega é o
   * efeito de busca, disparado por `recarga` — e assim há UM lugar que sabe
   * montar a consulta, em vez de dois que precisam concordar.
   */
  const [recarga, setRecarga] = useState(0);
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());
  const { jobs, acompanhar } = useAcompanharJobs<ApexJob>(
    () => listApexJobs(spaceId),
    () => {
      setRecarga((n) => n + 1);
      onMudou?.();
    },
  );
  const [pend, start] = useTransition();
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  /**
   * LAZY: o dicionário NÃO vem no HTML inicial.
   *
   * Com 78.126 colunas embutidas, a página não abria — alguns megabytes de JSON
   * serializado antes de o navegador desenhar o primeiro pixel. Agora chegam
   * cem por vez, buscadas quando a tela pede.
   */
  const [dic, setDic] = useState<{ linhas: DicColuna[]; total: number }>({ linhas: [], total: 0 });
  const [carregandoDic, setCarregandoDic] = useState(false);
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
   * Busca ao digitar, com respiro de 300ms.
   *
   * Sem o respiro, cada tecla vira uma consulta ao banco — "centro de custo"
   * dispararia dezesseis. O valor é o de sempre para busca: curto o bastante
   * para parecer imediato, longo o bastante para o dedo terminar a palavra.
   */
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      setCarregandoDic(true);
      const r = await listDicPagina(spaceId, { busca, pagina, porPagina: POR_PAGINA });
      if (vivo) {
        setDic(r);
        setCarregandoDic(false);
      }
    }, busca ? 300 : 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [spaceId, busca, pagina, recarga]);

  const totalPaginas = Math.max(1, Math.ceil(dic.total / POR_PAGINA));

  const jobsAcompanhados = jobs.filter(
    (j) => (j.status === "queued" || j.status === "running" || j.status === "error") && !dispensados.has(j.id),
  );
  const errosVisiveis = jobsAcompanhados.filter((j) => j.status === "error");

  /**
   * Esconde o job desta lista, com a MESMA dispensa da gaveta de Atividade —
   * senão limpar aqui deixaria o erro lá, e vice-versa. O estado local é só
   * para o item sumir antes da próxima sondagem.
   */
  async function dispensar(alvos: { id: string }[]) {
    if (!alvos.length) return;
    setDispensados((s) => new Set([...s, ...alvos.map((a) => a.id)]));
    await dispensarAtividade(alvos.map((a) => ({ tipo: "dicionario", id: a.id })));
  }

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
          {errosVisiveis.length > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => void dispensar(errosVisiveis)}>
                <X className="size-3.5" />
                Limpar {errosVisiveis.length === 1 ? "o erro" : `os ${errosVisiveis.length} erros`}
              </Button>
            </div>
          )}
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
                  {/* Também alcança o job travado em `queued`, que "Limpar os
                      erros" não pega porque ele nunca chega a falhar. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => void dispensar([j])}
                    aria-label={erro ? "Dispensar este erro" : "Parar de acompanhar este processo"}
                  >
                    <X className="size-3.5" />
                  </Button>
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

      {(dic.total > 0 || busca) && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              Dicionário de colunas{" "}
              <span className="tabular-nums text-text-muted">({dic.total.toLocaleString("pt-BR")})</span>
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={async () => setDic(await listDicPagina(spaceId, { busca, pagina, porPagina: POR_PAGINA }))}>
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
              {carregandoDic ? "buscando…" : `${dic.total.toLocaleString("pt-BR")} coluna(s)`}
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
                {dic.linhas.map((c, i) => (
                  <tr key={`${c.table}.${c.column}-${i}`} className="border-t border-border">
                    <td className="px-3 py-1.5 font-mono text-xs">{c.table ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{c.column ?? "—"}</td>
                    <td className="px-3 py-1.5">{c.label ?? <span className="text-text-muted">—</span>}</td>
                  </tr>
                ))}
                {dic.linhas.length === 0 && !carregandoDic && (
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
                {Math.min((pagina + 1) * POR_PAGINA, dic.total).toLocaleString("pt-BR")} de{" "}
                {dic.total.toLocaleString("pt-BR")}
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
