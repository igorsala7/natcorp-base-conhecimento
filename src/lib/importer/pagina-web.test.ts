import { describe, it, expect } from "vitest";
import { extrairPaginaWeb } from "./pagina-web";

describe("extração de página web", () => {
  it("descarta menu, rodapé e script — indexá-los faria o chatbot citar o menu", () => {
    const r = extrairPaginaWeb(`
      <html><head><title>Ignorar</title></head><body>
        <nav><a href="/a">Início</a><a href="/b">Produtos</a><a href="/c">Contato</a></nav>
        <script>window.x = "não deve aparecer"</script>
        <main>
          <h1>Como pedir férias</h1>
          <p>O pedido é feito pelo portal do colaborador com trinta dias de antecedência.</p>
        </main>
        <footer>© 2026 Acme — todos os direitos reservados</footer>
      </body></html>`);

    expect(r.conteudo).toContain("trinta dias");
    expect(r.conteudo).not.toContain("Produtos");
    expect(r.conteudo).not.toContain("não deve aparecer");
    expect(r.conteudo).not.toContain("direitos reservados");
  });

  it("o h1 do miolo vence o title da aba", () => {
    // O `<title>` carrega o nome do site, e esse sufixo repetido em todo
    // documento indexado polui a busca.
    const r = extrairPaginaWeb(
      `<html><head><title>Como pedir férias — RH Acme</title></head><body>
        <main><h1>Solicitação de férias</h1><p>${"conteúdo real ".repeat(30)}</p></main>
      </body></html>`,
    );
    expect(r.titulo).toBe("Solicitação de férias");
  });

  it("sem h1, corta o sufixo do site do title", () => {
    const r = extrairPaginaWeb(
      `<html><head><title>Como pedir férias | RH Acme</title></head><body>
        <main><p>${"texto do procedimento ".repeat(30)}</p></main>
      </body></html>`,
    );
    expect(r.titulo).toBe("Como pedir férias");
  });

  it("preserva a hierarquia — é ela que vira o heading_path da citação", () => {
    const r = extrairPaginaWeb(`
      <article>
        <h1>Financeiro</h1>
        <h2>Faturamento</h2>
        <h3>Emitir nota fiscal</h3>
        <p>Acesse o menu Faturamento e clique em Nova nota.</p>
        <ul><li>Informe o CNPJ</li><li>Confira o valor</li></ul>
      </article>`);

    expect(r.conteudo).toContain("# Financeiro");
    expect(r.conteudo).toContain("## Faturamento");
    expect(r.conteudo).toContain("### Emitir nota fiscal");
    expect(r.conteudo).toContain("- Informe o CNPJ");
    // A ordem importa: o chunker monta o caminho lendo de cima para baixo.
    expect(r.conteudo.indexOf("# Financeiro")).toBeLessThan(r.conteudo.indexOf("## Faturamento"));
  });

  it("sem article nem main, acha o bloco com mais PROSA", () => {
    // Menu tem muitos elementos e quase nenhuma prosa; o miolo é o contrário.
    const r = extrairPaginaWeb(`
      <body>
        <div><a>Um</a><a>Dois</a><a>Três</a><a>Quatro</a><a>Cinco</a><a>Seis</a></div>
        <div><h2>Política de reembolso</h2><p>${"O reembolso é analisado em cinco dias úteis. ".repeat(10)}</p></div>
      </body>`);

    expect(r.conteudo).toContain("cinco dias úteis");
    expect(r.conteudo).toContain("## Política de reembolso");
  });

  it("mede o conteúdo para o chamador poder recusar página vazia", () => {
    const vazia = extrairPaginaWeb("<html><body><nav>Menu</nav></body></html>");
    expect(vazia.caracteres).toBeLessThan(200);

    const cheia = extrairPaginaWeb(`<main><p>${"conteúdo de verdade ".repeat(40)}</p></main>`);
    expect(cheia.caracteres).toBeGreaterThan(200);
  });

  it("resolve entidades HTML — & e aspas entram cruas no chunk sem isso", () => {
    const r = extrairPaginaWeb(`<main><p>${"x ".repeat(60)} Pesquisa &amp; Desenvolvimento &quot;P&amp;D&quot;</p></main>`);
    expect(r.conteudo).toContain('Pesquisa & Desenvolvimento "P&D"');
  });
});
