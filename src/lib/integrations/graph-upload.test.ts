import { describe, expect, it, vi } from "vitest";
import { enviarParaOneDrive, nomeSeguro, urlDeUpload } from "./graph-upload";

describe("nomeSeguro", () => {
  it("troca proibidos por hífen em vez de remover", () => {
    // Removendo, "Relatorio 01/2026.pdf" viraria "Relatorio 012026.pdf" — uma
    // data que não existe. O hífen preserva a leitura.
    expect(nomeSeguro("Relatorio 01/2026.pdf")).toBe("Relatorio 01-2026.pdf");
    expect(nomeSeguro('Ferias: "Julho" <2026>.xlsx')).toBe("Ferias- -Julho- -2026-.xlsx");
  });

  it("apara espaço e ponto das pontas — o OneDrive recusa", () => {
    expect(nomeSeguro("  relatorio.pdf  ")).toBe("relatorio.pdf");
    expect(nomeSeguro("...oculto.txt.")).toBe("oculto.txt");
  });

  it("nome que some na limpeza vira `arquivo`", () => {
    // Subir com nome vazio falha com um erro do Graph que não diz o motivo.
    expect(nomeSeguro("///")).toBe("arquivo");
    expect(nomeSeguro("   ")).toBe("arquivo");
    expect(nomeSeguro("")).toBe("arquivo");
  });

  it("limita o comprimento", () => {
    expect(nomeSeguro("a".repeat(500)).length).toBe(200);
  });
});

describe("urlDeUpload", () => {
  it("sempre na pasta acordada, com renomeação em conflito", () => {
    const u = urlDeUpload("Relatorio.pdf");
    expect(u).toContain("/me/drive/root:/natcorp-nati/Relatorio.pdf:/content");
    // `rename` é a decisão do produto: salvar duas vezes NÃO pode apagar o de
    // ontem. Se este parâmetro cair, a perda é silenciosa.
    expect(u).toContain("conflictBehavior=rename");
    expect(u).not.toContain("replace");
  });

  it("escapa o nome sem escapar a barra da pasta", () => {
    const u = urlDeUpload("Férias & Abonos.xlsx");
    expect(u).toContain("natcorp-nati/F%C3%A9rias%20%26%20Abonos.xlsx");
  });

  it("aceita outra base do Graph (nuvem soberana)", () => {
    expect(urlDeUpload("a.pdf", "https://graph.microsoft.de/v1.0")).toContain("graph.microsoft.de");
  });
});

const resposta = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => body } as unknown as Response);

describe("enviarParaOneDrive", () => {
  const base = { token: "t", nome: "Relatorio.pdf", mimeType: "application/pdf" };
  const b64 = Buffer.from("conteudo").toString("base64");

  it("envia os bytes crus com o mime do arquivo", async () => {
    const f = resposta({ name: "Relatorio.pdf", webUrl: "https://x/y", size: 8 });
    const r = await enviarParaOneDrive({ ...base, base64: b64, fetchImpl: f as unknown as typeof fetch });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/pdf");
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect(r).toEqual({ ok: true, nome: "Relatorio.pdf", webUrl: "https://x/y", tamanho: 8 });
  });

  it("devolve o nome QUE FOI GRAVADO, não o pedido", async () => {
    // Com `rename`, o Graph pode gravar "Relatorio 1.pdf". Dizer o nome pedido
    // faria a pessoa procurar um arquivo que não existe.
    const f = resposta({ name: "Relatorio 1.pdf", webUrl: "https://x/1", size: 8 });
    const r = await enviarParaOneDrive({ ...base, base64: b64, fetchImpl: f as unknown as typeof fetch });
    expect(r.ok && r.nome).toBe("Relatorio 1.pdf");
  });

  it("recusa arquivo vazio antes de gastar a chamada", async () => {
    const f = resposta({});
    const r = await enviarParaOneDrive({ ...base, base64: "", fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, erro: "O arquivo gerado está vazio." });
    expect(f).not.toHaveBeenCalled();
  });

  it("recusa acima de 4 MB explicando o que fazer", async () => {
    const f = resposta({});
    const grande = Buffer.alloc(5 * 1024 * 1024).toString("base64");
    const r = await enviarParaOneDrive({ ...base, base64: grande, fetchImpl: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toContain("5.0 MB");
      expect(r.erro).toMatch(/recorte menor/);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("propaga a mensagem do Graph — é a pista de escopo faltando", async () => {
    const f = resposta({ error: { message: "Insufficient privileges" } }, false, 403);
    const r = await enviarParaOneDrive({ ...base, base64: b64, fetchImpl: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Insufficient privileges");
  });

  it("sem corpo de erro, ainda diz o status", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("x"); } } as unknown as Response);
    const r = await enviarParaOneDrive({ ...base, base64: b64, fetchImpl: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("500");
  });
});
