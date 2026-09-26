/**
 * AS GARANTIAS DE SEGURANÇA DA ABA CONTEÚDO, sob teste.
 *
 * A área do cliente não tem sessão do Supabase: grava com `service_role`, que
 * tem `rolbypassrls`. Não existe RLS protegendo este caminho — as linhas de
 * código testadas aqui SÃO a cerca:
 *
 *   1. a base vem da sessão revalidada, nunca do formulário. Vale para as ações de
 *      documentação E para as de ARQUIVO da empresa, no fim do arquivo;
 *   2. o `space_id` que o cliente anexa tem de estar no poço de
 *      `documentacoes_universais` com `enabled = true` — sem isso ele aponta para
 *      a documentação customizada de outro cliente, e o isolamento das tarefas 1
 *      a 7 cai por uma tela.
 *
 * Garantia sem teste é garantia até alguém refatorar, e as duas falham em
 * SILÊNCIO: a gravação funcionaria, e o vazamento apareceria semanas depois como
 * uma resposta do assistente citando documento de outro cliente.
 *
 * ── O que é dublado, e o que NÃO é ───────────────────────────────────────
 * `abrirSessaoGestao` é dublado (é ele que verifica HMAC e lê o banco), mas
 * `baseDaSessao` roda de VERDADE: é ela que decide que a base sai da identidade,
 * e dublá-la apagaria justamente o que o item 1 afirma. O cliente do Supabase é
 * um gravador que registra cada tabela tocada, cada operação e cada payload —
 * assim o teste também afirma o que NÃO foi escrito
 * (`documentacoes_universais`), que é a terceira regra do arquivo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/gestao/sessao", () => ({ abrirSessaoGestao: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
// A busca no ERP não deve sair nem por acidente num teste de unidade: se alguma
// destas chamadas escapar, a dublagem estoura em vez de bater num ERP real.
vi.mock("@/lib/documentacoes/valores-erp", () => ({
  buscarValoresNoErp: vi.fn(async () => ({ ok: true, valores: [], total: 0, usuario: "?", formatoDesconhecido: false })),
}));
/**
 * O mecanismo do arquivo é dublado porque ele tem teste próprio
 * (`src/lib/documentacoes/arquivos-da-base.test.ts`, onde as quatro recusas e o
 * desfazer são verificados). O que se testa AQUI é só o que este arquivo
 * acrescenta: a base sai da sessão revalidada e nunca do formulário.
 */
vi.mock("@/lib/documentacoes/arquivos-da-base", () => ({
  anexarArquivoDaBase: vi.fn(),
  excluirArquivoDaBase: vi.fn(),
  arquivosDaBase: vi.fn(),
}));

import {
  salvarAjusteDeDocumentacao,
  voltarAoPadraoDeDocumentacao,
  valoresParaDimensao,
  anexarArquivoDoCliente,
  excluirArquivoDoCliente,
  listarArquivosDoCliente,
} from "./actions";
import { abrirSessaoGestao } from "@/lib/gestao/sessao";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarValoresNoErp } from "@/lib/documentacoes/valores-erp";
import {
  anexarArquivoDaBase,
  excluirArquivoDaBase,
  arquivosDaBase,
} from "@/lib/documentacoes/arquivos-da-base";

const BASE_DA_SESSAO = { code: "natcorp", id: "11111111-1111-4111-8111-111111111111" };
const BASE_DO_VIZINHO = { code: "leadec", id: "22222222-2222-4222-8222-222222222222" };
const DOC_NO_POCO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC_DE_OUTRO_CLIENTE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Operacao = {
  tabela: string;
  op: "select" | "upsert" | "delete" | "insert";
  payload?: unknown;
  filtros: Record<string, unknown>;
};

let operacoes: Operacao[] = [];

/**
 * Cliente Supabase dublado.
 *
 * `documentacoes_universais` responde uma linha só para `DOC_NO_POCO` — é o poço
 * do teste. `ai_base_documentacoes` responde vazio (nenhuma sobreposição
 * gravada), salvo quando o cenário pede o contrário.
 */
