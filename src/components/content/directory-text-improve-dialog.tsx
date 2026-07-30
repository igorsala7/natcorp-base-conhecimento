"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { wordDiff, type DiffOp } from "@/lib/content/word-diff";
import type { Criatividade } from "@/lib/ai/creativity";
import { saveArticle, sanitizeEmptyArticles, type TextoAcao, type TomAlvo } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import {
  directoryArticlesOrdered,
  proporTextoArtigo,
  proporMigracao,
  aplicarMigracao,
} from "@/app/(admin)/admin/(app)/conteudo/directory-text-actions";

type Fase = "escolha" | "processando" | "revisar" | "aplicando" | "concluido" | "vazio" | "erro";

type ItemTexto = {
  tipo: "texto";
  key: string;
  nodeId: string;
  titulo: string;
  antes: string;
  depois: string;
  doc: object;
};
type ItemMigracao = {
  tipo: "migracao";
  key: string;
  deNodeId: string;
  deTitulo: string;
  paraNodeId: string;
  paraTitulo: string;
  blocosIds: string[];
  previa: string;
  motivo: string;
};
type Item = ItemTexto | ItemMigracao;

const SUBTIPOS: { value: TextoAcao; label: string }[] = [
  { value: "reescrever", label: "Reescrever (mais claro)" },
  { value: "expandir", label: "Expandir" },
  { value: "resumir", label: "Resumir" },
  { value: "tom", label: "Mudar o tom" },
];
const TONS: { value: TomAlvo; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "tecnico", label: "Técnico" },
];
const CRIAT: { value: Criatividade; label: string }[] = [
  { value: "conservador", label: "Conservador" },
  { value: "equilibrado", label: "Equilibrado" },
  { value: "criativo", label: "Criativo" },
];

/**
 * "Melhorar texto" de TODOS os artigos abaixo de um diretório (recursivo), com
 * antes/depois por artigo e — na opção "formatação" — também detectando conteúdo
 * do fim de um artigo que pertence ao próximo. Aplica só o que o usuário marcar;
 * nos publicados vira rascunho (o roteamento seguro do saveArticle).
 */
