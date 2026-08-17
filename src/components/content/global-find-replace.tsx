"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Replace, FileText, CornerDownRight, Loader2, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useLoader } from "@/components/ui/loader";
import { useConfirm } from "@/components/ui/confirm";
import {
  findInSpace,
  replaceInSpace,
  type FindHit,
} from "@/app/(admin)/admin/(app)/conteudo/find-replace-actions";

/**
 * Localizar e substituir na documentação INTEIRA (todos os artigos do espaço).
 * Busca traz a lista resumida dos artigos com o termo (título · caminho · nº ·
 * trecho); clicar num item abre o artigo. A troca respeita o fluxo do editor:
 * publicado → rascunho pendente; rascunho → direto.
 */
export function GlobalFindReplace({
  spaceId,
  open,
  onClose,
}: {
  spaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const loader = useLoader();
  const { confirmar } = useConfirm();

  const [term, setTerm] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [hits, setHits] = useState<FindHit[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());

  function reset() {
    setBuscou(false);
    setHits([]);
    setTotalMatches(0);
    setSel(new Set());
  }

  async function buscar() {
    const q = term.trim();
    if (q.length < 2) {
      toast.info("Digite ao menos 2 caracteres para buscar.");
      return;
    }
    setBuscando(true);
    const r = await findInSpace(spaceId, q, { caseSensitive });
    setBuscando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setHits(r.hits);
    setTotalMatches(r.totalMatches);
    setSel(new Set(r.hits.map((h) => h.nodeId)));
    setBuscou(true);
  }

  function irParaArtigo(nodeId: string) {
    onClose();
    router.push(`/admin/conteudo/${nodeId}`);
  }

  function alternar(nodeId: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  const todosMarcados = hits.length > 0 && sel.size === hits.length;
  function alternarTodos() {
    setSel(todosMarcados ? new Set() : new Set(hits.map((h) => h.nodeId)));
  }

  async function substituir() {
    const q = term.trim();
    if (q.length < 2) return;
    if (replacement === q) {
      toast.info("O texto de substituição é igual ao buscado.");
      return;
    }
    const alvos = hits.filter((h) => sel.has(h.nodeId));
    if (!alvos.length) {
      toast.info("Selecione ao menos um artigo.");
      return;
    }
    const totalSel = alvos.reduce((s, h) => s + h.count, 0);
    const ok = await confirmar({
      title: `Substituir em ${alvos.length} artigo(s)?`,
      description: `Trocar “${q}” por “${replacement || "(vazio)"}” em ${totalSel} ocorrência(s). Artigos publicados viram rascunho pendente — o site só muda quando você publicar.`,
      confirmLabel: "Substituir",
    });
    if (!ok) return;

    await loader.during("Substituindo na documentação…", async () => {
      const r = await replaceInSpace(spaceId, q, replacement, {
        caseSensitive,
        nodeIds: alvos.map((h) => h.nodeId),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const partes = [`${r.ocorrencias} ocorrência(s) trocada(s) em ${r.artigos} artigo(s)`];
      if (r.rascunhos) partes.push(`${r.rascunhos} viraram rascunho pendente (use “Publicar rascunhos”)`);
      if (r.erros) partes.push(`${r.erros} falharam`);
      toast.success(partes.join(" · "));
      router.refresh();
      // Rebusca para refletir o estado atual (o que sobrou / drafts).
      await buscar();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Localizar e substituir na documentação"
      description="Procura o termo em todos os artigos deste espaço e troca de uma vez."
      size="xl"
    >
      <div className="space-y-3">
        {/* Linha de busca */}
        <div className="flex items-center gap-2">
          <SearchInput
            autoFocus
            value={term}
            onChange={(v) => {
              setTerm(v);
              if (buscou) reset();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscar();
              }
            }}
            label="Localizar em todos os artigos"
            placeholder="Localizar…"
            wrapperClassName="flex-1"
          />
          <button
            type="button"
            onClick={() => setCaseSensitive((v) => !v)}
            title="Diferenciar maiúsculas de minúsculas"
            aria-pressed={caseSensitive}
            className={`h-9 rounded-md border px-2.5 text-sm font-medium transition-colors ${
              caseSensitive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-text-muted hover:bg-surface-2"
            }`}
          >
            Aa
          </button>
          <Button variant="secondary" onClick={() => void buscar()} disabled={buscando}>
            {buscando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Buscar
          </Button>
        </div>

        {/* Resultados */}
        <div className="min-h-[8rem] max-h-[46vh] overflow-y-auto rounded-lg border border-border">
          {!buscou ? (
            <p className="p-6 text-center text-sm text-text-muted">
              Digite um termo e clique em <strong>Buscar</strong> para ver os artigos que o contêm.
            </p>
          ) : hits.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-muted">
              Nenhum artigo contém “{term.trim()}”.
            </p>
          ) : (
            <div>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface-2/80 px-3 py-2 backdrop-blur">
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  <span>
                    <strong className="text-text">{totalMatches}</strong> ocorrência(s) em{" "}
                    <strong className="text-text">{hits.length}</strong> artigo(s)
                  </span>
                </label>
                <span className="text-xs text-text-muted">{sel.size} selecionado(s)</span>
              </div>
              <ul className="divide-y divide-border">
                {hits.map((h) => (
                  <li key={h.nodeId} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-surface-2/50">
                    <input
                      type="checkbox"
                      checked={sel.has(h.nodeId)}
                      onChange={() => alternar(h.nodeId)}
                      className="mt-0.5 size-4 accent-[var(--color-primary)]"
                      aria-label={`Incluir ${h.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => irParaArtigo(h.nodeId)}
                      className="min-w-0 flex-1 text-left"
                      title="Abrir o artigo"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-text-muted" />
                        <span className="truncate font-medium text-text hover:text-primary hover:underline">
                          {h.title || "(sem título)"}
                        </span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-semibold text-primary">
                          {h.count}
                        </span>
                        {h.hasDraft && (
                          <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-2xs font-medium text-warning">
                            rascunho
                          </span>
                        )}
                      </div>
                      {h.path && (
                        <div className="mt-0.5 truncate pl-6 text-xs text-text-muted">{h.path}</div>
                      )}
                      <div className="mt-1 flex items-start gap-1 pl-6 text-xs text-text-muted">
                        <CornerDownRight className="mt-0.5 size-3.5 shrink-0" />
                        <span className="truncate font-mono">
                          {h.snippetBefore}
                          <mark className="rounded bg-warning-soft px-0.5 text-text">
                            {h.snippetMatch}
                          </mark>
                          {h.snippetAfter}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Substituição */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Replace className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Substituir por… (deixe vazio para remover o termo)"
              className="pl-8"
            />
          </div>
          <Button onClick={() => void substituir()} disabled={!buscou || sel.size === 0}>
            <Replace className="size-4" /> Substituir selecionados ({sel.size})
          </Button>
        </div>

        <p className="text-xs text-text-muted">
          Busca e troca no texto de parágrafos, títulos, listas e citações (inclusive aninhados).
          Conteúdo de <strong>tabelas e checklists</strong> não é incluído nesta versão. Títulos de
          artigos/pastas não são alterados.
        </p>
      </div>
    </Dialog>
  );
}
