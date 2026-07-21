"use client";

import { useState } from "react";
import { Film, ImagePlus, Loader2 } from "lucide-react";
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

/** Extensões de vídeo aceitas por arquivo (o render usa <video controls>). */
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v";
const VIDEO_MAX_MB = 100;

/** Detecta o provedor a partir da URL — colar link e enviar arquivo convivem. */
function detectarProvedorVideo(url: string): "youtube" | "vimeo" | "upload" {
  if (/youtu\.?be/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url)) return "upload";
  return "youtube";
}

export function VideoBlock({ block, onChange, spaceId }: BlockEditProps) {
  const b = block as Extract<Block, { type: "video" }>;
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function pick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = VIDEO_ACCEPT;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setErro(null);
      if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
        setErro(`Arquivo com ${Math.round(file.size / 1024 / 1024)} MB — o limite é ${VIDEO_MAX_MB} MB. Para vídeos grandes, hospede no YouTube/Vimeo e cole o link.`);
        return;
      }
      setBusy(true);
      const url = await uploadToAssets(file, spaceId);
      setBusy(false);
      if (url) onChange({ data: { provider: "upload", url } } as Partial<Block>);
      else setErro("Falha no envio do vídeo. Tente novamente.");
    };
    input.click();
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <input
          value={b.data.url}
          onChange={(e) => {
            const url = e.target.value;
            onChange({ data: { provider: detectarProvedorVideo(url), url } } as Partial<Block>);
          }}
          placeholder="URL do vídeo (YouTube, Vimeo)…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          title={`Enviar arquivo de vídeo (.mp4, .mov, .webm — até ${VIDEO_MAX_MB} MB)`}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Film className="size-3.5" />}
          {busy ? "Enviando…" : "Enviar arquivo"}
        </button>
      </div>
      {erro && <p className="mt-1.5 text-xs text-brand-pink-700">{erro}</p>}
      {/* Prévia real do arquivo enviado — link externo continua só na publicação. */}
      {b.data.url && b.data.provider === "upload" && (
        <video src={b.data.url} controls preload="metadata" className="mt-2 max-h-72 w-full rounded-md" />
      )}
      {b.data.url && b.data.provider !== "upload" && (
        <p className="mt-1 text-xs text-text-muted">Vídeo será incorporado na publicação.</p>
      )}
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