function dublarDb(opcoes: { sobreposicaoExistente?: boolean; regraDaNatcorp?: unknown } = {}) {
  function construir(tabela: string) {
    const op: Operacao = { tabela, op: "select", filtros: {} };
    const resposta = () => {
      if (tabela === "documentacoes_universais") {
        const pedido = op.filtros.space_id;
        const ativo = op.filtros.enabled !== false;
        return {
          data:
            pedido === DOC_NO_POCO && ativo
              ? { space_id: DOC_NO_POCO, regra: opcoes.regraDaNatcorp ?? {} }
              : null,
          error: null,
        };
      }
      if (tabela === "ai_base_documentacoes" && op.op === "select") {
        return {
          data: opcoes.sobreposicaoExistente
            ? { enabled: true, regra: { portal: ["PG"] }, criado_por: null }
            : null,
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (campo: string, valor: unknown) => {
        op.filtros[campo] = valor;
        return q;
      },
      in: () => q,
      maybeSingle: () => Promise.resolve(resposta()),
      upsert: (payload: unknown) => {
        op.op = "upsert";
        op.payload = payload;
        return Promise.resolve({ error: null });
      },
      insert: (payload: unknown) => {
        op.op = "insert";
        op.payload = payload;
        return Promise.resolve({ error: null });
      },
      delete: () => {
        op.op = "delete";
        return q;
      },
      // `then` para o encadeamento que termina sem `maybeSingle` (o delete).
      then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
    };
    operacoes.push(op);
    return q;
  }
  return { from: (tabela: string) => construir(tabela) };
}

function sessaoDeCliente(usuario: string | null = "ana.silva") {
  return {
    ok: true as const,
    modo: "cliente" as const,
    identidade: {
      baseCode: BASE_DA_SESSAO.code,
      baseId: BASE_DA_SESSAO.id,
      baseNome: "Natcorp",
      usuario,
      perfil: "MASTER",
      painel: "PO",
      empresa: "700",
      matricula: "1024",
    },
    spaceId: "espaco-da-chave",
    key: "pk_x",
    token: "kbt1h.a.b",
    operador: null,
  };
}

function sessaoDeSuporte() {
  return {
    ...sessaoDeCliente(null),
    modo: "suporte" as const,
    key: null,
    token: null,
    operador: { id: "operador-1", email: "suporte@natcorp.com.br" },
  };
}

const escritas = () => operacoes.filter((o) => o.op !== "select");

beforeEach(() => {
  vi.clearAllMocks();
  operacoes = [];
  vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);
});

describe("a base vem da sessão, nunca do formulário", () => {
  it("POST forjado com a base do vizinho grava na base DA SESSÃO", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      // O atacante manda de tudo: a base do vizinho em todos os nomes plausíveis.
      base: BASE_DO_VIZINHO.code,
      baseId: BASE_DO_VIZINHO.id,
      base_id: BASE_DO_VIZINHO.id,
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PG"] },
    });

    expect(r).toEqual({ ok: true });
    const upsert = escritas().find((o) => o.tabela === "ai_base_documentacoes");
    expect(upsert?.op).toBe("upsert");
    expect(upsert?.payload).toMatchObject({
      base_id: BASE_DA_SESSAO.id,
      space_id: DOC_NO_POCO,
    });
    // E, explicitamente, NÃO a do vizinho — a asserção que quebra se alguém
    // passar a ler a base do payload "porque já vem no formulário".
    expect((upsert?.payload as { base_id: string }).base_id).not.toBe(BASE_DO_VIZINHO.id);
  });

  it("apagar a sobreposição também usa a base da sessão, não a do formulário", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ sobreposicaoExistente: true }) as never,
    );

    const r = await voltarAoPadraoDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      base: BASE_DO_VIZINHO.code,
      baseId: BASE_DO_VIZINHO.id,
      spaceId: DOC_NO_POCO,
    });

    expect(r).toEqual({ ok: true });
    const del = escritas().find((o) => o.op === "delete");
    expect(del?.tabela).toBe("ai_base_documentacoes");
    expect(del?.filtros.base_id).toBe(BASE_DA_SESSAO.id);
  });

  it("sessão recusada não escreve nada", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue({
      ok: false,
      motivo: "expirado",
      mensagem: "Sua sessão expirou.",
    } as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: {},
    });

    expect(r).toEqual({ ok: false, erro: "Sua sessão expirou." });
    expect(escritas()).toHaveLength(0);
  });
});

