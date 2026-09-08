import { describe, it, expect } from "vitest";
import {
  decidirAcesso,
  permitidoPelaTaxonomia,
  chaveModulo,
  type RegraAcesso,
  type ModuloDaTool,
} from "./acesso-regras";

/** Atalho para montar regra sem repetir os nulos em todo teste. */
function regra(p: Partial<RegraAcesso>): RegraAcesso {
  return {
    painel: null,
    alvo_tipo: "base",
    alvo: null,
    escopo_tipo: "modulo",
    tool_key: null,
    modulo: null,
    submodulo: null,
    efeito: "negar",
    ...p,
  };
}

const SESMT: ModuloDaTool[] = [{ modulo: "SEGURANÇA DO TRABALHO", submodulo: "CAT" }];
const PONTO: ModuloDaTool[] = [{ modulo: "FREQUÊNCIA", submodulo: "CONSULTAS" }];

describe("decidirAcesso — os quatro casos da demanda", () => {
  it("nega SESMT para o perfil GESTOR_FINANCEIRO só no Painel do Gestor", () => {
    const regras = [
      regra({
        painel: "PG",
        alvo_tipo: "perfil",
        alvo: "GESTOR_FINANCEIRO",
        modulo: "SEGURANÇA DO TRABALHO",
        efeito: "negar",
      }),
    ];
    const ctxGestor = { painel: "PG", perfil: "GESTOR_FINANCEIRO", usuario: "fulano" };
    expect(decidirAcesso(regras, ctxGestor, "sesmt_cat", SESMT)?.efeito).toBe("negar");

    // Mesma pessoa, outro painel: a regra não alcança.
    const ctxOperador = { painel: "PO", perfil: "GESTOR_FINANCEIRO", usuario: "fulano" };
    expect(decidirAcesso(regras, ctxOperador, "sesmt_cat", SESMT)).toBeNull();
  });

  it("nega ponto eletrônico para o usuário ADIAS em qualquer painel", () => {
    const regras = [
      regra({ alvo_tipo: "usuario", alvo: "ADIAS", modulo: "FREQUÊNCIA", efeito: "negar" }),
    ];
    for (const painel of ["PO", "PG", "PC"]) {
      const d = decidirAcesso(regras, { painel, perfil: "RH", usuario: "adias" }, "ponto", PONTO);
      expect(d?.efeito).toBe("negar");
    }
    // Outra pessoa continua passando.
    expect(decidirAcesso(regras, { painel: "PO", perfil: "RH", usuario: "outro" }, "ponto", PONTO))
      .toBeNull();
  });

  it("libera histórico financeiro só para um usuário (nega na base, permite no usuário)", () => {
    const modulos: ModuloDaTool[] = [
      { modulo: "ADMINISTRAÇÃO DE PESSOAL", submodulo: "FOLHA DE PAGAMENTO > HISTÓRICO FINANCEIRO" },
    ];
    const regras = [
      regra({ alvo_tipo: "base", modulo: "ADMINISTRAÇÃO DE PESSOAL", efeito: "negar" }),
      regra({
        alvo_tipo: "usuario",
        alvo: "FGOMES",
        modulo: "ADMINISTRAÇÃO DE PESSOAL",
        efeito: "permitir",
      }),
    ];
    expect(decidirAcesso(regras, { painel: "PO", perfil: "X", usuario: "fgomes" }, "hist", modulos)?.efeito)
      .toBe("permitir");
    expect(decidirAcesso(regras, { painel: "PO", perfil: "X", usuario: "outro" }, "hist", modulos)?.efeito)
      .toBe("negar");
  });

  it("libera treinamento para um perfil", () => {
    const modulos: ModuloDaTool[] = [{ modulo: "TREINAMENTO", submodulo: "GESTÃO DE TREINAMENTO" }];
    const regras = [
      regra({ alvo_tipo: "perfil", alvo: "RH", modulo: "TREINAMENTO", efeito: "permitir" }),
    ];
    expect(decidirAcesso(regras, { painel: "PO", perfil: "RH", usuario: "a" }, "trein", modulos)?.efeito)
      .toBe("permitir");
  });
});