export function DirectoryTextImproveDialog({
  nodeId,
  title,
  onClose,
}: {
  nodeId: string;
  title: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("escolha");
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<"formatar" | "melhorar">("formatar");
  const [subtipo, setSubtipo] = useState<TextoAcao>("reescrever");
  const [tomAlvo, setTomAlvo] = useState<TomAlvo>("formal");
  const [criatividade, setCriatividade] = useState<Criatividade>("equilibrado");
  const [prog, setProg] = useState({ feitos: 0, total: 0, falhas: 0 });
  const [itens, setItens] = useState<Item[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [removidos, setRemovidos] = useState(0);

  const ocupado = fase === "processando" || fase === "aplicando";

  async function rodar() {
    setErro(null);
    // Saneia primeiro: remove (lixeira) os artigos vazios (título duplicado sem corpo).
    const san = await sanitizeEmptyArticles(nodeId);
    setRemovidos(san.ok ? san.removidos : 0);
    const r = await directoryArticlesOrdered(nodeId);
    if (!r.ok) {
      setErro(r.error);
      setFase("erro");
      return;
    }
    if (!r.artigos.length) {
      setFase("vazio");
      return;
    }
    const artigos = r.artigos;
    const acao: TextoAcao = modo === "formatar" ? "formatar" : subtipo;
    const tom = acao === "tom" ? tomAlvo : undefined;
    const totalPares = modo === "formatar" ? Math.max(0, artigos.length - 1) : 0;
    setFase("processando");
    setProg({ feitos: 0, total: artigos.length + totalPares, falhas: 0 });

    const encontrados: Item[] = [];
    let feitos = 0;
    let falhas = 0;

    for (const a of artigos) {
      const p = await proporTextoArtigo(a.id, { acao, tom, criatividade });
      if (!p.ok) falhas += 1;
      else if (p.mudou) {
        encontrados.push({ tipo: "texto", key: `t:${a.id}`, nodeId: a.id, titulo: p.titulo, antes: p.antes, depois: p.depois, doc: p.doc });
      }
      setProg({ feitos: ++feitos, total: artigos.length + totalPares, falhas });
    }

    if (modo === "formatar") {
      for (let i = 0; i < artigos.length - 1; i++) {
        const m = await proporMigracao(artigos[i]!.id, artigos[i + 1]!.id);
        if (!m.ok) falhas += 1;
        else if (m.mover) {
          encontrados.push({
            tipo: "migracao",
            key: `m:${m.deNodeId}:${m.paraNodeId}`,
            deNodeId: m.deNodeId, deTitulo: m.deTitulo,
            paraNodeId: m.paraNodeId, paraTitulo: m.paraTitulo,
            blocosIds: m.blocosIds, previa: m.previa, motivo: m.motivo,
          });
        }
        setProg({ feitos: ++feitos, total: artigos.length + totalPares, falhas });
      }
    }

    setItens(encontrados);
    setSel(new Set(encontrados.map((x) => x.key)));
    setFase(encontrados.length ? "revisar" : "concluido");
  }

  async function aplicar() {
    const escolhidos = itens.filter((x) => sel.has(x.key));
    setFase("aplicando");
    setProg({ feitos: 0, total: escolhidos.length, falhas: 0 });
    let feitos = 0;
    let falhas = 0;
    for (const it of escolhidos) {
      const r =
        it.tipo === "texto"
          ? await saveArticle(it.nodeId, it.doc)
          : await aplicarMigracao(it.deNodeId, it.paraNodeId, it.blocosIds);
      if (!r.ok) falhas += 1;
      setProg({ feitos: ++feitos, total: escolhidos.length, falhas });
    }
    setProg((p) => ({ ...p, falhas }));
    setFase("concluido");
    router.refresh();
  }

  function toggle(key: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  const pct = prog.total ? Math.round((prog.feitos / prog.total) * 100) : 0;
  const nTexto = itens.filter((x) => x.tipo === "texto").length;
  const nMig = itens.filter((x) => x.tipo === "migracao").length;

  const footer =
    fase === "escolha" ? (
      <>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void rodar()}>Analisar artigos</Button>
      </>
    ) : fase === "revisar" ? (
      <>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void aplicar()} disabled={sel.size === 0}>
          Aplicar {sel.size} alteração{sel.size === 1 ? "" : "ões"}
        </Button>
      </>
    ) : fase === "concluido" || fase === "vazio" || fase === "erro" ? (
      <Button onClick={onClose}>Fechar</Button>
    ) : null;

  return (
    <Dialog
      open
      onClose={ocupado ? () => {} : onClose}
      title={`Melhorar texto — “${title}”`}
      size="lg"
      footer={footer}
    >
      {fase === "escolha" && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-text-muted">
            Vou analisar o texto de <strong>todos os artigos</strong> deste diretório e das subpastas.
            Você revê tudo antes de aplicar; nada muda no que estiver publicado até você publicar.
          </p>

          <div className="space-y-2">
            <Opcao
              ativo={modo === "formatar"}
              onClick={() => setModo("formatar")}
              titulo="Só correções de formatação"
              desc="Corrige parágrafos, gramática e frases quebradas — e detecta conteúdo do fim de um artigo que pertence ao próximo, propondo mover."
            />
            <Opcao
              ativo={modo === "melhorar"}
              onClick={() => setModo("melhorar")}
              titulo="Melhorar o texto"
              desc="Reescreve/expande/resume ou muda o tom (ex.: mais formal)."
            />
          </div>

          {modo === "melhorar" && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Grupo label="Tipo de melhoria">
                {SUBTIPOS.map((s) => (
                  <Pilula key={s.value} ativo={subtipo === s.value} onClick={() => setSubtipo(s.value)}>{s.label}</Pilula>
                ))}
              </Grupo>
              {subtipo === "tom" && (
                <Grupo label="Tom">
                  {TONS.map((t) => (
                    <Pilula key={t.value} ativo={tomAlvo === t.value} onClick={() => setTomAlvo(t.value)}>{t.label}</Pilula>
                  ))}
                </Grupo>
              )}
              <Grupo label="Criatividade">
                {CRIAT.map((c) => (
                  <Pilula key={c.value} ativo={criatividade === c.value} onClick={() => setCriatividade(c.value)}>{c.label}</Pilula>
                ))}
              </Grupo>
            </div>
          )}
        </div>
      )}

      {(fase === "processando" || fase === "aplicando") && (
        <div className="space-y-3 py-2">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-text-muted">
            {fase === "processando" ? `Analisando ${prog.feitos} de ${prog.total}…` : `Aplicando ${prog.feitos} de ${prog.total}…`}
            {prog.falhas > 0 && <span className="text-red-600 dark:text-red-400"> {prog.falhas} falha(s).</span>}
          </p>
        </div>
      )}

      {fase === "vazio" && <p className="text-sm text-text-muted">Não há artigos neste diretório.</p>}
      {fase === "erro" && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      {fase === "concluido" && (
        <p className="text-sm leading-relaxed">
          {itens.length === 0
            ? "Nenhuma alteração foi identificada — os textos já estão bons."
            : `Aplicado. Nos artigos publicados as mudanças ficaram como rascunho — abra cada um para revisar e publicar.`}
          {removidos > 0 && (
            <span className="text-text-muted"> {removidos} artigo(s) vazio(s) removido(s) para a lixeira.</span>
          )}
        </p>
      )}

      {fase === "revisar" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-text-muted">
              {nTexto} artigo(s) com texto melhorado{nMig > 0 && ` · ${nMig} sugestão(ões) de mover conteúdo`}. Marque o que aplicar.
            </p>
            <div className="flex gap-2">
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setSel(new Set(itens.map((x) => x.key)))}>Tudo</button>
              <button type="button" className="text-xs font-medium text-text-muted hover:underline" onClick={() => setSel(new Set())}>Limpar</button>
            </div>
          </div>

          <div className="space-y-3">
            {itens.map((it) => (
              <label key={it.key} className="block cursor-pointer rounded-lg border border-border p-3 hover:border-primary/40">
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={sel.has(it.key)} onChange={() => toggle(it.key)} />
                  <div className="min-w-0 flex-1">
                    {it.tipo === "texto" ? (
                      <>
                        <p className="text-sm font-medium">{it.titulo}</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <DiffCol ops={wordDiff(it.antes, it.depois)} side="a" rotulo="Antes" />
                          <DiffCol ops={wordDiff(it.antes, it.depois)} side="b" rotulo="Depois" />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          Mover o fim de “{it.deTitulo}” → início de “{it.paraTitulo}”
                        </p>
                        {it.motivo && <p className="mt-0.5 text-xs text-text-muted">{it.motivo}</p>}
                        <div className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed text-text-muted">
                          {it.previa}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function DiffCol({ ops, side, rotulo }: { ops: DiffOp[]; side: "a" | "b"; rotulo: string }) {
  return (
    <div>
      <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-text-muted">{rotulo}</p>
      <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg p-2.5 text-sm leading-relaxed">
        {ops.map((op, i) => {
          if (op.type === "eq") return <span key={i}>{op.text}</span>;
          if (op.type === "del" && side === "a")
            return <span key={i} className="rounded bg-brand-pink-100 text-brand-pink-800 line-through dark:bg-brand-pink-950/50 dark:text-brand-pink-300">{op.text}</span>;
          if (op.type === "ins" && side === "b")
            return <span key={i} className="rounded bg-brand-purple-100 text-primary dark:bg-brand-purple-950/50">{op.text}</span>;
          return null;
        })}
      </div>
    </div>
  );
}

function Opcao({ ativo, onClick, titulo, desc }: { ativo: boolean; onClick: () => void; titulo: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${ativo ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className={`size-3.5 shrink-0 rounded-full border-2 ${ativo ? "border-primary bg-primary" : "border-border"}`} />
        {titulo}
      </span>
      <span className="mt-1 block pl-6 text-xs leading-relaxed text-text-muted">{desc}</span>
    </button>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${ativo ? "border-primary bg-primary/10 text-primary" : "border-border text-text-muted hover:border-primary/40"}`}
    >
      {children}
    </button>
  );
}
