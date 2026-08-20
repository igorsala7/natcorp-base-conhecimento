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

describe("marcarCacheDeTools — segundo breakpoint nas essenciais", () => {
  const t2 = (d: string) => ({ description: d, inputSchema: {} });
  const lista = { ess1: t2("E1"), ess2: t2("E2"), outra1: t2("O1"), outra2: t2("O2") };

  it("essenciais como prefixo CONTINUO ganham breakpoint", () => {
    // Medido no simulador: em 13 perguntas de assuntos diferentes as 5
    // essenciais saem sempre primeiro e na mesma ordem — dai dar para marcar
    // sem reordenar nada.
    const out = marcarCacheDeTools(lista, ["ess1", "ess2"]);
    expect(out.ess2).toHaveProperty("providerOptions", ANTHROPIC_CACHE);
    expect(out.outra2).toHaveProperty("providerOptions", ANTHROPIC_CACHE);
    expect(out.ess1).not.toHaveProperty("providerOptions");
    expect(out.outra1).not.toHaveProperty("providerOptions");
  });

  it("essenciais ESPALHADAS: omite o 2o breakpoint em vez de reordenar", () => {
    // Reordenar invalidaria o cache de tools, system E mensagens de uma vez.
    const espalhadas = { ess1: t2("E1"), outra1: t2("O1"), ess2: t2("E2") };
    const marcadas = Object.entries(marcarCacheDeTools(espalhadas, ["ess1", "ess2"]))
      .filter(([, v]) => "providerOptions" in v).map(([k]) => k);
    expect(marcadas).toEqual(["ess2"]); // so a ultima da lista
  });

  it("TODAS essenciais: nao duplica o breakpoint da ultima", () => {
    const marcadas = Object.values(marcarCacheDeTools({ a: t2("A"), b: t2("B") }, ["a", "b"]))
      .filter((v) => "providerOptions" in v);
    expect(marcadas).toHaveLength(1);
  });

  it("essencial inexistente na lista e ignorada", () => {
    const out = marcarCacheDeTools(lista, ["ess1", "ess2", "fantasma"]);
    expect(out.ess2).toHaveProperty("providerOptions", ANTHROPIC_CACHE);
  });

  it("sem essenciais, mantem 1 breakpoint (compatibilidade)", () => {
    const marcadas = Object.values(marcarCacheDeTools(lista)).filter((v) => "providerOptions" in v);
    expect(marcadas).toHaveLength(1);
  });

  it("no MAXIMO 2 breakpoints — o teto da Anthropic e 4 no total", () => {
    // 2 aqui + 1 na ultima mensagem = 3. Sobra 1 de folga.
    const muitas = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`t${i}`, t2(String(i))]));
    const marcadas = Object.values(marcarCacheDeTools(muitas, ["t0", "t1", "t2"]))
      .filter((v) => "providerOptions" in v);
    expect(marcadas.length).toBeLessThanOrEqual(2);
  });
});

describe("IDENTIDADE DE PAYLOAD — a prova de que o modelo le a mesma coisa", () => {
  /**
   * Este e o teste que sustenta a afirmacao "invisivel ao modelo". Compara o
   * payload inteiro antes e depois da marcacao, ignorando SO `providerOptions`
   * (metadado do provedor, retirado antes de o payload chegar ao modelo).
   *
   * Se ele passa, nenhuma mudanca de comportamento e possivel: o modelo recebe
   * as mesmas ferramentas, na mesma ordem, com a mesma descricao e o mesmo
   * schema.
   */
  const semProviderOptions = (o: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        const { providerOptions: _ignorado, ...resto } = v as Record<string, unknown>;
        return [k, resto];
      }),
    );

  // Uma lista realista: integracoes primeiro (como o tool-builder monta), depois
  // as locais (form/visual/query) — a ordem exata que a rota produz.
  const payload = {
    estrutura_filiais: { description: "Filiais", inputSchema: { type: "object", properties: { emp: { type: "number" } } } },
    lista_opcoes: { description: "Opções", inputSchema: { type: "object" } },
    meus_dados: { description: "Meus dados", inputSchema: { type: "object" } },
    bi_headcount: { description: "Headcount por estrutura", inputSchema: { type: "object", properties: { mes: { type: "string" } } } },
    ms_email_enviar: { description: "Enviar e-mail", inputSchema: { type: "object", properties: { para: { type: "string" }, assunto: { type: "string" } } } },
    consultar_registros: { description: "Filtra 100% das linhas", inputSchema: { type: "object" } },
    montar_grafico: { description: "Gráfico", inputSchema: { type: "object" } },
  };
  const essenciais = ["estrutura_filiais", "lista_opcoes", "meus_dados"];

  it("payload IDENTICO fora o providerOptions", () => {
    const marcado = marcarCacheDeTools(payload, essenciais);
    expect(semProviderOptions(marcado)).toEqual(payload);
  });

  it("ordem das chaves IDENTICA — tools e o 1o bloco do payload", () => {
    // Reordenar invalidaria o cache de tools, system E mensagens de uma vez.
    expect(Object.keys(marcarCacheDeTools(payload, essenciais))).toEqual(Object.keys(payload));
  });

  it("marca exatamente 2 pontos: fim das essenciais e fim da lista", () => {
    const marcadas = Object.entries(marcarCacheDeTools(payload, essenciais))
      .filter(([, v]) => "providerOptions" in v)
      .map(([k]) => k);
    expect(marcadas).toEqual(["meus_dados", "montar_grafico"]);
  });

  it("a entrada original nao e tocada", () => {
    const antes = JSON.stringify(payload);
    marcarCacheDeTools(payload, essenciais);
    expect(JSON.stringify(payload)).toBe(antes);
  });
});