describe("decidirAcesso — precedência", () => {
  it("usuário vence perfil, que vence base", () => {
    const regras = [
      regra({ alvo_tipo: "base", modulo: "FINANCEIRO", efeito: "negar" }),
      regra({ alvo_tipo: "perfil", alvo: "FOLHA", modulo: "FINANCEIRO", efeito: "permitir" }),
      regra({ alvo_tipo: "usuario", alvo: "joao", modulo: "FINANCEIRO", efeito: "negar" }),
    ];
    const mods: ModuloDaTool[] = [{ modulo: "FINANCEIRO", submodulo: null }];

    expect(decidirAcesso(regras, { painel: "PO", perfil: "FOLHA", usuario: "joao" }, "t", mods)?.efeito)
      .toBe("negar"); // regra de usuário decide
    expect(decidirAcesso(regras, { painel: "PO", perfil: "FOLHA", usuario: "maria" }, "t", mods)?.efeito)
      .toBe("permitir"); // cai no perfil
    expect(decidirAcesso(regras, { painel: "PO", perfil: "OUTRO", usuario: "maria" }, "t", mods)?.efeito)
      .toBe("negar"); // cai na base
  });

  it("escopo mais específico vence dentro do mesmo nível: bloqueia o módulo, libera uma tool", () => {
    const regras = [
      regra({ alvo_tipo: "base", escopo_tipo: "modulo", modulo: "FINANCEIRO", efeito: "negar" }),
      regra({ alvo_tipo: "base", escopo_tipo: "tool", tool_key: "contracheque", efeito: "permitir" }),
    ];
    const mods: ModuloDaTool[] = [{ modulo: "FINANCEIRO", submodulo: null }];
    const ctx = { painel: "PO", perfil: "X", usuario: "y" };

    expect(decidirAcesso(regras, ctx, "contracheque", mods)?.efeito).toBe("permitir");
    expect(decidirAcesso(regras, ctx, "outra_do_financeiro", mods)?.efeito).toBe("negar");
  });

  it("empate real entre regras igualmente específicas fecha", () => {
    const regras = [
      regra({ alvo_tipo: "base", escopo_tipo: "modulo", modulo: "FINANCEIRO", efeito: "permitir" }),
      regra({ alvo_tipo: "base", escopo_tipo: "modulo", modulo: "FINANCEIRO", efeito: "negar" }),
    ];
    const mods: ModuloDaTool[] = [{ modulo: "FINANCEIRO", submodulo: null }];
    expect(decidirAcesso(regras, { painel: "PO", perfil: "X", usuario: "y" }, "t", mods)?.efeito)
      .toBe("negar");
  });

  it("painel explícito desempata contra painel curinga", () => {
    const regras = [
      regra({ painel: null, alvo_tipo: "base", modulo: "FÉRIAS", efeito: "negar" }),
      regra({ painel: "PO", alvo_tipo: "base", modulo: "FÉRIAS", efeito: "permitir" }),
    ];
    const mods: ModuloDaTool[] = [{ modulo: "FÉRIAS", submodulo: null }];
    expect(decidirAcesso(regras, { painel: "PO", perfil: "X", usuario: "y" }, "t", mods)?.efeito)
      .toBe("permitir");
    expect(decidirAcesso(regras, { painel: "PG", perfil: "X", usuario: "y" }, "t", mods)?.efeito)
      .toBe("negar");
  });

  it("sem regra aplicável devolve null — que NÃO é permissão", () => {
    expect(decidirAcesso([], { painel: "PO", perfil: "X", usuario: "y" }, "t", SESMT)).toBeNull();
  });

  it("submódulo homônimo sob outro módulo não casa", () => {
    // 'RELATÓRIOS' existe sob FREQUÊNCIA e sob SEGURANÇA DO TRABALHO.
    const regras = [
      regra({
        alvo_tipo: "base",
        escopo_tipo: "submodulo",
        modulo: "FREQUÊNCIA",
        submodulo: "RELATÓRIOS",
        efeito: "negar",
      }),
    ];
    const ctx = { painel: "PO", perfil: "X", usuario: "y" };
    const daSeguranca: ModuloDaTool[] = [
      { modulo: "SEGURANÇA DO TRABALHO", submodulo: "RELATÓRIOS" },
    ];
    expect(decidirAcesso(regras, ctx, "t", daSeguranca)).toBeNull();

    const daFrequencia: ModuloDaTool[] = [{ modulo: "FREQUÊNCIA", submodulo: "RELATÓRIOS" }];
    expect(decidirAcesso(regras, ctx, "t", daFrequencia)?.efeito).toBe("negar");
  });
});

