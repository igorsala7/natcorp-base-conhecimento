"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Database, FileText, FileUp, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { gerarDbDocs, ingestDbJson, listApexJobs, type ApexJob } from "./apex-actions";

/**
 * Fase D — objetos de banco (tabelas, views, triggers, procedures, functions, packages).
 * Cola/sobe o JSON de pkg_db_meta.f_schema_json → alimenta o mesmo dicionário de dados e a
 * ontologia (comentários das colunas viram termos) e, opcionalmente, gera a documentação
 * técnica "parruda" (um artigo por objeto) para os analistas/programadores da Natcorp.
 * As colunas aparecem na planilha do card acima (mesmo data_dictionary).
 */
export function DbIngest({ spaceId }: { spaceId: string }) {
  const toast = useToast();
  const [json, setJson] = useState("");
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
      setJobs(js.filter((j) => j.kind === "db_objects" || j.kind === "db_docs"));
      const ativo = js.some((j) => j.status === "queued" || j.status === "running");
      if ((!ativo && ticks > 1) || ticks > 60) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }
    };
    void run();
    pollRef.current = setInterval(run, 2500);
  }

  function processar() {
    start(async () => {
      const r = await ingestDbJson(spaceId, json);
      if (r.ok) { toast.success("Ingestão de objetos enfileirada — colunas entram na planilha acima."); iniciarPoll(); }
      else toast.error(r.error);
    });
  }

  function documentar() {
    start(async () => {
      const r = await gerarDbDocs(spaceId, json);
      if (r.ok) { toast.success("Documentação técnica enfileirada — um artigo por objeto na base."); iniciarPoll(); }
      else toast.error(r.error);
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
        <Database className="size-4 text-text-muted" />
        <h2 className="text-base font-semibold">Objetos de banco → dicionário + documentação técnica</h2>
      </div>
      <p className="text-sm text-text-muted">
        Cole (ou suba) o JSON de <code>pkg_db_meta.f_schema_json</code> (tabelas, views, triggers,
        procedures, functions, packages). As colunas e seus comentários alimentam o
        <strong> mesmo dicionário de dados</strong> e a ontologia; a documentação técnica gera um
        artigo por objeto (propósito, colunas, relacionamentos e passo a passo do código) para os
        analistas de sistemas e programadores.
      </p>

      <textarea
        className={`${controlClass} min-h-[8rem] w-full font-mono text-xs`}
        placeholder='Cole aqui o JSON de pkg_db_meta.f_schema_json…'
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
        <Button variant="ghost" onClick={documentar} disabled={pend || !json.trim()} title="Gera um artigo técnico por objeto na base de conhecimento">
          <FileText className="size-4" /> Gerar documentação técnica
        </Button>
        <span className="text-xs text-text-muted">Precisa do worker rodando (npm run worker).</span>
      </div>

      {jobsAtivos.length > 0 && (
        <div className="space-y-2">
          {jobsAtivos.map((j) => (
            <div key={j.id} className="text-sm">
              <div className="mb-1 flex justify-between text-text-muted">
                <span>{j.kind === "db_docs" ? "Documentando…" : "Ingerindo…"}</span>
                <span>{j.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full bg-primary transition-all" style={{ width: `${j.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}
