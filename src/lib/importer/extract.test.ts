import { describe, it, expect } from "vitest";
import { extractDocument, podarChromeDePaginas } from "./extract";

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

describe("poda de cabeçalho/rodapé/paginação do PDF", () => {
  const TITULOS = ["Cadastro de Clientes", "Emissão de Notas", "Relatórios gerenciais", "Controle de estoque", "Configurações"];
  const corpo = (pg: number) =>
    `Parágrafo de corpo da página ${pg} com conteúdo longo o bastante para nunca ser confundido com mobília de página.`;
  // Cada página: cabeçalho corrido (curto), título de corpo (único), parágrafo
  // longo, rodapé corrido e paginação — o layout típico de um PDF de manual.
  const paginas = (n: number) =>
    Array.from({ length: n }, (_, p) => {
      const pg = p + 1;
      return [
        { text: "Manual do Sistema NatCorp", page: pg },
        { text: TITULOS[p] ?? `Tema ${pg}`, page: pg },
        { text: corpo(pg), page: pg },
        { text: "Confidencial — uso interno", page: pg },
        { text: `Página ${pg} de ${n}`, page: pg },
      ];
    }).flat();

  it("remove cabeçalho, rodapé corrido e paginação, preservando o corpo", () => {
    const { lines, dropped } = podarChromeDePaginas(paginas(5), 5);
    const textos = lines.map((l) => l.text);
    expect(textos).not.toContain("Manual do Sistema NatCorp"); // cabeçalho
    expect(textos).not.toContain("Confidencial — uso interno"); // rodapé corrido
    expect(textos.some((t) => /^Página/.test(t))).toBe(false); // paginação
    // Título e corpo reais ficam.
    expect(textos).toContain("Relatórios gerenciais");
    expect(textos.some((t) => t.includes("Parágrafo de corpo da página 3"))).toBe(true);
    expect(dropped).toBe(3 * 5); // 3 linhas de mobília × 5 páginas
    expect(lines).toHaveLength(2 * 5); // sobram título + corpo
  });

  it("remove um cabeçalho-TABELA de várias linhas + rodapé de site (o caso do PDF real)", () => {
    // Cabeçalho de 4 fragmentos (título, seção, "Página: N", "Data: …") repetido
    // em toda página, com rodapé de URL — como no manual do Chamado Interno.
    const HEADINGS = ["Área de Atendimento", "Cadastro de Responsável", "Tipos de Atendimento", "Fases do Chamado", "Relatórios", "Gráficos"];
    const paginas = Array.from({ length: 6 }, (_, p) => {
      const pg = p + 1;
      return [
        { text: "Chamado Interno", page: pg },
        { text: "Orientação", page: pg },
        { text: `Página: ${pg}`, page: pg },
        { text: "Data: 29/12/2023", page: pg },
        { text: HEADINGS[p] ?? `Seção ${pg}`, page: pg },
        { text: `Corpo específico e longo da página ${pg}, descrevendo um procedimento sem se repetir em outras.`, page: pg },
        { text: "WWW.NATCORP.COM.BR", page: pg },
      ];
    }).flat();
    const textos = podarChromeDePaginas(paginas, 6).lines.map((l) => l.text);
    // As 4 linhas do cabeçalho-tabela e o rodapé somem.
    expect(textos).not.toContain("Chamado Interno");
    expect(textos).not.toContain("Orientação");
    expect(textos.some((t) => /^Página:/.test(t))).toBe(false);
    expect(textos.some((t) => /^Data:/.test(t))).toBe(false);
    expect(textos).not.toContain("WWW.NATCORP.COM.BR");
    // O título de seção e o corpo reais ficam.
    expect(textos).toContain("Tipos de Atendimento");
    expect(textos.some((t) => t.includes("Corpo específico e longo da página 3"))).toBe(true);
  });

  it("é conservador: não age com menos de 3 páginas", () => {
    const curto = paginas(2);
    const { lines, dropped } = podarChromeDePaginas(curto, 2);
    expect(dropped).toBe(0);
    expect(lines).toHaveLength(curto.length);
  });

  it("não confunde número no MEIO da página com paginação", () => {
    const linhas = Array.from({ length: 4 }, (_, p) => {
      const pg = p + 1;
      const HEAD = ["Cadastros", "Chamados", "Relatórios", "Gráficos"][p]!;
      return [
        { text: "Cabeçalho fixo da empresa", page: pg }, // mobília
        { text: HEAD, page: pg }, // título único → banda para aqui
        { text: "42", page: pg }, // número de conteúdo, no miolo
        { text: `Parágrafo de corpo longo e exclusivo da página ${pg}, com texto suficiente para ultrapassar o limite de caracteres da mobília e jamais ser confundido com ela.`, page: pg },
        { text: "Rodapé fixo do documento", page: pg }, // mobília
      ];
    }).flat();
    const textos = podarChromeDePaginas(linhas, 4).lines.map((l) => l.text);
    expect(textos).toContain("42"); // sobrevive: está no miolo
    expect(textos).not.toContain("Cabeçalho fixo da empresa");
    expect(textos).not.toContain("Rodapé fixo do documento");
  });
});
