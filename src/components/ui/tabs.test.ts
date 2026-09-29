import { describe, it, expect } from "vitest";
import { resolverAba, type Aba } from "./tabs";

/**
 * O projeto não tem jsdom (ambiente `node`), então o teste cobre o miolo PURO:
 * qual aba o `?aba=` seleciona. É a regra que o `Tabs` e o `useAbaAtual` liam
 * cada um por sua conta — duas cópias do mesmo `if`, uma em cada arquivo — e por
 * isso ela virou função.
 */
const aba = (key: string, extra: Partial<Aba> = {}): Aba => ({ key, label: key, ...extra });

describe("resolverAba", () => {
  const tabs = [aba("bases"), aba("apis"), aba("conversas", { href: "/admin/conversas" })];

  it("sem parâmetro, cai na primeira aba DESTA tela", () => {
    expect(resolverAba(tabs, null)).toBe("bases");
  });

  it("o parâmetro escolhe a aba desta tela", () => {
    expect(resolverAba(tabs, "apis")).toBe("apis");
  });

  it("parâmetro desconhecido cai na primeira, não em painel vazio", () => {
    // URL colada de outra versão do produto não pode virar tela em branco.
    expect(resolverAba(tabs, "aba-que-nao-existe")).toBe("bases");
  });

  it("aba de OUTRA rota nunca é a aba atual desta barra", () => {
    // `?aba=conversas` em /admin/integracoes não tem painel para montar: a aba
    // Conversas é a rota /admin/conversas. Sem esta regra, o `useAbaAtual`
    // devolvia "conversas" e a tela caía no último `else` da cadeia de painéis —
    // mostrando o painel do WhatsApp com a barra acesa em Conversas.
    expect(resolverAba(tabs, "conversas")).toBe("bases");
  });

  it("a primeira aba desabilitada não vira a primeira", () => {
    const comDesabilitada = [aba("a", { disabled: true }), aba("b")];
    expect(resolverAba(comDesabilitada, null)).toBe("b");
  });

  it("barra só de links não inventa aba atual", () => {
    // Não acontece hoje (barra assim usa `AbasRota`), mas devolver `undefined`
    // aqui viraria `?aba=undefined` na primeira troca.
    const soLinks = [aba("x", { href: "/admin/x" }), aba("y", { href: "/admin/y" })];
    expect(resolverAba(soLinks, null)).toBe("x");
  });
});
