import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  extDe,
  extensaoAceita,
  pareceBinario,
  assertArquivoSeguro,
  ACCEPT_ATTR,
  ACCEPT_ATTR_MIDIA,
  MAX_UPLOAD_BYTES,
  MAX_SERVER_ACTION_BYTES,
  MAX_ANEXO_CLIENTE_BYTES,
  MAX_ANEXO_CLIENTE_MB,
} from "./file-guard";

const txt = (s: string) => new TextEncoder().encode(s);

/** Bytes com a assinatura certa seguidos de enchimento, para os casos de mídia. */
const bytes = (...sig: number[]) => new Uint8Array([...sig, 1, 2, 3, 4, 5, 6, 7, 8]);
/** Caixa `ftyp` da família ISO-BMFF (mp4/mov/m4a): ela mora no byte 4. */
const ftyp = (marca: string) =>
  new Uint8Array([0, 0, 0, 0x20, ...[..."ftyp" + marca].map((c) => c.charCodeAt(0))]);

describe("extDe / extensaoAceita", () => {
  it("extrai a extensão e aceita dev types + pptx", () => {
    expect(extDe("relatorio.PPTX")).toBe("pptx");
    expect(extDe("script.sql")).toBe("sql");
    expect(extDe("Dockerfile")).toBe("dockerfile");
    expect(extensaoAceita("a.js")).toBe(true);
    expect(extensaoAceita("a.pptx")).toBe(true);
    expect(extensaoAceita("a.exe")).toBe(false);
    expect(extensaoAceita("a.bin")).toBe(false);
  });
  it("ACCEPT_ATTR inclui pptx e sql", () => {
    expect(ACCEPT_ATTR).toContain(".pptx");
    expect(ACCEPT_ATTR).toContain(".sql");
  });
  it("ACCEPT_ATTR habilita CSV (extensão + MIMEs, p/ o seletor do macOS)", () => {
    expect(ACCEPT_ATTR).toContain(".csv");
    expect(ACCEPT_ATTR).toContain("text/csv");
    expect(ACCEPT_ATTR).toContain("application/vnd.ms-excel");
  });
});

describe("pareceBinario", () => {
  it("texto puro não é binário", () => {
    expect(pareceBinario(txt("SELECT * FROM users; -- comentário\nabc"))).toBe(false);
  });
  it("bytes NUL = binário", () => {
    expect(pareceBinario(new Uint8Array([65, 0, 66, 0, 67]))).toBe(true);
  });
});

describe("assertArquivoSeguro", () => {
  it("aceita .sql de texto", () => {
    expect(() => assertArquivoSeguro(txt("DELETE FROM x WHERE id=1;"), "d.sql")).not.toThrow();
  });
  it("rejeita extensão não permitida", () => {
    expect(() => assertArquivoSeguro(txt("MZ"), "virus.exe")).toThrow(/não permitido/i);
  });
  it("rejeita .ppt antigo pedindo pptx", () => {
    expect(() => assertArquivoSeguro(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), "a.ppt")).toThrow(/pptx/i);
  });
  it("rejeita binário disfarçado de .txt", () => {
    expect(() => assertArquivoSeguro(new Uint8Array([0, 1, 2, 3, 0, 0]), "fake.txt")).toThrow(/binário/i);
  });
  it("rejeita docx sem assinatura zip", () => {
    expect(() => assertArquivoSeguro(txt("isto não é um zip"), "fake.docx")).toThrow(/Office/i);
  });
  it("aceita docx com assinatura PK", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    expect(() => assertArquivoSeguro(zip, "real.docx")).not.toThrow();
  });
  it("rejeita pdf sem %PDF", () => {
    expect(() => assertArquivoSeguro(txt("nope"), "fake.pdf")).toThrow(/PDF/i);
  });
});

/**
 * O MODO MÍDIA — e a metade dele que é "o resto do produto não muda".
 *
 * `assertArquivoSeguro` é compartilhada com o importador e com os anexos de
 * chat. A liberação de mídia é do ARQUIVO DA EMPRESA e de mais ninguém: cada
 * caso abaixo que prova uma liberação tem o par que prova que, SEM a opção, a
 * recusa de sempre continua de pé. Os casos da seção anterior rodam todos sem
 * `opts` de propósito — eles são a regressão das outras duas superfícies.
 */
