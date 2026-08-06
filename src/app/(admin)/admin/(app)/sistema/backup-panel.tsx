"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatabaseBackup, RotateCcw, Trash2, Save, Clock, ShieldAlert, Download, Upload, GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Surface } from "@/components/ui/surface";
import { Field, eyebrowLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataTable, DataHead, Th, Td, Tr, EmptyRow } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import {
  criarBackup, restaurarBackup, excluirBackup, salvarConfigBackup,
  criarUploadUrl, importarUpload, salvarConfigGithub, enviarParaGithub, importarDoGithub,
} from "./backup-actions";

export type BackupRow = {
  id: string;
  kind: string;
  status: string;
  progress: number;
  phase: string | null;
  bytes: number | null;
  tables_count: number | null;
  rows_count: number | null;
  files_count: number | null;
  error: string | null;
  created_at: string;
  source_backup_id: string | null;
};

export type BackupSettingsRow = {
  auto_enabled: boolean;
  frequency: string;
  hour: number;
  weekday: number;
  include_storage: boolean;
  retention_days: number;
  last_run_at: string | null;
  github_repo: string | null;
  github_branch: string;
  github_path: string;
};

const fmtData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const quando = (iso: string) => fmtData.format(new Date(iso));

function fmtBytes(n: number | null): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = n, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

const KIND: Record<string, string> = {
  manual: "Manual", auto: "Automático", restore: "Restauração", upload: "Enviado", github: "→ GitHub",
};
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/** Registro que representa um backup restaurável (guarda arquivos próprios). */
const ehBackup = (b: BackupRow) => b.kind === "manual" || b.kind === "auto" || b.kind === "upload";

function StatusCell({ b }: { b: BackupRow }) {
  if (b.status === "done") return <span className="font-medium text-emerald-600">Concluído</span>;
  if (b.status === "error")
    return <span className="font-medium text-rose-600" title={b.error ?? ""}>Erro</span>;
  return (
    <span className="text-text-muted">
      {b.status === "queued" ? "Na fila" : "Rodando"}
      {b.status === "running" && ` · ${b.progress}%`}
      {b.phase ? ` (${b.phase})` : ""}
    </span>
  );
}

