"use client";

import type { Block } from "@/lib/blocks/schema";
import { controlClass } from "@/components/ui/input";
import type { EditorActions } from "./edit-types";
import { ChartProps } from "./chart-props";
import { FlowProps } from "./flow-props";
import { DataImport } from "./data-import";
import { rowsToTable } from "@/lib/blocks/tabular";

/**
 * Propriedades ESPECÍFICAS de cada tipo de objeto — os seletores/knobs que antes
 * ficavam dentro do bloco no canvas (variante do destaque, cor do painel/hero,
 * linguagem do código, tamanho da imagem, link do botão…). O CONTEÚDO de texto
 * (o que se digita) continua editável no próprio bloco; aqui ficam só os ajustes.
 */
export function ObjectProperties({ block, actions }: { block: Block; actions: EditorActions }) {
  switch (block.type) {
    case "chart":
      return <ChartProps block={block} actions={actions} />;

    case "flow":
      return <FlowProps block={block} actions={actions} />;

    case "table": {
      const d = block.data;
      const setData = (patch: Partial<typeof d>) =>
        actions.patch(block.id, { data: { ...d, ...patch } } as Partial<Block>);
      return (
        <>
          <Grupo title="Importar dados">
            <DataImport
              onRows={(rows) => {
                const { rows: cells, hasHeader } = rowsToTable(rows);
                // Cores por célula ficam obsoletas com a nova grade — descarta.
                setData({ rows: cells, hasHeader, cellColors: undefined });
              }}
            />
            <p className="mt-1 text-[0.6875rem] text-text-muted">
              Cole do Excel/Sheets ou envie CSV/Excel — as colunas viram a tabela.
            </p>
          </Grupo>
          <Grupo title="Tabela">
            <Campo label="Primeira linha é cabeçalho">
              <Seg
                value={d.hasHeader ? "sim" : "nao"}
                options={[["sim", "Sim"], ["nao", "Não"]]}
                onChange={(v) => setData({ hasHeader: v === "sim" })}
              />
            </Campo>
            <Campo label="Bordas">
              <Seg
                value={d.borders ?? "rows"}
                options={[["all", "Grade"], ["rows", "Linhas"], ["none", "Nenhuma"]]}
                onChange={(v) => setData({ borders: v as "all" | "rows" | "none" })}
              />
            </Campo>
            <Campo label="Listras">
              <Seg
                value={d.striped === false ? "nao" : "sim"}
                options={[["sim", "Sim"], ["nao", "Não"]]}
                onChange={(v) => setData({ striped: v === "sim" })}
              />
            </Campo>
          </Grupo>
        </>
      );
    }

    case "heading": {
      const nivel = block.data.level;
      return (
        <Grupo title="Título">
          <Campo label="Nível">
            <Seg
              value={String(nivel)}
              options={[["1", "H1"], ["2", "H2"], ["3", "H3"]]}
              onChange={(v) => actions.transformHeading(block.id, Number(v) as 1 | 2 | 3)}
            />
          </Campo>
        </Grupo>
      );
    }

    case "quote":
      return (
        <Grupo title="Citação">
          <Campo label="Autor (opcional)">
            <input
              value={block.data?.author ?? ""}
              onChange={(e) =>
                actions.patch(block.id, { data: { author: e.target.value || undefined } } as Partial<Block>)
              }
              placeholder="Quem disse"
              className={`${controlClass} px-2`}
            />
          </Campo>
        </Grupo>
      );

    case "callout":
      return (
        <Grupo title="Destaque">
          <Campo label="Tipo">
            <Seg
              value={block.data.variant}
              options={[
                ["info", "Nota"], ["success", "Dica"], ["warning", "Atenção"],
                ["danger", "Cuidado"], ["note", "Observação"],
              ]}
              onChange={(v) => actions.patch(block.id, { data: { ...block.data, variant: v as typeof block.data.variant } } as Partial<Block>)}
            />
          </Campo>
        </Grupo>
      );

    case "panel":
      return (
        <Grupo title="Painel">
          <Campo label="Cor de fundo">
            <Seg
              value={block.data.bg}
              options={[["purple", "Roxo"], ["pink", "Rosa"], ["blue", "Azul"], ["gray", "Cinza"]]}
              onChange={(v) => actions.patch(block.id, { data: { bg: v as typeof block.data.bg } } as Partial<Block>)}
            />
          </Campo>
        </Grupo>
      );

    case "hero":
      return (
        <Grupo title="Banner">
          <Campo label="Cor de fundo">
            <Seg
              value={block.data.bg}
              options={[["purple", "Roxo"], ["blue", "Azul"], ["gray", "Cinza"], ["dark", "Escuro"]]}
              onChange={(v) => actions.patch(block.id, { data: { ...block.data, bg: v as typeof block.data.bg } } as Partial<Block>)}
            />
          </Campo>
        </Grupo>
      );

    case "button":
      return (
        <Grupo title="Botão">
          <Campo label="Estilo">
            <Seg
              value={block.data.variant}
              options={[["primary", "Primário"], ["secondary", "Secundário"]]}
              onChange={(v) => actions.patch(block.id, { data: { ...block.data, variant: v as typeof block.data.variant } } as Partial<Block>)}
            />
          </Campo>
          <Campo label="Link">
            <input
              value={block.data.href}
              onChange={(e) => actions.patch(block.id, { data: { ...block.data, href: e.target.value } } as Partial<Block>)}
              placeholder="/docs/… ou https://…"
              className={`${controlClass} px-2`}
            />
          </Campo>
        </Grupo>
      );

    case "card":
      return (
        <Grupo title="Card">
          <Campo label="Link (opcional)">
            <input
              value={block.data.href ?? ""}
              onChange={(e) => actions.patch(block.id, { data: { ...block.data, href: e.target.value || undefined } } as Partial<Block>)}
              placeholder="/docs/… ou https://…"
              className={`${controlClass} px-2`}
            />
          </Campo>
        </Grupo>
      );

    case "spacer":
      return (
        <Grupo title="Espaçador">
          <Campo label="Altura">
            <Seg
              value={block.data.size}
              options={[["sm", "Pequeno"], ["md", "Médio"], ["lg", "Grande"]]}
              onChange={(v) => actions.patch(block.id, { data: { size: v as typeof block.data.size } } as Partial<Block>)}
            />
          </Campo>
        </Grupo>
      );

    case "code":
      return (
        <Grupo title="Código">
          <Campo label="Linguagem">
            <input
              value={block.data.language ?? ""}
              onChange={(e) => actions.patch(block.id, { data: { ...block.data, language: e.target.value || null } } as Partial<Block>)}
              placeholder="ts, sql, bash…"
              className={`${controlClass} px-2`}
            />
          </Campo>
          <Campo label="Nome do arquivo (opcional)">
            <input
              value={block.data.filename ?? ""}
              onChange={(e) => actions.patch(block.id, { data: { ...block.data, filename: e.target.value || undefined } } as Partial<Block>)}
              placeholder="ex.: config.json"
              className={`${controlClass} px-2`}
            />
          </Campo>
        </Grupo>
      );

    case "image":
      return (
        <Grupo title="Imagem">
          <Campo label="Tamanho">
            <Seg
              value={block.data.size ?? "natural"}
              options={[["natural", "Natural"], ["wide", "Ampla"], ["medium", "Média"]]}
              onChange={(v) =>
                actions.patch(block.id, {
                  data: { ...block.data, size: v === "natural" ? undefined : (v as "wide" | "medium") },
                } as Partial<Block>)
              }
            />
          </Campo>
          <Campo label="Legenda (opcional)">
            <input
              value={block.data.caption}
              onChange={(e) => actions.patch(block.id, { data: { ...block.data, caption: e.target.value } } as Partial<Block>)}
              placeholder="Legenda da imagem"
              className={`${controlClass} px-2`}
            />
          </Campo>
          <Campo label="Texto alternativo (acessibilidade)">
            <input
              value={block.data.alt}
              onChange={(e) => actions.patch(block.id, { data: { ...block.data, alt: e.target.value } } as Partial<Block>)}
              placeholder="Descreva a imagem"
              className={`${controlClass} px-2`}
            />
          </Campo>
        </Grupo>
      );

    case "cardGrid":
      return (
        <Grupo title="Grade de cards">
          <Campo label="Colunas">
            <Seg
              value={String(block.data.cols || 3)}
              options={[["2", "2"], ["3", "3"], ["4", "4"]]}
              onChange={(v) => actions.patch(block.id, { data: { cols: Number(v) } } as Partial<Block>)}
            />
          </Campo>
        </Grupo>
      );

    default:
      return null;
  }
}

function Grupo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</h4>
      {children}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-muted">{label}</label>
      {children}
    </div>
  );
}

function Seg({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`rounded-md border px-2 py-1 text-xs ${
            value === val ? "border-primary text-primary" : "border-border text-text-muted hover:bg-surface-2"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
