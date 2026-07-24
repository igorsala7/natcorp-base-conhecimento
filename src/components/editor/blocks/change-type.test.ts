import { describe, it, expect } from "vitest";
import { changeType } from "./use-editor-actions";
import { blocksToText, richToText } from "@/lib/blocks/serialize";
import type { Block, RichText } from "@/lib/blocks/schema";

const para = (t: string, id = "p1"): Block => ({ id, type: "paragraph", text: [{ text: t }] });
/** Lê o `.text` de qualquer bloco que o tenha (vazio se não tiver). */
const textoDe = (b: Block): string => richToText((b as { text?: RichText }).text);

describe("changeType — converte preservando o conteúdo", () => {
  it("parágrafo → título → parágrafo mantém texto e id", () => {
    const h = changeType(para("Olá mundo"), "heading");
    expect(h.type).toBe("heading");
    expect(h.id).toBe("p1");
    expect(textoDe(h)).toBe("Olá mundo");
    expect(textoDe(changeType(h, "paragraph"))).toBe("Olá mundo");
  });

  it("mesmo tipo é no-op", () => {
    const p = para("x");
    expect(changeType(p, "paragraph")).toBe(p);
  });

  it("parágrafo → código preenche data.code", () => {
    const c = changeType(para("linha 1"), "code") as Extract<Block, { type: "code" }>;
    expect(c.type).toBe("code");
    expect(c.data.code).toBe("linha 1");
  });

  it("parágrafo → tabela e tabela → parágrafo mantêm o texto", () => {
    const t = changeType(para("Célula A"), "table");
    expect(t.type).toBe("table");
    expect(blocksToText([t])).toContain("Célula A");
    expect(textoDe(changeType(t, "paragraph"))).toContain("Célula A");
  });

  it("lista → checklist preserva itens e ids; volta para lista numerada", () => {
    const lista: Block = {
      id: "l1",
      type: "bulletList",
      children: [
        { id: "i1", type: "listItem", text: [{ text: "um" }] },
        { id: "i2", type: "listItem", text: [{ text: "dois" }] },
      ],
    };
    const ck = changeType(lista, "checklist") as Extract<Block, { type: "checklist" }>;
    expect(ck.data.items.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(ck.data.items.map((i) => richToText(i.text))).toEqual(["um", "dois"]);
    const back = changeType(ck, "orderedList") as Extract<Block, { type: "orderedList" }>;
    expect(back.children.map((c) => textoDe(c))).toEqual(["um", "dois"]);
  });

  it("código multilinha → lista cria um item por linha", () => {
    const code: Block = { id: "c1", type: "code", data: { language: null, code: "a\nb\nc" } };
    const lista = changeType(code, "bulletList") as Extract<Block, { type: "bulletList" }>;
    expect(lista.children.map((c) => textoDe(c))).toEqual(["a", "b", "c"]);
  });

  it("callout → parágrafo achata o texto dos filhos", () => {
    const callout: Block = { id: "ca1", type: "callout", data: { variant: "info" }, children: [para("aviso")] };
    expect(textoDe(changeType(callout, "paragraph"))).toBe("aviso");
  });

  it("parágrafo → recolhível envolve o texto num filho", () => {
    const tg = changeType(para("detalhe"), "toggle");
    expect(tg.type).toBe("toggle");
    expect(blocksToText([tg])).toContain("detalhe");
  });

  it("parágrafo → passo a passo (steps) mantém o texto num step; e volta", () => {
    const st = changeType(para("faça isso"), "steps") as Extract<Block, { type: "steps" }>;
    expect(st.type).toBe("steps");
    expect(st.children[0]?.type).toBe("step");
    expect(blocksToText([st])).toContain("faça isso");
    expect(textoDe(changeType(st, "paragraph"))).toContain("faça isso");
  });

  it("lista → grade de cards cria um card por item", () => {
    const lista: Block = {
      id: "l1",
      type: "bulletList",
      children: [
        { id: "i1", type: "listItem", text: [{ text: "A" }] },
        { id: "i2", type: "listItem", text: [{ text: "B" }] },
      ],
    };
    const cg = changeType(lista, "cardGrid") as Extract<Block, { type: "cardGrid" }>;
    expect(cg.children.every((c) => c.type === "card")).toBe(true);
    expect(cg.children.length).toBe(2);
    expect(blocksToText([cg])).toContain("A");
    expect(blocksToText([cg])).toContain("B");
  });

  it("parágrafo → colunas gera ao menos 2 colunas com o texto na primeira", () => {
    const ct = changeType(para("coluna esquerda"), "container") as Extract<Block, { type: "container" }>;
    expect(ct.type).toBe("container");
    expect(ct.data.columns).toBeGreaterThanOrEqual(2);
    expect(ct.children[0]?.type).toBe("column");
    expect(blocksToText([ct])).toContain("coluna esquerda");
  });

  it("parágrafo → banner (hero) usa o texto no título; e volta", () => {
    const h = changeType(para("Bem-vindo"), "hero") as Extract<Block, { type: "hero" }>;
    expect(h.type).toBe("hero");
    expect(h.data.title).toBe("Bem-vindo");
    expect(textoDe(changeType(h, "paragraph"))).toContain("Bem-vindo");
  });
});
