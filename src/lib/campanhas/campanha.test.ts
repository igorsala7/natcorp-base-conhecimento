import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MAX_TITULO,
  ROTULO_DO_ESTADO,
  campanhaParaFormulario,
  dadosDaCampanhaSchema,
  estadoDaCampanha,
  isoParaLocal,
  localParaIso,
  mensagemDeAutoExclusao,
  problemasDaCampanha,
  regraExcluiAPropriaBase,
  type Campanha,
} from "./campanha";

const AGORA = new Date("2026-09-27T12:00:00.000Z");

function campanha(p: Partial<Campanha> = {}): Campanha {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    titulo: "Folha fechada",
    corpo: "",
    regra: {},
    publicarEm: "2026-09-27T09:00:00.000Z",
    encerrarEm: null,
    enabled: true,
    repetir: false,
    criadaPor: "ana",
    criadaEm: "2026-09-27T09:00:00.000Z",
    ...p,
  };
}

describe("estado da campanha", () => {
  it("dentro da janela e ligada: aparecendo agora", () => {
    expect(estadoDaCampanha(campanha(), AGORA)).toBe("ativa");
  });

  it("publicar_em no futuro: agendada", () => {
    expect(estadoDaCampanha(campanha({ publicarEm: "2026-09-28T09:00:00.000Z" }), AGORA)).toBe(
      "agendada",
    );
  });

  it("encerrar_em no passado: encerrada", () => {
    expect(estadoDaCampanha(campanha({ encerrarEm: "2026-09-27T11:00:00.000Z" }), AGORA)).toBe(
      "encerrada",
    );
  });

  it("encerrar_em no futuro não encerra (a comparação é com o instante, não com o dia)", () => {
    expect(estadoDaCampanha(campanha({ encerrarEm: "2026-09-27T12:00:01.000Z" }), AGORA)).toBe(
      "ativa",
    );
  });

  it("desligada: parada, mesmo dentro da janela", () => {
    expect(estadoDaCampanha(campanha({ enabled: false }), AGORA)).toBe("desligada");
  });

  /**
   * A ORDEM DOS RAMOS É A REGRA, e este é o caso que a prova.
   *
   * Janela vencida vence o interruptor: religar uma campanha cujo `encerrar_em`
   * já passou não a faz aparecer, porque `alertas_para` corta pela janela também.
   * Chamá-la de "Parado" sugeriria que religar resolve, e a pessoa clicaria num
   * botão sem efeito visível.
   */
  it("janela vencida E desligada: encerrada, não parada", () => {
    expect(
      estadoDaCampanha(
        campanha({ enabled: false, encerrarEm: "2026-09-27T11:00:00.000Z" }),
        AGORA,
      ),
    ).toBe("encerrada");
  });

  it("todo estado tem rótulo: sem isto a etiqueta sairia vazia num estado novo", () => {
    for (const estado of ["ativa", "agendada", "encerrada", "desligada"] as const) {
      expect(ROTULO_DO_ESTADO[estado].rotulo.length).toBeGreaterThan(0);
    }
  });
});

