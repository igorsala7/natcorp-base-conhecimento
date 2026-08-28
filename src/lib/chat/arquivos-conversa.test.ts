import { describe, expect, it } from "vitest";
import { extrairArquivosDeMensagens } from "./arquivos-conversa-parse";

const msg = (created_at: string, media: unknown) => ({ created_at, media });
const arq = (filename: string, path = `p/${filename}`) => ({
  kind: "file",
  path,
  filename,
  mimeType: "application/pdf",
});

describe("extrairArquivosDeMensagens", () => {
  it("acha o arquivo gerado em turno ANTERIOR — o caso que fazia o e-mail sair sem anexo", () => {
    // 27/08: PPT gerado às 15:56, e-mail pedido às 16:24. O turno do envio tem
    // `media` vazia; o arquivo está na mensagem de 28 minutos antes.
    const linhas = [
      msg("2026-08-27T16:24:05Z", null),
      msg("2026-08-27T15:56:15Z", [arq("relatorio-executivo-tony-oliveira.pdf")]),
    ];
    const out = extrairArquivosDeMensagens(linhas);
    expect(out).toHaveLength(1);
    expect(out[0]!.filename).toBe("relatorio-executivo-tony-oliveira.pdf");
  });

  it("ordena do mais recente para o mais antigo", () => {
    const out = extrairArquivosDeMensagens([
      msg("2026-08-27T15:00:00Z", [arq("antigo.pdf")]),
      msg("2026-08-27T16:00:00Z", [arq("novo.pdf")]),
    ]);
    expect(out.map((a) => a.filename)).toEqual(["novo.pdf", "antigo.pdf"]);
  });

  it("mesmo nome regerado fica só na versão mais recente", () => {
    // Regerar o relatório com o mesmo título é rotina; oferecer as duas versões
    // só dá ao modelo uma escolha que ele não tem como fazer certo.
    const out = extrairArquivosDeMensagens([
      msg("2026-08-27T15:00:00Z", [arq("relatorio.pdf", "p/v1")]),
      msg("2026-08-27T16:00:00Z", [arq("relatorio.pdf", "p/v2")]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.path).toBe("p/v2");
  });

  it("gráfico não é arquivo anexável", () => {
    const out = extrairArquivosDeMensagens([
      msg("2026-08-27T16:00:00Z", [{ kind: "chart", spec: { tipo: "barra" } }, arq("ok.pdf")]),
    ]);
    expect(out.map((a) => a.filename)).toEqual(["ok.pdf"]);
  });

  it("aguenta media malformada sem derrubar o turno", () => {
    const out = extrairArquivosDeMensagens([
      msg("2026-08-27T16:00:00Z", "não é array"),
      msg("2026-08-27T15:00:00Z", [null, {}, { kind: "file" }, arq("bom.pdf")]),
    ]);
    expect(out.map((a) => a.filename)).toEqual(["bom.pdf"]);
  });
});
