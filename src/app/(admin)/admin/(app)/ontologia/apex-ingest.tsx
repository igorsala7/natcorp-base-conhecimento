"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Boxes, Download, FileText, FileUp, Loader2, Play, RefreshCw } from "lucide-react";
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

/**
 * Ingestão de app APEX (Produto 1): cola/sobe o JSON de pkg_apex_meta → extrai o
 * dicionário de dados (tabela·coluna·label), alimenta a ontologia e exporta a planilha.
 */
export function ApexIngest({ spaceId, initialCols }: { spaceId: string; initialCols: DicColuna[] }) {
  const toast = useToast();
  const [json, setJson] = useState("");
  const [cols, setCols] = useState<DicColuna[]>(initialCols);
  const [jobs, setJobs] = useState<ApexJob[]>([]);
  const [pend, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function iniciarPoll() {
    if (pollRef.current) return;
    let ticks = 0;
    const run = async () => {
      ticks += 1;
      const js = await listApexJobs(spaceId);
      setJobs(js);
      const ativo = js.some((j) => j.status === "queued" || j.status === "running");
      if (!ativo) setCols(await listDataDictionaryColumns(spaceId));
      if ((!ativo && ticks > 1) || ticks > 40) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }
    };
    void run();
    pollRef.current = setInterval(run, 2500);
  }

  function processar() {
    start(async () => {
      const r = await ingestApexJson(spaceId, json);
      if (r.ok) { toast.success("Ingestão enfileirada — progresso abaixo."); iniciarPoll(); }
      else toast.error(r.error);
    });
  }

  function documentar() {
    start(async () => {
      const r = await gerarDocsApex(spaceId, json);
      if (r.ok) { toast.success("Documentação enfileirada — 2 artigos por página (usuário + técnica) na base."); iniciarPoll(); }
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

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setJson(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  const jobsAtivos = jobs.filter((j) => j.status === "queued" || j.status === "running");

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
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={processar} disabled={pend || !json.trim()}>
          {pend ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Processar
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={pend}>
          <FileUp className="size-4" /> Subir JSON
        </Button>
        <Button variant="ghost" onClick={documentar} disabled={pend || !json.trim()} title="Gera 2 artigos por página (usuário + técnica) na base de conhecimento">
          <FileText className="size-4" /> Gerar documentação
        </Button>
        <span className="text-xs text-text-muted">Precisa do worker rodando (npm run worker).</span>
      </div>

      {jobsAtivos.length > 0 && (
        <div className="space-y-2">
          {jobsAtivos.map((j) => (
            <div key={j.id} className="text-sm">
              <div className="mb-1 flex justify-between text-text-muted">
                <span>Ingerindo…</span>
                <span>{j.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full bg-primary transition-all" style={{ width: `${j.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {cols.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Dicionário de colunas ({cols.length})</span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={async () => setCols(await listDataDictionaryColumns(spaceId))}>
                <RefreshCw className="size-4" /> Recarregar
              </Button>
              <Button variant="ghost" onClick={baixarCsv} disabled={pend}>
                <Download className="size-4" /> Baixar planilha (CSV)
              </Button>
            </div>
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Tabela</th>
                  <th className="px-3 py-2 font-medium">Coluna</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                </tr>
              </thead>
              <tbody>
                {cols.slice(0, 500).map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 font-mono text-xs">{c.table ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{c.column ?? "—"}</td>
                    <td className="px-3 py-1.5">{c.label ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Surface>
  );
}
