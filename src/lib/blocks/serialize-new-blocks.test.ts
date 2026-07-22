import { describe, it, expect } from "vitest";
import { blocksToText, blocksToMarkdown } from "./serialize";
import type { Block } from "./schema";

const doc: Block[] = [
  {
    id: "c1",
    type: "checklist",
    data: {
      items: [
        { id: "i1", text: [{ text: "Acesso de administrador" }], checked: true },
        { id: "i2", text: [{ text: "Backup em dia" }], checked: false },
      ],
    },
  },
  {
    id: "s1",
    type: "stats",
    data: { items: [{ id: "k1", value: "99,9%", label: "Disponibilidade", trend: "últimos 30 dias" }] },
  },
];

describe("serialização dos blocos checklist e stats", () => {
  it("texto puro inclui os itens (busca/embeddings)", () => {
    const t = blocksToText(doc);
    expect(t).toContain("Acesso de administrador");
    expect(t).toContain("Backup em dia");
    expect(t).toContain("Disponibilidade");
    expect(t).toContain("99,9%");
  });
  it("markdown usa - [x] / - [ ] e valor em negrito", () => {
    const md = blocksToMarkdown(doc);
    expect(md).toContain("- [x] Acesso de administrador");
    expect(md).toContain("- [ ] Backup em dia");
    expect(md).toContain("**99,9%** Disponibilidade — últimos 30 dias");
  });
});
