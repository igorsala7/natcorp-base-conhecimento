/**
 * O MOLDE DOS ALERTAS — e a cerca que ele é, não o formato que ele parece.
 *
 * O caso que justifica o arquivo é o terceiro: `alertas_para` hoje NÃO devolve
 * `regra`, e a migration de campanhas tem uma assertiva que quebra se alguém
 * acrescentar. Mas a assertiva do banco não sabe o que o TypeScript faz com a
 * linha depois — um `{...linha}` aqui publicaria a coluna nova na resposta de
 * `/api/v1/config`, que chega ao navegador de qualquer visitante.
 *
 * Então o teste não verifica "os campos certos saem" (isso seria testar um
 * mapeamento). Verifica que um campo que NÃO está na lista não sai, mesmo quando
 * o banco o entrega.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertasDoWidget, alertasDaIdentidade } from "./alertas";

describe("alertasDoWidget", () => {
  it("molda as quatro colunas de alertas_para", () => {
    const r = alertasDoWidget([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        titulo: "Folha fechada",
        corpo: "A folha de setembro foi fechada em 25/09.",
        publicar_em: "2026-09-25T12:00:00.000Z",
      },
    ]);
    expect(r).toEqual([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        titulo: "Folha fechada",
        corpo: "A folha de setembro foi fechada em 25/09.",
        publicarEm: "2026-09-25T12:00:00.000Z",
      },
    ]);
  });

  it("NÃO repassa a regra do cliente, mesmo se o banco devolver", () => {
    const r = alertasDoWidget([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        titulo: "Aviso",
        corpo: "",
        publicar_em: "2026-09-25T12:00:00.000Z",
        // O dia em que alguém acrescentar isto ao retorno da função: os centros
        // de custo e os sindicatos do cliente viram dado público.
        regra: { centro_custo: ["1001", "1002"], sindicato: ["SINDPD"] },
      },
    ]);
    expect(r).toHaveLength(1);
    expect(Object.keys(r[0]!).sort()).toEqual(["corpo", "id", "publicarEm", "titulo"]);
    expect(JSON.stringify(r)).not.toContain("1001");
    expect(JSON.stringify(r)).not.toContain("SINDPD");
  });

  it("corpo vazio é alerta legítimo: título sozinho é um aviso", () => {
    const r = alertasDoWidget([
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", titulo: "Ponto fecha hoje", corpo: "", publicar_em: "x" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.corpo).toBe("");
  });

  it("descarta linha sem id (não há onde gravar a visualização) e título em branco", () => {
    const r = alertasDoWidget([
      { id: "", titulo: "sem id", corpo: "", publicar_em: "x" },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", titulo: "   ", corpo: "corpo sem título", publicar_em: "x" },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", titulo: "válido", corpo: "", publicar_em: "x" },
    ]);
    expect(r.map((a) => a.titulo)).toEqual(["válido"]);
  });

  it("RPC com erro (null) ou resposta fora de forma vira lista vazia, nunca exceção", () => {
    // Abrir o widget não pode quebrar por causa de um alerta: bolha sem alerta é
    // o comportamento de sempre, bolha que não monta é regressão.
    expect(alertasDoWidget(null)).toEqual([]);
    expect(alertasDoWidget(undefined)).toEqual([]);
    expect(alertasDoWidget({ id: "x" })).toEqual([]);
    expect(alertasDoWidget("[]")).toEqual([]);
    expect(alertasDoWidget([null, 7, "x", []])).toEqual([]);
  });
});

/**
 * A ENTREGA NÃO PODE FALHAR EM SILÊNCIO.
 *
 * `alertas: []` é a resposta certa quando a RPC falha — a bolha não pode deixar
 * de montar por causa de um alerta — e é TAMBÉM a resposta de "este cliente não
 * configurou aviso nenhum". Sem log os dois são indistinguíveis de fora, para
 * todos os clientes e por tempo indeterminado: migration aplicada pela metade,
 * EXECUTE revogado por um `drop function` futuro ou assinatura mudada produzem
 * lista vazia calada, e o sintoma que chega é o painel dizendo "Ninguém
 * visualizou ainda" — que o cliente lê como "minha gente não abre o chat".
 *
 * O teste confere as duas metades juntas, porque uma sem a outra não serve: a
 * lista continua vazia (nada de exceção subindo até a rota) E a queda deixou
 * rastro com a base e o nome da RPC. E confere o que NÃO pode estar no rastro:
 * matrícula e usuário não são dado de log.
 */
describe("alertasDaIdentidade não cai em silêncio", () => {
  const TRACK = { p_base: "acme_sa", p_matricula: "98765", p_usuario: "ana.silva" };

  /** Um `SupabaseClient` de mentira: só `rpc`, que é tudo que a função chama. */
  function clienteQue(rpc: () => Promise<unknown>): SupabaseClient {
    return { rpc } as unknown as SupabaseClient;
  }

  it("RPC com erro: lista vazia, rastro com a base e a RPC, e NADA da identidade", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await alertasDaIdentidade(
        clienteQue(async () => ({
          data: null,
          error: { message: "function public.alertas_para(text, jsonb) does not exist" },
        })),
        TRACK,
      );
      expect(r).toEqual([]);
      expect(log).toHaveBeenCalledTimes(1);
      const texto = log.mock.calls[0]!.join(" ");
      expect(texto).toContain("alertas_para");
      expect(texto).toContain("acme_sa");
      expect(texto).not.toContain("98765");
      expect(texto).not.toContain("ana.silva");
    } finally {
      log.mockRestore();
    }
  });

  it("exceção de transporte: também vazia, também com rastro", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await alertasDaIdentidade(
        clienteQue(() => Promise.reject(new Error("fetch failed"))),
        TRACK,
      );
      expect(r).toEqual([]);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]!.join(" ")).toContain("acme_sa");
    } finally {
      log.mockRestore();
    }
  });

  it("sem base no token não vai ao banco e não loga: ausência não é falha", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let foi = false;
    try {
      const r = await alertasDaIdentidade(
        clienteQue(async () => {
          foi = true;
          return { data: [], error: null };
        }),
        {},
      );
      expect(r).toEqual([]);
      expect(foi).toBe(false);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("caminho bom: sem log nenhum, e o molde continua sendo aplicado", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await alertasDaIdentidade(
        clienteQue(async () => ({
          data: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              titulo: "Folha fechada",
              corpo: "",
              publicar_em: "2026-09-25T12:00:00.000Z",
              regra: { centro_custo: ["1001"] },
            },
          ],
          error: null,
        })),
        TRACK,
      );
      expect(r).toHaveLength(1);
      expect(Object.keys(r[0]!).sort()).toEqual(["corpo", "id", "publicarEm", "titulo"]);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
