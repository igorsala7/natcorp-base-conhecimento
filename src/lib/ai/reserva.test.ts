import { describe, expect, it, vi } from "vitest";
import { generateText, streamText } from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { comReserva, deveUsarReserva, semChave } from "./reserva";

/** Erro no formato do AI SDK (APICallError tem `statusCode`). */
const erroHttp = (statusCode: number, message = "falhou") => Object.assign(new Error(message), { statusCode });

const resposta = (texto: string) => ({
  content: [{ type: "text" as const, text: texto }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
  warnings: [],
});

const stream = (texto: string) => ({
  stream: convertArrayToReadableStream([
    { type: "text-start" as const, id: "1" },
    { type: "text-delta" as const, id: "1", delta: texto },
    { type: "text-end" as const, id: "1" },
    {
      type: "finish" as const,
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    },
  ]),
});

const ROT = { principal: "maritaca:sabia-4", reserva: "google:gemini-3.8-flash" };

describe("deveUsarReserva", () => {
  it("troca quando o PROVEDOR não pode atender", () => {
    // 403 insufficient_funds da Maritaca (14/10), chave, modelo descontinuado, limite, fora do ar
    for (const c of [401, 402, 403, 404, 408, 429, 500, 503]) expect(deveUsarReserva(erroHttp(c)), String(c)).toBe(true);
    expect(deveUsarReserva(new Error("fetch failed"))).toBe(true);
    expect(deveUsarReserva(Object.assign(new Error("x"), { name: "CircuitOpenError" }))).toBe(true);
  });

  it("NÃO troca quando o defeito é da requisição: esconderia o nosso erro", () => {
    for (const c of [400, 409, 413, 422]) expect(deveUsarReserva(erroHttp(c)), String(c)).toBe(false);
  });

  it("NÃO troca quando o usuário clicou em Parar ou o prazo acabou", () => {
    const c = new AbortController();
    c.abort();
    expect(deveUsarReserva(erroHttp(503), c.signal)).toBe(false);
    expect(deveUsarReserva(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(false);
  });
});

describe("comReserva", () => {
  it("generate: o principal falha por crédito e a reserva responde", async () => {
    const avisar = vi.fn();
    const principal = new MockLanguageModelV3({ doGenerate: async () => { throw erroHttp(403, "insufficient_funds"); } });
    const reserva = new MockLanguageModelV3({ doGenerate: async () => resposta("da reserva") });
    const r = await generateText({ model: comReserva(principal, reserva, ROT, avisar), prompt: "oi", maxRetries: 0 });
    expect(r.text).toBe("da reserva");
    expect(avisar).toHaveBeenCalledWith(expect.objectContaining({ principal: "maritaca:sabia-4", motivo: expect.stringContaining("403") }));
  });

  it("stream: falha ao ABRIR o stream vai para a reserva", async () => {
    const principal = new MockLanguageModelV3({ doStream: async () => { throw erroHttp(429, "rate limit"); } });
    const reserva = new MockLanguageModelV3({ doStream: async () => stream("da reserva") });
    const r = streamText({ model: comReserva(principal, reserva, ROT, () => {}), prompt: "oi", maxRetries: 0 });
    expect(await r.text).toBe("da reserva");
  });

  it("principal saudável: a reserva nem é chamada", async () => {
    const reservaGen = vi.fn(async () => resposta("da reserva"));
    const principal = new MockLanguageModelV3({ doGenerate: async () => resposta("do principal") });
    const reserva = new MockLanguageModelV3({ doGenerate: reservaGen });
    const r = await generateText({ model: comReserva(principal, reserva, ROT, () => {}), prompt: "oi" });
    expect(r.text).toBe("do principal");
    expect(reservaGen).not.toHaveBeenCalled();
  });

  it("erro 400 sobe como está, sem tentar a reserva", async () => {
    const reservaGen = vi.fn(async () => resposta("da reserva"));
    const principal = new MockLanguageModelV3({ doGenerate: async () => { throw erroHttp(400, "schema inválido"); } });
    const reserva = new MockLanguageModelV3({ doGenerate: reservaGen });
    await expect(generateText({ model: comReserva(principal, reserva, ROT, () => {}), prompt: "oi", maxRetries: 0 })).rejects.toThrow("schema inválido");
    expect(reservaGen).not.toHaveBeenCalled();
  });
});

describe("semChave", () => {
  it("não deixa pedaço de chave chegar ao log", () => {
    const m = semChave("Incorrect API key provided: 100088*****************6d2d. You can find your API key at https://plataforma.maritaca.ai");
    expect(m).not.toMatch(/100088|6d2d/);
    expect(m).toContain("[oculta]");
    expect(semChave("chave AIzaSyD-abcdefghijklmnop vazou")).not.toContain("AIzaSy");
  });
});
