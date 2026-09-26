/**
 * A AMARRAÇÃO ENTRE O TOKEN E A CHAVE DA BASE — e é isto que a tarefa entrega.
 *
 * O furo: a chave que assina o token é do ESPAÇO, um espaço atende muitos
 * clientes, e essa chave mora em texto puro na constante `c_key` do bloco PL/SQL
 * dentro do APEX de cada cliente. Como nada amarrava o `p_base` do payload à
 * chave, quem administra o APEX de um cliente podia assinar
 * `{"p_base":"<outro cliente>"}` e o servidor aceitava.
 *
 * Até este projeto isso era contido POR ACIDENTE: as ferramentas ainda batiam no
 * ERP alheio, com credenciais que a pessoa não tem. O projeto acaba com o
 * acidente — o PDF de regras internas do cliente passa a morar no nosso Postgres
 * e a cerca autoriza pelo `p_base` alegado.
 *
 * Dois casos daqui são a entrega, e os dois foram confirmados invertendo o
 * código de propósito e vendo-os falhar (as saídas estão no relatório da
 * tarefa):
 *
 *   · "token da base A alegando a base B é RECUSADO" — é o furo;
 *   · "depois da catraca, a chave do espaço não volta a valer" — é a catraca.
 *
 * ── O que é dublado, e o que NÃO é ─────────────────────────────────────
 * Sem servidor e sem rede: o token é assinado em memória com `assinarRastreio`
 * (a função real, mesmo HMAC do bloco do APEX) e o Supabase é um GRAVADOR, que
 * registra tabela, operação e filtros. Assim o teste também afirma o que NÃO
 * aconteceu — e no caso 5 isso é metade da garantia, porque "recusar sem
 * consultar chave de base nenhuma" é uma afirmação sobre a AUSÊNCIA de uma
 * leitura. A cifra em repouso é dublada pela identidade (`tryDecryptSecret`),
 * que é o único jeito de o teste conhecer a chave que assinou.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/crypto/secrets", () => ({ tryDecryptSecret: (s: string) => s }));

import { decodeTrackDetalhado } from "./resolve";
import { assinarRastreio, encriptarRastreio, gerarChaveRastreio } from "./token";
import { createAdminClient } from "@/lib/supabase/admin";

const ESPACO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_BASE_A = "11111111-1111-4111-8111-111111111111";
const ID_BASE_B = "22222222-2222-4222-8222-222222222222";

/** Três chaves distintas e reais: a do espaço e uma por base. */
const CHAVE_ESPACO = gerarChaveRastreio();
const CHAVE_BASE_A = gerarChaveRastreio();
const CHAVE_BASE_B = gerarChaveRastreio();

/** Identidade plausível — serve para provar que o log NÃO a carrega. */
const USUARIO = "maria.silva";
const MATRICULA = "004321";

type Op = { tabela: string; op: "select" | "update"; payload?: unknown; filtros: Record<string, unknown> };
type LinhaChaveBase = { base_id: string; space_id: string; key_enc: string; confirmada_em: string | null };

let ops: Op[] = [];
let chavesDeBase: LinhaChaveBase[] = [];

type Opcoes = {
  /** `base_code` -> id. A caixa é de propósito: produção tem `INCOR`. */
  bases?: Record<string, string>;
  chavesDeBase?: LinhaChaveBase[];
  chaveDoEspaco?: string | null;
  /** Tabela cuja LEITURA falha (erro de transporte/permissão, não "não achei"). */
  erroEm?: string;
};

