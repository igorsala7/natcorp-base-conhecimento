"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Heading, Image as ImageIcon, FolderPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { validateImport, applyValidation, type ValidateMode, type ValidateReport } from "./validate-actions";

type Ok = Extract<ValidateReport, { ok: true }>;
type Fase = "modo" | "validando" | "resultado" | "aplicando" | "concluido" | "erro";

const MODOS: { key: ValidateMode; label: string; desc: string }[] = [
  { key: "text", label: "Revisar texto", desc: "Verifica se faltou algum trecho do original nos artigos." },
  { key: "both", label: "Revisar texto + imagens", desc: "Verifica textos E imagens faltantes." },
  { key: "images", label: "Revisar imagens", desc: "Verifica se faltou alguma imagem do original." },
];

/**
 * "Validar conteúdo": compara o artigo gerado com o arquivo original, mostra o
 * que faltou (texto/imagens/seções) e insere o selecionado na posição certa.
 */
export function ImportValidateDialog({
  jobId,
  name,
  onClose,
}: {
  jobId: string;
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("modo");
  const [erro, setErro] = useState<string | null>(null);
  const [rel, setRel] = useState<Ok | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [improve, setImprove] = useState(true);
  const [feito, setFeito] = useState<{ inseridos: number; secoesCriadas: number } | null>(null);

  const todosIds = rel ? [...rel.text.map((t) => t.id), ...rel.images.map((i) => i.id), ...rel.sections.map((s) => s.id)] : [];

  async function validar(mode: ValidateMode) {
    setFase("validando");
    setErro(null);
    const r = await validateImport(jobId, mode);
    if (!r.ok) {
      setErro(r.error);
      setFase("erro");
      return;
    }
    setRel(r);
    setSel(new Set([...r.text.map((t) => t.id), ...r.images.map((i) => i.id), ...r.sections.map((s) => s.id)]));
    setFase("resultado");
  }

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function aplicar() {
    setFase("aplicando");
    const r = await applyValidation(jobId, { ids: [...sel], improve });
    if (!r.ok) {
      setErro(r.error);
      setFase("erro");
      return;
    }
    setFeito({ inseridos: r.inseridos, secoesCriadas: r.secoesCriadas });
    setFase("concluido");
    router.refresh();
  }

  const trabalhando = fase === "validando" || fase === "aplicando";
  const completo = rel?.complete;

  const footer =
    fase === "resultado" && !completo ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={aplicar} disabled={sel.size === 0}>
          Aplicar {sel.size} selecionado{sel.size === 1 ? "" : "s"}
        </Button>
      </>
    ) : fase === "concluido" || fase === "erro" || (fase === "resultado" && completo) ? (
      <Button onClick={onClose}>Fechar</Button>
    ) : null;

  return (
    <Dialog open onClose={trabalhando ? () => {} : onClose} title={`Validar conteúdo — ${name}`} footer={footer}>
      {fase === "modo" && (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-text-muted">
            Comparo o arquivo original importado com os artigos gerados e mostro o que faltou.
          </p>
          {MODOS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => validar(m.key)}
              className="flex w-full flex-col items-start rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-surface-2"
            >
              <span className="text-sm font-medium">{m.label}</span>
              <span className="text-xs text-text-muted">{m.desc}</span>
            </button>
          ))}
        </div>
      )}

      {fase === "validando" && (
        <p className="py-6 text-center text-sm text-text-muted">Comparando com o original…</p>
      )}
      {fase === "aplicando" && (
        <p className="py-6 text-center text-sm text-text-muted">Inserindo o conteúdo selecionado…</p>
      )}

      {fase === "erro" && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      {fase === "resultado" && completo && (
        <p className="flex items-center gap-2 py-4 text-sm">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          Está tudo completo — os artigos cobrem todo o conteúdo do original ({Math.round((rel!.completude) * 100)}
          %).
        </p>
      )}

      {fase === "resultado" && !completo && rel && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Completude atual: {Math.round(rel.completude * 100)}%. Marque o que inserir:</span>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setSel((s) => (s.size === todosIds.length ? new Set() : new Set(todosIds)))}
            >
              {sel.size === todosIds.length ? "Limpar" : "Selecionar tudo"}
            </button>
          </div>

          {rel.text.length > 0 && (
            <Grupo titulo="Texto faltante" icone={<FileText className="size-3.5" />}>
              {rel.text.map((t) => (
                <Linha key={t.id} checked={sel.has(t.id)} onToggle={() => toggle(t.id)}>
                  {t.heading && <Heading className="mt-0.5 size-3.5 shrink-0 text-primary" />}
                  <span className="line-clamp-3">{t.excerpt}</span>
                </Linha>
              ))}
            </Grupo>
          )}

          {rel.sections.length > 0 && (
            <Grupo titulo="Seções/diretórios faltantes (serão criados)" icone={<FolderPlus className="size-3.5" />}>
              {rel.sections.map((s) => (
                <Linha key={s.id} checked={sel.has(s.id)} onToggle={() => toggle(s.id)}>
                  <span className="font-medium">{s.title}</span>
                  <span className="text-text-muted">· {s.qtd} bloco(s)</span>
                </Linha>
              ))}
            </Grupo>
          )}

          {rel.images.length > 0 && (
            <Grupo titulo="Imagens faltantes" icone={<ImageIcon className="size-3.5" />}>
              <div className="grid grid-cols-4 gap-2">
                {rel.images.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggle(i.id)}
                    className={`overflow-hidden rounded-lg border-2 ${sel.has(i.id) ? "border-primary" : "border-transparent opacity-60"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </Grupo>
          )}

          <label className="flex items-center gap-2 border-t border-border pt-3 text-sm">
            <input
              type="checkbox"
              checked={improve}
              onChange={(e) => setImprove(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Melhorar o layout dos artigos afetados depois de inserir
          </label>
        </div>
      )}

      {fase === "concluido" && feito && (
        <p className="flex items-center gap-2 py-4 text-sm">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          Pronto: {feito.inseridos} item(ns) inserido(s)
          {feito.secoesCriadas > 0 && `, ${feito.secoesCriadas} seção(ões) criada(s)`}. Nos artigos publicados as
          mudanças ficaram como rascunho.
        </p>
      )}
    </Dialog>
  );
}

function Grupo({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {icone} {titulo}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Linha({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-xs leading-relaxed hover:bg-surface-2">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 accent-[var(--color-primary)]" />
      {children}
    </label>
  );
}
