"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw, Upload, Link2, Loader2, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/input";
import { CaptureDialog } from "@/components/capture/capture-dialog";
import { createImportJob, createUrlImportJob, deleteImportJob, retryImportJob } from "./actions";
import { createCaptureImport, sugerirCaminhoCaptura } from "./capture-actions";
import { ImportValidateDialog } from "./import-validate-dialog";
import { ACCEPT_ATTR, extensaoAceita, MAX_UPLOAD_BYTES } from "@/lib/importer/file-guard";

export type ImportJobRow = {
  id: string;
  original_name: string | null;
  status: string;
  progress: number;
  error: string | null;
  created_at: string;
};

import { STATUS_LABEL, STATUS_TONE, isTerminal } from "./status";

export function ImportManager({
  spaceId,
  spaceName,
  initialJobs,
}: {
  spaceId: string;
  /**
   * O NOME do destino, escrito onde a ação acontece.
   *
   * O id sozinho não protege ninguém: a tela resolvia a documentação errada e,
   * como não dizia qual era, o engano só aparecia depois — com o manual do
   * cliente já indexado no espaço de outro. Repetir o nome na zona de envio e
   * na confirmação é barato e é a única coisa entre o clique e um erro caro.
   */
  spaceName: string;
  initialJobs: ImportJobRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [jobs, setJobs] = useState<ImportJobRow[]>(initialJobs);
  const [uploading, setUploading] = useState(false);
  const [progressoUp, setProgressoUp] = useState<string | null>(null);
  const [validar, setValidar] = useState<{ id: string; name: string } | null>(null);
  const [url, setUrl] = useState("");
  const [importandoUrl, setImportandoUrl] = useState(false);
  const [capturaAberta, setCapturaAberta] = useState(false);
  // Resolver pendente do diálogo "planilha com fluxograma?" (PDF/Imagem/importar normal).
  const [flowAsk, setFlowAsk] = useState<((v: "pdf" | "image" | null) => void) | null>(null);
  const responderFluxo = (v: "pdf" | "image" | null) => { flowAsk?.(v); setFlowAsk(null); };

  // Realtime: acompanha progresso dos jobs deste espaço.
  useEffect(() => {
    const channel = supabase
      .channel(`import-jobs-${spaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "import_jobs", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const row = payload.new as ImportJobRow;
          setJobs((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== (payload.old as { id: string }).id);
            }
            const exists = prev.some((j) => j.id === row.id);
            return exists
              ? prev.map((j) => (j.id === row.id ? { ...j, ...row } : j))
              : [row, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [spaceId, supabase]);

  // Rede de segurança: enquanto houver job em andamento, recarrega a lista por
  // polling. Se o Realtime não entregar (canal/RLS), o relatório continua vivo.
  const hasActive = jobs.some((j) => !isTerminal(j.status));
  useEffect(() => {
    if (!hasActive) return;
    let alive = true;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("import_jobs")
        .select("id, original_name, status, progress, error, created_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (alive && data) setJobs(data as ImportJobRow[]);
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hasActive, spaceId, supabase]);

  // Vários arquivos de uma vez: envia e enfileira UM a UM (o worker também
  // processa um de cada vez). A ordem de seleção vira a ordem da fila.
  // Planilha (xlsx/xlsm): pode conter FLUXOGRAMAS. Pergunta UMA vez, ao ver uma planilha
  // no lote, se deve interpretar como fluxograma (LibreOffice + visão) e em que formato.
  async function perguntarFluxo(): Promise<"pdf" | "image" | null> {
    return new Promise((resolve) => setFlowAsk(() => resolve));
  }

  async function onFiles(files: File[]) {
    const temPlanilha = files.some((f) => /\.xls[xm]$/i.test(f.name));
    const escolhaFluxo = temPlanilha ? await perguntarFluxo() : null;
    setUploading(true);
    const erros: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const ehPlanilha = /\.xls[xm]$/i.test(file.name);
      if (!extensaoAceita(file.name)) {
        erros.push(`"${file.name}": tipo de arquivo não permitido.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        erros.push(`"${file.name}": arquivo muito grande (máx. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`);
        continue;
      }
      setProgressoUp(files.length > 1 ? `Enviando ${i + 1} de ${files.length}: ${file.name}` : "Enviando…");
      const path = `${spaceId}/${Date.now()}-${i}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("imports").upload(path, file);
      if (error) {
        erros.push(`"${file.name}": falha no upload — ${error.message}`);
        continue;
      }
      const res = await createImportJob({
        spaceId,
        sourceFile: path,
        originalName: file.name,
        mime: file.type || "application/octet-stream",
        sizeBytes: file.size,
        flowRender: ehPlanilha ? escolhaFluxo : null,
      });
      if (!res.ok) erros.push(`"${file.name}": ${res.error}`);
    }
    setProgressoUp(null);
    setUploading(false);
    if (erros.length) toast.error(erros.join(" · "));
    // O sucesso NOMEIA o destino. Confirmação bloqueante antes de cada envio
    // seria atrito diário para proteger de um erro que o seletor visível já
    // impede; o aviso depois pega o caso que sobra — a pessoa que trocou de
    // documentação sem perceber — e ainda dá tempo de apagar o job.
    const enviados = files.length - erros.length;
    if (enviados > 0) {
      toast.success(
        `${enviados} arquivo(s) na fila de ${spaceName}. Acompanhe o progresso abaixo.`,
      );
    }
  }

  async function importarUrl() {
    const alvo = url.trim();
    if (!alvo || importandoUrl) return;
    setImportandoUrl(true);
    const res = await createUrlImportJob({ spaceId, url: alvo });
    setImportandoUrl(false);
    if (res.ok) {
      setUrl("");
      toast.success(`Página enviada para importação em ${spaceName}. Acompanhe abaixo.`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="mt-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center hover:border-primary">
        <Upload className="size-6 text-text-muted" />
        <span className="text-sm font-medium">
          {uploading ? (progressoUp ?? "Enviando…") : "Clique para escolher arquivos"}
        </span>
        <span className="text-xs text-text-muted">
          PDF, DOCX, PPTX, XLSX, CSV/TSV, HTML, Markdown e arquivos de desenvolvimento (SQL, JS, TS, CSS, JSON…) — pode escolher vários (processa um de cada vez)
        </span>
        <span className="text-xs text-text-muted">
          Destino: <strong className="font-semibold text-text">{spaceName}</strong>
        </span>
        <input
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const fs = e.target.files ? Array.from(e.target.files) : [];
            if (fs.length) void onFiles(fs);
            e.target.value = "";
          }}
        />
      </label>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="url"
            inputMode="url"
            placeholder="…ou cole o endereço de uma página (https://…) para importar o conteúdo"
            className={`${controlClass} pl-9`}
            value={url}
            disabled={importandoUrl}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void importarUrl();
              }
            }}
          />
        </div>
        <Button onClick={() => void importarUrl()} disabled={importandoUrl || !url.trim()}>
          {importandoUrl ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Importar da URL
        </Button>
        <Button variant="secondary" onClick={() => setCapturaAberta(true)} title="Cria um passo a passo com prints reais da página">
          <Camera className="size-4" /> Com prints
        </Button>
      </div>

      <CaptureDialog
        open={capturaAberta}
        onClose={() => setCapturaAberta(false)}
        title="Importar de uma URL com prints"
        spaceId={spaceId}
        submit={(input) => createCaptureImport({ spaceId, ...input })}
        sugerir={(i) => sugerirCaminhoCaptura({ spaceId, ...i })}
        onDone={() => {
          toast.success("Prints capturados! A prévia da importação está pronta abaixo — clique em revisar.");
          setCapturaAberta(false);
          router.refresh();
        }}
      />

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Importações
      </h2>
      <div className="mt-3">
        {jobs.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="Nenhuma importação ainda"
            description="Envie um ou vários arquivos (PDF, DOCX, HTML, Markdown) acima. São processados um de cada vez, em segundo plano, e você acompanha o progresso aqui."
          />
        ) : (
          <Surface elevation={1} padding="none" className="overflow-hidden">
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{job.original_name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                        <Badge tone={STATUS_TONE[job.status] ?? "neutral"}>
                          {STATUS_LABEL[job.status] ?? job.status}
                        </Badge>
                        {job.error && <span className="truncate">{job.error}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {job.status === "preview" && (
                        <Button size="sm" onClick={() => router.push(`/admin/importar/${job.id}`)}>
                          Revisar
                        </Button>
                      )}
                      {job.status === "done" && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setValidar({ id: job.id, name: job.original_name ?? "documento" })}
                          >
                            Validar conteúdo
                          </Button>
                          <Link href="/admin/conteudo" className="text-sm text-primary hover:underline">
                            Ver na árvore
                          </Link>
                        </>
                      )}
                      {/* Antes, um job em erro só oferecia "Remover" — e remover
                          apaga o arquivo do Storage junto. Quem tomasse um erro
                          transitório (worker reiniciando, timeout da IA) tinha
                          de subir o PDF de 200 páginas outra vez. */}
                      {job.status === "error" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary hover:bg-transparent hover:underline"
                          onClick={() => {
                            void retryImportJob(job.id).then((r) => {
                              if (r.ok) toast.success("Reenviado para a fila.");
                              else toast.error(r.error);
                            });
                          }}
                        >
                          <RotateCw /> Tentar de novo
                        </Button>
                      )}
                      <button
                        type="button"
                        className="rounded-sm text-xs text-text-muted transition-colors hover:text-danger"
                        onClick={async () => {
                          if (
                            await confirmar({
                              title: "Remover importação",
                              description: "O relatório e o arquivo enviado desta importação são removidos. O conteúdo já importado para a árvore permanece.",
                              tone: "danger",
                              confirmLabel: "Remover",
                            })
                          )
                            deleteImportJob(job.id);
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  {job.status !== "done" && job.status !== "error" && (
                    <div
                      role="progressbar"
                      aria-valuenow={job.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progresso de ${job.original_name}`}
                      className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2"
                    >
                      <div
                        className="h-full bg-primary transition-[width] duration-base ease-out motion-reduce:transition-none"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </div>

      {validar && (
        <ImportValidateDialog jobId={validar.id} name={validar.name} onClose={() => setValidar(null)} />
      )}

      {flowAsk && (
        <Dialog open onClose={() => responderFluxo(null)} title="Planilha com fluxogramas?" size="sm">
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-text-muted">
              Detectei uma <strong>planilha</strong>. Se ela tiver <strong>fluxogramas</strong> (desenhados com células/formas),
              a IA pode interpretá-los <strong>aba por aba</strong> — explicando cada etapa e <strong>redesenhando</strong> o
              fluxo no editor. Para isso a planilha é convertida (visão). Em que formato?
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => responderFluxo("pdf")}>Interpretar fluxogramas — via PDF (recomendado)</Button>
              <Button variant="secondary" onClick={() => responderFluxo("image")}>Interpretar fluxogramas — via Imagem</Button>
              <Button variant="ghost" onClick={() => responderFluxo(null)}>Não — importar como planilha normal (dados)</Button>
            </div>
            <p className="text-xs text-text-muted">
              PDF é mais fiel na maioria dos modelos; Imagem funciona com qualquer modelo de visão.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
