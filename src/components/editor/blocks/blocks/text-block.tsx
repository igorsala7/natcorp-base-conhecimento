"use client";

import type { Block, RichText as RT, HeadingLevel } from "@/lib/blocks/schema";
import { RichText } from "../rich-text/rich-text";
import type { BlockEditProps } from "../edit-types";

/**
 * Parágrafo / citação — usa a MESMA tag semântica do portal (p / blockquote)
 * dentro do contexto `.prose prose-portal`, então o texto aparece idêntico ao
 * que o usuário final vê.
 */
export function TextBlock({ block, onChange, ...rest }: BlockEditProps) {
  const b = block as Extract<Block, { type: "paragraph" | "quote" }>;
  return (
    <RichText
      tag={b.type === "quote" ? "blockquote" : "p"}
      value={b.text}
      onChange={(text: RT) => onChange({ text } as Partial<Block>)}
      placeholder={b.type === "quote" ? "Citação…" : "Escreva, ou tecle “/” para inserir blocos…"}
      autoFocus={rest.autoFocus}
      onEnter={rest.onEnter}
      onEmptyBackspace={rest.onEmptyBackspace}
      onSlash={rest.onSlash}
      registerHandle={rest.registerHandle}
    />
  );
}

/** Título com seletor de nível (H1/H2/H3). Renderiza a tag h1/h2/h3 real. */
export function HeadingBlock({ block, onChange, ...rest }: BlockEditProps) {
  const b = block as Extract<Block, { type: "heading" }>;
  const level = b.data.level;
  return (
    <div className="group/heading relative">
      <div className="absolute -left-14 top-1 hidden gap-0.5 group-focus-within/heading:flex">
        {([1, 2, 3] as HeadingLevel[]).map((l) => (
          <button
            key={l}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange({ data: { level: l } } as Partial<Block>)}
            className={`flex size-6 items-center justify-center rounded text-xs font-semibold ${
              level === l ? "bg-primary text-primary-fg" : "text-text-muted hover:bg-surface-2"
            }`}
          >
            H{l}
          </button>
        ))}
      </div>
      <RichText
        tag={`h${level}` as "h1" | "h2" | "h3"}
        value={b.text}
        onChange={(text: RT) => onChange({ text } as Partial<Block>)}
        placeholder={`Título ${level}`}
        autoFocus={rest.autoFocus}
        onEnter={rest.onEnter}
        onEmptyBackspace={rest.onEmptyBackspace}
        onSlash={rest.onSlash}
        registerHandle={rest.registerHandle}
      />
    </div>
  );
}
