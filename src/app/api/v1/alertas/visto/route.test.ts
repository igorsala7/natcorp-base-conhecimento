/**
 * O REPORTE DE VISUALIZAÇÃO — o que a rota faz com um id que vem do CORPO.
 *
 * `campanhaId` é controlado por quem chama, e `widget.js` é público. A cerca de
 * verdade é `public.registrar_visualizacao`, que só grava quando a campanha está
 * entre as que `alertas_para` devolveria para AQUELA base e AQUELA identidade.
 * Estes testes exercitam o lado do servidor que consome esse portão:
 *
 * · a identidade que vai para o banco sai do TOKEN e não do corpo;
 * · id forjado e campanha de outro cliente saem com a MESMA resposta (variar por
 *   motivo transformaria o endpoint num oráculo de existência: 36 caracteres de
 *   id e uma resposta que distingue "não existe" de "não é sua" permitem mapear
 *   as campanhas no ar de outro cliente);
 * · repetição da mesma pessoa nunca grava duas vezes, e a rota devolve 200 nos
 *   dois regimes: `registrado: true` quando a campanha repete (continua
 *   entregável) e `registrado: false` quando ela não repete (o portão já não a
 *   entrega a quem a viu). O que não pode acontecer em regime nenhum é 4xx/5xx:
 *   aí o widget acharia que errou e reenviaria para sempre.
 *
 * ── O que é dublado, e o que NÃO é ────────────────────────────────────────────
 * O dublê da RPC reimplementa a SEMÂNTICA de `registrar_visualizacao` (portão por
 * base + janela, e chave única com NULLS DISTINCT) porque o predicado real mora
 * em SQL e já tem assertiva comportamental na própria migration. O que roda de
 * verdade aqui é a rota: o portão da v1, a tradução da identidade e o tratamento
 * de cada retorno.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rateLimitOk = vi.fn(async () => true);
const originAllowed = vi.fn(() => true);
const resolveWidgetKey = vi.fn(async () => ({
  id: "k1",
  space_id: "sp-1",
  space_ids: ["sp-1"],
  allowed_origins: [],
  rate_limit: 100,
}));
vi.mock("@/lib/widget/auth", () => ({
  resolveWidgetKey: (...a: unknown[]) => resolveWidgetKey(...(a as [])),
  originAllowed: (...a: unknown[]) => originAllowed(...(a as [])),
  corsHeaders: () => ({}),
  clientIp: () => "1.2.3.4",
  extractKey: (_req: unknown, k: unknown) => (typeof k === "string" ? k : "pk_x"),
  rateLimitOk: (...a: unknown[]) => rateLimitOk(...(a as [])),
}));

const track = vi.fn(
  async () =>
    ({ p_base: "zz-cliente-a", p_portal: "PG", p_usuario: "ana.silva", p_matricula: "9001" }) as Record<
      string,
      string
    >,
);
vi.mock("@/lib/tracking/resolve", () => ({ decodeTrackForSpace: (...a: unknown[]) => track(...(a as [])) }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { POST } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";

const DA_BASE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DA_BASE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FORJADO = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const DESLIGADA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
/** Campanha da base A com `repetir = true`: continua entregável a quem já a viu. */
const QUE_REPETE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type Linha = { campanha_id: string; p_usuario: string | null; p_matricula: string | null };
let gravadas: Linha[] = [];
let chamadas: { nome: string; args: Record<string, unknown> }[] = [];

/**
 * O banco, com a semântica de `registrar_visualizacao`.
 *
 * `ativas` é o que `alertas_para` devolveria para cada base — ou seja o portão
 * inteiro (base + janela + elegivel + repetição) já resolvido. `DESLIGADA` existe
 * em nenhuma lista de propósito: é a campanha que existe mas não está ativa.
 *
 * `QUE_REPETE` é a única com `repetir = true`. Para as outras, o portão deixa de
 * entregar a campanha depois que aquela identidade registrou visualização — e é
 * por isso que a segunda chamada da mesma pessoa devolve `false`, não `true`.
 * "Identidade" é o par (usuario, matricula) com nulo distinto de nulo, a MESMA
 * definição da chave única, logo quem não traz os dois campos continua recebendo.
 */
