import { describe, it, expect } from "vitest";
import { temSinalDePeriodo, ehParamDePeriodo, toolsQuePedemPeriodo, opcoesDePeriodo, precisaPerguntarPeriodo, faltaPeriodoNaChamada, respostaFaltaPeriodo } from "./periodo";

const tool = (key: string, params: unknown) => ({ key, name: key, params });
const P = (nome: string, origem = "modelo", obrigatorio = true) => ({ nome, descricao: "", origem, obrigatorio });

describe("temSinalDePeriodo", () => {
  it("reconhece as formas que as pessoas realmente escrevem", () => {
    for (const t of [
      "eventos de 01/03 a 31/03", "março/2025", "quem marcou o ponto hoje",
      "na semana passada", "últimos 3 meses", "no mês atual", "desde janeiro",
      // As formas com demonstrativo — 8 dos 12 falsos positivos medidos em produção.
      "Quais são as minhas reuniões deste mês?", "marcaram o ponto nesse mês",
      "quero saber neste período os colaboradores", "minhas reuniões deste ano",
      "compromissos desse mês", "no trimestre atual", "a partir de 01/07",
      "quero de 2025", "entre 01/01 e 30/06", "período de apuração de abril",
    ]) expect(temSinalDePeriodo(t), t).toBe(true);
  });

  it("não confunde número solto nem matrícula com período", () => {
    for (const t of [
      "Quero ver os eventos de apuração de ponto da matrícula 205818",
      "traga a lista completa", "quais são os meus dados", "empresa 700",
    ]) expect(temSinalDePeriodo(t), t).toBe(false);
  });
});

describe("ehParamDePeriodo", () => {
  it("só conta o que o MODELO preenche", () => {
    expect(ehParamDePeriodo(P("data_inicial"))).toBe(true);
    expect(ehParamDePeriodo(P("competencia"))).toBe(true);
    // Data resolvida pelo servidor não depende do que a pessoa disse.
    expect(ehParamDePeriodo(P("data_inicial", "sistema"))).toBe(false);
  });

  it("ignora data OPCIONAL — filtro que a API não exige não vira pergunta", () => {
    // Medido: informacoes_pessoais_funcionais_resumido tem 4 datas opcionais, e
    // "Traga meus colaboradores" não precisa de período nenhum.
    expect(ehParamDePeriodo(P("p_dt_admissao_ini", "modelo", false))).toBe(false);
    expect(ehParamDePeriodo(P("p_data_ini", "modelo", true))).toBe(true);
  });

  it("não casa por substring — 'ano' dentro de outra palavra não é período", () => {
    expect(ehParamDePeriodo(P("planejamento"))).toBe(false);
    expect(ehParamDePeriodo(P("matricula"))).toBe(false);
  });
});

