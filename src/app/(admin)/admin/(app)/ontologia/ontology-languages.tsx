"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Languages, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { IDIOMAS } from "@/lib/i18n/languages";
import {
  listTranslationJobs,
  listTranslations,
  saveTranslation,
  setSpaceLanguages,
  traduzirOntologia,
  type JobTraducao,
  type LinhaTraducao,
} from "./actions";

const TRADUZIVEIS = IDIOMAS.filter((i) => i.code !== "pt");

/**
 * Gestão dos idiomas da ontologia (Fase 1c): habilita idiomas (sem sobrepor o PT),
 * dispara a tradução por IA e permite REVISAR/editar cada tradução por idioma.
 */
export function OntologyLanguages({
  spaceId,
  initialLangs,
  canManage,
}: {
  spaceId: string;
  initialLangs: string[];
  canManage: boolean;
}) {
  const toast = useToast();
  const [ativos, setAtivos] = useState<string[]>(initialLangs);
  const [langSel, setLangSel] = useState<string | null>(initialLangs[0] ?? null);
  const [linhas, setLinhas] = useState<LinhaTraducao[] | null>(null);
  const [jobs, setJobs] = useState<JobTraducao[]>([]);
  const [pend, startPend] = useTransition();
  const [carregando, startCarregar] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function iniciarPoll() {
    if (pollRef.current) return;
    let ticks = 0;
    const run = async () => {
      ticks += 1;
      const js = await listTranslationJobs(spaceId);
      setJobs(js);
      const ativo = js.some((j) => j.status === "queued" || j.status === "running");
      if ((!ativo && ticks > 1) || ticks > 30) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    };
    void run();
    pollRef.current = setInterval(run, 2500);
  }

  function toggle(code: string) {
    setAtivos((a) => (a.includes(code) ? a.filter((x) => x !== code) : [...a, code]));
  }

  function salvarIdiomas() {
    startPend(async () => {
      const r = await setSpaceLanguages(spaceId, ativos);
      if (r.ok) { toast.success("Idiomas salvos — a tradução dos habilitados foi enfileirada."); iniciarPoll(); }
      else toast.error(r.error);
    });
  }

  function carregar(lang: string) {
    setLangSel(lang);
    setLinhas(null);
    startCarregar(async () => setLinhas(await listTranslations(spaceId, lang)));
  }

  function traduzir(lang: string) {
    startPend(async () => {
      const r = await traduzirOntologia(spaceId, lang);
      if (r.ok) { toast.success("Tradução enfileirada — o progresso aparece abaixo."); iniciarPoll(); }
      else toast.error(r.error);
    });
  }

  const jobsAtivos = jobs.filter((j) => j.status === "queued" || j.status === "running");

  const idiomasSalvos = JSON.stringify([...ativos].sort()) !== JSON.stringify([...initialLangs].sort());

  return (
    <Surface elevation={1} padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <Languages className="size-4 text-text-muted" />
        <h2 className="text-base font-semibold">Idiomas</h2>
        <span className="text-sm text-text-muted">
          Traduz a ontologia (contextual, não literal) para outros idiomas — o PT continua o
          original. O chatbot responde no idioma que o usuário escolher no widget.
        </span>
      </div>

      {/* Habilitar idiomas */}
      <div className="flex flex-wrap gap-2">
        {TRADUZIVEIS.map((i) => {
          const on = ativos.includes(i.code);
          return (
            <button
              key={i.code}
              type="button"
              disabled={!canManage}
              onClick={() => toggle(i.code)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-text-muted hover:border-primary/40"
              } ${canManage ? "cursor-pointer" : "cursor-default opacity-70"}`}
            >
              {i.nativo}
            </button>
          );
        })}
      </div>
      {canManage && (
        <div className="flex items-center gap-3">
          <Button onClick={salvarIdiomas} disabled={pend || !idiomasSalvos}>
            {pend ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar idiomas
          </Button>
          <span className="text-xs text-text-muted">
            Ao salvar, os termos são traduzidos por IA em segundo plano (precisa do worker rodando).
          </span>
        </div>
      )}

      {jobsAtivos.length > 0 && (
        <div className="space-y-2">
          {jobsAtivos.map((j) => {
            const nome = IDIOMAS.find((i) => i.code === j.lang)?.nativo ?? j.lang;
            return (
              <div key={j.id} className="text-sm">
                <div className="mb-1 flex justify-between text-text-muted">
                  <span>Traduzindo {nome}… {j.done}/{j.total || "?"}</span>
                  <span>{j.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-primary transition-all" style={{ width: `${j.progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Revisão por idioma */}
      {ativos.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Revisar:</span>
            {ativos.map((code) => {
              const nome = IDIOMAS.find((i) => i.code === code)?.nativo ?? code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => carregar(code)}
                  className={`rounded-md border px-2.5 py-1 text-sm ${
                    langSel === code ? "border-primary bg-primary/10 text-primary" : "border-border text-text-muted"
                  }`}
                >
                  {nome}
                </button>
              );
            })}
            {langSel && canManage && (
              <Button variant="ghost" onClick={() => traduzir(langSel)} disabled={pend} className="ml-auto">
                <Sparkles className="size-4" /> Traduzir com IA
              </Button>
            )}
            {langSel && (
              <Button variant="ghost" onClick={() => carregar(langSel)} disabled={carregando}>
                {carregando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Recarregar
              </Button>
            )}
          </div>

          {carregando && !linhas && <p className="text-sm text-text-muted">Carregando…</p>}
          {linhas && linhas.length === 0 && (
            <p className="text-sm text-text-muted">Nenhum termo na ontologia ainda.</p>
          )}
          {linhas && linhas.length > 0 && langSel && (
            <div className="space-y-2">
              {linhas.map((l) => (
                <LinhaEditor key={l.termId} linha={l} lang={langSel} canManage={canManage} />
              ))}
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}

function LinhaEditor({ linha, lang, canManage }: { linha: LinhaTraducao; lang: string; canManage: boolean }) {
  const toast = useToast();
  const [term, setTerm] = useState(linha.term ?? "");
  const [aliases, setAliases] = useState((linha.aliases ?? []).join(", "));
  const [desc, setDesc] = useState(linha.description ?? "");
  const [reviewed, setReviewed] = useState(linha.reviewed);
  const [salvando, start] = useTransition();

  function salvar() {
    start(async () => {
      const r = await saveTranslation({
        termId: linha.termId,
        lang,
        term,
        description: desc,
        aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
      });
      if (r.ok) {
        setReviewed(true);
        toast.success("Tradução salva.");
      } else toast.error(r.error);
    });
  }

  const estado = reviewed ? { t: "Revisado", tone: "success" as const } : term ? { t: "Sugestão IA", tone: "neutral" as const } : { t: "Faltando", tone: "warning" as const };

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{linha.ptTerm}</div>
        {linha.ptAliases.length > 0 && (
          <div className="mt-0.5 text-xs text-text-muted">{linha.ptAliases.join(", ")}</div>
        )}
        <div className="mt-1"><Badge tone={estado.tone}>{estado.t}</Badge></div>
      </div>
      <div className="space-y-1.5">
        <input
          className={`${controlClass} h-9 w-full`}
          value={term}
          disabled={!canManage}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Termo traduzido"
        />
        <input
          className={`${controlClass} h-9 w-full`}
          value={aliases}
          disabled={!canManage}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="Sinônimos, separados por vírgula"
        />
        <input
          className={`${controlClass} h-9 w-full`}
          value={desc}
          disabled={!canManage}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descrição (opcional)"
        />
        {canManage && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={salvar} disabled={salvando || !term.trim()}>
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
