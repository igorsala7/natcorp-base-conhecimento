import { describe, it, expect } from "vitest";
import { podarPassosAnteriores, resumirRetorno, economiaDaPoda } from "./podar-passos";

const tool = (nome: string, value: unknown) => ({
  role: "tool" as const,
  content: [{ type: "tool-result", toolCallId: `c-${nome}`, toolName: nome, output: { type: "json", value } }],
});
const texto = (role: "user" | "assistant", content: string) => ({ role, content });
const amostra = (n: number) => ({ _dataset: "ds1", _total: 380, _completo: true, items: Array.from({ length: n }, (_, i) => ({ nome: `X${i}`, valor: i })) });

describe("resumirRetorno", () => {
  it("mantém o identificador do dataset e ensina a voltar aos dados", () => {
    const r = resumirRetorno(amostra(50));
    expect(r._dataset).toBe("ds1");
    expect(r._total).toBe(380);
    expect(r.items).toBeUndefined();
    expect(String(r._nota)).toContain('dados_de="ds1"');
  });

  it("preserva o erro — sem ele o modelo repete a chamada que falhou", () => {
    const r = resumirRetorno({ _erro: "PERÍODO NÃO INFORMADO", _perguntar: "diga o período" });
    expect(r._erro).toBe("PERÍODO NÃO INFORMADO");
    expect(r._perguntar).toBe("diga o período");
  });

  it("sem dataset, resume o JSON em vez de descartá-lo", () => {
    const r = resumirRetorno({ ok: true, protocolo: "A-12" });
    expect(String(r._resumo)).toContain("A-12");
  });
});

describe("podarPassosAnteriores", () => {
  it("poda os anteriores e deixa o ÚLTIMO retorno intacto", () => {
    const msgs = [texto("user", "oi"), tool("a", amostra(50)), texto("assistant", "ok"), tool("b", amostra(50))];
    const out = podarPassosAnteriores(msgs);
    const v = (m: unknown, ) => (m as { content: { output: { value: Record<string, unknown> } }[] }).content[0]!.output.value;
    expect(v(out[1]!)._podado).toBe(true);
    expect(v(out[1]!).items).toBeUndefined();
    // O último é de onde o modelo está redigindo — nunca se poda.
    expect(v(out[3]!).items).toHaveLength(50);
  });

  it("não faz nada quando só há um retorno", () => {
    const msgs = [texto("user", "oi"), tool("a", amostra(50))];
    expect(podarPassosAnteriores(msgs)).toBe(msgs);
  });

  it("não toca em mensagens de texto", () => {
    const msgs = [texto("user", "pergunta"), tool("a", amostra(9)), tool("b", amostra(9)), texto("assistant", "resposta")];
    const out = podarPassosAnteriores(msgs);
    expect(out[0]).toBe(msgs[0]);
    expect(out[3]).toBe(msgs[3]);
  });

  it("não muta a entrada", () => {
    const msgs = [tool("a", amostra(30)), tool("b", amostra(30))];
    const antes = JSON.stringify(msgs);
    podarPassosAnteriores(msgs);
    expect(JSON.stringify(msgs)).toBe(antes);
  });

  it("deixa passar retorno que não é JSON — pode ser imagem ou arquivo", () => {
    const bruto = { role: "tool", content: [{ type: "tool-result", toolCallId: "x", toolName: "t", output: { type: "content", value: [{ type: "media" }] } }] };
    const msgs = [bruto, tool("b", amostra(9)), tool("c", amostra(9))];
    expect(podarPassosAnteriores(msgs)[0]).toBe(bruto);
  });

  it("economiza de verdade num caso do tamanho real", () => {
    // p90 medido em produção: ~61 KB por retorno.
    const msgs = [tool("a", amostra(600)), texto("assistant", "…"), tool("b", amostra(600))];
    const out = podarPassosAnteriores(msgs);
    const ganho = economiaDaPoda(msgs, out);
    expect(ganho).toBeGreaterThan(JSON.stringify(msgs).length * 0.4);
  });
});
