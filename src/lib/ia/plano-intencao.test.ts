import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/ai/ontology", () => ({ vocabularioProximo: async () => "" }));
vi.mock("@/lib/ai/config", () => ({
  languageModel: async () => ({}),
  aiTimeout: () => undefined,
  hasAiKey: async () => false,
}));

const { planejarIntencao } = await import("./plano-intencao");

/**
 * O que importa testar aqui é a FALHA. O acerto do planner não se decide em
 * teste unitário — decide-se em `npm run eval:plano`, contra turno real, e o
 * veredito de lá é "ainda não" (30% de concordância de recorte).
 *
 * A falha, sim: um planner que devolve recorte quando não sabe cortaria a
 * ferramenta certa em silêncio. Ele tem de degradar para o conservador de hoje
 * — `precisaDados: true` e `modulos: []`, que significa "carrega todas".
 */
describe("planejarIntencao — degradação", () => {
  it("mensagem curta demais devolve a pergunta e carrega tudo", async () => {
    const p = await planejarIntencao({ spaceIds: "s1", pergunta: "oi", tags: [] });
    expect(p).toMatchObject({ consulta: "oi", precisaDados: true, modulos: [], confianca: 0, origem: "curta" });
  });

  it("sem chave de IA não inventa recorte", async () => {
    const p = await planejarIntencao({ spaceIds: "s1", pergunta: "quantas férias o tony tem", tags: [] });
    expect(p.origem).toBe("sem_chave");
    expect(p.modulos).toEqual([]);
    expect(p.precisaDados).toBe(true);
    expect(p.confianca).toBe(0);
  });

  /**
   * `confianca: 0` é o contrato do fallback: quem consumir o plano precisa
   * conseguir distinguir "decidi carregar tudo" de "não consegui decidir".
   */
  it("o fallback é reconhecível pela confiança zero", async () => {
    const curta = await planejarIntencao({ spaceIds: "s1", pergunta: "ok", tags: [] });
    const semChave = await planejarIntencao({ spaceIds: "s1", pergunta: "saldo de horas", tags: [] });
    expect(curta.confianca).toBe(0);
    expect(semChave.confianca).toBe(0);
  });

  it("preserva a pergunta original quando não consegue reescrever", async () => {
    const original = "quanto é meu saldo de banco de horas";
    const p = await planejarIntencao({ spaceIds: "s1", pergunta: original, tags: [] });
    expect(p.consulta).toBe(original);
  });
});