describe("o poço: o cliente só ajusta o que a Natcorp oferece", () => {
  it("space_id fora do poço é RECUSADO e nada é escrito", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      // A documentação customizada de outro cliente: existe em `spaces`, não
      // está em `documentacoes_universais`.
      spaceId: DOC_DE_OUTRO_CLIENTE,
      enabled: true,
      regra: {},
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("não está entre as que a Natcorp oferece");
    expect(escritas()).toHaveLength(0);
  });

  /**
   * O ACHADO DA TAREFA 14, PASSO 1: `enabled = true` sozinho não bastava.
   *
   * A universal está ATIVA no poço, mas a regra da Natcorp restringe a dimensão
   * `base` a um cliente que NÃO é o da sessão. Antes da correção, isso passava:
   * a gravação respondia `ok: true` e o ajuste não abria acesso a nada — falha
   * silenciosa, porque quem de fato protege é `public.escopo_documentacao`, no
   * SQL, reavaliando a identidade a cada turno.
   */
  it("universal ATIVA mas restrita a OUTRO cliente é RECUSADA na gravação, sem nomear o outro cliente", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { base: [BASE_DO_VIZINHO.code] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: {},
    });

    expect(r.ok).toBe(false);
    // A MESMA mensagem do caso "fora do poço": de quem lê, as duas são
    // igualmente "não oferecida para a minha empresa".
    expect(r.ok === false && r.erro).toContain("não está entre as que a Natcorp oferece");
    // E ela não pode citar o código do outro cliente — é o vazamento que a
    // tela do cliente nunca pode cometer.
    expect(r.ok === false && r.erro).not.toContain(BASE_DO_VIZINHO.code);
    expect(escritas()).toHaveLength(0);
  });

  it("universal restrita à PRÓPRIA base da sessão passa normalmente", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { base: [BASE_DA_SESSAO.code] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: {},
    });

    expect(r).toEqual({ ok: true });
    expect(escritas().some((o) => o.op === "upsert")).toBe(true);
  });

  it("a conferência do poço vem ANTES da gravação, e olha enabled", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: false,
      regra: {},
    });

    const conferencia = operacoes.find((o) => o.tabela === "documentacoes_universais");
    expect(conferencia, "o poço tem de ser consultado").toBeDefined();
    expect(conferencia?.filtros).toMatchObject({ space_id: DOC_NO_POCO, enabled: true });
    // Ordem: a conferência acontece antes de qualquer escrita.
    expect(operacoes.indexOf(conferencia!)).toBeLessThan(
      operacoes.indexOf(escritas().find((o) => o.op === "upsert")!),
    );
  });

  it("documentacoes_universais NUNCA é escrita pela área do cliente", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: {},
    });
    await voltarAoPadraoDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
    });

    expect(escritas().map((o) => o.tabela)).not.toContain("documentacoes_universais");
    expect(escritas().every((o) => o.tabela !== "spaces")).toBe(true);
  });
});

describe("as três travas da regra continuam na ordem", () => {
  it("chave fora das doze é recusada com o nome do campo, sem gravar", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      // O typo clássico: plural. `public.elegivel` FECHA nele.
      regra: { centro_custos: ["1"] },
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("centro_custos");
    expect(escritas()).toHaveLength(0);
  });

  it("lista toda em branco é recusada — ela LIBERA, o oposto do que se pediu", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["", "  "] },
    });

    expect(r.ok).toBe(false);
    expect(escritas()).toHaveLength(0);
  });

  it("a regra gravada sai normalizada (sem branco, caixa e duplicata)", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PG", "pg", " PG ", ""] },
    });

    const upsert = escritas().find((o) => o.op === "upsert");
    // Minúscula é a forma canônica de `normalizarRegra`: quatro grafias do mesmo
    // portal viram um valor, e a comparação em `public.elegivel` é insensível a
    // caixa dos dois lados.
    expect((upsert?.payload as { regra: Record<string, string[]> }).regra.portal).toEqual(["pg"]);
  });
});

describe("as listas de valor usam o login de quem está na tela", () => {
  it("modo cliente: consulta o ERP com o login do token", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente("ana.silva") as never);

    await valoresParaDimensao({ key: "pk_x", kbt: "kbt1h.a.b", dimensao: "empresa" });

    expect(buscarValoresNoErp).toHaveBeenCalledWith({
      base: BASE_DA_SESSAO.code,
      dimensao: "empresa",
      usuario: "ana.silva",
    });
  });

  it("modo suporte: NÃO consulta o ERP e devolve o motivo para a tela", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeSuporte() as never);

    const r = await valoresParaDimensao({ suporte: "1", base: BASE_DA_SESSAO.code, dimensao: "empresa" });

    expect(r).toEqual({ ok: false, motivo: "O modo suporte não tem login do ERP; digite o valor." });
    expect(buscarValoresNoErp).not.toHaveBeenCalled();
  });
});

