import { describe, it, expect } from "vitest";
import { aplicarOpsNoDoc, resumoDoDoc } from "./chat-ops";
import type { Block } from "@/lib/blocks/schema";
import type { EditorChatOp } from "@/lib/ai/editor-chat-schema";

const doc: Block[] = [
  { id: "b1", type: "heading", text: [{ text: "Intro" }], data: { level: 2 } },
  { id: "b2", type: "paragraph", text: [{ text: "Texto." }] },
  { id: "img", type: "image", data: { src: "https://x/i.png", alt: "print", caption: "" } },
  {
    id: "call",
    type: "callout",
    data: { variant: "info" },
    children: [{ id: "filho", type: "paragraph", text: [{ text: "dentro" }] }],
  },
];

const op = (o: Partial<EditorChatOp>): EditorChatOp => ({
  op: "inserir_apos",
  blockId: null,
  blocks: null,
  ...o,
});

describe("aplicarOpsNoDoc", () => {
  it("inserir_apos no topo-nível; a MÍDIA sobrevive intacta", () => {
    const r = aplicarOpsNoDoc(doc, [
      op({
        op: "inserir_apos",
        blockId: "b1",
        blocks: [{ kind: "bullets", items: ["Pré-requisito"] }],
      }),
    ]);
    expect(r.aplicadas).toBe(1);
    expect(r.blocks[1]?.type).toBe("bulletList");
    expect(r.blocks.find((b) => b.id === "img")).toEqual(doc[2]);
  });

  it("substituir preserva o id antigo no primeiro bloco (âncora p/ op seguinte)", () => {
    const r = aplicarOpsNoDoc(doc, [
      op({
        op: "substituir",
        blockId: "b2",
        blocks: [
          { kind: "paragraph", text: "Novo texto." },
          { kind: "paragraph", text: "Complemento." },
        ],
      }),
      op({
        op: "inserir_apos",
        blockId: "b2", // referencia o id preservado
        blocks: [{ kind: "divider" }],
      }),
    ]);
    expect(r.aplicadas).toBe(2);
    expect(r.blocks[1]?.id).toBe("b2");
    // b2, Complemento (id novo), divider inserido após o BLOCO b2 (a âncora).
    expect(r.blocks[2]?.type).toBe("divider");
  });

  it("blockId de FILHO de contêiner é recusado e reportado (não muta fundo)", () => {
    const r = aplicarOpsNoDoc(doc, [
      op({ op: "remover", blockId: "filho" }),
    ]);
    expect(r.aplicadas).toBe(0);
    expect(r.ignoradas[0]).toContain("filho");
    expect(r.blocks).toEqual(doc);
  });

  it("id inexistente é reportado; remover tudo nunca deixa o doc vazio", () => {
    const r = aplicarOpsNoDoc(doc, [
      op({ op: "remover", blockId: "fantasma" }),
      op({ op: "remover", blockId: "b1" }),
      op({ op: "remover", blockId: "b2" }),
      op({ op: "remover", blockId: "img" }),
      op({ op: "remover", blockId: "call" }),
    ]);
    expect(r.ignoradas).toHaveLength(1);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]?.type).toBe("paragraph");
  });

  it("inserir_topo entra no início", () => {
    const r = aplicarOpsNoDoc(doc, [
      op({ op: "inserir_topo", blocks: [{ kind: "callout", variant: "info", text: "Resumo", icon: null }] }),
    ]);
    expect(r.blocks[0]?.type).toBe("callout");
  });
});

describe("resumoDoDoc", () => {
  it("lista só o topo, com id e rótulo por tipo", () => {
    const resumo = resumoDoDoc(doc);
    expect(resumo).toContain("b1 → título(h2): Intro");
    expect(resumo).toContain("img → imagem: print");
    expect(resumo).toContain("call → callout [1 filho(s)]");
    expect(resumo).not.toContain("filho →"); // filho de contêiner não aparece
  });
});
