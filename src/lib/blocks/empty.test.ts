import { describe, it, expect } from "vitest";
import { docTemConteudo } from "./empty";

const doc = (blocks: unknown[]) => ({ version: 2, blocks });

describe("docTemConteudo", () => {
  it("parágrafo vazio → false (o artigo vazio da estruturação)", () => {
    expect(docTemConteudo(doc([{ id: "a", type: "paragraph", text: [] }]))).toBe(false);
  });
  it("doc sem blocos → false", () => {
    expect(docTemConteudo(doc([]))).toBe(false);
  });
  it("null/vazio → false", () => {
    expect(docTemConteudo(null)).toBe(false);
    expect(docTemConteudo(undefined)).toBe(false);
  });
  it("com texto → true", () => {
    expect(docTemConteudo(doc([{ id: "a", type: "paragraph", text: [{ text: "conteúdo" }] }]))).toBe(true);
  });
  it("só imagem (sem texto) → true", () => {
    expect(docTemConteudo(doc([{ id: "a", type: "image", data: { src: "x.png" } }]))).toBe(true);
  });
  it("só tabela (sem texto) → true", () => {
    expect(docTemConteudo(doc([{ id: "a", type: "table", data: {} }]))).toBe(true);
  });
});