describe("precisaPerguntarPeriodo", () => {
  const comData = [tool("consultar_marcacoes", [P("data_inicial"), P("data_final")])];

  it("pergunta quando a ferramenta pede período e ninguém disse", () => {
    const r = precisaPerguntarPeriodo({ pergunta: "Quero ver os eventos da matrícula 205818", tools: comData });
    expect(r.precisa).toBe(true);
    expect(r.tools).toEqual(["consultar_marcacoes"]);
  });

  it("NÃO pergunta quando o período veio em turnos anteriores", () => {
    const r = precisaPerguntarPeriodo({
      pergunta: "E os do Tony?",
      historico: [{ role: "user", content: "me traga as marcações de março/2025" }, { role: "assistant", content: "Aqui estão…" }],
      tools: comData,
    });
    expect(r.precisa).toBe(false);
  });

  it("não olha longe demais: período de vinte turnos atrás não governa o pedido de agora", () => {
    const antigo = [{ role: "user", content: "março/2025" }, ...Array.from({ length: 8 }, () => ({ role: "user", content: "ok" }))];
    expect(precisaPerguntarPeriodo({ pergunta: "e agora?", historico: antigo, tools: comData }).precisa).toBe(true);
  });

  it("IGNORA datas que o próprio agente escreveu — o período tem que vir da pessoa", () => {
    // As respostas do agente citam datas o tempo todo ("período aquisitivo
    // 03/06/2025 a 02/06/2026"); lê-las fazia o portão nunca disparar.
    const r = precisaPerguntarPeriodo({
      pergunta: "Quero ver os eventos de apuração da matrícula 205818",
      historico: [
        { role: "user", content: "quais são os dados dele?" },
        { role: "assistant", content: "Período aquisitivo 03/06/2025 a 02/06/2026, admitido em 12/03/2019." },
      ],
      tools: comData,
    });
    expect(r.precisa).toBe(true);
  });

  it("não pergunta quando nenhuma ferramenta do turno pede período", () => {
    const r = precisaPerguntarPeriodo({ pergunta: "quais são meus dados", tools: [tool("meus_dados", [P("matricula")])] });
    expect(r.precisa).toBe(false);
  });

  it("não pergunta quando a data da ferramenta é só um filtro opcional", () => {
    const cadastro = [tool("informacoes_pessoais_funcionais_resumido", [P("p_dt_admissao_ini", "modelo", false)])];
    expect(precisaPerguntarPeriodo({ pergunta: "Traga meus colaboradores", tools: cadastro }).precisa).toBe(false);
  });
});

describe("opcoesDePeriodo", () => {
  it("oferece opções concretas e datadas, nunca uma pergunta em aberto", () => {
    const o = opcoesDePeriodo(new Date(Date.UTC(2026, 7, 19)));
    expect(o.map((x) => x.id)).toEqual(["mes_atual", "mes_anterior", "ultimos_3", "ano_atual"]);
    expect(o[0]!.label).toContain("agosto/2026");
    expect(o[0]!.de).toBe("2026-08-01");
    expect(o[1]!.label).toContain("julho/2026");
    expect(o[1]!.de).toBe("2026-07-01");
    expect(o[1]!.ate).toBe("2026-07-31");
    expect(o[2]!.de).toBe("2026-06-01");
    expect(o[3]!.de).toBe("2026-01-01");
  });

  it("vira o ano corretamente em janeiro", () => {
    const o = opcoesDePeriodo(new Date(Date.UTC(2026, 0, 15)));
    expect(o[1]!.label).toContain("dezembro/2025");
    expect(o[1]!.de).toBe("2025-12-01");
    expect(o[1]!.ate).toBe("2025-12-31");
  });
});

describe("faltaPeriodoNaChamada — decisão na EXECUÇÃO", () => {
  const exige = [{ nome: "data_ini", descricao: "", origem: "modelo", obrigatorio: true }];
  const opcional = [{ nome: "p_dt_admissao_ini", descricao: "", origem: "modelo", obrigatorio: false }];

  it("barra quando a ferramenta exige data e ninguém informou período", () => {
    expect(faltaPeriodoNaChamada(exige, false)).toBe(true);
  });

  it("deixa passar assim que a pessoa informou o período", () => {
    expect(faltaPeriodoNaChamada(exige, true)).toBe(false);
  });

  it("nunca barra por causa de um filtro de data OPCIONAL", () => {
    // "Traga meus colaboradores" não precisa de período, e a tool de cadastro
    // tem quatro datas opcionais — barrar aqui era 14% de todos os turnos.
    expect(faltaPeriodoNaChamada(opcional, false)).toBe(false);
  });

  it("a resposta traz as opções prontas, não uma pergunta em aberto", () => {
    const r = respostaFaltaPeriodo(new Date(Date.UTC(2026, 7, 19)));
    expect(r._erro).toBe("PERÍODO NÃO INFORMADO");
    expect(r._perguntar).toMatch(/NÃO escolha um intervalo por conta própria/);
    expect(r.opcoes).toHaveLength(4);
    expect(r.opcoes[0]).toContain("agosto/2026");
    expect(r.opcoes[0]).toContain("2026-08-01");
  });
});
