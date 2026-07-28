import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hostEhSeguro } from "@/lib/ai/web-fetch";
import type { MediaRef } from "@/lib/studio/media";

/**
 * Baixa imagens de uma página e as RE-HOSPEDA no bucket público `assets`
 * (dedup por checksum), devolvendo `MediaRef`s. Assim a IA insere a imagem por
 * um id curto (`[[media:id]]`), sem hotlink e sem inventar URLs longas. Só
 * imagens de verdade (content-type de imagem, ≥ 1 KB, ≤ 8 MB); trava SSRF no host.
 */

const MAX_IMG_BYTES = 8_000_000;
const MIN_IMG_BYTES = 1024; // abaixo disso costuma ser ícone/pixel de rastreio
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

async function baixarImagem(url: string): Promise<{ bytes: Buffer; mime: string } | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!(await hostEhSeguro(u.hostname))) return null;
  let resp: Response;
  try {
    resp = await fetch(u, { signal: AbortSignal.timeout(8000), redirect: "follow" });
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  const mime = (resp.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!EXT[mime]) return null;
  const ab = await resp.arrayBuffer();
  if (ab.byteLength < MIN_IMG_BYTES || ab.byteLength > MAX_IMG_BYTES) return null;
  return { bytes: Buffer.from(ab), mime };
}

export async function reHospedarImagens(
  spaceId: string,
  imagens: { url: string; alt: string }[],
  limite = 8,
): Promise<MediaRef[]> {
  const supabase = createAdminClient();
  const candidatas = imagens.slice(0, limite);
  const resultados = await Promise.all(
    candidatas.map(async (img): Promise<MediaRef | null> => {
      const baixada = await baixarImagem(img.url);
      if (!baixada) return null;
      const checksum = createHash("sha256").update(baixada.bytes).digest("hex");
      const path = `${spaceId}/web/${checksum}.${EXT[baixada.mime]}`;
      const { error } = await supabase.storage
        .from("assets")
        .upload(path, baixada.bytes, { contentType: baixada.mime, upsert: true });
      const url = error ? "" : supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
      if (!url) return null;
      return {
        id: randomUUID().replace(/-/g, "").slice(0, 8),
        kind: "image",
        url,
        name: img.alt || "Imagem da página",
        alt: img.alt,
      };
    }),
  );
  return resultados.filter((m): m is MediaRef => m !== null);
}