function dublarDb(opcoes: { falhar?: boolean } = {}) {
  gravadas = [];
  chamadas = [];
  const ativas: Record<string, string[]> = {
    "zz-cliente-a": [DA_BASE_A, QUE_REPETE],
    "zz-cliente-b": [DA_BASE_B],
  };

  const db = {
    rpc: vi.fn(async (nome: string, args: Record<string, unknown>) => {
      chamadas.push({ nome, args });
      if (nome !== "registrar_visualizacao") return { data: null, error: { message: `rpc inesperada: ${nome}` } };
      if (opcoes.falhar) return { data: null, error: { message: "banco fora do ar" } };

      const base = String(args.p_base ?? "");
      const campanha = String(args.p_campanha ?? "");
      // O PORTÃO: a campanha tem de estar entre as entregáveis DAQUELA base.
      if (!(ativas[base] ?? []).includes(campanha)) return { data: false, error: null };

      const ident = (args.p_identidade ?? {}) as Record<string, string>;
      const usuario = (ident.usuario ?? "").trim() || null;
      const matricula = (ident.matricula ?? "").trim() || null;
      // Chave única com NULLS DISTINCT: nulo nunca colide com nulo, então
      // visualização anônima é uma linha nova a cada vez.
      const jaTem =
        usuario !== null &&
        matricula !== null &&
        gravadas.some(
          (l) => l.campanha_id === campanha && l.p_usuario === usuario && l.p_matricula === matricula,
        );
      // O PORTÃO DA REPETIÇÃO, que é o mesmo predicado da entrega: numa campanha
      // que não repete, quem já viu não recebe mais — logo não há o que gravar, e
      // a resposta é a MESMA recusa de "não é sua". Nada é inserido nem
      // atualizado: a data que vale é a da primeira vez.
      if (jaTem && campanha !== QUE_REPETE) return { data: false, error: null };
      if (!jaTem) gravadas.push({ campanha_id: campanha, p_usuario: usuario, p_matricula: matricula });
      // Repetição em campanha com repetir = true devolve TRUE: ela continua
      // entregável, e `false` faria o widget achar que falhou.
      return { data: true, error: null };
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  return db;
}

function pedir(body: Record<string, unknown>) {
  const req = new Request("https://api/api/v1/alertas/visto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  Object.defineProperty(req, "nextUrl", { value: new URL(req.url) });
  return POST(req as unknown as Parameters<typeof POST>[0]);
}

beforeEach(() => {
  rateLimitOk.mockClear();
  rateLimitOk.mockResolvedValue(true);
  originAllowed.mockReturnValue(true);
  resolveWidgetKey.mockResolvedValue({
    id: "k1",
    space_id: "sp-1",
    space_ids: ["sp-1"],
    allowed_origins: [],
    rate_limit: 100,
  });
  track.mockResolvedValue({
    p_base: "zz-cliente-a",
    p_portal: "PG",
    p_usuario: "ana.silva",
    p_matricula: "9001",
  });
});

describe("a identidade sai do token, nunca do corpo", () => {
  it("grava a identidade do token e ignora os p_* que o corpo manda", async () => {
    dublarDb();

    const res = await pedir({
      campanhaId: DA_BASE_A,
      track: "tok",
      // O atacante se diz outra pessoa, de outra base, de outro portal.
      p_base: "zz-cliente-b",
      p_usuario: "bruno.costa",
      p_matricula: "9002",
      identidade: { usuario: "bruno.costa" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, registrado: true });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.args).toEqual({
      p_campanha: DA_BASE_A,
      p_base: "zz-cliente-a",
      // `identidadeDoRastreio`: chaves das dimensões (sem `p_`), e só o que o
      // token traz.
      p_identidade: { base: "zz-cliente-a", portal: "PG", usuario: "ana.silva", matricula: "9001" },
    });
    expect(gravadas).toEqual([{ campanha_id: DA_BASE_A, p_usuario: "ana.silva", p_matricula: "9001" }]);
  });
});

describe("id forjado e campanha de outro cliente: a MESMA resposta", () => {
  /** Roda um cenário e devolve status + corpo cru, para comparar entre si. */
  async function recusa(id: string) {
    dublarDb();
    const res = await pedir({ campanhaId: id, track: "tok" });
    return { status: res.status, corpo: await res.text(), linhas: gravadas.length };
  }

  it("inexistente · de outra base · desligada saem idênticas, e nada é gravado", async () => {
    const forjado = await recusa(FORJADO);
    const doVizinho = await recusa(DA_BASE_B);
    const desligada = await recusa(DESLIGADA);

    expect(forjado.status).toBe(200);
    expect(JSON.parse(forjado.corpo)).toEqual({ ok: true, registrado: false });
    // Comparadas ENTRE SI, não contra um literal: um literal passaria com três
    // corpos diferentes, que é o oráculo de existência sob teste.
    expect(doVizinho).toEqual(forjado);
    expect(desligada).toEqual(forjado);
    expect(forjado.linhas).toBe(0);
  });

  it("`registrado: false` NÃO é erro HTTP — o widget não deve reenviar", async () => {
    dublarDb();
    const res = await pedir({ campanhaId: DA_BASE_B, track: "tok" });
    // 200 de propósito: 4xx faria o widget tratar como falha e tentar de novo a
    // cada abertura, para sempre, numa campanha que nunca vai ser dele.
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
  });
});

describe("a mesma pessoa duas vezes", () => {
  it("campanha que REPETE: conta UMA e as duas chamadas devolvem registrado", async () => {
    dublarDb();

    const um = await pedir({ campanhaId: QUE_REPETE, track: "tok" });
    const dois = await pedir({ campanhaId: QUE_REPETE, track: "tok" });

    expect(await um.json()).toEqual({ ok: true, registrado: true });
    // A campanha continua entregável, então `false` aqui faria o widget achar que
    // falhou e reenviar.
    expect(await dois.json()).toEqual({ ok: true, registrado: true });
    expect(gravadas).toHaveLength(1);
  });

  it("campanha que NÃO repete: a segunda chamada é recusada, e com 200", async () => {
    dublarDb();

    const um = await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    const dois = await pedir({ campanhaId: DA_BASE_A, track: "tok" });

    expect(await um.json()).toEqual({ ok: true, registrado: true });
    // `registrado: false` porque o portão já não entrega a campanha a quem a viu.
    // No caminho normal isto nem acontece (sem entrega não há balão para
    // renderizar); o caso real é a corrida de duas abas da mesma pessoa.
    expect(dois.status).toBe(200);
    expect(await dois.json()).toEqual({ ok: true, registrado: false });
    // E a recusa NÃO pode virar linha nova nem atualizar a data da primeira.
    expect(gravadas).toHaveLength(1);
  });

  it("anônimo (sem usuário e sem matrícula) grava uma linha por visualização", async () => {
    // NULLS DISTINCT: dizer "alguém viu" é verdade; colapsar cinquenta anônimos
    // em "um viu" não é.
    dublarDb();
    track.mockResolvedValue({ p_base: "zz-cliente-a", p_portal: "PG" });

    await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    await pedir({ campanhaId: DA_BASE_A, track: "tok" });

    expect(gravadas).toHaveLength(2);
    expect(gravadas.every((l) => l.p_usuario === null && l.p_matricula === null)).toBe(true);
  });
});

describe("o portão da v1", () => {
  it("chave inválida: 401 e o banco nem é tocado", async () => {
    const db = dublarDb();
    resolveWidgetKey.mockResolvedValue(null as never);
    const res = await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(res.status).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("origem fora da allowlist: 403 e o banco nem é tocado", async () => {
    const db = dublarDb();
    originAllowed.mockReturnValue(false);
    const res = await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(res.status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("rate limit: 429, e o balde é por PESSOA quando há identidade", async () => {
    const db = dublarDb();
    rateLimitOk.mockResolvedValue(false);
    const res = await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(res.status).toBe(429);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(rateLimitOk).toHaveBeenCalledWith("k1", "1.2.3.4", 100, "zz-cliente-a:ana.silva");
  });

  /**
   * SEM PESSOA, O SUJEITO É O IP — E NUNCA A BASE.
   *
   * O sujeito era `${base}:${usuario ?? matricula ?? ""}`, que para o acesso
   * anônimo dava `zz-cliente-a:` — o MESMO valor para todo anônimo daquela base.
   * O balde que o comentário chamava de "por pessoa" era um balde por BASE: com
   * `rate_limit = 600` (o valor das três chaves de produção), um script drenava o
   * teto de todos os outros anônimos e empurrava o número do painel para baixo.
   *
   * As duas metades ficam travadas aqui: o anônimo passa a ter balde de IP, e o
   * caminho identificado continua exatamente como estava (o teste acima).
   */
  it("sem usuário e sem matrícula, o balde é por IP e não por base", async () => {
    dublarDb();
    track.mockResolvedValue({ p_base: "zz-cliente-a", p_portal: "PG" });
    await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(rateLimitOk).toHaveBeenCalledWith("k1", "1.2.3.4", 100, "zz-cliente-a:ip:1.2.3.4");
  });

  it("só matrícula continua sendo pessoa: o balde é a matrícula, não o IP", async () => {
    dublarDb();
    track.mockResolvedValue({ p_base: "zz-cliente-a", p_portal: "PG", p_matricula: "9001" });
    await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(rateLimitOk).toHaveBeenCalledWith("k1", "1.2.3.4", 100, "zz-cliente-a:9001");
  });

  /* Sem base no token não há cliente a quem cobrar, e o sujeito não é inventado:
     cai no balde da chave, que é o que `rateLimitOk` faz com `null`. */
  it("sem base no token o sujeito é nulo: balde da chave, não um sujeito de mentira", async () => {
    dublarDb();
    track.mockResolvedValue({ p_portal: "PG" });
    await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(rateLimitOk).toHaveBeenCalledWith("k1", "1.2.3.4", 100, null);
  });

  it("id fora de forma: 400 sem ir ao banco (o PostgREST erraria no tipo)", async () => {
    const db = dublarDb();
    for (const id of ["", "  ", "nao-e-uuid", "1; drop table x", DA_BASE_A + "x"]) {
      const res = await pedir({ campanhaId: id, track: "tok" });
      expect(res.status).toBe(400);
    }
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("JSON inválido: 400", async () => {
    dublarDb();
    const req = new Request("https://api/api/v1/alertas/visto", { method: "POST", body: "{nao-e-json" });
    Object.defineProperty(req, "nextUrl", { value: new URL(req.url) });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("token sem base: mesma resposta da recusa, e o banco nem é consultado", async () => {
    const db = dublarDb();
    track.mockResolvedValue({});
    const res = await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, registrado: false });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("falha do banco é 500 — distinta da recusa, porque aí o widget PODE tentar de novo", async () => {
    dublarDb({ falhar: true });
    const res = await pedir({ campanhaId: DA_BASE_A, track: "tok" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Não foi possível registrar." });
  });
});
