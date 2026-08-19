import { describe, it, expect } from "vitest";
import { blocoConfirmacaoExecutada } from "./confirmacao-bloco";

/**
 * O caso que originou estes testes: o e-mail FOI enviado (servidor executou, ok=true),
 * a API respondeu sem corpo, e o modelo disse ao usuário que "o sistema não permite
 * enviar e-mail". O bloco não pode deixar o sucesso a cargo da inferência.
 */
describe("blocoConfirmacaoExecutada", () => {
  it("afirma o sucesso mesmo quando a API não devolve corpo", () => {
    const b = blocoConfirmacaoExecutada({ tool: "ms_email_enviar", nome: "Enviar e-mail", ok: true, data: {} });
    expect(b).toContain("EXECUTADA COM SUCESSO");
    expect(b).toContain("DEU CERTO");
    expect(b).toMatch(/NUNCA diga que não foi possível/);
    // Sem corpo, não oferece um JSON vazio para o modelo interpretar.
    expect(b).not.toContain("```json");
  });

  it("entrega o retorno quando ele existe, e só ele", () => {
    const b = blocoConfirmacaoExecutada({
      tool: "ferias_criar", nome: "Criar férias", ok: true, data: { protocolo: "A-12" },
    });
    expect(b).toContain("EXECUTADA COM SUCESSO");
    expect(b).toContain("A-12");
    expect(b).toContain("nada além deles");
  });

  it("na falha, não afirma sucesso e diz o que falhou", () => {
    const b = blocoConfirmacaoExecutada({
      tool: "ferias_criar", nome: "Criar férias", ok: false, erro: "Sequência inválida",
    });
    expect(b).toContain("NÃO CONCLUÍDA");
    expect(b).not.toContain("DEU CERTO");
    expect(b).toContain("Sequência inválida");
    expect(b).toContain("não invente que deu certo");
  });
});
