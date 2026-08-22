import { describe, it, expect } from "vitest";
import { decidirAcao, soFormato, GERADOR } from "./portao-acao";

/** O gerador SEMPRE está na mesa nestes testes, menos onde o teste diz o contrário. */
const base = {
  ferramentas: [GERADOR, "consultar_registros", "agrupar", "estrutura_empresas", "consultar_ferias"],
  conversaEmAndamento: true,
  social: false,
  tutorial: false,
  documental: false,
  continuation: false,
};

describe("soFormato — a mensagem é só recipiente", () => {
  // As quatro do gabarito, todas esperando `gerar_relatorio`.
  for (const p of ["Ok, me gere um pdf disso", "excel", "Faz em pdf", "Agora gere um PPT e Word"]) {
    it(`dispara: "${p}"`, () => expect(soFormato(p)).toBe(true));
  }
  // As formas vistas em produção (25 dias de `ai_chat_traces`) — todas corretas.
  for (const p of ["Faça um pdf", "Agora em versão pdf", "Faça o PDF", "GERAR PDF", "quero em pdf", "gere um ppt", "Agora faça em PPT e Word"]) {
    it(`dispara (produção): "${p}"`, () => expect(soFormato(p)).toBe(true));
  }
  // Frases do MESMO conjunto que trazem assunto próprio — o gabarito NÃO pede o gerador.
  for (const p of [
    "Crie um template de documento de contrato de admissão de contrato determinado",
    "Cria um PDF com essas informações pra eu enviar pro meu gestor",
    "Crie um PDF com essa analise para que eu possa enviar para meu jurídico",
    "Analise este relatório e me diga o que chama atenção.",
    "Me gere um relatório de férias",
    "GERE ESTE MATERIAL EXECUTIVO PARA APRESENTAR",
    "traga a lista completa",
    "Tudo junto",
  ]) {
    it(`não dispara: "${p.slice(0, 42)}"`, () => expect(soFormato(p)).toBe(false));
  }
  /**
   * `anexo` saiu de RX_RECIPIENTE: é palavra de ENTRADA tanto quanto de saída, e
   * em 25 dias o único turno que ele decidia sozinho era a mensagem "anexo".
   */
  for (const p of ["anexo", "conforme anexo", "calcule utilizando este anexo"]) {
    it(`não dispara (anexo é entrada): "${p}"`, () => expect(soFormato(p)).toBe(false));
  }
});

describe("regra FORMATO", () => {
  it("força o gerador quando há conversa e o gerador está na mesa", () => {
    expect(decidirAcao({ ...base, pergunta: "excel" }))
      .toEqual({ modo: "forcar", tool: GERADOR, regra: "formato" });
  });
  it("não força no PRIMEIRO turno — não há conteúdo a embalar", () => {
    expect(decidirAcao({ ...base, pergunta: "excel", conversaEmAndamento: false }).modo).toBe("livre");
  });
  it("não força se o gerador não foi entregue ao modelo", () => {
    expect(decidirAcao({ ...base, pergunta: "Faz em pdf", ferramentas: ["consultar_ferias"] }).modo).toBe("livre");
  });
  it("mensagem com assunto próprio segue livre", () => {
    expect(decidirAcao({ ...base, pergunta: "Cria um PDF com essas informações pra eu enviar pro meu gestor" }).modo).toBe("livre");
  });
  it("social, tutorial, documental e o loop de tela ficam de fora", () => {
    for (const flag of ["social", "tutorial", "documental", "continuation"] as const) {
      expect(decidirAcao({ ...base, pergunta: "Faz em pdf", [flag]: true }).modo).toBe("livre");
    }
  });
});
