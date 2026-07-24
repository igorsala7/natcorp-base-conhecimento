import { describe, it, expect } from "vitest";
import { sanitizeDoc } from "./rich-blocks";
import { BlockDocSchema } from "@/lib/blocks/schema";

/** Acesso solto aos blocos nos testes (o Block real é união discriminada). */
type Loose = {
  id: string;
  type: string;
  text?: { text: string; marks?: unknown[] }[];
  data?: Record<string, unknown>;
  children?: Loose[];
};
const blocosDe = (raw: unknown, fb = "") => sanitizeDoc(raw, fb).blocks as unknown as Loose[];
const first = (raw: unknown) => blocosDe(raw)[0]!;
const kids = (b: Loose) => b.children ?? [];

describe("sanitizeDoc — validade e estrutura", () => {
  it("sempre devolve um BlockDoc v2 válido", () => {
    const doc = sanitizeDoc({ blocks: [{ type: "paragraph", text: "oi" }] });
    expect(BlockDocSchema.safeParse(doc).success).toBe(true);
    expect(doc.version).toBe(2);
    expect(doc.blocks[0]!.id).toBeTypeOf("string");
  });

  it("aceita array direto, {blocks} e {nodes}", () => {
    for (const raw of [
      [{ type: "paragraph", text: "a" }],
      { blocks: [{ type: "paragraph", text: "a" }] },
      { nodes: [{ type: "paragraph", text: "a" }] },
    ]) {
      expect(sanitizeDoc(raw).blocks).toHaveLength(1);
    }
  });

  it("texto string vira spans; heading coage nível para 2/3", () => {
    expect(first({ blocks: [{ type: "paragraph", text: "olá" }] }).text).toEqual([{ text: "olá" }]);
    expect(first({ blocks: [{ type: "heading", data: { level: 5 }, text: "T" }] }).data!.level).toBe(2);
    expect(first({ blocks: [{ type: "heading", data: { level: 3 }, text: "T" }] }).data!.level).toBe(3);
  });

  it("callout: variant coercido e texto solto vira parágrafo-filho", () => {
    const c = first({ blocks: [{ type: "callout", data: { variant: "xyz", title: "Nota" }, text: "corpo" }] });
    expect(c.data!.variant).toBe("info");
    expect(kids(c)[0]!.type).toBe("paragraph");
    expect(kids(c)[0]!.text).toEqual([{ text: "corpo" }]);
  });

  it("bulletList: itens string viram listItem", () => {
    const l = first({ blocks: [{ type: "bulletList", items: ["um", "dois"] }] });
    expect(kids(l).map((k) => k.type)).toEqual(["listItem", "listItem"]);
    expect(kids(l)[0]!.text).toEqual([{ text: "um" }]);
  });

  it("steps com step aninhado e title", () => {
    const s = first({
      blocks: [{ type: "steps", children: [{ type: "step", data: { title: "Passo 1" }, text: "Clique" }] }],
    });
    const step = kids(s)[0]!;
    expect(step.type).toBe("step");
    expect(step.data!.title).toBe("Passo 1");
    expect(kids(step)[0]!.text).toEqual([{ text: "Clique" }]);
  });

  it("table: células string viram spans; tabela vazia é descartada", () => {
    const t = first({ blocks: [{ type: "table", data: { rows: [["Campo", "Descrição"]] } }] });
    expect((t.data!.rows as unknown[][])[0]![0]).toEqual([{ text: "Campo" }]);
    // Tabela vazia é descartada; com um irmão válido, sobra só o irmão.
    const doc = blocosDe({ blocks: [{ type: "table", data: { rows: [] } }, { type: "paragraph", text: "ok" }] });
    expect(doc.map((b) => b.type)).toEqual(["paragraph"]);
  });

  it("checklist lê items (topo ou data)", () => {
    const ck = first({ blocks: [{ type: "checklist", items: [{ text: "conferir", checked: true }] }] });
    const items = ck.data!.items as { text: unknown; checked: boolean }[];
    expect(items[0]!.checked).toBe(true);
    expect(items[0]!.text).toEqual([{ text: "conferir" }]);
  });

  it("marca inválida (link sem href) não derruba o bloco — cai para texto puro", () => {
    const p = first({ blocks: [{ type: "paragraph", text: [{ text: "x", marks: [{ type: "link" }] }] }] });
    expect(p.type).toBe("paragraph");
    expect(p.text).toEqual([{ text: "x" }]);
  });

  it("marca válida (bold) é preservada", () => {
    const p = first({ blocks: [{ type: "paragraph", text: [{ text: "x", marks: [{ type: "bold" }] }] }] });
    expect(p.text).toEqual([{ text: "x", marks: [{ type: "bold" }] }]);
  });

  it("tipo desconhecido, image e snippet são descartados", () => {
    const doc = blocosDe({
      blocks: [
        { type: "banana", text: "x" },
        { type: "image", data: { src: "a" } },
        { type: "snippet", data: { snippetKey: "k" } },
        { type: "paragraph", text: "fica" },
      ],
    });
    expect(doc).toHaveLength(1);
    expect(doc[0]!.type).toBe("paragraph");
  });

  it("vazio → parágrafos do texto de fallback", () => {
    const doc = blocosDe({ blocks: [] }, "Primeiro.\n\nSegundo.");
    expect(doc.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
    expect(doc[1]!.text).toEqual([{ text: "Segundo." }]);
  });
});