/**
 * A QUARTA TRAVA: as duas regras valem ao mesmo tempo.
 *
 * Sem ela, o cliente escolhe um portal que a regra da Natcorp não permite, a
 * gravação passa, e a documentação não alcança ninguém — sem erro em lugar
 * nenhum. É o mesmo modo de falha das três primeiras, e por isso a mesma
 * postura: recusar, nomeando o que fazer.
 */
describe("a combinação das duas regras", () => {
  it("escolha sem valor em comum com a da Natcorp é RECUSADA, sem gravar", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { portal: ["PG"] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PO"] },
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("Gestor");
    expect(r.ok === false && r.erro).toContain("Ocultar");
    expect(escritas()).toHaveLength(0);
  });

  it("escolha com valor em comum passa", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { portal: ["PG", "PO"] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PO"] },
    });

    expect(r).toEqual({ ok: true });
    expect(escritas().some((o) => o.op === "upsert")).toBe(true);
  });

  it("OCULTAR não é recusado: é o caminho legítimo para ninguém alcançar", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { portal: ["PG"] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: false,
      regra: { portal: ["PO"] },
    });

    expect(r).toEqual({ ok: true });
    const upsert = escritas().find((o) => o.op === "upsert");
    expect((upsert?.payload as { enabled: boolean }).enabled).toBe(false);
  });
});

/**
 * OS ARQUIVOS DA EMPRESA — o que a camada de action garante.
 *
 * O mecanismo (allowlist, Storage, chunks, cascade, desfazer) tem teste próprio.
 * Aqui só uma coisa é afirmada, e é a que não tem RLS por trás: o `baseId` que
 * chega ao mecanismo é o da SESSÃO revalidada. Um POST forjado pode mandar a base
 * do vizinho em qualquer nome — o arquivo continua nascendo na pasta certa e a
 * exclusão continua alcançando só a própria base.
 */
function formDeAnexo(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("key", "pk_x");
  form.set("kbt", "kbt1h.a.b");
  // O atacante manda de tudo: a base do vizinho em todos os nomes plausíveis.
  form.set("base", BASE_DO_VIZINHO.code);
  form.set("baseId", BASE_DO_VIZINHO.id);
  form.set("base_id", BASE_DO_VIZINHO.id);
  form.set("downloadLiberado", "1");
  form.set("regra", "{}");
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  form.set("arquivo", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "manual.pdf", { type: "application/pdf" }));
  return form;
}