function dublarDb(opcoes: Opcoes = {}) {
  const bases = Object.entries(opcoes.bases ?? { "base-a": ID_BASE_A, "base-b": ID_BASE_B }).map(
    ([base_code, id]) => ({ id, base_code }),
  );
  chavesDeBase = opcoes.chavesDeBase ?? [];
  const chaveDoEspaco = opcoes.chaveDoEspaco === undefined ? CHAVE_ESPACO : opcoes.chaveDoEspaco;

  function construir(tabela: string) {
    const op: Op = { tabela, op: "select", filtros: {} };
    ops.push(op);

    const casam = (): Record<string, unknown>[] => {
      const linhas: Record<string, unknown>[] =
        tabela === "ai_bases"
          ? bases
          : tabela === "ai_base_tracking_keys"
            ? (chavesDeBase as unknown as Record<string, unknown>[])
            : chaveDoEspaco === null
              ? []
              : [{ space_id: ESPACO, key_enc: chaveDoEspaco }];
      return linhas.filter((l) =>
        Object.entries(op.filtros).every(([campo, valor]) => {
          // `ilike` do PostgREST é insensível a caixa, e o código já manda o
          // valor normalizado com os curingas escapados. Desescapar aqui é o
          // que faz o teste exercitar `escaparIlike` de verdade.
          if (campo === "base_code") {
            const alvo = String(valor).replace(/\\(.)/g, "$1").toLowerCase();
            return String(l[campo]).toLowerCase() === alvo;
          }
          return l[campo] === valor;
        }),
      );
    };

    const q: Record<string, unknown> = {
      select: () => q,
      eq: (campo: string, valor: unknown) => {
        op.filtros[campo] = valor;
        return q;
      },
      ilike: (campo: string, valor: unknown) => {
        op.filtros[campo] = valor;
        return q;
      },
      is: (campo: string, valor: unknown) => {
        op.filtros[campo] = valor;
        return q;
      },
      update: (payload: unknown) => {
        op.op = "update";
        op.payload = payload;
        return q;
      },
      maybeSingle: () =>
        Promise.resolve(
          opcoes.erroEm === tabela
            ? { data: null, error: { message: "conexão caiu no meio da consulta" } }
            : { data: casam()[0] ?? null, error: null },
        ),
      // Encadeamento que termina sem `maybeSingle` — o UPDATE da catraca.
      then: (resolve: (v: { error: null }) => void) => {
        for (const l of casam()) Object.assign(l, op.payload);
        resolve({ error: null });
      },
    };
    return q;
  }

  return { from: (tabela: string) => construir(tabela) };
}

function chaveDaBase(over: Partial<LinhaChaveBase> = {}): LinhaChaveBase {
  return { base_id: ID_BASE_A, space_id: ESPACO, key_enc: CHAVE_BASE_A, confirmada_em: null, ...over };
}

/** Payload de um token de verdade: os p_* que o bloco do APEX manda. */
function payload(base: string) {
  return { p_base: base, p_usuario: USUARIO, p_matricula: MATRICULA, p_portal: "PO" };
}

const leituras = (tabela: string) => ops.filter((o) => o.tabela === tabela && o.op === "select");
const atualizacoes = () => ops.filter((o) => o.op === "update");

beforeEach(() => {
  vi.clearAllMocks();
  ops = [];
  vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);
});

/* ── 1. A chave da base fecha, e a identidade vale ────────────────────────── */

describe("token assinado com a chave da PRÓPRIA base", () => {
  it("é aceito, e a identidade que sai é a do payload verificado", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ chavesDeBase: [chaveDaBase()] }) as never,
    );

    const token = assinarRastreio(CHAVE_BASE_A, payload("base-a"));
    const r = await decodeTrackDetalhado(ESPACO, token);

    expect(r.motivo).toBeNull();
    expect(r.campos.p_base).toBe("base-a");
    expect(r.campos.p_usuario).toBe(USUARIO);
  });

  /**
   * A base chega do APEX com a caixa que o item de aplicação tiver. Produção
   * tem `INCOR`, `NATCORP` e `STEFANINI` gravados em conversas, então a escolha
   * da chave não pode depender de caixa — senão o cliente cai no legado para
   * sempre e a catraca nunca fecha para ele.
   */
  it("acha a chave mesmo com a base em CAIXA ALTA no token", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ bases: { "base-a": ID_BASE_A }, chavesDeBase: [chaveDaBase()] }) as never,
    );

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_BASE_A, payload("BASE-A")));

    expect(r.motivo).toBeNull();
    expect(r.campos.p_base).toBe("BASE-A");
  });
});

/* ── 2. Enquanto a catraca está aberta, a chave do espaço ainda vale ─────── */

describe("chave do ESPAÇO com a catraca aberta (a transição)", () => {
  it("é aceita, e o log diz que aquela base ainda está na chave antiga", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () =>
        dublarDb({
          bases: { "base-transicao": ID_BASE_A },
          chavesDeBase: [chaveDaBase({ confirmada_em: null })],
        }) as never,
    );
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Base própria deste caso: o aviso é uma linha por base POR PROCESSO, então
    // um caso que reaproveitasse `base-a` dependeria da ordem dos testes.
    const r = await decodeTrackDetalhado(
      ESPACO,
      assinarRastreio(CHAVE_ESPACO, payload("base-transicao")),
    );

    expect(r.motivo).toBeNull();
    expect(r.campos.p_usuario).toBe(USUARIO);

    const texto = aviso.mock.calls.flat().join(" ");
    expect(texto).toContain("base-transicao");
    // O log NÃO pode virar vazamento de identidade — mesma regra dos dois
    // pontos de queda de `escopo-da-base.ts`.
    expect(texto).not.toContain(USUARIO);
    expect(texto).not.toContain(MATRICULA);
    expect(texto).not.toContain("kbt1h.");
    aviso.mockRestore();
  });

  it("avisa UMA vez por base, e não uma por turno", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () =>
        dublarDb({ bases: { "base-ruidosa": ID_BASE_A }, chavesDeBase: [chaveDaBase()] }) as never,
    );
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    const token = assinarRastreio(CHAVE_ESPACO, payload("base-ruidosa"));
    await decodeTrackDetalhado(ESPACO, token);
    await decodeTrackDetalhado(ESPACO, token);
    await decodeTrackDetalhado(ESPACO, token);

    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });
});

