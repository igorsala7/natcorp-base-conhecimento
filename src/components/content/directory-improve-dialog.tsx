"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutQuestionsForm, diretivasEscolhidas } from "@/components/editor/layout-questions";
import { diretivasParaDirecao, type LayoutQuestion } from "@/lib/importer/question-schema";
import {
  directoryArticleIds,
  proposeDirectoryLayoutQuestions,
  improveNodeLayoutAndSave,
  sanitizeEmptyArticles,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

type Fase = "carregando" | "vazio" | "erro" | "confirmar" | "rodando" | "concluido";

/**
 * Melhorar layout de TODOS os artigos abaixo de um diretório (recursivo), com
 * confirmação e preferências de layout (como na importação). Processa um artigo
 * por vez no navegador, mostrando progresso; nos artigos publicados a melhoria
 * vira RASCUNHO (o mesmo roteamento do editor), nada vai ao ar sem publicar.
 */
export function DirectoryImproveDialog({
  nodeId,
  title,
  onClose,
}: {
  nodeId: string;
  title: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [perguntas, setPerguntas] = useState<LayoutQuestion[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [carregandoPerg, setCarregandoPerg] = useState(false);
  const [prog, setProg] = useState({ feitos: 0, total: 0, falhas: 0, removidos: 0 });

  useEffect(() => {
    let vivo = true;
    directoryArticleIds(nodeId).then((r) => {
      if (!vivo) return;
      if (!r.ok) {
        setErro(r.error);
        setFase("erro");
      } else if (!r.ids.length) {
        setFase("vazio");
      } else {
        setIds(r.ids);
        setFase("confirmar");
      }
    });
    return () => {
      vivo = false;
    };
  }, [nodeId]);

  async function carregarPreferencias() {
    setCarregandoPerg(true);
    setErro(null);
    const r = await proposeDirectoryLayoutQuestions(nodeId);
    setCarregandoPerg(false);
    if (r.ok) {
      setPerguntas(r.perguntas);
      setRespostas({});
    } else {
      setErro(r.error);
    }
  }

  async function rodar() {
    const direcao = perguntas ? diretivasParaDirecao(diretivasEscolhidas(perguntas, respostas)) : undefined;
    setFase("rodando");
    setProg({ feitos: 0, total: ids.length, falhas: 0, removidos: 0 });
    // Saneia primeiro: remove (lixeira) os artigos VAZIOS (título duplicado sem
    // corpo). Depois re-lê a lista, pois alguns ids podem ter sido removidos.
    const san = await sanitizeEmptyArticles(nodeId);
    const removidos = san.ok ? san.removidos : 0;
    let alvo = ids;
    if (removidos > 0) {
      const rid = await directoryArticleIds(nodeId);
      if (rid.ok) { alvo = rid.ids; setIds(rid.ids); }
    }
    setProg({ feitos: 0, total: alvo.length, falhas: 0, removidos });
    let falhas = 0;
    for (let i = 0; i < alvo.length; i++) {
      const r = await improveNodeLayoutAndSave(alvo[i]!, direcao);
      if (!r.ok) falhas += 1;
      setProg({ feitos: i + 1, total: alvo.length, falhas, removidos });
    }
    setFase("concluido");
    router.refresh();
  }

  const rodando = fase === "rodando";
  const pct = prog.total ? Math.round((prog.feitos / prog.total) * 100) : 0;

  const footer =
    fase === "confirmar" ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={rodar} disabled={carregandoPerg}>
          Melhorar {ids.length} artigo{ids.length === 1 ? "" : "s"}
        </Button>
      </>
    ) : fase === "concluido" || fase === "vazio" || fase === "erro" ? (
      <Button onClick={onClose}>Fechar</Button>
    ) : null;

  return (
    <Dialog open onClose={rodando ? () => {} : onClose} title="Melhorar layout do diretório" footer={footer}>
      {fase === "carregando" && <p className="text-sm text-text-muted">Verificando artigos…</p>}

      {fase === "vazio" && (
        <p className="text-sm text-text-muted">Não há artigos neste diretório para melhorar.</p>
      )}

      {fase === "erro" && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      {fase === "confirmar" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            Vou melhorar o layout de <strong>{ids.length}</strong> artigo{ids.length === 1 ? "" : "s"} em{" "}
            <strong>“{title}”</strong> e nas subpastas. A IA reformata em blocos ricos (tabelas, passos,
            listas, avisos…) <strong>sem reescrever</strong>. Nos artigos publicados, as mudanças ficam
            como <strong>rascunho</strong> — nada vai ao ar sem você publicar.
          </p>

          {perguntas ? (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-3 text-xs font-medium text-text-muted">
                Preferências de layout (aplicadas a todos os artigos):
              </p>
              <LayoutQuestionsForm perguntas={perguntas} respostas={respostas} onChange={setRespostas} />
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={carregarPreferencias} disabled={carregandoPerg}>
              {carregandoPerg ? "Analisando…" : "Definir preferências de layout (opcional)"}
            </Button>
          )}

          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        </div>
      )}

      {(fase === "rodando" || fase === "concluido") && (
        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-sm text-text-muted">
            {rodando
              ? `Melhorando ${prog.feitos} de ${prog.total}…`
              : `Pronto: ${prog.feitos - prog.falhas} de ${prog.total} artigo(s) melhorado(s).`}
            {prog.removidos > 0 && (
              <span className="text-text-muted"> {prog.removidos} artigo(s) vazio(s) removido(s) para a lixeira.</span>
            )}
            {prog.falhas > 0 && (
              <span className="text-red-600 dark:text-red-400"> {prog.falhas} falhou(aram).</span>
            )}
          </p>
          {fase === "concluido" && (
            <p className="text-xs text-text-muted">
              Nos artigos publicados as mudanças estão como rascunho — abra cada um para revisar e publicar.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
