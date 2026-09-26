/**
 * A DECISÃO DE DOWNLOAD, sob teste — e ela é a MESMA nos dois chamadores.
 *
 * `/api/v1/chat` usa esta função para decidir se a citação sai com link, e
 * `/api/v1/arquivo/[id]` usa para decidir se assina. Se fossem duas, o modo de
 * divergir seria o pior possível: ou o chat oferece um link que o endpoint
 * recusa (ruído), ou o endpoint serve o que o chat não mostraria (vazamento).
 *
 * As três condições vivem em lugares diferentes de propósito, e o teste as
 * separa: propriedade e alcance são a RPC `documentos_da_base` (SQL, a mesma
 * cerca da busca), e `download_liberado` é a coluna. O que este arquivo prova é
 * que nenhuma das três é pulada — inclusive quando as outras duas passam.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { arquivosBaixaveis, arquivoBaixavel } from "./download-de-arquivo";

const MEU = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUTRO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Linha = { id: string; original_name: string; storage_path: string; mime: string | null; download_liberado: boolean };

const linha = (over: Partial<Linha> = {}): Linha => ({
  id: MEU,
  original_name: "zz-manual.pdf",
  storage_path: "bases/b1/zz-manual.pdf",
  mime: "application/pdf",
  download_liberado: true,
  ...over,
});

/** Grava o que foi perguntado: metade do que importa é o que NÃO é consultado. */
function dublarDb(opcoes: {
  elegiveis?: string[];
  linhas?: Linha[];
  erroRpc?: string;
  erroLinhas?: string;
  explodir?: boolean;
} = {}) {
  const chamadas: { rpc: { nome: string; args: unknown }[]; idsConsultados: string[][]; filtros: string[] } = {
    rpc: [],
    idsConsultados: [],
    filtros: [],
  };
  const db = {
    rpc: vi.fn(async (nome: string, args: unknown) => {
      chamadas.rpc.push({ nome, args });
      if (opcoes.explodir) throw new Error("rede caiu");
      if (opcoes.erroRpc) return { data: null, error: { message: opcoes.erroRpc } };
      return { data: (opcoes.elegiveis ?? []).map((document_id) => ({ document_id })), error: null };
    }),
    from: vi.fn(() => {
      let ids: string[] = [];
      let soLiberado = false;
      const q: Record<string, unknown> = {
        select: () => q,
        in: (_c: string, v: string[]) => {
          ids = v;
          chamadas.idsConsultados.push(v);
          return q;
        },
        filter: (campo: string, _op: string, valor: unknown) => {
          chamadas.filtros.push(`${campo}=${String(valor)}`);
          if (campo === "download_liberado" && valor === true) soLiberado = true;
          return q;
        },
        then: (resolver: (r: unknown) => void) =>
          resolver(
            opcoes.erroLinhas
              ? { data: null, error: { message: opcoes.erroLinhas } }
              : {
                  data: (opcoes.linhas ?? []).filter(
                    (l) => ids.includes(l.id) && (!soLiberado || l.download_liberado),
                  ),
                  error: null,
                },
          ),
      };
      return q;
    }),
  };
  return { db: db as never, chamadas };
}

let erroDoConsole: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  erroDoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("as três condições, uma a uma", () => {
  it("passa quando as três valem", async () => {
    const { db, chamadas } = dublarDb({ elegiveis: [MEU], linhas: [linha()] });

    const r = await arquivosBaixaveis(db, "zz-cliente", { p_base: "zz-cliente", p_perfil: "MASTER" }, [MEU]);

    expect(r).toEqual([
      { id: MEU, nome: "zz-manual.pdf", storagePath: "bases/b1/zz-manual.pdf", mime: "application/pdf" },
    ]);
    // A cerca é a RPC, com a identidade montada das doze dimensões.
    expect(chamadas.rpc[0]).toEqual({
      nome: "documentos_da_base",
      args: { p_base: "zz-cliente", p_identidade: { base: "zz-cliente", perfil: "MASTER" } },
    });
    expect(chamadas.filtros).toContain("download_liberado=true");
  });

  it("id que a RPC não devolve NÃO é consultado na tabela", async () => {
    // É a linha que impede o atalho de "conferir o id direto em
    // knowledge_documents": isso pularia o `public.elegivel` da função.
    const { db, chamadas } = dublarDb({ elegiveis: [MEU], linhas: [linha(), linha({ id: OUTRO })] });

    const r = await arquivosBaixaveis(db, "zz-cliente", { p_base: "zz-cliente" }, [MEU, OUTRO]);

    expect(r.map((a) => a.id)).toEqual([MEU]);
    expect(chamadas.idsConsultados).toEqual([[MEU]]);
  });

  it("alcançar o arquivo NÃO é poder baixá-lo", async () => {
    const { db } = dublarDb({ elegiveis: [MEU], linhas: [linha({ download_liberado: false })] });

    expect(await arquivosBaixaveis(db, "zz-cliente", { p_base: "zz-cliente" }, [MEU])).toEqual([]);
  });

  it("sem base no token nada é liberado, e o banco nem é tocado", async () => {
    const { db, chamadas } = dublarDb({ elegiveis: [MEU], linhas: [linha()] });

    expect(await arquivosBaixaveis(db, "", {}, [MEU])).toEqual([]);
    expect(await arquivosBaixaveis(db, null, {}, [MEU])).toEqual([]);
    expect(chamadas.rpc).toHaveLength(0);
  });

  it("lista de ids vazia sai antes de qualquer consulta", async () => {
    const { db, chamadas } = dublarDb({ elegiveis: [MEU], linhas: [linha()] });

    expect(await arquivosBaixaveis(db, "zz-cliente", { p_base: "zz-cliente" }, [])).toEqual([]);
    expect(chamadas.rpc).toHaveLength(0);
  });
});

describe("falha de leitura FECHA, e grita", () => {
  it("erro da RPC não libera nada", async () => {
    const { db } = dublarDb({ erroRpc: "permission denied", linhas: [linha()] });

    expect(await arquivosBaixaveis(db, "zz-cliente", { p_base: "zz-cliente" }, [MEU])).toEqual([]);
    // Sem o log, "não pode baixar" e "a leitura quebrou" ficam idênticos de fora.
    expect(erroDoConsole).toHaveBeenCalled();
  });

  it("erro na leitura da tabela não libera nada", async () => {
    const { db } = dublarDb({ elegiveis: [MEU], erroLinhas: "timeout" });

    expect(await arquivosBaixaveis(db, "zz-cliente", { p_base: "zz-cliente" }, [MEU])).toEqual([]);
    expect(erroDoConsole).toHaveBeenCalled();
  });

  it("exceção de transporte não derruba o turno — devolve vazio", async () => {
    const { db } = dublarDb({ explodir: true });

    expect(await arquivosBaixaveis(db, "zz-cliente", { p_base: "zz-cliente" }, [MEU])).toEqual([]);
    expect(erroDoConsole).toHaveBeenCalled();
  });
});

describe("a versão de um id só", () => {
  it("devolve o arquivo, ou null", async () => {
    const { db } = dublarDb({ elegiveis: [MEU], linhas: [linha()] });
    expect(await arquivoBaixavel(db, "zz-cliente", { p_base: "zz-cliente" }, MEU)).toMatchObject({ id: MEU });

    const fechado = dublarDb({ elegiveis: [MEU], linhas: [linha({ download_liberado: false })] });
    expect(await arquivoBaixavel(fechado.db, "zz-cliente", { p_base: "zz-cliente" }, MEU)).toBeNull();
  });
});