/* ── 3. A CATRACA: depois de confirmada, a chave do espaço não volta ─────── */

describe("catraca fechada", () => {
  /**
   * O caso que impede a correção de ser desfeita por acidente. Aceitar a chave
   * compartilhada depois de o cliente ter provado que tem a própria reabriria o
   * furo SÓ PARA ELE — e em silêncio, porque tudo continuaria funcionando.
   */
  it("recusa o token assinado com a chave do ESPAÇO", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ chavesDeBase: [chaveDaBase({ confirmada_em: "2026-09-25T10:00:00Z" })] }) as never,
    );

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_ESPACO, payload("base-a")));

    expect(r.motivo).toBe("invalido");
    expect(r.campos).toEqual({});
    // E não é por a chave do espaço ter sumido: ela nem foi consultada.
    expect(leituras("space_tracking_keys")).toHaveLength(0);
  });

  /**
   * Chave gravada que não abre significa `APP_ENCRYPTION_KEY` trocada. Com a
   * catraca fechada isso não pode virar uma volta à chave compartilhada: um
   * defeito NOSSO de leitura de segredo não reabre o furo do cliente.
   */
  it("recusa também quando a chave da base não abre", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () =>
        dublarDb({
          chavesDeBase: [chaveDaBase({ key_enc: "", confirmada_em: "2026-09-25T10:00:00Z" })],
        }) as never,
    );

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_ESPACO, payload("base-a")));

    expect(r.motivo).toBe("invalido");
    expect(leituras("space_tracking_keys")).toHaveLength(0);
  });
});

/* ── 4. O FURO: assinar com a chave de A e dizer que é B ─────────────────── */

describe("token de uma base alegando ser OUTRA", () => {
  it("é RECUSADO quando a base alegada já fechou a catraca", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () =>
        dublarDb({
          chavesDeBase: [
            chaveDaBase(),
            chaveDaBase({ base_id: ID_BASE_B, key_enc: CHAVE_BASE_B, confirmada_em: "2026-09-25T10:00:00Z" }),
          ],
        }) as never,
    );

    // Quem administra o APEX da base A assina com a chave DELE dizendo ser B.
    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_BASE_A, payload("base-b")));

    expect(r.motivo).toBe("invalido");
    expect(r.campos).toEqual({});
  });

  /**
   * Mesmo antes de B fechar a catraca o token não passa: ele não fecha com a
   * chave de B nem com a do espaço. A diferença é só QUAL cerca recusou.
   */
  it("é recusado mesmo com a base alegada ainda na transição", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () =>
        dublarDb({
          chavesDeBase: [chaveDaBase(), chaveDaBase({ base_id: ID_BASE_B, key_enc: CHAVE_BASE_B })],
        }) as never,
    );

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_BASE_A, payload("base-b")));

    expect(r.motivo).toBe("invalido");
    expect(r.campos).toEqual({});
  });
});

/* ── 5. Base fora do catálogo ────────────────────────────────────────────── */

describe("base alegada que não existe em ai_bases", () => {
  /**
   * Recusa, e NÃO queda para o legado: se caísse, bastaria alegar uma base que
   * a busca não resolve para escapar da amarração e voltar à chave
   * compartilhada. Medido em produção: a única base fora do catálogo que já
   * conversou é `TESTE_FATURA`, 2 conversas no Painel do Gestor, em 08/08.
   */
  it("é recusada sem consultar chave de base nenhuma", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_ESPACO, payload("nao-existe")));

    expect(r.motivo).toBe("invalido");
    expect(r.campos).toEqual({});
    expect(leituras("ai_base_tracking_keys")).toHaveLength(0);
    expect(leituras("space_tracking_keys")).toHaveLength(0);
  });
});

/* ── 6. A catraca grava uma vez e não regrava ────────────────────────────── */

