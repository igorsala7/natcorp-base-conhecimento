"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Merge, Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import {
  createTag,
  deleteTag,
  mergeTags,
  renameTag,
  type TagInfo,
} from "../conteudo/tag-actions";

/**
 * Gestão de tags da documentação (padrão HubSpot): criar, renomear, excluir e
 * MESCLAR — selecionar várias e reatribuir tudo a uma tag-destino, para acabar
 * com duplicatas ("NF-e" vs "Nota fiscal") sem tocar artigo por artigo.
 */
export function TagsManager({ spaceId, initial }: { spaceId: string; initial: TagInfo[] }) {
  const router = useRouter();
  const { confirmar, pedirTexto } = useConfirm();
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [mesclando, setMesclando] = useState(false);
  const [destino, setDestino] = useState("");
  const [novo, setNovo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      setMsg(r.ok ? null : (r.error ?? "Falha."));
      router.refresh();
    });
  }

  function marcar(id: string) {
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selecionadas = initial.filter((t) => marcadas.has(t.id));

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <TagIcon className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Tags</h2>
          <p className="text-xs text-text-muted">
            Etiquetas transversais à árvore — o leitor filtra por elas no portal.
          </p>
        </div>
        {marcadas.size >= 2 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setDestino(selecionadas[0]?.id ?? "");
              setMesclando(true);
            }}
          >
            <Merge className="size-4" /> Mesclar ({marcadas.size})
          </Button>
        )}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const nome = novo.trim();
          if (!nome) return;
          setNovo("");
          run(() => createTag(spaceId, nome));
        }}
      >
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Nova tag…"
          aria-label="Nova tag"
          className={`${controlClass} h-9 max-w-60`}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !novo.trim()}>
          <Plus className="size-4" /> Criar
        </Button>
      </form>

      {msg && (
        <p role="alert" className="mt-2 rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {msg}
        </p>
      )}

      {initial.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">
          Nenhuma tag ainda. Crie aqui, ou direto nas propriedades de um artigo.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {initial.map((t) => (
            <li
              key={t.id}
              className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${
                marcadas.has(t.id)
                  ? "border-primary bg-brand-purple-50 dark:bg-brand-purple-950/40"
                  : "border-border"
              }`}
            >
              <input
                type="checkbox"
                checked={marcadas.has(t.id)}
                onChange={() => marcar(t.id)}
                aria-label={`Selecionar ${t.name} para mesclar`}
                className="size-3.5 accent-[var(--color-primary)]"
              />
              <span>{t.name}</span>
              <span className="text-xs tabular-nums text-text-muted">{t.artigos}</span>
              <button
                type="button"
                title="Renomear"
                className="text-text-muted opacity-0 hover:text-text group-hover:opacity-100"
                onClick={async () => {
                  const nome = await pedirTexto({
                    title: "Renomear tag",
                    label: "Nome",
                    initial: t.name,
                  });
                  if (nome && nome !== t.name) run(() => renameTag(t.id, nome));
                }}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                title="Excluir"
                className="text-text-muted opacity-0 hover:text-brand-pink-700 group-hover:opacity-100"
                onClick={async () => {
                  if (
                    await confirmar({
                      title: "Excluir tag",
                      description: `Excluir "${t.name}"? Ela some de ${t.artigos} artigo(s) — os artigos ficam.`,
                      tone: "danger",
                    })
                  )
                    run(() => deleteTag(t.id));
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={mesclando}
        onClose={() => !pending && setMesclando(false)}
        title="Mesclar tags"
        description="Os artigos das tags selecionadas passam todos para a tag-destino; as demais são excluídas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMesclando(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !destino}
              onClick={() =>
                run(async () => {
                  const r = await mergeTags([...marcadas], destino);
                  if (r.ok) {
                    setMarcadas(new Set());
                    setMesclando(false);
                  }
                  return r;
                })
              }
            >
              {pending ? "Mesclando…" : "Mesclar"}
            </Button>
          </>
        }
      >
        <Field label="Tag-destino" htmlFor="tag-destino">
          <select
            id="tag-destino"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className={`${controlClass} h-10`}
          >
            {selecionadas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.artigos} artigo{t.artigos === 1 ? "" : "s"})
              </option>
            ))}
          </select>
        </Field>
      </Dialog>
    </section>
  );
}
