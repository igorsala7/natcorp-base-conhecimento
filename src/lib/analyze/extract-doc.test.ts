/**
 * `extrairDocumento` (POST /api/v1/extract) roda na finalidade OCR. Três
 * comportamentos que um refactor quebraria sem nenhum outro teste perceber:
 *  - desligada, RECUSA, em vez de cair no modelo do Chat (documento pessoal só
 *    vai para onde o administrador apontou);
 *  - provedor sem visão (Maritaca) recebe TEXTO transcrito, nunca a imagem;
 *  - a confiança sai sempre entre 0 e 1 (o schema perdeu min/max por causa da
 *    Maritaca, e a faixa passou a ser garantida em código).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  configEscolhida: vi.fn(),
  extrairTexto: vi.fn(),
  generateObject: vi.fn(),
  interpretarArquivos: vi.fn(),
}));

vi.mock("@/lib/ai/config", () => ({
  configEscolhida: m.configEscolhida,
  languageModelDe: vi.fn(() => "MODELO"),
}));
vi.mock("@/lib/ai/ocr", () => {
  class OcrDesligadoError extends Error {}
  return { OcrDesligadoError, extrairTexto: m.extrairTexto };
});
vi.mock("ai", () => ({ generateObject: m.generateObject }));
vi.mock("./files", () => ({ interpretarArquivos: m.interpretarArquivos }));

import { OcrDesligadoError } from "@/lib/ai/ocr";
import { extrairDocumento } from "./extract-doc";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const cfg = (kind: string, model: string) => ({ kind, model, apiKey: "k", origem: "banco" });

beforeEach(() => {
  vi.clearAllMocks();
  m.interpretarArquivos.mockResolvedValue({
    texto: "",
    imageParts: [{ type: "image", image: PNG, mediaType: "image/*" }],
    fileParts: [],
    metas: [],
  });
  m.generateObject.mockResolvedValue({
    object: {
      tipo_documento: "cpf",
      campos: [
        { campo: "numero", valor: "123.456.789-09", confianca: 1.7 },
        { campo: "nome", valor: "MARIA", confianca: -0.2 },
      ],
    },
  });
});

describe("extrairDocumento", () => {
  it("OCR desligado: recusa e não chama modelo nenhum", async () => {
    m.configEscolhida.mockResolvedValue(null);
    await expect(extrairDocumento({ arquivos: [] })).rejects.toBeInstanceOf(OcrDesligadoError);
    expect(m.configEscolhida).toHaveBeenCalledWith(undefined, "ocr");
    expect(m.generateObject).not.toHaveBeenCalled();
  });

  it("sem visão (Maritaca): transcreve a imagem e manda só TEXTO ao modelo", async () => {
    const c = cfg("maritaca", "sabiazinho-4-br-sp");
    m.configEscolhida.mockResolvedValue(c);
    m.extrairTexto.mockResolvedValue({ texto: "CPF: 123.456.789-09" });

    await extrairDocumento({ arquivos: [] });

    // A extensão vem do conteúdo: o MIME da parte era só "image/*".
    expect(m.extrairTexto).toHaveBeenCalledWith(
      { nome: "documento-1.png", bytes: PNG },
      expect.objectContaining({ cfg: c }),
    );
    const chamada = m.generateObject.mock.calls[0]![0];
    expect(chamada.messages).toBeUndefined();
    expect(chamada.prompt).toContain("CPF: 123.456.789-09");
  });

  it("com visão: a imagem vai ao modelo e o OCR à parte não roda", async () => {
    m.configEscolhida.mockResolvedValue(cfg("google", "gemini-3.5-flash"));

    await extrairDocumento({ arquivos: [] });

    expect(m.extrairTexto).not.toHaveBeenCalled();
    const conteudo = m.generateObject.mock.calls[0]![0].messages[0].content;
    expect(conteudo.some((p: { type: string }) => p.type === "image")).toBe(true);
  });

  it("confiança fora da faixa é trazida para 0..1", async () => {
    m.configEscolhida.mockResolvedValue(cfg("google", "gemini-3.5-flash"));
    const r = await extrairDocumento({ arquivos: [] });
    expect(r.campos.map((c) => c.confianca)).toEqual([1, 0]);
  });
});