describe("arquivos da empresa: a base vem da sessão, nunca do formulário", () => {
  beforeEach(() => {
    vi.mocked(anexarArquivoDaBase).mockResolvedValue({ ok: true, documentId: "doc-1", chunks: 5 });
    vi.mocked(excluirArquivoDaBase).mockResolvedValue({ ok: true, nome: "manual.pdf", tinhaChunks: true });
    vi.mocked(arquivosDaBase).mockResolvedValue({ arquivos: [], falhou: false });
  });

  it("anexar usa o baseId DA SESSÃO, mesmo com a base do vizinho no formulário", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await anexarArquivoDoCliente(formDeAnexo({ naBaseDeConhecimento: "1" }));

    expect(r).toEqual({ ok: true, chunks: 5 });
    const entrada = vi.mocked(anexarArquivoDaBase).mock.calls[0]?.[0];
    expect(entrada?.baseId).toBe(BASE_DA_SESSAO.id);
    expect(entrada?.baseId).not.toBe(BASE_DO_VIZINHO.id);
    expect(entrada).toMatchObject({
      originalName: "manual.pdf",
      naBaseDeConhecimento: true,
      downloadLiberado: true,
    });
  });

  /*
    O FIO ENTRE A TELA E A AÇÃO, no formato exato que a tela manda.

    `ArquivosPainel` envia "1" ou "0" nas duas caixas, e `campo()` devolve
    `undefined` só para string VAZIA — "0" chega como "0" e precisa virar
    `false`. Um `Boolean(campo(...))` aqui leria "0" como verdadeiro e gravaria
    o oposto da escolha: o arquivo que o cliente mandou NÃO indexar entraria na
    base de conhecimento, sem erro em lugar nenhum.
  */
  it('"0" nas duas caixas chega ao mecanismo como false', async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    await anexarArquivoDoCliente(
      formDeAnexo({ naBaseDeConhecimento: "0", downloadLiberado: "0" }),
    );

    expect(vi.mocked(anexarArquivoDaBase).mock.calls[0]?.[0]).toMatchObject({
      naBaseDeConhecimento: false,
      downloadLiberado: false,
    });
  });

  it("excluir usa o baseId DA SESSÃO — é o que impede apagar arquivo alheio", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await excluirArquivoDoCliente({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      base: BASE_DO_VIZINHO.code,
      baseId: BASE_DO_VIZINHO.id,
      documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(r).toEqual({ ok: true });
    expect(excluirArquivoDaBase).toHaveBeenCalledWith({
      baseId: BASE_DA_SESSAO.id,
      documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("listar também é escopado pela sessão", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await listarArquivosDoCliente({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      baseId: BASE_DO_VIZINHO.id,
    });

    expect(r).toEqual({ ok: true, arquivos: [] });
    expect(arquivosDaBase).toHaveBeenCalledWith(BASE_DA_SESSAO.id);
  });

  /*
    LEITURA QUEBRADA NÃO VIRA LISTA VAZIA.

    Quem chama esta action SUBSTITUI a lista que está na tela. Devolver
    `{ ok: true, arquivos: [] }` numa leitura que caiu faria os arquivos do
    cliente desaparecerem por causa de um defeito nosso — e uma leitura PARCIAL é
    pior ainda, porque parece completa.
  */
  it("falha de leitura recusa em vez de devolver lista vazia", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(arquivosDaBase).mockResolvedValue({ arquivos: [], falhou: true });

    const r = await listarArquivosDoCliente({ key: "pk_x", kbt: "kbt1h.a.b" });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("Não foi possível ler");
  });

  it("sessão recusada não chega ao mecanismo", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue({
      ok: false,
      motivo: "expirado",
      mensagem: "Sua sessão expirou.",
    } as never);

    const anexo = await anexarArquivoDoCliente(formDeAnexo());
    const exclusao = await excluirArquivoDoCliente({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(anexo).toEqual({ ok: false, erro: "Sua sessão expirou." });
    expect(exclusao).toEqual({ ok: false, erro: "Sua sessão expirou." });
    expect(anexarArquivoDaBase).not.toHaveBeenCalled();
    expect(excluirArquivoDaBase).not.toHaveBeenCalled();
    expect(escritas()).toHaveLength(0);
  });

  it("formulário sem arquivo é recusado antes de qualquer escrita", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const form = formDeAnexo();
    form.delete("arquivo");
    const r = await anexarArquivoDoCliente(form);

    expect(r).toEqual({ ok: false, erro: "Escolha um arquivo." });
    expect(anexarArquivoDaBase).not.toHaveBeenCalled();
  });

  it("regra em JSON quebrado é recusada como entrada malformada, sem chamar o mecanismo", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await anexarArquivoDoCliente(formDeAnexo({ regra: "{portal:" }));

    expect(r.ok).toBe(false);
    expect(anexarArquivoDaBase).not.toHaveBeenCalled();
  });

  it("a recusa do mecanismo chega intacta, e nada é registrado em auditoria", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(anexarArquivoDaBase).mockResolvedValue({
      ok: false,
      erro: "Não é possível incluir .png na base de conhecimento.",
    });

    const r = await anexarArquivoDoCliente(formDeAnexo({ naBaseDeConhecimento: "1" }));

    expect(r).toEqual({ ok: false, erro: "Não é possível incluir .png na base de conhecimento." });
    expect(escritas()).toHaveLength(0);
  });

  it("o que dá certo vai para o audit_log com a base e o autor", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente("ana.silva") as never);

    await anexarArquivoDoCliente(formDeAnexo({ naBaseDeConhecimento: "1" }));

    const registro = escritas().find((o) => o.tabela === "audit_log");
    expect(registro?.op).toBe("insert");
    expect(registro?.payload).toMatchObject({
      action: "gestao.arquivo.anexado",
      entity_type: "knowledge_document",
      entity_id: "doc-1",
      // Arquivo de empresa não tem espaço: inventar um faria a linha de auditoria
      // apontar para uma documentação que nada tem a ver com o arquivo.
      space_id: null,
    });
    expect((registro?.payload as { after: Record<string, unknown> }).after).toMatchObject({
      base: BASE_DA_SESSAO.code,
      por: "ana.silva",
      via_suporte: false,
      chunks: 5,
    });
  });

  it("no suporte, a auditoria diz que não foi o cliente", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeSuporte() as never);

    await excluirArquivoDoCliente({
      suporte: "1",
      base: BASE_DA_SESSAO.code,
      documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const registro = escritas().find((o) => o.tabela === "audit_log");
    expect((registro?.payload as { after: Record<string, unknown> }).after).toMatchObject({
      por: "suporte:suporte@natcorp.com.br",
      via_suporte: true,
    });
  });
});
