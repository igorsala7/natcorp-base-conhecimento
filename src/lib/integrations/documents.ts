/**
 * Detecta ARQUIVOS em base64 no retorno de uma API (ex.: holerite/recibo em PDF)
 * e os separa do JSON que vai para o modelo.
 *
 * Por quê: o base64 é enorme (dezenas de KB) — mandá-lo para o LLM gasta tokens à
 * toa e ele não faz nada com bytes. Aqui a gente EXTRAI o arquivo (para entregar
 * ao usuário) e substitui o base64 por um marcador curto no payload do modelo.
 *
 * Reconhece o formato comum: um objeto com um campo de MIME (`mimetype`…), um nome
 * (`filename`…) e o conteúdo base64 (`documento`/`arquivo`/… ou o campo apontado
 * por `charset: "base64"`). Funciona em qualquer profundidade (objetos/arrays).
 */

export type OutFile = { filename: string; mimeType: string; base64: string };

const MIME_KEYS = ["mimetype", "mimeType", "mime_type", "contentType", "content_type"];
const NAME_KEYS = ["filename", "fileName", "file_name", "nome", "name"];
const B64_KEYS = ["documento", "arquivo", "file", "conteudo", "content", "base64", "data", "body", "pdf"];

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/zip": "zip",
};

function looksBase64(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.replace(/\s+/g, "");
  if (s.length < 100 || s.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

function defaultName(mime: string): string {
  const ext = EXT[mime] || mime.split("/")[1] || "bin";
  return `documento.${ext}`;
}

/** Devolve o JSON limpo (sem base64) e a lista de arquivos extraídos. */
export function extractDocumentsFromResult(data: unknown): { cleaned: unknown; files: OutFile[] } {
  const files: OutFile[] = [];
  const cleaned = walk(data, files);
  return { cleaned, files };
}

function walk(node: unknown, files: OutFile[]): unknown {
  if (Array.isArray(node)) return node.map((x) => walk(x, files));
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const mimeKey = MIME_KEYS.find((k) => typeof obj[k] === "string");

    let b64Key: string | undefined;
    if (mimeKey) {
      for (const k of B64_KEYS) {
        if (looksBase64(obj[k])) {
          b64Key = k;
          break;
        }
      }
      // `charset: "base64"` → o payload é o campo (de outro nome) que for base64.
      if (!b64Key && String(obj.charset ?? "").toLowerCase() === "base64") {
        b64Key = Object.keys(obj).find((k) => looksBase64(obj[k]));
      }
    }

    if (mimeKey && b64Key) {
      const mimeType = String(obj[mimeKey]);
      const nome = NAME_KEYS.map((k) => obj[k]).find((v) => typeof v === "string" && v) as string | undefined;
      const filename = nome || defaultName(mimeType);
      files.push({ filename, mimeType, base64: String(obj[b64Key]).replace(/\s+/g, "") });
      // Payload do modelo: base64 vira um marcador curto.
      return { ...obj, [b64Key]: `«arquivo ${filename}»` };
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walk(v, files);
    return out;
  }
  return node;
}