describe("decidirAcesso — ferramentas protegidas de bloqueio", () => {
  const daEstrutura: ModuloDaTool[] = [{ modulo: "ESTRUTURA", submodulo: null }];
  const ctx = { painel: "PO", perfil: "FOLHA", usuario: "joao" };

  it("ignora o bloqueio por módulo numa ferramenta protegida", () => {
    const regras = [regra({ alvo_tipo: "base", modulo: "ESTRUTURA", efeito: "negar" })];
    expect(decidirAcesso(regras, ctx, "estrutura_centros_custo", daEstrutura, true)).toBeNull();
    // A mesma regra derruba uma ferramenta não protegida do mesmo módulo.
    expect(decidirAcesso(regras, ctx, "outra_qualquer", daEstrutura, false)?.efeito).toBe("negar");
  });

  it("ignora o bloqueio nominal — nem apontando a ferramenta pelo nome", () => {
    const regras = [
      regra({ alvo_tipo: "usuario", alvo: "joao", escopo_tipo: "tool", tool_key: "lista_opcoes", efeito: "negar" }),
    ];
    expect(decidirAcesso(regras, ctx, "lista_opcoes", [], true)).toBeNull();
  });

  it("liberação explícita continua valendo numa protegida", () => {
    const regras = [
      regra({ alvo_tipo: "perfil", alvo: "FOLHA", modulo: "ESTRUTURA", efeito: "permitir" }),
    ];
    expect(decidirAcesso(regras, ctx, "estrutura_cargos", daEstrutura, true)?.efeito).toBe("permitir");
  });

  it("com regras de negar E permitir, a protegida fica com a liberação", () => {
    const regras = [
      regra({ alvo_tipo: "base", modulo: "ESTRUTURA", efeito: "negar" }),
      regra({ alvo_tipo: "base", escopo_tipo: "tool", tool_key: "estrutura_cargos", efeito: "permitir" }),
    ];
    expect(decidirAcesso(regras, ctx, "estrutura_cargos", daEstrutura, true)?.efeito).toBe("permitir");
  });
});

describe("permitidoPelaTaxonomia — o cruzamento automático com o ERP", () => {
  const taxonomia = new Set(
    ["FREQUÊNCIA", "SEGURANÇA DO TRABALHO", "ADMINISTRAÇÃO DE PESSOAL"].map(chaveModulo),
  );

  it("corta quando o módulo existe no ERP e o usuário não o tem", () => {
    const doUsuario: ModuloDaTool[] = [{ modulo: "FREQUÊNCIA", submodulo: "CONSULTAS" }];
    expect(permitidoPelaTaxonomia(SESMT, doUsuario, taxonomia)).toBe(false);
  });

  it("passa quando o usuário tem o módulo", () => {
    const doUsuario: ModuloDaTool[] = [{ modulo: "SEGURANÇA DO TRABALHO", submodulo: "CAT" }];
    expect(permitidoPelaTaxonomia(SESMT, doUsuario, taxonomia)).toBe(true);
  });

  it("tool marcada no módulo inteiro passa com qualquer submódulo daquele módulo", () => {
    const daTool: ModuloDaTool[] = [{ modulo: "FREQUÊNCIA", submodulo: null }];
    const doUsuario: ModuloDaTool[] = [{ modulo: "FREQUÊNCIA", submodulo: "LANÇAMENTOS" }];
    expect(permitidoPelaTaxonomia(daTool, doUsuario, taxonomia)).toBe(true);
  });

  it("PASSA quando nenhum módulo da tool existe na taxonomia do ERP (as 37 órfãs)", () => {
    // 'FINANCEIRO' não existe em apex_programas: a API nunca o devolve para
    // ninguém. Cortar aqui derrubaria a ferramenta para todos os usuários.
    const orfa: ModuloDaTool[] = [{ modulo: "FINANCEIRO", submodulo: null }];
    const doUsuario: ModuloDaTool[] = [{ modulo: "FREQUÊNCIA", submodulo: "CONSULTAS" }];
    expect(permitidoPelaTaxonomia(orfa, doUsuario, taxonomia)).toBe(true);
  });

  it("tool sem nenhuma tag passa — não há eixo para cruzar", () => {
    expect(permitidoPelaTaxonomia([], [], taxonomia)).toBe(true);
  });

  it("usuário sem nenhum módulo perde as tools mapeadas, mas não as órfãs", () => {
    expect(permitidoPelaTaxonomia(SESMT, [], taxonomia)).toBe(false);
    const orfa: ModuloDaTool[] = [{ modulo: "PAGAMENTO", submodulo: null }];
    expect(permitidoPelaTaxonomia(orfa, [], taxonomia)).toBe(true);
  });
});