export function BackupPanel({
  backups, settings, isOwner, githubTokenPresent,
}: {
  backups: BackupRow[];
  settings: BackupSettingsRow;
  isOwner: boolean;
  githubTokenPresent: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [supabase] = useState(() => createClient());
  const [pending, startTransition] = useTransition();
  const [jobs, setJobs] = useState<BackupRow[]>(backups);
  const [cfg, setCfg] = useState<BackupSettingsRow>(settings);
  const [gh, setGh] = useState({ repo: settings.github_repo ?? "", branch: settings.github_branch || "main", path: settings.github_path || "backups", token: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const githubOn = Boolean(settings.github_repo) && githubTokenPresent;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      const u = await criarUploadUrl();
      if (!u.ok) { toast.error(u.error); return; }
      const { error } = await supabase.storage.from("backups").uploadToSignedUrl(u.path, u.token, file);
      if (error) { toast.error("Falha no envio: " + error.message); return; }
      const r = await importarUpload(u.path);
      if (r.ok) toast.success(r.msg ?? "Enviado."); else toast.error(r.error);
      router.refresh();
    });
  }

  const ativos = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const ocupado = ativos.length > 0;

  function run(fn: () => Promise<{ ok: boolean; msg?: string; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.msg ?? "Feito.");
      else toast.error(r.error ?? "Falhou.");
      router.refresh();
    });
  }

  // Progresso ao vivo (Realtime) + rede de segurança por polling.
  useEffect(() => {
    const channel = supabase
      .channel("backup-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "backup_jobs" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setJobs((prev) => prev.filter((j) => j.id !== (payload.old as { id: string }).id));
          return;
        }
        const row = payload.new as BackupRow;
        setJobs((prev) =>
          prev.some((j) => j.id === row.id) ? prev.map((j) => (j.id === row.id ? { ...j, ...row } : j)) : [row, ...prev],
        );
        if (row.status === "done" || row.status === "error") router.refresh();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, router]);

  useEffect(() => {
    if (ativos.length === 0) return;
    let alive = true;
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("backup_jobs")
        .select("id, kind, status, progress, phase, bytes, tables_count, rows_count, files_count, error, created_at, source_backup_id")
        .order("created_at", { ascending: false }).limit(50);
      if (alive && data) setJobs(data as BackupRow[]);
    }, 2500);
    return () => { alive = false; clearInterval(t); };
  }, [ativos.length, supabase]);

  async function onRestore(b: BackupRow) {
    const ok = await confirmar({
      title: "Restaurar este backup?",
      description:
        "Isto SUBSTITUI todos os dados atuais (banco e arquivos) pelos do backup — é irreversível. " +
        "A troca acontece em uma transação: se algo falhar, nada é alterado.",
      confirmLabel: "Restaurar (substituir tudo)",
      tone: "danger",
    });
    if (ok) run(() => restaurarBackup(b.id));
  }

  async function onDelete(b: BackupRow) {
    const ok = await confirmar({
      title: "Excluir backup?",
      description: "O registro e os arquivos deste backup serão apagados.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (ok) run(() => excluirBackup(b.id));
  }

  function salvar() {
    run(() => salvarConfigBackup({
      auto_enabled: cfg.auto_enabled,
      frequency: cfg.frequency === "weekly" ? "weekly" : "daily",
      hour: cfg.hour,
      weekday: cfg.weekday,
      include_storage: cfg.include_storage,
      retention_days: cfg.retention_days,
    }));
  }

  return (
    <div className="mt-5 space-y-6">
      {/* Fazer backup */}
      <Surface elevation={1} padding="lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h2 className={eyebrowLabel}>Backup manual</h2>
            <p className="mt-1 text-sm text-text-muted">
              Gera um backup completo <strong className="font-medium">agora</strong>: todas as tabelas do banco
              (inclusive os embeddings){cfg.include_storage ? " e os arquivos enviados (imagens/anexos)" : ""}.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onPickFile} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={pending}
              title="Enviar um arquivo .zip de backup (baixado daqui) para restaurar depois">
              <Upload className="size-4" /> Enviar arquivo
            </Button>
            <Button onClick={() => run(criarBackup)} disabled={pending || ocupado}>
              <DatabaseBackup className="size-4" /> {ocupado ? "Backup em andamento…" : "Fazer backup agora"}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Cada backup também pode ser <strong className="font-medium">baixado</strong> como um único `.zip` (coluna Ações) — guarde offline ou envie para outro ambiente.
        </p>
      </Surface>

      {/* Configurações: agendador + retenção */}
      <Surface elevation={1} padding="lg">
        <h2 className={eyebrowLabel}>Backup automático e retenção</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg.auto_enabled}
              onChange={(e) => setCfg({ ...cfg, auto_enabled: e.target.checked })} />
            Fazer backup automaticamente
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg.include_storage}
              onChange={(e) => setCfg({ ...cfg, include_storage: e.target.checked })} />
            Incluir arquivos do Storage (imagens/anexos)
          </label>
          <Field label="Frequência">
            <Select value={cfg.frequency}
              onChange={(v) => setCfg({ ...cfg, frequency: v })} disabled={!cfg.auto_enabled}>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
            </Select>
          </Field>
          <Field label="Hora do dia (0–23)">
            <Input type="number" min={0} max={23} value={cfg.hour}
              onChange={(e) => setCfg({ ...cfg, hour: Number(e.target.value) })} disabled={!cfg.auto_enabled} />
          </Field>
          {cfg.frequency === "weekly" && (
            <Field label="Dia da semana">
              <Select value={String(cfg.weekday)}
                onChange={(v) => setCfg({ ...cfg, weekday: Number(v) })} disabled={!cfg.auto_enabled}>
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Guardar backups por (dias)">
            <Input type="number" min={1} max={3650} value={cfg.retention_days}
              onChange={(e) => setCfg({ ...cfg, retention_days: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={salvar} disabled={pending}><Save className="size-4" /> Salvar configurações</Button>
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
            <Clock className="size-3.5" />
            {cfg.auto_enabled
              ? `Automático: ${cfg.frequency === "weekly" ? `toda ${DIAS[cfg.weekday]?.toLowerCase()}` : "todo dia"} às ${String(cfg.hour).padStart(2, "0")}:00. Backups além de ${cfg.retention_days} dia(s) são apagados.`
              : "Backup automático desligado."}
            {settings.last_run_at ? ` Último automático: ${quando(settings.last_run_at)}.` : ""}
          </span>
        </div>
        <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-text-muted">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          O agendamento roda no <strong className="mx-1 font-medium">worker</strong> (npm run worker). Restaurar exige ser Owner.
        </p>
      </Surface>

      {/* GitHub */}
      <Surface elevation={1} padding="lg">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4" />
          <h2 className={eyebrowLabel}>Salvar/restaurar pelo GitHub</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Envie um backup para um repositório GitHub e traga de volta quando precisar. Indicado para o backup do
          <strong className="font-medium"> banco</strong> (o GitHub limita arquivos a ~100 MB — backups com muitos arquivos podem não caber).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Repositório (org/nome)">
            <Input value={gh.repo} placeholder="minha-org/backups-kb" onChange={(e) => setGh({ ...gh, repo: e.target.value })} />
          </Field>
          <Field label="Token de acesso (PAT com escopo repo)">
            <Input type="password" value={gh.token} placeholder={githubTokenPresent ? "•••••• (mantém o atual)" : "ghp_…"} onChange={(e) => setGh({ ...gh, token: e.target.value })} />
          </Field>
          <Field label="Branch">
            <Input value={gh.branch} onChange={(e) => setGh({ ...gh, branch: e.target.value })} />
          </Field>
          <Field label="Pasta no repositório">
            <Input value={gh.path} onChange={(e) => setGh({ ...gh, path: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => run(() => salvarConfigGithub(gh))} disabled={pending}>
            <Save className="size-4" /> Salvar GitHub
          </Button>
          <Button variant="secondary" onClick={() => run(importarDoGithub)} disabled={pending || !githubOn}
            title={githubOn ? "Traz o backup mais recente do repositório para a lista" : "Configure e salve o GitHub primeiro"}>
            <Download className="size-4" /> Importar do GitHub
          </Button>
          {!githubOn && <span className="text-xs text-text-muted">Salve o repositório e o token para ativar.</span>}
        </div>
      </Surface>

      {/* Relatório */}
      <Surface elevation={1} padding="lg">
        <h2 className={eyebrowLabel}>Backups realizados</h2>
        <div className="mt-4">
          <DataTable>
            <DataHead>
              <Th>Quando</Th>
              <Th>Tipo</Th>
              <Th>Tamanho</Th>
              <Th>Conteúdo</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </DataHead>
            <tbody>
              {jobs.length === 0 && <EmptyRow colSpan={6}>Nenhum backup ainda. Clique em “Fazer backup agora”.</EmptyRow>}
              {jobs.map((b) => (
                <Tr key={b.id}>
                  <Td className="whitespace-nowrap">{quando(b.created_at)}</Td>
                  <Td>{KIND[b.kind] ?? b.kind}</Td>
                  <Td className="tabular-nums">{fmtBytes(b.bytes)}</Td>
                  <Td className="text-xs text-text-muted">
                    {ehBackup(b)
                      ? `${b.tables_count ?? 0} tabelas${b.rows_count ? ` · ${(b.rows_count).toLocaleString("pt-BR")} linhas` : ""}${b.files_count ? ` · ${b.files_count} arquivos` : ""}`
                      : "—"}
                  </Td>
                  <Td><StatusCell b={b} /></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {ehBackup(b) && b.status === "done" && (
                        <>
                          <a
                            href={`/api/admin/backup/${b.id}/download`}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                            title="Baixar este backup como .zip"
                          >
                            <Download className="size-4" /> Baixar
                          </a>
                          {githubOn && (
                            <Button size="sm" variant="ghost" onClick={() => run(() => enviarParaGithub(b.id))} disabled={pending}
                              title="Enviar este backup para o GitHub">
                              <GitBranch className="size-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => onRestore(b)}
                            disabled={pending || ocupado || !isOwner}
                            title={isOwner ? "Restaurar este backup (substitui os dados atuais)" : "Apenas o Owner pode restaurar"}>
                            <RotateCcw className="size-4" /> Restaurar
                          </Button>
                        </>
                      )}
                      {b.status !== "running" && b.status !== "queued" && (
                        <Button size="sm" variant="ghost" onClick={() => onDelete(b)} disabled={pending}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </Surface>
    </div>
  );
}
