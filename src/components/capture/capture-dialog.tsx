"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Link2, Loader2, Lock, CheckCircle2, AlertCircle, Wand2, Bookmark, Trash2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { controlClass } from "@/components/ui/input";
import type { CaminhoSugerido } from "@/lib/capture/plan-schema";
import { Select } from "@/components/ui/select";
import {
  listCaptureRecipes,
  saveCaptureRecipe,
  deleteCaptureRecipe,
  type CaptureRecipe,
} from "@/app/(admin)/admin/(app)/importar/capture-recipe-actions";

export type CaptureMode = "static" | "interactive";
export type CaptureJobRow = { id: string; status: string; progress: number; error: string | null; destino: unknown };
type Login = { usuario: string; senha: string };

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila…",
  running: "Abrindo a página…",
  capturing: "Navegando e capturando os prints…",
  writing: "Montando o artigo…",
  done: "Concluído",
  error: "Falhou",
};

/**
 * Diálogo compartilhado (Importador e Estúdio). Modo estático ou INTERATIVO: no
 * interativo, um passo a passo de navegação (a IA pode SUGERIR o caminho e pedir
 * valores de campos), e instruções que dá para SALVAR/reusar. Login opcional
 * (cifrado, não salvo). Acompanha o progresso do capture_job em tempo real.
 */
