"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FilePlus2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import type { SpaceInfo } from "@/lib/content/spaces";
import { createSpace, type NewSpaceMode } from "@/app/(admin)/admin/(app)/conteudo/space-actions";

const MODES: { key: NewSpaceMode; icon: typeof FilePlus2; label: string; desc: string }[] = [
  {
    key: "empty",
    icon: FilePlus2,
    label: "Vazia",
    desc: "Começa do zero, sem nenhum conteúdo.",
  },
  {
    key: "inherit",
    icon: GitBranch,
    label: "Herdar de outra",
    desc: "Reflete os diretórios e artigos da origem. Se a origem mudar, a mudança aparece aqui — exceto no que você customizar ou ocultar.",
  },
  {
    key: "copy",
    icon: Copy,
    label: "Cópia editável",
    desc: "Copia diretórios e artigos uma vez. Fica independente: mudanças na origem NÃO aparecem aqui.",
  },
];

export function NewSpaceDialog({
  spaces,
  onClose,
}: {
  spaces: SpaceInfo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<NewSpaceMode>("empty");
  const [sourceId, setSourceId] = useState(spaces[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const precisaOrigem = mode === "inherit" || mode === "copy";
  // Copiar o layout vem marcado quando já há uma origem escolhida: quem herda
  // ou copia conteúdo quase sempre quer a mesma cara.
  const [copiarLayout, setCopiarLayout] = useState(true);

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const res = await createSpace({
        name,
        mode,
        sourceSpaceId: precisaOrigem ? sourceId : null,
        // Vale para os três modos: dá para nascer vazia já com a marca de outra.
        copyLayoutFromSpaceId: copiarLayout && sourceId ? sourceId : null,
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      onClose();
      router.push(`/admin/conteudo?space=${res.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Nova documentação"
      description="Escolha como o conteúdo inicial será formado."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim() || (precisaOrigem && !sourceId)}>
            {pending ? "Criando…" : "Criar documentação"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nome" htmlFor="space-nome" required>
          <Input
            id="space-nome"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Documentação do Cliente A"
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text">Como começar</legend>
          <div className="space-y-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const ativo = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setMode(m.key)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    ativo
                      ? "border-primary bg-brand-purple-50 dark:bg-brand-purple-950/30"
                      : "border-border hover:bg-surface-2"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 size-4 shrink-0 ${ativo ? "text-primary" : "text-text-muted"}`}
                  />
                  <span>
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs leading-relaxed text-text-muted">{m.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {precisaOrigem && (
          <Field
            label="Documentação de origem"
            htmlFor="space-origem"
            required
            hint={
              mode === "inherit"
                ? "O vínculo permanece: alterações na origem continuam refletindo aqui."
                : "A cópia é feita uma única vez e segue independente."
            }
          >
            <select
              id="space-origem"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className={`${controlClass} h-10`}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Aparência da home. Fica disponível também no modo "Vazia": criar uma
            documentação sem conteúdo mas já com a marca de outra é o caso real
            de quem abre a documentação de um produto novo. */}
        {spaces.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={copiarLayout}
                onChange={(e) => setCopiarLayout(e.target.checked)}
                className="mt-1 accent-[var(--color-primary)]"
              />
              <span>
                <span className="font-medium">Copiar as configurações de layout da home</span>
                <span className="block text-xs leading-relaxed text-text-muted">
                  Cor da marca, logo, cabeçalho, textos e quais regiões aparecem. É um retrato:
                  você edita depois em Aparência, sem afetar a origem.
                </span>
              </span>
            </label>

            {copiarLayout && !precisaOrigem && (
              <Field label="Copiar o layout de" htmlFor="space-layout" className="mt-3">
                <select
                  id="space-layout"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className={`${controlClass} h-10`}
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {msg && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {msg}
          </p>
        )}
      </div>
    </Dialog>
  );
}