describe("problemas de preenchimento (os dois CHECKs do banco, em português)", () => {
  const bom = {
    titulo: "Folha fechada",
    publicarEm: "2026-09-27T09:00:00.000Z",
    encerrarEm: null,
  };

  it("preenchimento correto não acusa nada", () => {
    expect(problemasDaCampanha(bom)).toEqual([]);
  });

  it("título vazio é recusado (CHECK ai_campanhas_titulo_nao_branco)", () => {
    expect(problemasDaCampanha({ ...bom, titulo: "" }).map((p) => p.campo)).toEqual(["titulo"]);
  });

  /**
   * Título só de espaço em branco, e aqui o TypeScript é MAIS estreito que o
   * banco de propósito: `btrim` de um argumento apara só espaço, então um título
   * feito de tabulação passaria pelo CHECK e viraria uma primeira mensagem em
   * branco no chat de todo mundo que a regra alcança. A direção do desvio é a
   * segura: recusar aqui o que o banco aceitaria.
   */
  it("título só de branco é recusado, inclusive tabulação (mais estreito que o btrim do banco)", () => {
    expect(problemasDaCampanha({ ...bom, titulo: "   " })).toHaveLength(1);
    expect(problemasDaCampanha({ ...bom, titulo: "\t\n" })).toHaveLength(1);
  });

  it("título comprido é recusado, com o campo nomeado", () => {
    const p = problemasDaCampanha({ ...bom, titulo: "x".repeat(MAX_TITULO + 1) });
    expect(p).toHaveLength(1);
    expect(p[0]!.campo).toBe("titulo");
  });

  it("data de início ausente ou ilegível é recusada", () => {
    expect(problemasDaCampanha({ ...bom, publicarEm: null }).map((p) => p.campo)).toEqual([
      "publicarEm",
    ]);
    expect(problemasDaCampanha({ ...bom, publicarEm: "ontem" }).map((p) => p.campo)).toEqual([
      "publicarEm",
    ]);
  });

  it("encerrar ANTES de publicar é recusado (CHECK ai_campanhas_janela_coerente)", () => {
    const p = problemasDaCampanha({ ...bom, encerrarEm: "2026-09-26T09:00:00.000Z" });
    expect(p.map((x) => x.campo)).toEqual(["encerrarEm"]);
  });

  /* O CHECK é `>`, não `>=`: janela de zero segundo nunca está aberta, então a
     tela tem de recusar o igual também. */
  it("encerrar no MESMO instante de publicar é recusado", () => {
    expect(problemasDaCampanha({ ...bom, encerrarEm: bom.publicarEm })).toHaveLength(1);
  });

  it("encerrar depois de publicar é aceito, e vazio também", () => {
    expect(problemasDaCampanha({ ...bom, encerrarEm: "2026-09-30T09:00:00.000Z" })).toEqual([]);
    expect(problemasDaCampanha({ ...bom, encerrarEm: null })).toEqual([]);
  });

  it("o mesmo validador aceita o valor do campo datetime-local, e não só ISO", () => {
    expect(
      problemasDaCampanha({
        titulo: "Aviso",
        publicarEm: "2026-09-27T09:00",
        encerrarEm: "2026-09-28T09:00",
      }),
    ).toEqual([]);
    expect(
      problemasDaCampanha({
        titulo: "Aviso",
        publicarEm: "2026-09-28T09:00",
        encerrarEm: "2026-09-27T09:00",
      }),
    ).toHaveLength(1);
  });
});

describe("formulário", () => {
  /**
   * A DECISÃO DO DONO, TRAVADA POR TESTE.
   *
   * O padrão é "uma vez por pessoa", e um formulário que nascesse com `true`
   * inverteria isso sem nenhum CHECK do banco para pegar: os dois valores de um
   * boolean são válidos. Este teste e o `z.boolean()` sem default do esquema são
   * as duas metades da mesma guarda.
   */
  it("aviso novo nasce com repetição DESLIGADA", () => {
    expect(campanhaParaFormulario(null, AGORA).repetir).toBe(false);
  });

  it("aviso novo já vem com a data de início preenchida com agora", () => {
    expect(campanhaParaFormulario(null, AGORA).publicarEm).toBe(isoParaLocal(AGORA.toISOString()));
  });

  it("aviso novo não restringe nada", () => {
    const f = campanhaParaFormulario(null, AGORA);
    expect(f.alcance.restritas).toEqual([]);
    expect(f.id).toBeNull();
  });

  it("editar preserva a escolha de repetição gravada", () => {
    expect(campanhaParaFormulario(campanha({ repetir: true }), AGORA).repetir).toBe(true);
  });

  /**
   * A tela não DESENHA a dimensão de cliente, mas o estado do formulário a
   * guarda: descartá-la ao abrir para edição transformaria uma regra que FECHA
   * numa que ABRE no próximo salvamento, que é exatamente o defeito contra o qual
   * `chavesProblematicasDaRegra` existe.
   */
  it("editar preserva a dimensão de cliente que a tela não desenha", () => {
    const f = campanhaParaFormulario(campanha({ regra: { base: ["acme"], portal: ["PG"] } }), AGORA);
    expect(f.alcance.restritas).toContain("base");
    expect(f.alcance.valores.base).toEqual(["acme"]);
  });

  it("ISO e datetime-local fecham nos dois sentidos", () => {
    const local = "2026-09-27T14:35";
    expect(isoParaLocal(localParaIso(local))).toBe(local);
    expect(localParaIso("")).toBeNull();
    expect(isoParaLocal(null)).toBe("");
    expect(isoParaLocal("data quebrada")).toBe("");
  });
});