describe("gravação de confirmada_em", () => {
  it("grava na primeira verificação com a chave da base e não regrava depois", async () => {
    const linha = chaveDaBase();
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ chavesDeBase: [linha] }) as never);

    const token = assinarRastreio(CHAVE_BASE_A, payload("base-a"));

    const primeira = await decodeTrackDetalhado(ESPACO, token);
    expect(primeira.motivo).toBeNull();
    expect(atualizacoes()).toHaveLength(1);
    expect(chavesDeBase[0]!.confirmada_em).not.toBeNull();
    const gravado = chavesDeBase[0]!.confirmada_em;

    const segunda = await decodeTrackDetalhado(ESPACO, token);
    expect(segunda.motivo).toBeNull();
    expect(atualizacoes()).toHaveLength(1);
    expect(chavesDeBase[0]!.confirmada_em).toBe(gravado);
  });

  /**
   * `exp` só é olhado DEPOIS de o HMAC fechar, então token vencido que fecha
   * com a chave da base é prova de posse igual: o bloco daquele cliente já foi
   * recolado, e a catraca fecha. O motivo devolvido continua sendo `expirado`,
   * que é o único que vira aviso acionável na tela do usuário.
   */
  it("fecha a catraca mesmo com o token VENCIDO, e diz expirado", async () => {
    const linha = chaveDaBase();
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ chavesDeBase: [linha] }) as never);

    const vencido = assinarRastreio(CHAVE_BASE_A, {
      ...payload("base-a"),
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const r = await decodeTrackDetalhado(ESPACO, vencido);

    expect(r.motivo).toBe("expirado");
    expect(chavesDeBase[0]!.confirmada_em).not.toBeNull();
  });
});

/* ── 7. O p_base verificado tem de ser o mesmo que escolheu a chave ─────── */

describe("conferência entre a base alegada e a verificada", () => {
  /**
   * Sem esta conferência a amarração é só aparente: a chave foi escolhida por
   * uma base e a identidade que seguiria para as consultas seria de outra.
   *
   * O caso é construtível porque `trackingFields` apara em 200 caracteres e
   * `baseAlegada` não: um `p_base` mais longo que isso sai diferente dos dois
   * lados. Não é cenário de produção — é a prova de que a guarda está viva, e
   * não código morto que ninguém nota se cair.
   */
  it("recusa quando o payload verificado traz outra base", async () => {
    const longa = "b".repeat(210);
    vi.mocked(createAdminClient).mockImplementation(
      () =>
        dublarDb({
          bases: { [longa]: ID_BASE_A },
          chavesDeBase: [chaveDaBase()],
        }) as never,
    );

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_BASE_A, payload(longa)));

    expect(r.motivo).toBe("invalido");
    expect(r.campos).toEqual({});
  });
});

/* ── 8. O que continua indo pelo caminho legado, de propósito ───────────── */

describe("caminho legado", () => {
  it("token sem p_base (portal público) nem procura base", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_ESPACO, { p_usuario: USUARIO }));

    expect(r.motivo).toBeNull();
    expect(r.campos.p_usuario).toBe(USUARIO);
    expect(leituras("ai_bases")).toHaveLength(0);
  });

  /**
   * O formato opaco (`kbt1.`, AES-GCM) fica no legado porque não é possível
   * descobrir a base antes de ter a chave, e tentar chave por chave até uma
   * decifrar transformaria a validação num oráculo. Nada em produção emite esse
   * formato — o bloco do APEX só emite `kbt1h.`.
   */
  it("formato opaco kbt1. vai pela chave do espaço, sem procurar base", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);

    const r = await decodeTrackDetalhado(ESPACO, encriptarRastreio(CHAVE_ESPACO, payload("base-a")));

    expect(r.motivo).toBeNull();
    expect(r.campos.p_base).toBe("base-a");
    expect(leituras("ai_bases")).toHaveLength(0);
  });

  it("espaço sem chave nenhuma continua dizendo sem_chave", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ chaveDoEspaco: null }) as never,
    );

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_ESPACO, { p_usuario: USUARIO }));

    expect(r.motivo).toBe("sem_chave");
  });

  it("sem token é sem_token, e nada é consultado", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);

    expect((await decodeTrackDetalhado(ESPACO, null)).motivo).toBe("sem_token");
    expect(ops).toHaveLength(0);
  });
});

/* ── 9. Erro de leitura falha FECHADA ───────────────────────────────────── */

describe("falha na leitura da configuração", () => {
  /**
   * Sem ler a linha da base não há como saber se aquele cliente já fechou a
   * catraca, e adivinhar para o lado permissivo é exatamente o que reabre o
   * furo. O custo real é zero: se o Postgres não responde, o turno não se
   * completa de todo jeito.
   */
  it("erro ao procurar a base recusa em vez de cair na chave do espaço", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ erroEm: "ai_bases" }) as never);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_ESPACO, payload("base-a")));

    expect(r.motivo).toBe("invalido");
    expect(leituras("space_tracking_keys")).toHaveLength(0);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });

  it("erro ao ler a chave da base também recusa", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ erroEm: "ai_base_tracking_keys" }) as never,
    );
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await decodeTrackDetalhado(ESPACO, assinarRastreio(CHAVE_ESPACO, payload("base-a")));

    expect(r.motivo).toBe("invalido");
    expect(leituras("space_tracking_keys")).toHaveLength(0);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