/**
 * A ORDEM É O CACHE.
 *
 * `tools` é o primeiro bloco do payload: o que muda ali invalida tools, system
 * e mensagens de uma vez. As de integração são remontadas a cada pergunta por
 * top-K semântico — com elas na frente, o prefixo quebrava em TODO turno, por
 * construção. Medido: 21%–38% de leitura de cache, contra ~70% esperado.
 */
describe("marcarCacheDeTools — breakpoint do bloco estável", () => {
  const t = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i}`, { d: i }]));
  const marcada = (o: Record<string, unknown>, k: string) =>
    !!(o[k] as { providerOptions?: unknown } | undefined)?.providerOptions;

  it("marca o fim do bloco estável E o fim da lista", () => {
    const out = marcarCacheDeTools(t(6), ["t0", "t1", "t2"]);
    expect(marcada(out, "t2")).toBe(true); // fim do estável
    expect(marcada(out, "t5")).toBe(true); // fim da lista
    for (const k of ["t0", "t1", "t3", "t4"]) expect(marcada(out, k)).toBe(false);
  });

  it("bloco estável que NÃO é prefixo contínuo não ganha breakpoint", () => {
    // Um breakpoint no meio de um bloco que muda não cacheia nada — só queima um
    // dos quatro que a Anthropic permite. Era o caso ANTES da reordenação.
    const out = marcarCacheDeTools(t(6), ["t0", "t4"]);
    expect(marcada(out, "t4")).toBe(false);
    expect(marcada(out, "t1")).toBe(false);
    expect(marcada(out, "t5")).toBe(true); // o do fim continua
  });

  it("tudo estável: só o breakpoint do fim (seriam dois no mesmo lugar)", () => {
    const out = marcarCacheDeTools(t(3), ["t0", "t1", "t2"]);
    expect(marcada(out, "t2")).toBe(true);
    expect(marcada(out, "t1")).toBe(false);
  });

  it("chave estável que não está na lista é ignorada", () => {
    const out = marcarCacheDeTools(t(4), ["t0", "t1", "nao_existe"]);
    expect(marcada(out, "t1")).toBe(true);
    expect(marcada(out, "t3")).toBe(true);
  });

  it("não muta a entrada nem troca a ordem das chaves", () => {
    const entrada = t(4);
    const antes = JSON.stringify(entrada);
    const out = marcarCacheDeTools(entrada, ["t0", "t1"]);
    expect(JSON.stringify(entrada)).toBe(antes);
    expect(Object.keys(out)).toEqual(["t0", "t1", "t2", "t3"]);
  });
});

describe("marcarCacheDeTools — núcleo (terceiro breakpoint)", () => {
  const marcado = (t: Record<string, unknown>, k: string) =>
    !!(t[k] as { providerOptions?: unknown } | undefined)?.providerOptions;

  const tools = { q1: {}, q2: {}, f1: {}, v1: {}, i1: {}, i2: {} };
  const NUCLEO = ["q1", "q2"];
  const ESTAVEIS = ["q1", "q2", "f1", "v1"];

  it("marca núcleo, fim do bloco estável e a última — três pontos", () => {
    const r = marcarCacheDeTools(tools, ESTAVEIS, NUCLEO);
    expect(marcado(r, "q2")).toBe(true);  // fim do núcleo
    expect(marcado(r, "v1")).toBe(true);  // fim do bloco estável
    expect(marcado(r, "i2")).toBe(true);  // última
    expect(marcado(r, "f1")).toBe(false);
    // Nunca mais de 3: a Anthropic aceita 4, e o quarto fica de reserva.
    expect(Object.keys(r).filter((k) => marcado(r, k))).toHaveLength(3);
  });

  it("omite o núcleo quando ele não é prefixo contínuo", () => {
    // Reordenar para forçar o prefixo invalidaria tools + system + mensagens.
    const fora = { f1: {}, q1: {}, q2: {}, i1: {} };
    const r = marcarCacheDeTools(fora, ["f1", "q1", "q2"], NUCLEO);
    expect(marcado(r, "q2")).toBe(true);   // fim do bloco estável, ainda vale
    expect(marcado(r, "q1")).toBe(false);  // núcleo não é prefixo → sem breakpoint
  });

  it("sem núcleo, o comportamento anterior é preservado", () => {
    const r = marcarCacheDeTools(tools, ESTAVEIS);
    expect(Object.keys(r).filter((k) => marcado(r, k))).toEqual(["v1", "i2"]);
  });

  it("não muta a entrada", () => {
    const orig = { a: {}, b: {} };
    marcarCacheDeTools(orig, ["a"], ["a"]);
    expect(marcado(orig, "a")).toBe(false);
    expect(marcado(orig, "b")).toBe(false);
  });
});
