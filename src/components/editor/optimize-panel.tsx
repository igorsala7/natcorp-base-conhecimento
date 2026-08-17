"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Gauge, X } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import {
  auditArticle,
  type QualityContext,
  type QualityIssue,
  type Impacto,
} from "@/lib/quality/audit-article";
import { getQualityContext } from "@/app/(admin)/admin/(app)/conteudo/quality-actions";

const COR: Record<Impacto, string> = {
  alto: "bg-danger",
  medio: "bg-warning",
  baixo: "bg-brand-gray-400",
};
const ROTULO: Record<Impacto, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

/**
 * Aba "Otimizar" (padrão HubSpot): auditoria de qualidade/SEO do artigo em
 * edição — meta description, alt de imagens, títulos, links internos e
 * oportunidades de linkagem. Clicar num problema seleciona o bloco de origem.
 * A auditoria é pura e roda AQUI, sobre o conteúdo ainda não salvo; só o
 * contexto (caminhos válidos e títulos vizinhos) vem do servidor, uma vez.
 */
export function OptimizePanel({
  nodeId,
  spaceId,
  title,
  description,
  blocks,
  onSelectBlock,
  onClose,
}: {
  nodeId: string;
  spaceId: string;
  title: string;
  description: string | null;
  blocks: Block[];
  onSelectBlock: (id: string) => void;
  onClose: () => void;
}) {
  const [ctx, setCtx] = useState<QualityContext | null>(null);

  useEffect(() => {
    let alive = true;
    void getQualityContext(spaceId, nodeId).then((r) => {
      if (alive) setCtx({ validPaths: new Set(r.validPaths), otherArticles: r.otherArticles });
    });
    return () => {
      alive = false;
    };
  }, [spaceId, nodeId]);

  const issues: QualityIssue[] | null = useMemo(
    () => (ctx ? auditArticle({ title, description, blocks }, ctx) : null),
    [ctx, title, description, blocks],
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Gauge className="size-4 text-primary" /> Otimizar
          </h3>
          <p className="text-xs text-text-muted">
            {issues === null
              ? "Analisando…"
              : issues.length === 0
                ? "Nenhum problema encontrado"
                : `${issues.length} ponto(s) de atenção`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded p-1 text-text-muted hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {issues !== null && issues.length === 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-text-muted">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            Descrição, imagens, títulos e links estão em ordem.
          </p>
        )}
        <ul className="space-y-1.5">
          {(issues ?? []).map((i, idx) => {
            const conteudo = (
              <>
                <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-text-muted">
                  <span aria-hidden className={`size-1.5 rounded-full ${COR[i.impacto]}`} />
                  {ROTULO[i.impacto]}
                </span>
                <span className="mt-0.5 block text-[0.8125rem] leading-snug">{i.mensagem}</span>
              </>
            );
            return (
              <li key={idx}>
                {i.blockId ? (
                  <button
                    type="button"
                    onClick={() => onSelectBlock(i.blockId!)}
                    title="Ir para o bloco"
                    className="w-full rounded-lg border border-border p-2.5 text-left transition-colors hover:border-primary"
                  >
                    {conteudo}
                  </button>
                ) : (
                  <div className="rounded-lg border border-border p-2.5">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-2xs leading-relaxed text-text-muted">
          A descrição do artigo é editada em Propriedades (árvore) — botão de lápis. Links
          externos são verificados pelo scan da documentação em Análises.
        </p>
      </div>
    </aside>
  );
}
