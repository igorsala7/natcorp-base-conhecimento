import "server-only";
import { assertArquivoSeguro, ehImagem, EXT_EXTRAI } from "@/lib/importer/file-guard";
import { extractDocument } from "@/lib/importer/extract";
import { decodeBytesToText } from "./core";
import type { ImagePart, FilePart } from "@/lib/chat/attachment-store";

export type ArquivoIn = { nome: string; mime?: string; base64: string };
export type { FilePart } from "@/lib/chat/attachment-store";

export type InterpretacaoArquivos = {
  texto: string; // conteúdo textual extraído (DADO), rotulado por arquivo
  imageParts: ImagePart[]; // imagens → modelo de visão
  fileParts: FilePart[]; // PDFs sem texto → o próprio arquivo vai ao modelo (OCR)
  metas: { nome: string; tipo: "texto" | "imagem" | "arquivo"; chars?: number }[];
};

const MAX_ARQ_BYTES = 20 * 1024 * 1024; // 20 MB por arquivo
const MAX_ARQUIVOS = 20;
const MAX_TEXTO_ARQ = 200_000; // chars por arquivo

/**
 * Lê os arquivos (base64) e prepara para a análise:
 *  - documentos com texto (DOCX/XLSX/PDF nativo/txt/csv/…) → TEXTO (dado);
 *  - imagens → visão (OCR pelo modelo);
 *  - PDF sem camada de texto (escaneado) → o próprio PDF vai ao modelo (OCR nativo).
 * Cada arquivo passa pelo portão de segurança (allowlist + magic bytes).
 */
export async function interpretarArquivos(arquivos: ArquivoIn[]): Promise<InterpretacaoArquivos> {
  const out: InterpretacaoArquivos = { texto: "", imageParts: [], fileParts: [], metas: [] };
  const blocos: string[] = [];
  for (const a of arquivos.slice(0, MAX_ARQUIVOS)) {
    const nome = (a?.nome || "arquivo").slice(0, 200);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(Buffer.from(String(a?.base64 ?? ""), "base64"));
    } catch {
      continue;
    }
    if (!bytes.length || bytes.length > MAX_ARQ_BYTES) continue;
    try {
      assertArquivoSeguro(bytes, nome, { imagens: true });
    } catch {
      out.metas.push({ nome, tipo: "arquivo" }); // rejeitado pelo portão — ignora conteúdo
      continue;
    }
    const ext = nome.split(".").pop()?.toLowerCase() ?? "";
    const mime = a.mime || (ehImagem(nome) ? "image/*" : "application/octet-stream");

    if (ehImagem(nome)) {
      out.imageParts.push({ type: "image", image: bytes, mediaType: mime });
      out.metas.push({ nome, tipo: "imagem" });
      continue;
    }

    if ((EXT_EXTRAI as readonly string[]).includes(ext)) {
      try {
        const exd = await extractDocument(Buffer.from(bytes), nome, mime);
        const texto = exd.blocks.map((b) => b.text).join("\n").replace(/\n{3,}/g, "\n\n").trim();
        if (texto.length >= 20) {
          blocos.push(`### ${nome}\n${texto.slice(0, MAX_TEXTO_ARQ)}`);
          out.metas.push({ nome, tipo: "texto", chars: texto.length });
          continue;
        }
        if (ext === "pdf") {
          // Sem texto → PDF escaneado: manda o arquivo ao modelo (OCR nativo).
          out.fileParts.push({ type: "file", data: bytes, mediaType: "application/pdf" });
          out.metas.push({ nome, tipo: "arquivo" });
          continue;
        }
      } catch {
        // cai no texto cru abaixo
      }
    }

    // Texto puro (txt/csv/json/…) ou fallback.
    const texto = decodeBytesToText(bytes).trim();
    if (texto) {
      blocos.push(`### ${nome}\n${texto.slice(0, MAX_TEXTO_ARQ)}`);
      out.metas.push({ nome, tipo: "texto", chars: texto.length });
    }
  }
  out.texto = blocos.join("\n\n");
  return out;
}
