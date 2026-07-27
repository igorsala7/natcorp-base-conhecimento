"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea que CRESCE com o conteúdo conforme as linhas, até `maxLines` linhas
 * de aumento; a partir daí, rola por dentro. Usada nas caixas de mensagem dos
 * assistentes de IA (Estúdio, chat do editor, assistente do portal, teste RAG).
 *
 * A altura mínima vem do CSS (`min-h-*` na `className`); o teto é
 * `min + maxLines * lineHeight`. Reajusta a cada mudança de `value`.
 */
export const AutoGrowTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { maxLines?: number }
>(function AutoGrowTextarea({ maxLines = 5, className, value, ...rest }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement, []);

  useEffect(() => {
    const ta = inner.current;
    if (!ta) return;
    ta.style.height = "auto";
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 || 20;
    const min = parseFloat(cs.minHeight) || 0;
    const max = min + lh * maxLines;
    const alvo = Math.min(Math.max(ta.scrollHeight, min || ta.scrollHeight), max);
    ta.style.height = `${alvo}px`;
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
  }, [value, maxLines]);

  return (
    <textarea
      ref={inner}
      value={value}
      className={cn("resize-none", className)}
      {...rest}
    />
  );
});
