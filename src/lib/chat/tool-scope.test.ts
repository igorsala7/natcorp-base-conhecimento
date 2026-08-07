import { describe, it, expect } from "vitest";
import { categorizarTools, type EntradaEscopo } from "./tool-scope";

const vazio: EntradaEscopo = {
  integTools: {}, harvestTools: {}, queryTools: {},
  formTools: {}, visualTools: {}, inviteTools: {}, intencaoVisual: false,
};
const com = (p: Partial<EntradaEscopo>): EntradaEscopo => ({ ...vazio, ...p });
const VISUAIS = { montar_grafico: 1, gerar_relatorio: 1 };

/**
 * Regressão: as ferramentas visuais viraram sempre-ligadas e `temTools` passou a ser
 * true em 100% dos turnos — matando a recusa honesta e o clarify de tema, que exigem
 * `!temTools`. Gráfico e arquivo transformam o que existe; não são fonte.
 */
describe("categorizarTools", () => {
  it("só visuais, sem o usuário pedir → não conta como fonte", () => {
    const r = categorizarTools(com({ visualTools: VISUAIS }));
    expect(r.temDataTools).toBe(false);
    expect(r.temToolsDeConteudo).toBe(false); // a recusa honesta volta a poder rodar
  });

  it("só visuais, mas o usuário PEDIU → conta (era o efeito da regex antiga)", () => {
    const r = categorizarTools(com({ visualTools: VISUAIS, intencaoVisual: true }));
    expect(r.temDataTools).toBe(false);
    expect(r.temToolsDeConteudo).toBe(true);
  });

  it("integração cortada pelo modo relatório → sem tools de dados", () => {
    const r = categorizarTools(com({ integTools: {}, queryTools: {}, visualTools: VISUAIS }));
    expect(r.temDataTools).toBe(false);
  });

  it("API de integração é fonte de dado", () => {
    expect(categorizarTools(com({ integTools: { ferias: 1 } })).temDataTools).toBe(true);
  });

  it("consulta sobre dataset e coleta de páginas também são dados", () => {
    expect(categorizarTools(com({ queryTools: { consultar_registros: 1 } })).temDataTools).toBe(true);
    expect(categorizarTools(com({ harvestTools: { coletar_relatorio: 1 } })).temDataTools).toBe(true);
  });

  it("ferramenta de tela é conteúdo, mas não é dado", () => {
    const r = categorizarTools(com({ formTools: { preencher_campo: 1 } }));
    expect(r.temDataTools).toBe(false);
    expect(r.temToolsDeConteudo).toBe(true);
  });

  it("turno sem ferramenta nenhuma", () => {
    expect(categorizarTools(vazio)).toEqual({ temDataTools: false, temToolsDeConteudo: false });
  });
});
