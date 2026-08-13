import { describe, it, expect } from "vitest";
import { blocoConfirmacaoExecutada } from "./confirmacao-bloco";

/**
 * O bloco que substitui as ferramentas num turno de confirmação.
 *
 * A conversa que motivou isto (13/08/2026) gastava ~80 mil tokens na palavra
 * "Sim": 30+ schemas e 3.268 tokens de documentação para o modelo redescobrir
 * uma decisão que o servidor já tinha tomado. Aqui ele recebe só o resultado.
 */
describe("blocoConfirmacaoExecutada", () => {
  it("proíbe chamar ferramenta de novo — repetir duplicaria o registro", () => {
    const b = blocoConfirmacaoExecutada({ tool: "ferias_criar", nome: "Férias: criar", ok: true, data: { cod: 1 } });
    expect(b).toMatch(/Não chame ferramenta nenhuma/i);
    expect(b).toMatch(/duplicaria/i);
  });

  it("leva o resultado para o modelo redigir", () => {
    const b = blocoConfirmacaoExecutada({
      tool: "ferias_criar", nome: "Férias: criar", ok: true,
      data: { cod_solicitacao: 57463, ja_concluida: false },
    });
    expect(b).toContain("57463");
    expect(b).toContain("ja_concluida");
  });

  it("na falha, manda dizer o que falhou — e não fingir sucesso", () => {
    const b = blocoConfirmacaoExecutada({ tool: "x", nome: "X", ok: false, erro: "HTTP 500" });
    expect(b).toContain("HTTP 500");
    expect(b).toMatch(/não invente que deu certo/i);
  });

  it("trunca retorno grande", () => {
    // Sem teto, um retorno gordo reintroduziria o custo que este caminho corta.
    const grande = { linhas: Array.from({ length: 5000 }, (_, i) => ({ i, nome: `Pessoa ${i}` })) };
    const b = blocoConfirmacaoExecutada({ tool: "x", nome: "X", ok: true, data: grande });
    expect(b.length).toBeLessThan(6500);
  });

  it("resultado vazio não quebra o bloco", () => {
    const b = blocoConfirmacaoExecutada({ tool: "x", nome: "X", ok: true });
    expect(b).toContain("AÇÃO JÁ EXECUTADA");
  });
});
