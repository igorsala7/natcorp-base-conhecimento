import { describe, it, expect } from "vitest";
import { resolveTheme, regiaoAtiva, REGIOES } from "./theme";
import { derivarVarianteEscura, derivarHover, contraste } from "./brand-color";

const FUNDO_ESCURO = "#16131c";
const FUNDO_CLARO = "#ffffff";

describe("resolveTheme", () => {
  it("aceita jsonb vazio, null e lixo sem lançar", () => {
    for (const entrada of [null, undefined, {}, [], 42, "texto", { brand: "não é objeto" }]) {
      const t = resolveTheme(entrada);
      expect(t.home.regions).toHaveLength(REGIOES.length);
      expect(t.home.subtitle.length).toBeGreaterThan(0);
    }
  });

  it("preserva o formato antigo do tema (primaryColor/supportUrl coexistiam)", () => {
    const t = resolveTheme({ supportUrl: "https://suporte.exemplo", supportEmail: "a@b.c" });
    expect(t.supportUrl).toBe("https://suporte.exemplo");
    expect(t.supportEmail).toBe("a@b.c");
  });

  it("mantém a ordem gravada e acrescenta as regiões que faltam", () => {
    const t = resolveTheme({
      home: { regions: [{ key: "recent", on: true }, { key: "hero", on: false }] },
    });
    expect(t.home.regions[0]?.key).toBe("recent");
    expect(t.home.regions[1]?.key).toBe("hero");
    expect(t.home.regions).toHaveLength(REGIOES.length);
    // Sem duplicatas, mesmo com as gravadas repetindo chaves do padrão.
    expect(new Set(t.home.regions.map((r) => r.key)).size).toBe(REGIOES.length);
  });

  it("deduplica região repetida (senão a seção sairia duas vezes na home)", () => {
    const t = resolveTheme({
      home: {
        regions: [
          { key: "recent", on: true },
          { key: "recent", on: false },
          { key: "hero", on: true },
        ],
      },
    });
    expect(t.home.regions.filter((r) => r.key === "recent")).toHaveLength(1);
    // Vence a primeira ocorrência.
    expect(regiaoAtiva(t, "recent")).toBe(true);
    expect(t.home.regions).toHaveLength(REGIOES.length);
  });

  it("descarta região com chave desconhecida em vez de quebrar", () => {
    const t = resolveTheme({ home: { regions: [{ key: "inexistente", on: true }] } });
    expect(t.home.regions.map((r) => r.key)).not.toContain("inexistente");
    expect(t.home.regions).toHaveLength(REGIOES.length);
  });

  it("respeita o desligamento gravado", () => {
    const t = resolveTheme({ home: { regions: [{ key: "recent", on: false }] } });
    expect(regiaoAtiva(t, "recent")).toBe(false);
    expect(regiaoAtiva(t, "categories")).toBe(true);
  });

  it("`cover` nasce desligada — quem não configurou nada não ganha um vazio", () => {
    expect(regiaoAtiva(resolveTheme({}), "cover")).toBe(false);
  });

  it("rejeita imagem fora do Storage do projeto (anti-hotlink)", () => {
    const t = resolveTheme({ brand: { coverUrl: "https://cdn.malicioso.example/capa.png" } });
    expect(t.brand.coverUrl).toBeNull();
  });

  it("aceita imagem do bucket assets", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/assets/space/capa.png";
    expect(resolveTheme({ brand: { coverUrl: url } }).brand.coverUrl).toBe(url);
  });

  it("tema antigo (sem os campos novos) resolve com os padrões", () => {
    const t = resolveTheme({ home: { title: "Docs" }, supportUrl: "https://s.exemplo" });
    expect(t.home.heroStyle).toBe("plain");
    expect(t.home.categoriesStyle).toBe("cards");
    expect(t.home.featured).toEqual([]);
    expect(t.header.links).toEqual([]);
    expect(t.footer.links).toEqual([]);
    expect(t.footer.text).toBeNull();
    expect(t.article.related).toBe(true);
    // Padrão de leitura: escala nova (menor) e faixa destacada entre diretórios.
    expect(t.article.fontSize).toBe("normal");
    expect(t.article.divider).toBe("band");
  });

  it("aceita fontSize/divider válidos; inválidos derrubam para o padrão", () => {
    const ok = resolveTheme({ article: { fontSize: "large", divider: "line" } });
    expect(ok.article.fontSize).toBe("large");
    expect(ok.article.divider).toBe("line");
    const invalido = resolveTheme({ article: { fontSize: "gigante" } });
    expect(invalido.article.fontSize).toBe("normal");
    expect(invalido.article.divider).toBe("band");
  });

  it("`featured` e `top` nascem desligadas (dependem de curadoria/feedback)", () => {
    const t = resolveTheme({});
    expect(regiaoAtiva(t, "featured")).toBe(false);
    expect(regiaoAtiva(t, "top")).toBe(false);
    // Num tema antigo que gravou regiões antes destas existirem, elas entram
    // no fim e continuam desligadas.
    const antigo = resolveTheme({ home: { regions: [{ key: "hero", on: true }] } });
    expect(regiaoAtiva(antigo, "featured")).toBe(false);
    expect(regiaoAtiva(antigo, "top")).toBe(false);
  });

  it("aceita heroStyle e categoriesStyle válidos", () => {
    const t = resolveTheme({ home: { heroStyle: "brand", categoriesStyle: "tiles" } });
    expect(t.home.heroStyle).toBe("brand");
    expect(t.home.categoriesStyle).toBe("tiles");
  });

  it("links aceitam https e caminho relativo; rejeitam javascript: e //", () => {
    const ok = resolveTheme({
      header: { links: [{ label: "Site", url: "https://exemplo.com" }] },
      footer: { links: [{ label: "Entrar", url: "/admin/login" }] },
    });
    expect(ok.header.links).toHaveLength(1);
    expect(ok.footer.links).toHaveLength(1);

    // Um link inválido invalida o tema inteiro → cai no padrão (links vazios).
    // É o contrato: quem grava é o admin validado; o resolver nunca deixa
    // passar um `javascript:` para a página pública.
    for (const url of ["javascript:alert(1)", "//evil.example", "ftp://x", "data:text/html,x"]) {
      const t = resolveTheme({ header: { links: [{ label: "x", url }] } });
      expect(t.header.links).toEqual([]);
    }
  });

  it("`featured` com id que não é uuid derruba para o padrão (lista vazia)", () => {
    const t = resolveTheme({ home: { featured: ["não-é-uuid"] } });
    expect(t.home.featured).toEqual([]);
  });
});

