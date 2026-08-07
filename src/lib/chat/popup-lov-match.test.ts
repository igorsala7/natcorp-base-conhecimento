import { describe, it, expect } from "vitest";

/**
 * Réplica de `casarItemLov` de `public/widget.js` — o widget é um IIFE de navegador
 * sem build, então não dá para importá-lo. Mesma disciplina de `base-path.test.ts`:
 * a regra crítica fica coberta mesmo vivendo em dois lugares. **Ao mudar a do widget,
 * mude esta junto.**
 *
 * Por que ela merece teste: escolher o item errado GRAVA dado errado numa tela do
 * sistema — é diferente de errar uma leitura. Por isso a precedência é exata primeiro
 * e ambiguidade NÃO é resolvida no chute: volta para o modelo perguntar.
 */
const scanTexto = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();
type Item = { id: string; texto: string };

function casarItemLov(itens: Item[], valor: string):
  { item?: Item; via?: string; ambiguo?: string[]; erro?: string } {
  const alvo = scanTexto(valor).toLowerCase();
  if (!alvo) return { erro: "sem valor" };
  const norm = (t: unknown) => scanTexto(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const alvoN = norm(valor);
  const info = itens.map((li) => {
    const txt = norm(li.texto);
    return { li, id: li.id.toLowerCase(), txt, desc: txt.replace(/^\s*[\w.\-]+\s*[-–]\s*/, "") };
  });
  const por = (f: (x: (typeof info)[number]) => boolean) => info.filter(f);
  let c = por((x) => !!x.id && x.id === alvo); if (c.length === 1) return { item: c[0]!.li, via: "codigo" };
  c = por((x) => x.desc === alvoN); if (c.length === 1) return { item: c[0]!.li, via: "descricao" };
  c = por((x) => x.txt === alvoN); if (c.length === 1) return { item: c[0]!.li, via: "texto" };
  c = por((x) => x.desc.indexOf(alvoN) === 0); if (c.length === 1) return { item: c[0]!.li, via: "prefixo" };
  const contem = por((x) => x.txt.indexOf(alvoN) >= 0);
  if (contem.length === 1) return { item: contem[0]!.li, via: "contem" };
  if (contem.length > 1) return { ambiguo: contem.slice(0, 8).map((x) => x.li.texto) };
  return { erro: "nao encontrado" };
}

/** A lista REAL do popup LOV de Empresa (P716_COD_EMPRESA). */
const LISTA: Item[] = [
  { id: "1", texto: "1 - Fundacao De Previdencia Complementar Do Estado De Sao Paulo" },
  { id: "90", texto: "90 - Natcorp" },
  { id: "91", texto: "91 - Natcorp Homologação" },
  { id: "92", texto: "92 - Natcorp Do Brasil 92" },
  { id: "99", texto: "99 - Alimac Consultória" },
  { id: "100", texto: "100 - Natcorp Homologações" },
  { id: "700", texto: "700 - Natcorp Do Brasil" },
  { id: "705", texto: "705 - Ls Consulting" },
  { id: "707", texto: "707 - Empresa Vitória" },
  { id: "790", texto: "790 - Natcorp Treinamento" },
];

describe("casarItemLov", () => {
  it("código exato vence tudo", () => {
    expect(casarItemLov(LISTA, "700")).toMatchObject({ item: { id: "700" }, via: "codigo" });
    expect(casarItemLov(LISTA, "90")).toMatchObject({ item: { id: "90" }, via: "codigo" });
  });

  it("descrição exata, com e sem acento, com e sem caixa", () => {
    for (const v of ["Natcorp Do Brasil", "natcorp do brasil", "NATCORP DO BRASIL"]) {
      expect(casarItemLov(LISTA, v), v).toMatchObject({ item: { id: "700" } });
    }
    expect(casarItemLov(LISTA, "Natcorp Homologacao")).toMatchObject({ item: { id: "91" } });
    expect(casarItemLov(LISTA, "Empresa Vitoria")).toMatchObject({ item: { id: "707" } });
  });

  it("EXATO vence CONTIDO — 'Natcorp' é a empresa 90, não as outras seis que a contêm", () => {
    expect(casarItemLov(LISTA, "Natcorp")).toMatchObject({ item: { id: "90" }, via: "descricao" });
  });

  it("ambíguo NÃO chuta: devolve os candidatos para o modelo perguntar", () => {
    const r = casarItemLov(LISTA, "Homologa");
    expect(r.item).toBeUndefined();
    expect(r.ambiguo).toHaveLength(2);
    expect(r.ambiguo).toEqual(expect.arrayContaining(["91 - Natcorp Homologação", "100 - Natcorp Homologações"]));
  });

  it("prefixo desempata quando só um começa com o termo", () => {
    expect(casarItemLov(LISTA, "Alimac")).toMatchObject({ item: { id: "99" }, via: "prefixo" });
  });

  it("valor inexistente falha em vez de escolher o mais parecido", () => {
    expect(casarItemLov(LISTA, "Fulano de Tal").erro).toBe("nao encontrado");
  });

  it("valor vazio não seleciona nada", () => {
    expect(casarItemLov(LISTA, "   ").erro).toBe("sem valor");
  });

  it("código que também aparece dentro de outro texto não confunde", () => {
    // "92" é o código de um item E aparece em "Natcorp Do Brasil 92" (o mesmo).
    expect(casarItemLov(LISTA, "92")).toMatchObject({ item: { id: "92" }, via: "codigo" });
  });
});
