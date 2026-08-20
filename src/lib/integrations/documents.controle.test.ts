import { describe, it, expect } from "vitest";
import { extractDocumentsFromResult } from "./documents";

/**
 * O caso real de 20/08: o endpoint de espelho de ponto devolve o PDF em base64
 * com CR literais dentro da string JSON. `JSON.parse` recusa, o retorno vira
 * string, o extrator não acha nada e o usuário fica sem o arquivo — oito turnos
 * seguidos, com a ferramenta reportando sucesso.
 */
const CORPO_ORACLE =
  '{"ESPELHO":[{"status":"OK","message":"SUCESSO","filename":"ESPELHO_DE_PONTO.pdf",' +
  '"charset":"base64","mimetype":"application/pdf","documento":"JVBERi0xLjQKMSAwIG9iago8PAov\r' +
  'Q3JlYXRvciAoT3JhY2xlKQo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgolJUVPRgo=\r"}]}';

/** Mesma tolerância do executor: controle CRU fora, escapado intacto. */
const parseTolerante = (t: string): unknown => {
  try { return JSON.parse(t); } catch { /* segue */ }
  try { return JSON.parse(t.replace(/[\r\n\t]/g, "")); } catch { return t; }
};

describe("retorno com caractere de controle cru", () => {
  it("o JSON do Oracle é inválido — é este o defeito", () => {
    expect(() => JSON.parse(CORPO_ORACLE)).toThrow();
  });

  it("a segunda tentativa recupera o objeto", () => {
    const d = parseTolerante(CORPO_ORACLE) as Record<string, unknown>;
    expect(typeof d).toBe("object");
    expect(Array.isArray(d.ESPELHO)).toBe(true);
  });

  it("e aí o PDF é extraído, com nome e tipo", () => {
    const { files, cleaned } = extractDocumentsFromResult(parseTolerante(CORPO_ORACLE));
    expect(files).toHaveLength(1);
    expect(files[0]!.filename).toBe("ESPELHO_DE_PONTO.pdf");
    expect(files[0]!.mimeType).toBe("application/pdf");
    // %PDF em base64 — o arquivo é um PDF de verdade, não um pedaço truncado.
    expect(files[0]!.base64.startsWith("JVBERi0")).toBe(true);
    // E o base64 sai do payload do modelo, que era o motivo do extrator existir.
    expect(JSON.stringify(cleaned)).toContain("«arquivo ESPELHO_DE_PONTO.pdf»");
    expect(JSON.stringify(cleaned)).not.toContain("JVBERi0");
  });

  it("sem a tolerância, o retorno fica string e NENHUM arquivo sai", () => {
    const { files } = extractDocumentsFromResult(CORPO_ORACLE);
    expect(files).toHaveLength(0);
  });

  it("não estraga o \\n ESCAPADO, que é conteúdo legítimo", () => {
    const d = parseTolerante('{"msg":"linha1\\nlinha2"}') as { msg: string };
    expect(d.msg).toBe("linha1\nlinha2");
  });
});
