"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2 } from "lucide-react";
import { renameNode, changeSlug, updateNodeMeta } from "@/app/(admin)/admin/(app)/conteudo/actions";
import { luminaLabel } from "@/components/ui/segmented";

/**
 * Cartão de metadados do artigo (padrão Lumina): título e descrição editáveis
 * sem sair do editor, slug com gesto EXPLÍCITO (cada troca cria redirect 301
 * e recalcula caminhos — nunca em debounce). Commit no blur/Enter +
 * router.refresh() — o mesmo contrato do diálogo de propriedades da árvore,
 * que continua dono de ícone/tags/autor.
 */
export function MetadataCard({
  nodeId,
  title,
  slug,
  description,
  icon,
}: {
  nodeId: string;
  title: string;
  slug: string;
  description: string | null;
  /** Ícone atual do nó — devolvido intacto (o diálogo da árvore é o dono). */
  icon: string | null;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(title);
  const [desc, setDesc] = useState(description ?? "");
  const [slugLocal, setSlugLocal] = useState(slug);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, startTransition] = useTransition();

  function flash() {
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1600);
  }

  function commitTitulo() {
    const t = titulo.trim();
    if (!t || t === title) return setTitulo(t || title);
    startTransition(async () => {
      const r = await renameNode(nodeId, t);
      if (!r.ok) return setErro(r.error);
      setErro(null);
      flash();
      router.refresh();
    });
  }

  function commitDescricao() {
    const d = desc.trim();
    if (d === (description ?? "")) return;
    startTransition(async () => {
      const r = await updateNodeMeta(nodeId, { icon, description: d || null });
      if (!r.ok) return setErro(r.error);
      setErro(null);
      flash();
      router.refresh();
    });
  }

  function commitSlug() {
    const v = slugLocal.trim();
    if (!v || v === slug) return setSlugLocal(v || slug);
    startTransition(async () => {
      const r = await changeSlug(nodeId, v);
      if (!r.ok) return setErro(r.error);
      setErro(null);
      flash();
      router.refresh();
    });
  }

  return (
    <div className="mb-3 grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-1 lg:grid-cols-[2fr_1fr]">
      <div className="min-w-0 space-y-2">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={commitTitulo}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="Título do artigo"
          aria-label="Título do artigo"
          className="w-full border-0 bg-transparent text-xl font-semibold tracking-tight text-text placeholder:text-text-muted/50 focus:outline-none"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={commitDescricao}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="Descrição curta exibida na busca e nos cartões…"
          aria-label="Descrição do artigo"
          className="w-full border-0 bg-transparent text-sm text-text-muted placeholder:text-text-muted/50 focus:outline-none"
        />
      </div>
      <div className="min-w-0">
        <span className={`mb-1 ${luminaLabel}`}>Slug (URL)</span>
        <div className="flex items-center gap-1.5">
          <input
            value={slugLocal}
            onChange={(e) => setSlugLocal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitSlug()}
            aria-label="Slug do artigo"
            className="h-9 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {slugLocal.trim() !== slug && (
            <button
              type="button"
              onClick={commitSlug}
              disabled={pendente}
              title="Alterar o slug (cria redirect 301 do endereço antigo)"
              className="flex h-9 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50"
            >
              {pendente ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
              Alterar
            </button>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-text-muted">
          {salvo ? (
            <span className="flex items-center gap-1 font-semibold text-emerald-600">
              <Check className="size-3" /> Salvo
            </span>
          ) : slugLocal.trim() !== slug ? (
            "Trocar o slug cria um redirecionamento 301 do endereço antigo."
          ) : (
            "Título e descrição salvam ao sair do campo."
          )}
        </p>
        {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
      </div>
    </div>
  );
}