describe("assertArquivoSeguro({ midia: true })", () => {
  const MP4 = ftyp("isom");

  it("sem a opção, vídeo continua recusado (importador e anexo de chat não mudam)", () => {
    expect(() => assertArquivoSeguro(MP4, "treinamento.mp4")).toThrow(/não permitido/i);
    expect(() => assertArquivoSeguro(MP4, "treinamento.mp4", { imagens: true })).toThrow(/não permitido/i);
  });

  it("com a opção, vídeo, áudio, compactado e Office antigo passam", () => {
    const casos: [Uint8Array, string][] = [
      [MP4, "treinamento.mp4"],
      [ftyp("qt  "), "clipe.mov"],
      [bytes(0x1a, 0x45, 0xdf, 0xa3), "aula.webm"],
      [bytes(0x49, 0x44, 0x33, 0x04), "podcast.mp3"],
      [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]), "aviso.wav"],
      [bytes(0x50, 0x4b, 0x03, 0x04), "pacote.zip"],
      [bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07), "pacote.rar"],
      [bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), "antigo.ppt"],
    ];
    for (const [buf, nome] of casos) {
      expect(() => assertArquivoSeguro(buf, nome, { midia: true }), nome).not.toThrow();
    }
  });

  it("magic bytes, não extensão: .mp4 que não é mp4 cai", () => {
    expect(() => assertArquivoSeguro(txt("isto é texto"), "falso.mp4", { midia: true })).toThrow(
      /não parece um \.mp4/i,
    );
  });

  it("executável e script de sistema são recusados COM o motivo", () => {
    expect(() => assertArquivoSeguro(bytes(0x4d, 0x5a), "instalador.exe", { midia: true })).toThrow(
      /executável ou script/i,
    );
    expect(() => assertArquivoSeguro(txt("#!/bin/sh\nrm -rf /"), "limpar.sh", { midia: true })).toThrow(
      /executável ou script/i,
    );
  });

  it("executável RENOMEADO para mídia cai pelo conteúdo", () => {
    const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(() => assertArquivoSeguro(pe, "treinamento.mp4", { midia: true })).toThrow(/programa executável/i);
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    expect(() => assertArquivoSeguro(elf, "foto.png", { midia: true })).toThrow(/programa executável/i);
  });

  it("o .sh continua sendo TEXTO para o importador (o modo mídia não vazou)", () => {
    expect(() => assertArquivoSeguro(txt("#!/bin/sh\necho oi"), "script.sh")).not.toThrow();
  });

  it("o .ppt antigo só muda de resposta DENTRO do modo mídia", () => {
    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    expect(() => assertArquivoSeguro(ole, "a.ppt")).toThrow(/pptx/i);
    expect(() => assertArquivoSeguro(ole, "a.ppt", { midia: true })).not.toThrow();
  });

  it("documento continua valendo no modo mídia (a opção SOMA, não substitui)", () => {
    expect(() => assertArquivoSeguro(txt("%PDF-1.7\n"), "manual.pdf", { midia: true })).not.toThrow();
    expect(() => assertArquivoSeguro(txt("linha um"), "notas.txt", { midia: true })).not.toThrow();
  });

  it("ACCEPT_ATTR_MIDIA acrescenta mídia sem mexer no ACCEPT_ATTR do importador", () => {
    expect(ACCEPT_ATTR_MIDIA).toContain(".mp4");
    expect(ACCEPT_ATTR_MIDIA).toContain(".zip");
    expect(ACCEPT_ATTR_MIDIA).toContain(".png");
    expect(ACCEPT_ATTR_MIDIA).toContain(".pdf");
    expect(ACCEPT_ATTR).not.toContain(".mp4");
    expect(ACCEPT_ATTR).not.toContain(".zip");
  });
});

/**
 * OS TETOS DE TAMANHO — e a promessa que a tela pode fazer.
 *
 * A tela do arquivo da empresa dizia "Até 60 MB por arquivo", copiado à mão de
 * `MAX_UPLOAD_BYTES`. Mas o envio é por Server Action, cortada em 8 MB, e acima
 * disso o Next devolve uma resposta ilegível em vez de erro de validação — o
 * cliente via "An unexpected response was received from the server", sem nenhuma
 * pista de que o problema era TAMANHO. O número estava em dois lugares e só um
 * deles valia.
 *
 * O que estes casos guardam não é o VALOR (o dono pode mudá-lo), é a relação: o
 * que a tela anuncia nunca pode ser maior que o que o servidor aceita, e o
 * `next.config.ts` não pode voltar a ter o número escrito à mão.
 */
describe("os três tetos de tamanho", () => {
  it("o que a tela anuncia não passa do que a Server Action aceita", () => {
    expect(MAX_ANEXO_CLIENTE_BYTES).toBeLessThanOrEqual(MAX_SERVER_ACTION_BYTES);
    expect(MAX_ANEXO_CLIENTE_BYTES).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    // MB inteiros, e para BAIXO: anunciar arredondando para cima prometeria
    // alguns KB que o servidor recusa.
    expect(MAX_ANEXO_CLIENTE_MB).toBe(Math.floor(MAX_ANEXO_CLIENTE_BYTES / 1024 / 1024));
    expect(MAX_ANEXO_CLIENTE_MB * 1024 * 1024).toBeLessThanOrEqual(MAX_ANEXO_CLIENTE_BYTES);
  });

  it("`next.config.ts` deriva o bodySizeLimit da constante, não de um literal", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain("MAX_SERVER_ACTION_BYTES");
    expect(config).toMatch(/bodySizeLimit:\s*`\$\{MAX_SERVER_ACTION_BYTES/);
    // O literal é o defeito: ele foi de 1mb para 8mb sem a tela saber.
    expect(config).not.toMatch(/bodySizeLimit:\s*["']\d+mb["']/);
  });
});