export function CaptureDialog({
  open,
  onClose,
  title = "Capturar telas de uma URL",
  spaceId,
  submit,
  sugerir,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Documentação (para listar/salvar instruções). */
  spaceId?: string;
  submit: (input: {
    url: string;
    mode: CaptureMode;
    login: Login | null;
    instrucao: string | null;
  }) => Promise<{ ok: true; jobId: string } | { ok: false; error: string }>;
  /** Abre a página e pede à IA um caminho sugerido (modo interativo). */
  sugerir?: (input: {
    url: string;
    instrucao?: string | null;
    login?: Login | null;
  }) => Promise<{ ok: true; sugestao: CaminhoSugerido } | { ok: false; error: string }>;
  onDone: (job: CaptureJobRow) => void;
}) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<CaptureMode>("static");
  const [comLogin, setComLogin] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [instrucao, setInstrucao] = useState("");
  const [fase, setFase] = useState<"form" | "rodando" | "erro">("form");
  const [erro, setErro] = useState<string | null>(null);
  const [job, setJob] = useState<CaptureJobRow | null>(null);

  // Sugestão de caminho (2B).
  const [sugerindo, setSugerindo] = useState(false);
  const [sugestao, setSugestao] = useState<CaminhoSugerido | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});

  // Instruções salvas (2D).
  const [recipes, setRecipes] = useState<CaptureRecipe[]>([]);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [salvarAberto, setSalvarAberto] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDesc, setRecipeDesc] = useState("");

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const carregarRecipes = useCallback(() => {
    if (spaceId) void listCaptureRecipes(spaceId).then(setRecipes);
  }, [spaceId]);
  useEffect(() => {
    if (open) carregarRecipes();
  }, [open, carregarRecipes]);

  // Progresso do capture_job (realtime) + fetch inicial.
  useEffect(() => {
    if (fase !== "rodando" || !job) return;
    const supabase = createClient();
    let vivo = true;
    const aplicar = (row: CaptureJobRow) => {
      if (!vivo) return;
      setJob(row);
      if (row.status === "done") onDoneRef.current(row);
      else if (row.status === "error") {
        setErro(row.error ?? "A captura falhou.");
        setFase("erro");
      }
    };
    const canal = supabase
      .channel(`capture:${job.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "capture_jobs", filter: `id=eq.${job.id}` },
        (p) => aplicar(p.new as CaptureJobRow),
      )
      .subscribe();
    void supabase
      .from("capture_jobs")
      .select("id, status, progress, error, destino")
      .eq("id", job.id)
      .maybeSingle()
      .then(({ data }) => data && aplicar(data as CaptureJobRow));
    return () => {
      vivo = false;
      void supabase.removeChannel(canal);
    };
  }, [fase, job]);

  function fechar() {
    setUrl("");
    setMode("static");
    setComLogin(false);
    setUsuario("");
    setSenha("");
    setInstrucao("");
    setFase("form");
    setErro(null);
    setJob(null);
    setSugestao(null);
    setValores({});
    setRecipeId(null);
    setSalvarAberto(false);
    onClose();
  }

  const loginAtual = (): Login | null => (comLogin && usuario && senha ? { usuario, senha } : null);

  async function iniciar() {
    const alvo = url.trim();
    if (!alvo) return;
    setErro(null);
    const r = await submit({
      url: alvo,
      mode,
      login: loginAtual(),
      instrucao: mode === "interactive" && instrucao.trim() ? instrucao.trim() : null,
    });
    if (!r.ok) {
      setErro(r.error);
      setFase("erro");
      return;
    }
    setJob({ id: r.jobId, status: "queued", progress: 0, error: null, destino: null });
    setFase("rodando");
  }

  async function pedirSugestao() {
    if (!sugerir || !url.trim()) return;
    setSugerindo(true);
    setErro(null);
    const r = await sugerir({ url: url.trim(), instrucao: instrucao.trim() || null, login: loginAtual() });
    setSugerindo(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setSugestao(r.sugestao);
    setValores({});
  }

  function aplicarSugestao() {
    if (!sugestao) return;
    const partes: string[] = [sugestao.plano.trim()];
    const preenchidos = sugestao.campos.filter((c) => valores[c.id]?.trim());
    if (preenchidos.length) {
      partes.push("Dados para preencher:\n" + preenchidos.map((c) => `- ${c.label}: ${valores[c.id]}`).join("\n"));
    }
    if (sugestao.prints.length) {
      partes.push("Telas para printar:\n" + sugestao.prints.map((p) => `- ${p}`).join("\n"));
    }
    setInstrucao(partes.filter(Boolean).join("\n\n"));
    setSugestao(null);
  }

  function usarRecipe(r: CaptureRecipe) {
    setInstrucao(r.instrucao);
    setRecipeId(r.id);
    setRecipeName(r.name);
    setRecipeDesc(r.description ?? "");
    setMode("interactive");
  }

  async function excluirRecipe(id: string) {
    await deleteCaptureRecipe(id);
    if (recipeId === id) setRecipeId(null);
    carregarRecipes();
  }

  async function salvarRecipe() {
    if (!spaceId || !recipeName.trim() || !instrucao.trim()) return;
    const r = await saveCaptureRecipe({
      spaceId,
      id: recipeId,
      name: recipeName.trim(),
      description: recipeDesc.trim() || null,
      url: url.trim() || null,
      instrucao: instrucao.trim(),
    });
    if (r.ok) {
      setRecipeId(r.id);
      setSalvarAberto(false);
      carregarRecipes();
    } else {
      setErro(r.error);
    }
  }

  return (
    <Dialog open={open} onClose={fechar} title={title} size="md">
      {fase === "rodando" ? (
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>{STATUS_LABEL[job?.status ?? "queued"] ?? job?.status}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(5, job?.progress ?? 5)}%` }} />
          </div>
          <p className="text-xs text-text-muted">
            Pode fechar esta janela — a captura continua no servidor e o resultado aparece quando terminar.
          </p>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {fase === "erro" && erro && (
            <p className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {erro}
            </p>
          )}

          <div>
            <label className="text-sm font-medium">Endereço da página</label>
            <div className="relative mt-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input type="url" inputMode="url" placeholder="https://…" className={`${controlClass} pl-9`} value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Como capturar</label>
            <div className="mt-1">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "static", label: "Página como carrega", title: "Captura a página como ela abre" },
                  { value: "interactive", label: "Interativo (a IA navega)", title: "A IA clica/preenche seguindo suas instruções" },
                ]}
              />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {mode === "static"
                ? "Rápido e robusto: prints da página como ela abre, com recorte e destaque de campos."
                : "A IA age como um usuário: clica, preenche e printa seguindo o passo a passo abaixo."}
            </p>
          </div>

          {mode === "interactive" && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Passo a passo de navegação</label>
                {spaceId && recipes.length > 0 && (
                  <details className="relative">
                    <summary className="cursor-pointer list-none text-xs font-medium text-primary hover:underline">
                      <Bookmark className="mr-1 inline size-3.5 align-[-2px]" /> Instruções salvas ({recipes.length})
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
                      {recipes.map((r) => (
                        <div key={r.id} className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-surface-2">
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => usarRecipe(r)}>
                            <span className="block truncate text-sm font-medium">{r.name}</span>
                            {r.description && <span className="block truncate text-xs text-text-muted">{r.description}</span>}
                          </button>
                          <button type="button" title="Excluir" className="shrink-0 rounded p-1 text-text-muted hover:text-danger" onClick={() => void excluirRecipe(r.id)}>
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <textarea
                className={`${controlClass} min-h-20 text-sm`}
                placeholder="Ex.: No menu lateral, clique em “Colaboradores”. Preencha o campo “CPF” e clique em “Buscar”. Tire um print da tela de resultado…  (ou clique em “Sugerir caminho” para a IA propor)"
                value={instrucao}
                onChange={(e) => setInstrucao(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-2">
                {sugerir && (
                  <Button size="sm" variant="secondary" onClick={() => void pedirSugestao()} disabled={sugerindo || !url.trim()}>
                    {sugerindo ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Sugerir caminho
                  </Button>
                )}
                {spaceId && (
                  <Button size="sm" variant="ghost" onClick={() => setSalvarAberto((v) => !v)} disabled={!instrucao.trim()}>
                    <Save className="size-4" /> {recipeId ? "Atualizar/salvar instrução" : "Salvar instrução"}
                  </Button>
                )}
              </div>

              {salvarAberto && spaceId && (
                <div className="space-y-2 rounded-md border border-border bg-surface-2/50 p-2.5">
                  <input className={`${controlClass} text-sm`} placeholder="Título da instrução" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} />
                  <input className={`${controlClass} text-sm`} placeholder="Descrição (opcional)" value={recipeDesc} onChange={(e) => setRecipeDesc(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSalvarAberto(false)}>Cancelar</Button>
                    <Button size="sm" onClick={() => void salvarRecipe()} disabled={!recipeName.trim()}>
                      {recipeId ? "Atualizar" : "Salvar nova"}
                    </Button>
                  </div>
                </div>
              )}

              {sugestao && (
                <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary">Sugestão da IA</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{sugestao.plano}</p>
                  {sugestao.campos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-text-muted">Preencha os dados que a IA vai precisar:</p>
                      {sugestao.campos.map((c) => (
                        <div key={c.id}>
                          <label className="text-xs font-medium">{c.label}</label>
                          <CampoInput campo={c} valor={valores[c.id] ?? ""} onChange={(v) => setValores((s) => ({ ...s, [c.id]: v }))} />
                        </div>
                      ))}
                    </div>
                  )}
                  {sugestao.prints.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-text-muted">Telas sugeridas para printar:</p>
                      <ul className="mt-1 list-disc pl-5 text-xs text-text-muted">
                        {sugestao.prints.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSugestao(null)}>Descartar</Button>
                    <Button size="sm" onClick={aplicarSugestao}>Usar esta sugestão</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={comLogin} onChange={(e) => setComLogin(e.target.checked)} />
              <Lock className="size-4 text-text-muted" /> A página exige login
            </label>
            {comLogin && (
              <div className="mt-3 space-y-2">
                <input className={controlClass} placeholder="Usuário / e-mail" autoComplete="off" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
                <input type="password" className={controlClass} placeholder="Senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
                <p className="flex items-start gap-1.5 text-xs text-text-muted">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  As credenciais são cifradas, usadas só para esta captura e apagadas em seguida — não ficam salvas.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={fechar}>Cancelar</Button>
            <Button onClick={() => void iniciar()} disabled={!url.trim() || (comLogin && (!usuario || !senha))}>
              <Camera className="size-4" /> Capturar
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function CampoInput({ campo, valor, onChange }: { campo: CaminhoSugerido["campos"][number]; valor: string; onChange: (v: string) => void }) {
  if ((campo.tipo === "lista" || campo.tipo === "radio") && campo.opcoes?.length) {
    return (
      <Select className={`${controlClass} mt-0.5 text-sm`} value={valor} onChange={(v) => onChange(v)}>
        <option value="">Selecione…</option>
        {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    );
  }
  if (campo.tipo === "checkbox") {
    return (
      <label className="mt-0.5 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={valor === "sim"} onChange={(e) => onChange(e.target.checked ? "sim" : "não")} /> Sim
      </label>
    );
  }
  const tipoHtml = campo.tipo === "data" ? "date" : campo.tipo === "numero" ? "number" : "text";
  return <input type={tipoHtml} className={`${controlClass} mt-0.5 text-sm`} value={valor} onChange={(e) => onChange(e.target.value)} />;
}
