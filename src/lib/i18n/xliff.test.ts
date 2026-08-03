import { describe, it, expect } from "vitest";
import { extrairSourcesXliff, preencherTargetsXliff, buildXliff, linhasParaUnidades, encodeXml } from "./xliff";

const XLIFF = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="apex" source-language="pt-BR" target-language="en" datatype="plaintext">
    <body>
      <trans-unit id="P1_SALVAR">
        <source>Salvar &amp; Fechar</source>
      </trans-unit>
      <trans-unit id="P1_NOME">
        <source><![CDATA[Nome do colaborador]]></source>
        <target>ANTIGO</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

describe("extrairSourcesXliff", () => {
  it("extrai id + source decodificando entidades e CDATA", () => {
    const u = extrairSourcesXliff(XLIFF);
    expect(u).toHaveLength(2);
    expect(u[0]).toEqual({ id: "P1_SALVAR", source: "Salvar & Fechar" });
    expect(u[1]).toEqual({ id: "P1_NOME", source: "Nome do colaborador" });
  });
  it("ignora sem id/source e deduplica", () => {
    expect(extrairSourcesXliff("<trans-unit><source>x</source></trans-unit>")).toEqual([]);
  });
});

describe("preencherTargetsXliff", () => {
  it("injeta target novo (após source) e SUBSTITUI o existente, escapando XML", () => {
    const out = preencherTargetsXliff(
      XLIFF,
      new Map([
        ["P1_SALVAR", "Save & Close"],
        ["P1_NOME", "Employee name"],
      ]),
    );
    // injetado onde não havia target
    expect(out).toContain("<target>Save &amp; Close</target>");
    // substituiu o target antigo
    expect(out).toContain("<target>Employee name</target>");
    expect(out).not.toContain("ANTIGO");
    // preservou a estrutura (source intacto)
    expect(out).toContain("<source>Salvar &amp; Fechar</source>");
  });
  it("unidade fora do mapa fica intacta", () => {
    const out = preencherTargetsXliff(XLIFF, new Map([["INEXISTENTE", "x"]]));
    expect(out).toBe(XLIFF);
  });
  it("preenche o que a IA traduziu e mantém o resto para revisão", () => {
    const out = preencherTargetsXliff(XLIFF, new Map([["P1_SALVAR", "Save"]]));
    expect(out).toContain("<target>Save</target>");
    expect(out).toContain("<target>ANTIGO</target>"); // não mexeu no outro
  });
});

describe("buildXliff + linhasParaUnidades", () => {
  it("monta XLIFF válido de uma lista de textos", () => {
    const u = linhasParaUnidades("Salvar\n  Cancelar \n\nExcluir");
    expect(u).toEqual([
      { id: "t1", source: "Salvar" },
      { id: "t2", source: "Cancelar" },
      { id: "t3", source: "Excluir" },
    ]);
    const xml = buildXliff(u, "pt-BR", "es");
    expect(xml).toContain('source-language="pt-BR"');
    expect(xml).toContain('target-language="es"');
    expect(xml).toContain('<trans-unit id="t1">');
    expect(xml).toContain("<source>Salvar</source>");
    // roundtrip: extrai de volta
    expect(extrairSourcesXliff(xml)).toHaveLength(3);
  });
  it("encodeXml escapa &<>\"", () => {
    expect(encodeXml('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });
});
