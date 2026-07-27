import { describe, it, expect } from "vitest";
import type { Block } from "../blocks/schema";
import {
  unidadesDoTranscript,
  unidadesDoArtigo,
  alinhar,
  type UnidadeOriginal,
  type UnidadeArtigo,
} from "./validate";

const par = (id: string, text: string): Block => ({ id, type: "paragraph", text: [{ text }] }) as Block;
const img = (id: string, src: string): Block =>
  ({ id, type: "image", data: { src, alt: "", caption: "" } }) as Block;

describe("unidadesDoTranscript", () => {
  it("separa títulos e imagens, ignora marcador de página", () => {
    const t = "# Título\nParágrafo um.\n[Página 2]\n⟦IMG:0⟧\nParágrafo dois.";
    expect(unidadesDoTranscript(t, ["http://img/0.png"])).toEqual([
      { kind: "text", text: "Título", level: 1 },
      { kind: "text", text: "Parágrafo um.", level: 0 },
      { kind: "image", url: "http://img/0.png" },
      { kind: "text", text: "Parágrafo dois.", level: 0 },
    ]);
  });
});

describe("unidadesDoArtigo", () => {
  it("emite unidades de texto e imagem com âncora (nodeId, blockId)", () => {
    expect(unidadesDoArtigo("n1", [par("a", "Olá mundo"), img("b", "http://x/y.png")])).toEqual([
      { kind: "text", text: "Olá mundo", nodeId: "n1", blockId: "a" },
      { kind: "image", url: "http://x/y.png", nodeId: "n1", blockId: "b" },
    ]);
  });
});

describe("alinhar", () => {
  const O = (text: string, level = 0): UnidadeOriginal => ({ kind: "text", text, level });
  const OI = (url: string): UnidadeOriginal => ({ kind: "image", url });
  const A = (text: string, blockId: string, nodeId = "n1"): UnidadeArtigo => ({ kind: "text", text, nodeId, blockId });

  it("tudo presente → sem faltantes, completude 1", () => {
    const r = alinhar(
      [O("Primeiro parágrafo do texto"), O("Segundo parágrafo aqui")],
      [A("Primeiro parágrafo do texto", "b1"), A("Segundo parágrafo aqui", "b2")],
    );
    expect(r.faltantes).toEqual([]);
    expect(r.completude).toBe(1);
  });

  it("parágrafo faltante no meio → âncora no bloco anterior", () => {
    const r = alinhar(
      [O("Primeiro parágrafo do texto"), O("Um trecho que sumiu totalmente"), O("Terceiro parágrafo final")],
      [A("Primeiro parágrafo do texto", "b1"), A("Terceiro parágrafo final", "b3")],
    );
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0]).toMatchObject({ kind: "text", alvo: { nodeId: "n1", afterBlockId: "b1" } });
  });

  it("imagem faltante → reportada com âncora", () => {
    const r = alinhar(
      [O("Texto antes da imagem"), OI("http://img/miss.png"), O("Texto logo depois")],
      [A("Texto antes da imagem", "b1"), A("Texto logo depois", "b2")],
    );
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0]).toMatchObject({
      kind: "image",
      url: "http://img/miss.png",
      alvo: { nodeId: "n1", afterBlockId: "b1" },
    });
  });

  it("faltante no início → âncora no começo do 1º artigo (afterBlockId null)", () => {
    const r = alinhar(
      [O("Intro que faltou completamente"), O("Corpo presente do artigo")],
      [A("Corpo presente do artigo", "b1")],
    );
    expect(r.faltantes[0]!.alvo).toEqual({ nodeId: "n1", afterBlockId: null });
  });
});
