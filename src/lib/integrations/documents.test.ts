import { describe, it, expect } from "vitest";
import { extractDocumentsFromResult } from "./documents";

const b64 = Buffer.from("x".repeat(300)).toString("base64"); // válido, >100 chars

describe("extractDocumentsFromResult", () => {
  it("extrai o arquivo aninhado e tira o base64 do payload (formato holerite)", () => {
    const data = {
      RECIBO: [
        {
          status: "OK",
          message: "Segue documento solicitado",
          filename: "RECIBO_DE_PAGAMENTO.pdf",
          charset: "base64",
          mimetype: "application/pdf",
          documento: b64,
        },
      ],
    };
    const { cleaned, files } = extractDocumentsFromResult(data);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ filename: "RECIBO_DE_PAGAMENTO.pdf", mimeType: "application/pdf", base64: b64 });
    // O payload que vai ao modelo não contém mais o base64.
    const doc = (cleaned as typeof data).RECIBO[0]!.documento;
    expect(doc).not.toContain(b64);
    expect(doc).toContain("RECIBO_DE_PAGAMENTO.pdf");
    // Campos normais preservados.
    expect((cleaned as typeof data).RECIBO[0]!.status).toBe("OK");
  });

  it("detecta pelo campo conhecido mesmo sem charset e usa nome padrão pelo mime", () => {
    const { files } = extractDocumentsFromResult({ mimetype: "image/png", arquivo: b64 });
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe("documento.png");
  });

  it("não confunde texto comum com base64", () => {
    const data = { message: "tudo certo", valor: 1234, obs: "sem arquivo aqui" };
    const { cleaned, files } = extractDocumentsFromResult(data);
    expect(files).toHaveLength(0);
    expect(cleaned).toEqual(data);
  });
});
