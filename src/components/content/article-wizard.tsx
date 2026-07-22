"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Block } from "@/lib/blocks/schema";
import { newId } from "@/lib/blocks/schema";
import {
  extractWizardContext,
  generateOutline,
  generateSection,
  type Outline,
} from "@/app/(admin)/admin/(app)/conteudo/generate-actions";
import { createNode } from "@/app/(admin)/admin/(app)/conteudo/actions";
import { saveArticle } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import { listSpaceFolders } from "@/app/(admin)/admin/(app)/conteudo/space-actions";

type Passo = "tema" | "outline" | "gerando";

/**
 * Wizard "Artigo com IA" (padrão Breeze/HubSpot em etapas): tema e contexto →
 * outline EDITÁVEL (renomear, reordenar, remover — o autor manda na estrutura)
 * → corpo gerado seção a seção com progresso → artigo criado como RASCUNHO.
 */
export function ArticleWizard({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>("tema");
  const [tema, setTema] = useState("");
  const [publico, setPublico] = useState("");
  const [contexto, setContexto] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [parentId, setParentId] = useState("__root__");
  const [folders, setFolders] = useState<{ id: string; title: string; depth: number }[]>([]);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let alive = true;
    void listSpaceFolders(spaceId).then((f) => alive && setFolders(f));
    return () => {
      alive = false;
    };
  }, [spaceId]);

  function anexarArquivo() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.md,.markdown,.html,.txt";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        setErro("Arquivo acima de 10 MB — use a Importação para documentos grandes.");
        return;
      }
      setExtraindo(true);
      setErro(null);
      const supabase = createClient();
      const path = `${spaceId}/wizard-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("imports").upload(path, file);
      if (error) {
        setErro(`Falha no upload: ${error.message}`);
        setExtraindo(false);
        return;
      }
      const r = await extractWizardContext({ spaceId, path, name: file.name, mime: file.type || null });
      setExtraindo(false);
      if (!r.ok) return setErro(r.error);
      setContexto((c) => (c ? `${c}\n\n` : "") + r.data);
    };
    input.click();
  }

  async function gerarOutline() {
    setOcupado(true);
    setErro(null);
    const r = await generateOutline({ spaceId, tema: tema.trim(), publico: publico.trim(), contexto });
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    setOutline(r.data);
    setPasso("outline");
  }

  function mudarSecao(i: number, patch: Partial<Outline["secoes"][number]>) {
    setOutline((o) =>
      o ? { ...o, secoes: o.secoes.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : o,
    );
  }
  function moverSecao(i: number, delta: -1 | 1) {
    setOutline((o) => {
      if (!o) return o;
      const secoes = [...o.secoes];
      const j = i + delta;
      if (j < 0 || j >= secoes.length) return o;
      [secoes[i], secoes[j]] = [secoes[j]!, secoes[i]!];
      return { ...o, secoes };
    });
  }

  async function gerarArtigo() {
    if (!outline) return;
    setPasso("gerando");
    setErro(null);
    const blocks: Block[] = [];
    const jaEscritas: string[] = [];
    for (let i = 0; i < outline.secoes.length; i++) {
      const secao = outline.secoes[i]!;
      setProgresso(`Escrevendo ${i + 1}/${outline.secoes.length}: ${secao.titulo}`);
      const r = await generateSection({
        spaceId,
        tema: tema.trim(),
        publico: publico.trim(),
        contexto,
        tituloArtigo: outline.titulo,
        secao,
        jaEscritas,
      });
      blocks.push({ id: newId(), type: "heading", text: [{ text: secao.titulo }], data: { level: 2 } });
      if (r.ok) {
        blocks.push(...r.data);
        jaEscritas.push(secao.titulo);
      } else {
        // A seção que falhou vira placeholder — o autor completa no editor.
        blocks.push({ id: newId(), type: "paragraph", text: [{ text: `[COMPLETAR — ${r.error}]` }] });
      }
    }

    setProgresso("Criando o rascunho…");
    const criado = await createNode({
      spaceId,
      parentId: parentId === "__root__" ? null : parentId,
      type: "article",
      title: outline.titulo,
    });
    if (!criado.ok || !criado.id) {
      setErro(!criado.ok ? criado.error : "Falha ao criar o artigo.");
      setPasso("outline");
      setProgresso(null);
      return;
    }
    await saveArticle(criado.id, { version: 2, blocks });
    router.push(`/admin/conteudo/${criado.id}`);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={() => passo !== "gerando" && onClose()}
      size="lg"
      title="Artigo com IA"
      description={
        passo === "tema"
          ? "Descreva o tema; a IA propõe a estrutura e VOCÊ decide antes de qualquer texto."
          : passo === "outline"
            ? "Ajuste a estrutura: renomeie, reordene ou corte seções. O corpo só é escrito depois do seu OK."
            : "Escrevendo seção a seção — o resultado nasce como rascunho, nada é publicado."
      }
      footer={
        passo === "tema" ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={ocupado || tema.trim().length < 4} onClick={gerarOutline}>
              {ocupado ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Propondo estrutura…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Propor estrutura
                </>
              )}
            </Button>
          </>
        ) : passo === "outline" ? (
          <>
            <Button variant="ghost" onClick={() => setPasso("tema")}>
              Voltar
            </Button>
            <Button disabled={!outline || outline.secoes.length === 0} onClick={gerarArtigo}>
              <Sparkles className="size-4" /> Gerar rascunho ({outline?.secoes.length ?? 0} seções)
            </Button>
          </>
        ) : null
      }
    >
      {passo === "tema" && (
        <div className="space-y-4">
          <Field label="Tema do artigo" htmlFor="wiz-tema">
            <textarea
              id="wiz-tema"
              rows={2}
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex.: Como emitir nota fiscal de serviço no módulo Financeiro"
              className={controlClass}
              autoFocus
            />
          </Field>
          <Field label="Público-alvo (opcional)" htmlFor="wiz-publico">
            <Input
              id="wiz-publico"
              value={publico}
              onChange={(e) => setPublico(e.target.value)}
              placeholder="Ex.: operadores do financeiro, sem conhecimento técnico"
            />
          </Field>
          <Field label="Onde criar" htmlFor="wiz-pasta">
            <select
              id="wiz-pasta"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={`${controlClass} h-10`}
            >
              <option value="__root__">Raiz da documentação</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {"— ".repeat(f.depth)}
                  {f.title}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Material de referência (opcional)"
            htmlFor="wiz-contexto"
            hint="A IA usa este material como única fonte de fatos. Sem ele, a estrutura sai genérica com [COMPLETAR]."
          >
            <textarea
              id="wiz-contexto"
              rows={4}
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Cole trechos, anotações, e-mails…"
              className={controlClass}
            />
          </Field>
          <Button size="sm" variant="secondary" onClick={anexarArquivo} disabled={extraindo}>
            {extraindo ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Extraindo…
              </>
            ) : (
              <>
                <FileUp className="size-4" /> Anexar arquivo (PDF, DOCX…)
              </>
            )}
          </Button>
        </div>
      )}

      {passo === "outline" && outline && (
        <div className="space-y-3">
          <Field label="Título do artigo" htmlFor="wiz-titulo">
            <Input
              id="wiz-titulo"
              value={outline.titulo}
              onChange={(e) => setOutline({ ...outline, titulo: e.target.value })}
            />
          </Field>
          <ul className="space-y-2">
            {outline.secoes.map((s, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5">
                  <input
                    value={s.titulo}
                    onChange={(e) => mudarSecao(i, { titulo: e.target.value })}
                    aria-label={`Título da seção ${i + 1}`}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                  />
                  <button type="button" title="Subir" className="rounded p-1 text-text-muted hover:bg-surface-2 disabled:opacity-30" disabled={i === 0} onClick={() => moverSecao(i, -1)}>
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" title="Descer" className="rounded p-1 text-text-muted hover:bg-surface-2 disabled:opacity-30" disabled={i === outline.secoes.length - 1} onClick={() => moverSecao(i, 1)}>
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Remover seção"
                    className="rounded p-1 text-text-muted hover:text-brand-pink-700"
                    onClick={() =>
                      setOutline({ ...outline, secoes: outline.secoes.filter((_, j) => j !== i) })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {s.pontos.length > 0 && (
                  <p className="mt-1 text-xs text-text-muted">{s.pontos.join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {passo === "gerando" && (
        <p className="flex items-center gap-2.5 py-6 text-sm text-text-muted">
          <Loader2 className="size-5 animate-spin text-primary" /> {progresso ?? "Preparando…"}
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {erro}
        </p>
      )}
    </Dialog>
  );
}
