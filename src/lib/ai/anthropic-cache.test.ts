import { describe, expect, it } from "vitest";
import { ANTHROPIC_CACHE, marcarCacheDeTools, withPrefixCache } from "./anthropic-cache";

/** Uma "ferramenta" reduzida ao que importa aqui: o schema é opaco para o cache. */
const t = (descricao: string) => ({ description: descricao, inputSchema: { type: "object" } });

describe("marcarCacheDeTools", () => {
  const tools = { alfa: t("A"), beta: t("B"), gama: t("C") };

  it("marca a ÚLTIMA ferramenta — e só ela", () => {
    // O ponto da mudança: a marcação ficava na última tool de INTEGRAÇÃO, com as
    // locais (query/visual/form) montadas depois e portanto FORA do prefixo.
    const out = marcarCacheDeTools(tools);
    expect(out.alfa).not.toHaveProperty("providerOptions");
    expect(out.beta).not.toHaveProperty("providerOptions");
    expect(out.gama).toHaveProperty("providerOptions", ANTHROPIC_CACHE);
  });

  it("preserva a ORDEM das chaves", () => {
    // `tools` é o primeiro bloco do payload; reordenar invalidaria o cache de
    // tools, de system E de mensagens de uma vez.
    expect(Object.keys(marcarCacheDeTools(tools))).toEqual(["alfa", "beta", "gama"]);
  });

  it("não muta a entrada", () => {
    const original = { alfa: t("A"), beta: t("B") };
    marcarCacheDeTools(original);
    expect(original.beta).not.toHaveProperty("providerOptions");
  });

  it("preserva description e schema — o modelo lê exatamente o mesmo", () => {
    // É a prova de que a mudança é INVISÍVEL ao modelo: `providerOptions` é
    // metadado do provedor, retirado antes do payload chegar nele.
    const out = marcarCacheDeTools(tools);
    for (const k of Object.keys(tools) as (keyof typeof tools)[]) {
      expect(out[k]).toMatchObject({ description: tools[k].description, inputSchema: tools[k].inputSchema });
    }
  });

  it("lista vazia devolve a mesma referência, sem quebrar", () => {
    const vazio = {};
    expect(marcarCacheDeTools(vazio)).toBe(vazio);
  });

  it("uma ferramenta só é marcada", () => {
    expect(marcarCacheDeTools({ unica: t("U") }).unica).toHaveProperty("providerOptions", ANTHROPIC_CACHE);
  });

  it("gera UM breakpoint — o teto da Anthropic é 4 no total", () => {
    const muitas = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`t${i}`, t(String(i))]));
    const marcadas = Object.values(marcarCacheDeTools(muitas)).filter((x) => "providerOptions" in x);
    expect(marcadas).toHaveLength(1);
  });
});

describe("withPrefixCache", () => {
  const msgs = [{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }];

  it("marca só a última mensagem", () => {
    const out = withPrefixCache(msgs, true);
    expect(out[0]).not.toHaveProperty("providerOptions");
    expect(out[1]).toHaveProperty("providerOptions", ANTHROPIC_CACHE);
  });

  it("desligado, devolve a MESMA referência", () => {
    // Importante: sem ferramentas o turno é chamada ÚNICA (não há `stopWhen`),
    // então não há segunda chamada para ler o cache — marcar seria escrita pura,
    // 1,25x de custo sem retorno. Por isso o gate existe.
    expect(withPrefixCache(msgs, false)).toBe(msgs);
  });

  it("não muta a entrada", () => {
    const original = [{ role: "user", content: "oi" }];
    withPrefixCache(original, true);
    expect(original[0]).not.toHaveProperty("providerOptions");
  });

  it("preserva role e content", () => {
    const out = withPrefixCache(msgs, true);
    expect(out[1]).toMatchObject({ role: "assistant", content: "olá" });
  });

  it("lista vazia não quebra", () => {
    expect(withPrefixCache([], true)).toEqual([]);
  });
});
