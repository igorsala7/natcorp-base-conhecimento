"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { uploadToAssets } from "@/lib/content/upload";
import { detectEmbed, embedIframe, EMBED_LABELS } from "@/lib/blocks/embed";
import type { BlockEditProps } from "../edit-types";

export function ImageBlock({ block, onChange, spaceId }: BlockEditProps) {
  const b = block as Extract<Block, { type: "image" }>;
  const [busy, setBusy] = useState(false);

  async function pick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      const url = await uploadToAssets(file, spaceId);
      setBusy(false);
      if (url) onChange({ data: { ...b.data, src: url, alt: b.data.alt || file.name } } as Partial<Block>);
    };
    input.click();
  }

  if (!b.data.src) {
    return (
      <button
        type="button"
        onClick={pick}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 py-8 text-sm text-text-muted hover:border-primary hover:text-primary"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {busy ? "Enviando…" : "Enviar imagem"}
      </button>
    );
  }

  return (
    <figure className="text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.data.src} alt={b.data.alt} className="mx-auto max-h-[480px] rounded-lg" />
      <input
        value={b.data.caption}
        onChange={(e) => onChange({ data: { ...b.data, caption: e.target.value } } as Partial<Block>)}
        placeholder="Legenda (opcional)"
        className="mt-2 w-full bg-transparent text-center text-sm text-text-muted outline-none"
      />
    </figure>
  );
}

export function VideoBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "video" }>;
  return (
    <div className="rounded-lg border border-border p-3">
      <input
        value={b.data.url}
        onChange={(e) => onChange({ data: { ...b.data, url: e.target.value } } as Partial<Block>)}
        placeholder="URL do vídeo (YouTube, Vimeo)…"
        className="w-full bg-transparent text-sm outline-none"
      />
      {b.data.url && <p className="mt-1 text-xs text-text-muted">Vídeo será incorporado na publicação.</p>}
    </div>
  );
}

export function EmbedBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "embed" }>;
  const [raw, setRaw] = useState(b.data.url);

  function commit(url: string) {
    const data = detectEmbed(url);
    onChange({ data } as Partial<Block>);
  }

  const frame = embedIframe(b.data);
  return (
    <div className="rounded-lg border border-border p-3">
      <input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => commit(raw)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit(raw))}
        placeholder="Cole uma URL (Figma, Google Maps, Loom, YouTube, PDF…)"
        className="w-full bg-transparent text-sm outline-none"
      />
      {b.data.provider && b.data.url && (
        <p className="mt-1 text-xs text-text-muted">Detectado: {EMBED_LABELS[b.data.provider]}</p>
      )}
      {frame && (
        <div
          className="relative mt-2 overflow-hidden rounded-md border border-border"
          style={{ aspectRatio: frame.aspect }}
        >
          <iframe src={frame.src} title={frame.title} className="absolute inset-0 size-full" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
        </div>
      )}
    </div>
  );
}
