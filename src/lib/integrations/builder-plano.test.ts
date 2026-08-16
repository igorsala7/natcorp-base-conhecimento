import { describe, it, expect, vi } from "vitest";
import { emSimulacao, descreverPlano, type Operacao } from "./builder-plano";

/** Duas ferramentas de mentira: uma que lê, uma que escreve. */
function conjunto(escreveu: string[]) {
  return {
    estado_atual: { execute: async () => "resumo real" },
    salvar_ferramenta: {
      execute: async (a: { key: string }) => {
        escreveu.push(a.key);
        return "gravado";
      },
    },
  } as never;
}

describe("portão do construtor", () => {
  it("a escrita NÃO acontece em simulação", async () => {
    const escreveu: string[] = [];
    const reg: Operacao[] = [];
    const t = emSimulacao(conjunto(escreveu), reg) as never as Record<string, { execute: (a: unknown) => Promise<unknown> }>;

    await t.salvar_ferramenta!.execute({ key: "consultar_ferias" });

    // O ponto inteiro: o banco não foi tocado, e a intenção ficou registrada.
    expect(escreveu).toEqual([]);
    expect(reg).toEqual([{ ferramenta: "salvar_ferramenta", args: { key: "consultar_ferias" } }]);
  });

  it("a LEITURA continua real — o plano precisa do estado verdadeiro", async () => {
    const reg: Operacao[] = [];
    const t = emSimulacao(conjunto([]), reg) as never as Record<string, { execute: () => Promise<unknown> }>;

    expect(await t.estado_atual!.execute()).toBe("resumo real");
    expect(reg).toEqual([]);
  });

  it("o retorno simulado impede o modelo de anunciar sucesso", async () => {
    const reg: Operacao[] = [];
    const t = emSimulacao(conjunto([]), reg) as never as Record<string, { execute: (a: unknown) => Promise<{ aviso: string }> }>;

    const r = await t.salvar_ferramenta!.execute({ key: "x" });
    // Sem este aviso o modelo assume sucesso e escreve "pronto, criei" — e a
    // pessoa lê uma afirmação falsa antes de ver o plano.
    expect(r.aviso).toMatch(/não gravado/i);
    expect(r.aviso).toMatch(/VAI acontecer/);
  });

  it("o plano mostra a CHAVE, que é o que distingue um objeto do outro", () => {
    const linhas = descreverPlano([
      { ferramenta: "salvar_ferramenta", args: { key: "consultar_ferias" } },
      { ferramenta: "vincular", args: { agente: "rh", tool: "consultar_ferias" } },
      { ferramenta: "desconhecida", args: {} },
    ]);
    // "criar a ferramenta consultar_ferias" e "...consultar_feriass" são
    // indistinguíveis sem a chave — e é assim que nasce tool duplicada.
    expect(linhas[0]).toBe("Criar ou editar a ferramenta: consultar_ferias");
    expect(linhas[1]).toBe("Vincular ferramenta ao agente: rh ← consultar_ferias");
    // Ferramenta nova sem rótulo cadastrado não some do plano.
    expect(linhas[2]).toBe("desconhecida");
  });
});
