import { describe, expect, it } from "vitest";
import {
  LIMITE_MARITACA_BYTES,
  corpoMaritaca,
  extensaoPorBytes,
  lerExtracaoMaritaca,
  mensagemErroMaritaca,
  mimeParaOcr,
} from "./ocr-formato";

const pdf = { nome: "rg.PDF", bytes: new TextEncoder().encode("%PDF-1.4 conteudo") };

describe("corpoMaritaca", () => {
  it("monta a parte `file` com data URL e o esforço de extração", () => {
    const { corpo } = corpoMaritaca(pdf, "sabiazinho-4-br-sp", "advanced");
    expect(corpo.model).toBe("sabiazinho-4-br-sp");
    expect(corpo.stream).toBe(false);
    expect(corpo.extraction_effort).toBe("advanced");
    const msgs = corpo.messages as { content: { type: string; file?: { filename: string; file_data: string } }[] }[];
    const arquivo = msgs[0]!.content.find((c) => c.type === "file")!;
    expect(arquivo.file!.filename).toBe("rg.PDF");
    expect(arquivo.file!.file_data.startsWith("data:application/pdf;base64,")).toBe(true);
  });

  it("usa medium por padrão (o nível que a Maritaca assume)", () => {
    expect(corpoMaritaca(pdf, "sabia-4").corpo.extraction_effort).toBe("medium");
  });

  it("recusa tipo que a Maritaca não lê, dizendo quais aceita", () => {
    expect(() => corpoMaritaca({ nome: "foto.webp", bytes: new Uint8Array([1]) }, "sabia-4")).toThrow(/Aceitos: .*pdf/);
  });

  it("mede o limite de 50 MB no base64, não no arquivo bruto", () => {
    // 38 MB brutos viram ~50,7 MB em base64: precisa ser recusado.
    const grande = { nome: "x.pdf", bytes: new Uint8Array(38 * 1024 * 1024) };
    expect(() => corpoMaritaca(grande, "sabia-4")).toThrow(/50 MB/);
    expect(LIMITE_MARITACA_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe("lerExtracaoMaritaca", () => {
  it("junta o texto dos arquivos e lê páginas e cache do usage", () => {
    const r = lerExtracaoMaritaca({
      choices: [{ message: { content: "ok" } }],
      extracted_files: [
        { filename: "a.pdf", text: "CPF: 123.456.789-09" },
        { filename: "b.png", text: "Nome: Maria" },
      ],
      usage: {
        prompt_tokens: 45,
        completion_tokens: 1,
        prompt_tokens_details: { cached_tokens: 12 },
        extraction_details: { medium_effort_pages_extracted: 2, advanced_effort_pages_extracted: 0 },
      },
    });
    expect(r.texto).toBe("CPF: 123.456.789-09\n\nNome: Maria");
    expect(r.paginas).toEqual({ medium: 2, advanced: 0 });
    expect(r.uso).toEqual({ input: 45, output: 1, cacheRead: 12 });
  });

  it("falha alto quando a extração vem vazia, em vez de devolver documento em branco", () => {
    expect(() => lerExtracaoMaritaca({ extracted_files: [{ filename: "a.pdf", text: "   " }] })).toThrow(
      /não devolveu texto/,
    );
    expect(() => lerExtracaoMaritaca({})).toThrow(/não devolveu texto/);
  });

  it("tolera usage ausente (conta zero, não quebra)", () => {
    const r = lerExtracaoMaritaca({ extracted_files: [{ text: "x" }] });
    expect(r.uso).toEqual({ input: 0, output: 0, cacheRead: 0 });
    expect(r.paginas).toEqual({ medium: 0, advanced: 0 });
  });
});

describe("mensagemErroMaritaca", () => {
  it("traduz os casos que o administrador resolve sozinho", () => {
    // Corpo real recebido em 13/10/2026 (conta sem crédito).
    const semCredito =
      '{"error":{"message":"Sorry, you need have active credits to use MariTalk via API.","type":"invalid_request_error","param":null,"code":"insufficient_funds"}}';
    expect(mensagemErroMaritaca(403, semCredito)).toMatch(/sem créditos.*MESMA organização/);
    expect(mensagemErroMaritaca(429, "")).toMatch(/Limite de uso/);
    expect(mensagemErroMaritaca(403, '{"detail":"Not authenticated"}')).toMatch(/recusou a chave/);
    expect(mensagemErroMaritaca(500, "boom")).toBe("Maritaca respondeu 500: boom");
  });
});

describe("extensaoPorBytes", () => {
  it("reconhece pelo conteúdo, não pelo nome", () => {
    const b = (...v: number[]) => new Uint8Array(v);
    expect(extensaoPorBytes(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(extensaoPorBytes(b(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe("png");
    expect(extensaoPorBytes(b(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(extensaoPorBytes(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8"))).toBe("webp");
    expect(extensaoPorBytes(new TextEncoder().encode("RIFF\0\0\0\0WAVE"))).toBeNull();
    expect(extensaoPorBytes(b())).toBeNull();
  });
});

describe("mimeParaOcr", () => {
  it("visão aceita webp; Maritaca aceita docx; nenhum aceita executável", () => {
    expect(mimeParaOcr("doc.webp", "visao")).toBe("image/webp");
    expect(mimeParaOcr("doc.webp", "maritaca")).toBeNull();
    expect(mimeParaOcr("cv.docx", "maritaca")).toMatch(/wordprocessingml/);
    expect(mimeParaOcr("cv.docx", "visao")).toBeNull();
    expect(mimeParaOcr("x.exe", "maritaca")).toBeNull();
  });
});
