import { describe, it, expect } from "vitest";
import { extractDocument } from "./extract";

/**
 * O manual real que motivou estes testes tinha 33 `<img>` em data URI, todas
 * filhas diretas de `<div>`, e o importador trazia ZERO. O extrator antigo
 * casava `<(h1-3|p|li)>…</\1>`, então só via imagem dentro de parágrafo — e
 * ainda perdia `h4`/`h5`, `<td>` e todo texto solto em `div`.
 */
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const html = (corpo: string) => Buffer.from(`<html><body>${corpo}</body></html>`, "utf8");
const extrair = (corpo: string) => extractDocument(html(corpo), "doc.html", "text/html");

describe("extração de HTML", () => {
  it("acha imagem que é filha direta de div (o caso que quebrou)", async () => {
    const ex = await extrair(`<p>Antes</p><div><img src="data:image/png;base64,${PNG}"></div><p>Depois</p>`);
    expect(ex.images).toHaveLength(1);
    expect(ex.images[0]!.mime).toBe("image/png");
    expect(ex.images[0]!.contentBase64).toBe(PNG);
    // Ancorada no bloco anterior → entra entre "Antes" e "Depois".
    expect(ex.blocks[ex.images[0]!.afterBlock]!.text).toBe("Antes");
  });

  it("preserva a ordem entre texto e imagens", async () => {
    const ex = await extrair(
      `<h2>Passo</h2><p>um</p><div><img src="data:image/png;base64,${PNG}"></div>` +
        `<p>dois</p><div><img src="data:image/gif;base64,R0lGOD"></div>`,
    );
    expect(ex.blocks.map((b) => b.text)).toEqual(["Passo", "um", "dois"]);
    expect(ex.images.map((i) => i.afterBlock)).toEqual([1, 2]);
    expect(ex.images[1]!.mime).toBe("image/gif");
  });

  it("reconhece h4 e h5 (o extrator antigo parava no h3)", async () => {
    const ex = await extrair("<h1>A</h1><h3>B</h3><h4>C</h4><h5>D</h5><h6>E</h6>");
    expect(ex.blocks.map((b) => b.level)).toEqual([1, 3, 4, 5, 6]);
  });

  it("captura texto de td e de div solto", async () => {
    const ex = await extrair("<table><tr><td>célula</td></tr></table><div>solto</div>");
    expect(ex.blocks.map((b) => b.text)).toEqual(["célula", "solto"]);
  });

  it("aninhamento não engole o título", async () => {
    const ex = await extrair("<div class='a'><div class='b'><h2>Título</h2><p>corpo</p></div></div>");
    expect(ex.blocks).toEqual([
      { text: "Título", level: 2 },
      { text: "corpo", level: 0 },
    ]);
  });

  it("não deixa CSS nem script virarem conteúdo", async () => {
    const ex = await extrair("<style>.x{font-family:Inter;margin:0}</style><script>var a=1</script><p>ok</p>");
    expect(ex.blocks.map((b) => b.text)).toEqual(["ok"]);
  });

  it("decodifica entidades, inclusive os acentos do português", async () => {
    const ex = await extrair("<p>Caf&eacute; &amp; ch&#225; &nbsp;&mdash; 100&#37;</p>");
    expect(ex.blocks[0]!.text).toBe("Café & chá — 100%");
    const acentos = await extrair("<p>Manuten&ccedil;&atilde;o, endere&ccedil;o, &Aacute;rea, &uuml;ber</p>");
    expect(acentos.blocks[0]!.text).toBe("Manutenção, endereço, Área, über");
  });

  it("entidade desconhecida fica visível em vez de sumir", async () => {
    const ex = await extrair("<p>a &naoexiste; b</p>");
    expect(ex.blocks[0]!.text).toBe("a &naoexiste; b");
  });

  it("imagem remota entra pela URL, sem baixar", async () => {
    const ex = await extrair(`<p>x</p><img src="https://cdn.exemplo.com/a.png" alt="Diagrama">`);
    expect(ex.images[0]).toMatchObject({
      url: "https://cdn.exemplo.com/a.png",
      contentBase64: "",
      name: "Diagrama",
    });
  });

  it("src relativo é ignorado (sem o site de origem não dá para resolver)", async () => {
    const ex = await extrair(`<img src="../img/a.png">`);
    expect(ex.images).toHaveLength(0);
  });

  it("marca itens de lista", async () => {
    const ex = await extrair("<ul><li>passo</li></ul><p>parágrafo</p>");
    expect(ex.blocks[0]!.listItem).toBe(true);
    expect(ex.blocks[1]!.listItem).toBeUndefined();
  });
});

describe("poda de mobília de página", () => {
  const repetida = (n: number) =>
    Array.from({ length: n }, (_, i) => `<p>pág ${i}</p><div><img src="data:image/png;base64,${PNG}"></div>`).join("");

  it("a mesma imagem em toda página é cabeçalho/rodapé, não conteúdo", async () => {
    const ex = await extrair(repetida(12));
    expect(ex.images).toHaveLength(0);
    expect(ex.droppedChrome).toBe(12);
  });

  it("duas ocorrências ainda são conteúdo (não poda cedo demais)", async () => {
    const ex = await extrair(repetida(2));
    expect(ex.images).toHaveLength(2);
    expect(ex.droppedChrome).toBe(0);
  });

  it("poda só a repetida, mantendo as demais", async () => {
    const outra = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const ex = await extrair(repetida(4) + `<div><img src="data:image/png;base64,${outra}"></div>`);
    expect(ex.images).toHaveLength(1);
    expect(ex.images[0]!.contentBase64).toBe(outra);
    expect(ex.droppedChrome).toBe(4);
  });
});