describe("regra que exclui a própria empresa", () => {
  it("restrição a OUTRA empresa é recusada: o aviso não alcançaria ninguém", () => {
    expect(regraExcluiAPropriaBase({ base: ["outra_sa"] }, "acme_sa")).toBe(true);
  });

  it("restrição à PRÓPRIA empresa passa (é redundante, não contraditória)", () => {
    expect(regraExcluiAPropriaBase({ base: ["acme_sa"] }, "acme_sa")).toBe(false);
  });

  it("a própria empresa acompanhada de outras passa: ainda alcança gente daqui", () => {
    expect(regraExcluiAPropriaBase({ base: ["outra_sa", "acme_sa"] }, "acme_sa")).toBe(false);
  });

  it("caixa e espaço não criam exclusão falsa (a normalização é a do predicado)", () => {
    expect(regraExcluiAPropriaBase({ base: ["  ACME_SA  "] }, "acme_sa")).toBe(false);
  });

  it("regra sem restrição de cliente passa, e restrição em outra dimensão também", () => {
    expect(regraExcluiAPropriaBase({}, "acme_sa")).toBe(false);
    expect(regraExcluiAPropriaBase({ portal: ["PG"] }, "acme_sa")).toBe(false);
    expect(regraExcluiAPropriaBase({ base: [] }, "acme_sa")).toBe(false);
  });

  it("sem base na sessão não se afirma exclusão", () => {
    expect(regraExcluiAPropriaBase({ base: ["outra_sa"] }, "  ")).toBe(false);
  });

  it("a mensagem nomeia a empresa de quem está olhando, e nenhuma outra", () => {
    const m = mensagemDeAutoExclusao("Acme S.A.");
    expect(m).toContain("Acme S.A.");
    expect(m).not.toContain("outra_sa");
  });
});

