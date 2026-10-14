/**
 * OCR: o que é PURO (sem rede, sem `server-only`) — montar a requisição da
 * Maritaca, ler a resposta dela e decidir o tipo do arquivo. Fica separado de
 * `ocr.ts` para ser testável sem chave nem servidor.
 *
 * Contrato da Maritaca (docs.maritaca.ai/pt/files, lido em 13/10/2026):
 *  - o arquivo vai em base64 numa parte `{type:"file", file:{filename, file_data}}`
 *    do Chat Completions; imagem também aceita esse formato;
 *  - a extração roda NO SERVIDOR DELA, antes do modelo, e volta em
 *    `extracted_files: [{filename, text}]`; o modelo recebe só o texto;
 *  - `extraction_effort` (medium | advanced) vale só para PDF e é cobrado por
 *    página (R$ 0,02 | R$ 0,045), à parte dos tokens; volta em
 *    `usage.extraction_details`;
 *  - o total de arquivos por requisição tem de ficar abaixo de 50 MB;
 *  - nada é guardado: perguntar de novo sobre o mesmo PDF extrai (e cobra) de novo.
 */

import type { EsforcoOcr } from "./catalog";

export type ArquivoOcr = {
  nome: string;
  /** Conteúdo bruto do arquivo. */
  bytes: Uint8Array;
};

/** Tipos que a Maritaca extrai, por extensão → MIME do data URL. */
const MIME_MARITACA: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  xml: "application/xml",
};

/** Tipos que um modelo com VISÃO lê direto (os outros provedores). */
const MIME_VISAO: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Teto da Maritaca: 50 MB por requisição. Medido no base64 (o que trafega),
 * que é ~4/3 do arquivo — conferir no tamanho bruto deixaria passar um PDF de
 * 45 MB que chega lá com 60 MB e volta erro.
 */
export const LIMITE_MARITACA_BYTES = 50 * 1024 * 1024;

function extensao(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i < 0 ? "" : nome.slice(i + 1).toLowerCase();
}

/** MIME aceito pelo motor, ou `null` se o tipo não é lido por ele. */
export function mimeParaOcr(nome: string, motor: "maritaca" | "visao"): string | null {
  const tabela = motor === "maritaca" ? MIME_MARITACA : MIME_VISAO;
  return tabela[extensao(nome)] ?? null;
}

/** Extensões aceitas por motor — a tela usa no `accept` e na mensagem de erro. */
export function extensoesOcr(motor: "maritaca" | "visao"): string[] {
  return Object.keys(motor === "maritaca" ? MIME_MARITACA : MIME_VISAO);
}

/**
 * Extensão pelo CONTEÚDO (magic bytes). Quem chega aqui já sem nome é a parte
 * de imagem/PDF montada para o modelo, e o MIME dela pode ser só "image/*" —
 * a Maritaca decide o tipo pela extensão do `filename`, então ela precisa ser
 * a verdadeira.
 */
export function extensaoPorBytes(b: Uint8Array): "pdf" | "png" | "jpg" | "webp" | null {
  const ini = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (ini(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF
  if (ini(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (ini(0xff, 0xd8, 0xff)) return "jpg";
  if (ini(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

function paraBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

/**
 * Corpo do POST `/chat/completions` da Maritaca para extrair o texto.
 *
 * A pergunta ao modelo é mínima de propósito: o que interessa é o
 * `extracted_files`, que a extração produz ANTES do modelo. Pedir a
 * transcrição ao modelo pagaria duas vezes pelo mesmo texto (entrada e saída)
 * e ainda o exporia a reescrever o que leu.
 */
export function corpoMaritaca(
  arquivo: ArquivoOcr,
  model: string,
  esforco: EsforcoOcr = "medium",
): { corpo: Record<string, unknown>; bytesEnviados: number } {
  const mime = mimeParaOcr(arquivo.nome, "maritaca");
  if (!mime) {
    throw new Error(
      `Tipo de arquivo não lido pela Maritaca (.${extensao(arquivo.nome)}). ` +
        `Aceitos: ${extensoesOcr("maritaca").join(", ")}.`,
    );
  }
  const b64 = paraBase64(arquivo.bytes);
  if (b64.length >= LIMITE_MARITACA_BYTES) {
    throw new Error("Arquivo grande demais para a Maritaca (limite de 50 MB por envio, já em base64).");
  }
  return {
    bytesEnviados: b64.length,
    corpo: {
      model,
      stream: false,
      temperature: 0,
      max_tokens: 8,
      extraction_effort: esforco,
      messages: [
        {
          role: "user",
          content: [
            { type: "file", file: { filename: arquivo.nome, file_data: `data:${mime};base64,${b64}` } },
            { type: "text", text: "Responda apenas: ok" },
          ],
        },
      ],
    },
  };
}

/**
 * Mensagem para um erro HTTP da Maritaca. Os dois casos que o administrador
 * resolve sozinho ganham texto em português com o que fazer; o resto vai cru
 * (2 KB), porque a mensagem do provedor é o que diagnostica.
 *
 * Visto em 13/10/2026 com a chave da Natcorp: conta sem crédito responde 403
 * com `code: "insufficient_funds"`, e `/models` continua 200. Uma chave
 * válida, portanto, não prova que dá para chamar.
 */
export function mensagemErroMaritaca(status: number, corpo: string): string {
  if (status === 429) {
    return "Limite de uso da Maritaca atingido (429). Aguarde e tente de novo; no Tier 0 o teto é baixo.";
  }
  if (corpo.includes("insufficient_funds")) {
    return "A conta da Maritaca está sem créditos. Adicione créditos em plataforma.maritaca.ai e tente de novo.";
  }
  if (status === 401 || corpo.includes("Not authenticated")) {
    return "A Maritaca recusou a chave de API. Confira a chave em Sistema → IA → Provedores.";
  }
  return `Maritaca respondeu ${status}: ${corpo.slice(0, 2000) || "sem detalhe"}`;
}

export type ExtracaoMaritaca = {
  texto: string;
  paginas: { medium: number; advanced: number };
  uso: { input: number; output: number; cacheRead: number };
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Lê a resposta da Maritaca. Lança quando a extração veio vazia: um OCR que
 * "dá certo" sem texto vira, mais à frente, um documento validado como se
 * estivesse em branco — falha silenciosa no pior lugar.
 */
export function lerExtracaoMaritaca(json: unknown): ExtracaoMaritaca {
  const r = (json ?? {}) as {
    extracted_files?: { filename?: string; text?: string }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
      extraction_details?: {
        medium_effort_pages_extracted?: number;
        advanced_effort_pages_extracted?: number;
      };
    };
  };
  const arquivos = Array.isArray(r.extracted_files) ? r.extracted_files : [];
  const texto = arquivos
    .map((f) => (typeof f?.text === "string" ? f.text : ""))
    .join("\n\n")
    .trim();
  if (!texto) {
    throw new Error(
      "A Maritaca não devolveu texto extraído. O arquivo pode estar vazio, protegido por senha ou ilegível.",
    );
  }
  const u = r.usage ?? {};
  return {
    texto,
    paginas: {
      medium: num(u.extraction_details?.medium_effort_pages_extracted),
      advanced: num(u.extraction_details?.advanced_effort_pages_extracted),
    },
    uso: {
      input: num(u.prompt_tokens),
      output: num(u.completion_tokens),
      cacheRead: num(u.prompt_tokens_details?.cached_tokens),
    },
  };
}