describe("derivarVarianteEscura", () => {
  // As três da marca, mais extremos: preto, uma cor saturadíssima e uma clara.
  const cores = ["#511C76", "#C95788", "#2C1A63", "#000000", "#0000ff", "#ff0000", "#e8e6ec"];

  it.each(cores)("%s fica legível sobre o fundo escuro", (cor) => {
    const escura = derivarVarianteEscura(cor);
    expect(contraste(escura, FUNDO_ESCURO)).toBeGreaterThanOrEqual(4.5);
  });

  it("não mexe numa cor que já passa no escuro", () => {
    const clara = "#9E77BC"; // brand.purple.400, usado hoje no dark mode
    expect(contraste(clara, FUNDO_ESCURO)).toBeGreaterThanOrEqual(4.5);
    expect(derivarVarianteEscura(clara)).toBe(clara);
  });

  it("devolve a entrada quando ela não é uma cor", () => {
    expect(derivarVarianteEscura("nem-cor")).toBe("nem-cor");
  });
});

describe("derivarHover", () => {
  it("escurece sem inverter a cor", () => {
    const base = "#511C76";
    const hover = derivarHover(base);
    expect(hover).not.toBe(base);
    // Continua legível com texto branco em cima (é fundo de botão primário).
    expect(contraste(hover, FUNDO_CLARO)).toBeGreaterThanOrEqual(4.5);
  });
});