describe("esquema da action", () => {
  const base = {
    titulo: "Folha fechada",
    publicarEm: "2026-09-27T09:00:00.000Z",
    repetir: false,
    regra: {},
  };

  it("aceita o payload completo", () => {
    expect(dadosDaCampanhaSchema.safeParse(base).success).toBe(true);
  });

  /**
   * O CAMPO É OBRIGATÓRIO, e é por isso que este teste existe.
   *
   * Com `.optional()`, quem consome precisaria escolher um valor para
   * `undefined` — e `?? true` inverteria a decisão do dono em silêncio. Com
   * `.default(true)`, o Zod inverteria sozinho. Exigir faz um formulário que
   * esqueça o campo falhar ALTO, que é a única falha que alguém conserta.
   */
  it("RECUSA o payload sem `repetir`: omitir não pode virar um padrão implícito", () => {
    const semRepetir: Record<string, unknown> = { ...base };
    delete semRepetir.repetir;
    expect(dadosDaCampanhaSchema.safeParse(semRepetir).success).toBe(false);
  });

  it("recusa `repetir` que não é booleano", () => {
    expect(dadosDaCampanhaSchema.safeParse({ ...base, repetir: "sim" }).success).toBe(false);
  });

  /**
   * NENHUMA RECUSA SAI EM INGLÊS.
   *
   * A action devolve `issues[0].message` direto para a tela, e quem está do outro
   * lado é um analista de RH dentro do ERP. Um campo sem mensagem própria entrega
   * o texto padrão do Zod ("Invalid input: expected string, received null"), que
   * não diz o que fazer e não está na língua de ninguém ali. Este caso já
   * aconteceu em quatro dos cinco campos deste esquema.
   */
  const recusas: { caso: string; payload: unknown }[] = [
    { caso: "data de início nula", payload: { ...base, publicarEm: null } },
    { caso: "título que não é texto", payload: { ...base, titulo: 7 } },
    { caso: "mensagem comprida", payload: { ...base, corpo: "y".repeat(5000) } },
    { caso: "data de parada que não é texto", payload: { ...base, encerrarEm: 5 } },
    { caso: "sem a escolha de repetição", payload: { titulo: "x", publicarEm: "2026-09-27T09:00" } },
  ];
  for (const { caso, payload } of recusas) {
    it(`a recusa de ${caso} sai em português`, () => {
      const r = dadosDaCampanhaSchema.safeParse(payload);
      expect(r.success).toBe(false);
      const msg = r.success ? "" : (r.error.issues[0]?.message ?? "");
      expect(msg.length).toBeGreaterThan(0);
      for (const ingles of ["Invalid input", "expected", "Too big", "Required"]) {
        expect(msg).not.toContain(ingles);
      }
    });
  }

  /* A regra atravessa como `unknown` de propósito: quem julga o conteúdo é
     `chavesProblematicasDaRegra`, que sabe nomear o campo errado em português. Um
     `z.object` aqui descartaria a chave desconhecida, e descartar ABRE. */
  it("deixa a regra passar sem julgar o conteúdo dela", () => {
    expect(dadosDaCampanhaSchema.safeParse({ ...base, regra: { centro_custos: ["1"] } }).success).toBe(
      true,
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SENTINELA DA TELA — nenhum denominador, e as duas frases obrigatórias

   ESTA é a catraca que roda a cada PR: `npm test` está na CI. A assertiva D da
   migration de campanhas cobre o lado do BANCO e só dispara quando alguém aplica
   aquele arquivo — `ci.yml` não aplica migration nenhuma —, e de todo jeito ela
   não alcançaria a TELA: nada impede um componente de dividir a contagem de
   visualizações por um total inventado no cliente.

   Olha o FONTE como texto, e só formas de CÓDIGO (`toFixed(`, `* 100`, divisão
   por total). Palavra em prosa fica de fora de propósito: os comentários daquele
   arquivo explicam POR QUE não há percentual, e uma regra que acusa justamente
   quem documenta a decisão é a regra que ensina a equipe a ignorar a catraca
   inteira. Aconteceu neste repositório com o contador de emoji, que travou a CI
   por dez dias contando emoji dentro de comentário.

   As duas assertivas POSITIVAS são a sentinela da sentinela: sem elas, esta
   verificação passaria feliz no dia em que a tela perdesse a explicação e o aviso
   de limitação, que é o que ela existe para proteger.
   ═══════════════════════════════════════════════════════════════════════════ */
const TELA = readFileSync(
  fileURLToPath(new URL("../../components/gestao/comunicacao-painel.tsx", import.meta.url)),
  "utf8",
);

/**
 * O MESMO FONTE, SEM O PREFIXO DE COMENTÁRIO DE CADA LINHA.
 *
 * As agulhas são FORMAS de código, e a caixa de comentário deste repositório
 * começa cada linha com ` * `: uma linha de prosa como "* 100 mil visualizações"
 * traria a forma `* 100` sem nenhuma conta existir. É exatamente o defeito do
 * contador de emoji, e catraca que acusa quem documenta a decisão é catraca que a
 * equipe aprende a ignorar.
 *
 * O preço é uma conta de porcentagem escrita com o `*` abrindo uma linha de
 * continuação. Essa mesma conta cai na agulha da DIVISÃO, cuja linha começa com
 * uma barra só e não é tocada aqui.
 */
const CODIGO_DA_TELA = TELA.split("\n")
  .map((l) => l.replace(/^[ \t]*(?:\*+|\/\/+)[ \t]?/, ""))
  .join("\n");

/**
 * As agulhas são REGEX, e o espaço é OPCIONAL em todas.
 *
 * Com `includes("* 100")` e `includes("/ painel.total")`, as grafias `*100` e
 * `/painel.total` — que o Prettier deste projeto aceita igual — atravessavam a
 * catraca inteira. `[ \t]*` e não `\s*` de propósito: cruzar linha traria de volta
 * o falso positivo de prosa que o passo acima acabou de fechar.
 */
const AGULHAS: [RegExp, string][] = [
  [/toFixed[ \t]*\(/, "arredondamento de fração: só aparece em conta de porcentagem"],
  [/\*[ \t]*100\b/, "multiplicação por cem é percentual"],
  [/\b100[ \t]*\*/, "idem, do outro lado"],
  [/\/[ \t]*painel\.total\b/, "divisão pelo total de visualizações é taxa de leitura"],
  [/\/[ \t]*painel\.identificadas\b/, "idem, com o outro número"],
];

describe("a tela de comunicação não mede o que não tem denominador", () => {
  it.each(AGULHAS)("não contém %s (%s)", (agulha) => {
    expect(agulha.test(CODIGO_DA_TELA)).toBe(false);
  });

  /**
   * A SENTINELA DA SENTINELA, TERCEIRA PARTE: a agulha pega a forma SEM espaço.
   *
   * A versão anterior comparava texto, então `*100` e `/painel.total` passavam.
   * Este teste é o que impede a regressão de voltar em silêncio: ele exercita as
   * agulhas contra as duas grafias da mesma conta.
   */
  it.each([
    "const pct = painel.identificadas * 100 / painel.total;",
    "const pct = painel.identificadas *100 /painel.total;",
    "const pct = (100 * painel.identificadas) / painel.total;",
    "const pct = (painel.identificadas/painel.identificadas).toFixed(1);",
  ])("as agulhas pegam a conta escrita como %s", (amostra) => {
    expect(AGULHAS.some(([re]) => re.test(amostra))).toBe(true);
  });

  it("explica por extenso por que não existe 'quem não visualizou'", () => {
    expect(TELA).toContain("Não há como mostrar quem não visualizou");
  });

  it("avisa que “uma vez por pessoa” não alcança quem não se identifica", () => {
    expect(TELA).toContain(
      'para quem entra assim, o aviso vai reaparecer a cada abertura mesmo com "mostrar uma vez" ligado.',
    );
  });

  /**
   * O NÚMERO MEDIDO NÃO VAI PARA A TELA.
   *
   * Os 26,3% foram medidos somando TODAS as bases, e um cliente cujo bloco de
   * rastreio está instalado direito não tem nenhum acesso assim. Dizer "26,3%"
   * para ele seria afirmar sobre a empresa dele um número que é de outra.
   */
  it("não imprime a medição de 26,3% na tela do cliente", () => {
    expect(TELA).not.toContain("26,3");
    expect(TELA).not.toContain("26.3");
  });
});
