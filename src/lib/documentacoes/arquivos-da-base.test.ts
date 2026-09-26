/**
 * O ARQUIVO DO CLIENTE, sob teste — e as garantias que NÃO TÊM RLS por trás.
 *
 * A área do cliente grava com `service_role`, que tem `rolbypassrls`. As policies
 * de `knowledge_documents` exigem `ai.configure`, permissão que o cliente não tem.
 * Então o que está testado aqui não é "o código também confere": é a ÚNICA cerca.
 *
 * Quatro classes, e todas falham em SILÊNCIO se ninguém as vigiar:
 *
 *   1. exclusão com id de OUTRA base — sem a conferência de dono, um POST forjado
 *      apaga o arquivo e os chunks de outro cliente, e ninguém fica sabendo;
 *   2. regra com dimensão digitada errada — `normalizarRegra` DESCARTA chave
 *      desconhecida, então uma regra que FECHA seria gravada como regra VAZIA, e
 *      regra vazia LIBERA. Gravar o oposto do pedido, sem erro em lugar nenhum;
 *   3. base de conhecimento pedida para tipo que não extrai — aceitar produziria
 *      documento com `chunk_count = 0` e status "pronto", que é a falha silenciosa
 *      clássica deste produto;
 *   4. arquivo que não vai à base de conhecimento NEM pode ser baixado — ocupa
 *      espaço, aparece na lista e não serve para nada.
 *
 * ── O que é dublado, e o que NÃO é ───────────────────────────────────────
 * O Supabase (banco e Storage) é um GRAVADOR: registra tabela, operação, payload
 * e filtros, e os caminhos que subiram ou saíram do bucket. Assim o teste também
 * afirma o que NÃO aconteceu — nada subiu, nada foi apagado —, que é metade do
 * que importa aqui. `extractDocument` e `reindexDocumentChunks` são dublados (um
 * arrasta mammoth/unpdf, o outro chama embedding); `assertArquivoSeguro` roda de
 * VERDADE, porque é ele que decide qual mídia entra, e dublá-lo apagaria a
 * decisão de produto que este arquivo existe para implementar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/importer/extract", () => ({ extractDocument: vi.fn() }));
vi.mock("@/lib/content/chunk", () => ({ reindexDocumentChunks: vi.fn() }));

import {
  anexarArquivoDaBase,
  excluirArquivoDaBase,
  arquivosDaBase,
  podeVirarConhecimento,
} from "./arquivos-da-base";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDocument } from "@/lib/importer/extract";
import { reindexDocumentChunks } from "@/lib/content/chunk";

const BASE_DA_SESSAO = "11111111-1111-4111-8111-111111111111";
const BASE_DO_VIZINHO = "22222222-2222-4222-8222-222222222222";
const DOC_DO_VIZINHO = "33333333-3333-4333-8333-333333333333";
const DOC_NOVO = "44444444-4444-4444-8444-444444444444";

/** Bytes que passam por `assertArquivoSeguro` para cada tipo usado nos casos. */
const TXT = new TextEncoder().encode("Manual interno da empresa.\nSegunda linha.\n");
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0x41]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);
/** Caixa `ftyp` no byte 4 — a assinatura que `assertArquivoSeguro` exige do mp4. */
const MP4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

type Op = { tabela: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filtros: Record<string, unknown> };
type Storage = { op: "upload" | "remove"; caminhos: string[] };

let ops: Op[] = [];
let storage: Storage[] = [];

type LinhaFake = {
  id: string;
  base_id: string;
  original_name: string;
  mime: string | null;
  size_bytes: number | null;
  status: string;
  chunk_count: number;
  download_liberado: boolean;
  regra: unknown;
  created_at: string;
  storage_path: string;
  error: string | null;
};

function linha(over: Partial<LinhaFake> = {}): LinhaFake {
  return {
    id: DOC_DO_VIZINHO,
    base_id: BASE_DO_VIZINHO,
    original_name: "contrato.pdf",
    mime: "application/pdf",
    size_bytes: 10,
    status: "ready",
    chunk_count: 3,
    download_liberado: true,
    regra: {},
    created_at: "2026-09-20T10:00:00Z",
    storage_path: `bases/${BASE_DO_VIZINHO}/x-contrato.pdf`,
    error: null,
    ...over,
  };
}

function dublarDb(opcoes: { linhas?: LinhaFake[]; falharUpload?: boolean; falharInsert?: boolean } = {}) {
  const linhas = opcoes.linhas ?? [];

  function construir(tabela: string) {
    const op: Op = { tabela, op: "select", filtros: {} };
    ops.push(op);

    // As linhas que batem com TODOS os filtros aplicados até aqui. É o que
    // reproduz o comportamento que interessa: `base_id` no filtro é uma CERCA,
    // não um enfeite — sem ele, a linha do vizinho voltaria.
    const casam = () =>
      linhas.filter((l) =>
        Object.entries(op.filtros).every(([campo, valor]) => (l as unknown as Record<string, unknown>)[campo] === valor),
      );

    const q: Record<string, unknown> = {
      select: () => q,
      eq: (campo: string, valor: unknown) => {
        op.filtros[campo] = valor;
        return q;
      },
      filter: (campo: string, _operador: string, valor: unknown) => {
        op.filtros[campo] = valor;
        return q;
      },
      order: () => q,
      range: (de: number, ate: number) =>
        Promise.resolve({ data: casam().slice(de, ate + 1), error: null }),
      maybeSingle: () => Promise.resolve({ data: casam()[0] ?? null, error: null }),
      single: () =>
        Promise.resolve(
          op.op === "insert"
            ? opcoes.falharInsert
              ? { data: null, error: { message: "insert recusado" } }
              : { data: { id: DOC_NOVO }, error: null }
            : { data: casam()[0] ?? null, error: null },
        ),
      insert: (payload: unknown) => {
        op.op = "insert";
        op.payload = payload;
        return q;
      },
      update: (payload: unknown) => {
        op.op = "update";
        op.payload = payload;
        return q;
      },
      delete: () => {
        op.op = "delete";
        return q;
      },
      // Para o encadeamento que termina sem `single`/`maybeSingle` (update, delete).
      then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
    };
    return q;
  }

  return {
    from: (tabela: string) => construir(tabela),
    storage: {
      from: () => ({
        upload: async (caminho: string) => {
          storage.push({ op: "upload", caminhos: [caminho] });
          return opcoes.falharUpload ? { error: { message: "bucket cheio" }, data: null } : { error: null, data: { path: caminho } };
        },
        remove: async (caminhos: string[]) => {
          storage.push({ op: "remove", caminhos });
          return { error: null, data: null };
        },
      }),
    },
  };
}

const escritas = () => ops.filter((o) => o.op !== "select");

beforeEach(() => {
  vi.clearAllMocks();
  ops = [];
  storage = [];
  vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);
  vi.mocked(extractDocument).mockResolvedValue({
    source: "markdown",
    blocks: [{ text: "conteúdo", level: 0 }],
    images: [],
  } as never);
  vi.mocked(reindexDocumentChunks).mockResolvedValue(4);
});

/* ── 1. A exclusão só alcança arquivo da PRÓPRIA base ────────────────────── */

describe("exclusão: id de outra base não apaga nada", () => {
  it("documento do vizinho é RECUSADO, e nada é apagado", async () => {
    // O banco TEM a linha do vizinho: quem impede é o filtro por `base_id`, não
    // a ausência do dado. Um teste com a tabela vazia passaria sem a cerca.
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ linhas: [linha()] }) as never);

    const r = await excluirArquivoDaBase({ baseId: BASE_DA_SESSAO, documentId: DOC_DO_VIZINHO });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toBe("Arquivo não encontrado nesta empresa.");
    expect(escritas()).toHaveLength(0);
    expect(storage).toHaveLength(0);
  });

  it("a leitura que decide isso filtra por id E por base_id", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ linhas: [linha()] }) as never);

    await excluirArquivoDaBase({ baseId: BASE_DA_SESSAO, documentId: DOC_DO_VIZINHO });

    const leitura = ops.find((o) => o.tabela === "knowledge_documents");
    expect(leitura?.filtros).toMatchObject({ id: DOC_DO_VIZINHO, base_id: BASE_DA_SESSAO });
  });

  it("documento da própria base é apagado, e o Storage vai DEPOIS da linha", async () => {
    const meu = linha({ id: DOC_NOVO, base_id: BASE_DA_SESSAO, storage_path: `bases/${BASE_DA_SESSAO}/y-manual.pdf` });
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ linhas: [meu] }) as never);

    const r = await excluirArquivoDaBase({ baseId: BASE_DA_SESSAO, documentId: DOC_NOVO });

    expect(r).toEqual({ ok: true, nome: "contrato.pdf", tinhaChunks: true });
    const del = escritas().find((o) => o.op === "delete");
    expect(del?.tabela).toBe("knowledge_documents");
    // O delete também carrega `base_id`: se a leitura um dia sumir, a exclusão
    // continua sem alcançar outra base.
    expect(del?.filtros).toMatchObject({ id: DOC_NOVO, base_id: BASE_DA_SESSAO });
    expect(storage).toEqual([{ op: "remove", caminhos: [meu.storage_path] }]);
  });
});

/* ── 2. A regra: validador ANTES do normalizador ─────────────────────────── */

describe("a regra é validada antes de normalizar, e antes de subir nada", () => {
  it("dimensão digitada errada é recusada pelo NOME, sem subir o arquivo", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: TXT,
      originalName: "aviso.txt",
      mime: "text/plain",
      naBaseDeConhecimento: true,
      downloadLiberado: false,
      // O typo clássico: plural. `public.elegivel` FECHA nele, e
      // `normalizarRegra` o DESCARTARIA — a regra iria ao banco vazia, e vazia
      // LIBERA. Gravaríamos "todos alcançam" onde se pediu "só o centro 1".
      regra: { centro_custos: ["1"] },
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("centro_custos");
    expect(storage).toHaveLength(0);
    expect(escritas()).toHaveLength(0);
  });

  it("lista toda em branco é recusada — ela LIBERA, o oposto do que se pediu", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: TXT,
      originalName: "aviso.txt",
      mime: "text/plain",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: { portal: ["", "  "] },
    });

    expect(r.ok).toBe(false);
    expect(storage).toHaveLength(0);
  });

  it("a regra gravada sai normalizada (sem branco, caixa e duplicata)", async () => {
    await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PDF,
      originalName: "manual.pdf",
      mime: "application/pdf",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: { portal: ["PG", "pg", " PG ", ""] },
    });

    const insert = escritas().find((o) => o.op === "insert");
    expect((insert?.payload as { regra: Record<string, string[]> }).regra.portal).toEqual(["pg"]);
  });
});

/* ── 3 e 4. As duas decisões de produto ──────────────────────────────────── */

describe("qualquer mídia baixa; só o que extrai vira conhecimento", () => {
  it("imagem pedida para a base de conhecimento é RECUSADA com o motivo", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PNG,
      originalName: "organograma.png",
      mime: "image/png",
      naBaseDeConhecimento: true,
      downloadLiberado: true,
      regra: {},
    });

    expect(r.ok).toBe(false);
    // O motivo importa tanto quanto a recusa: "não permitido" mandaria o cliente
    // procurar erro no arquivo, quando o caminho é desmarcar uma caixa.
    expect(r.ok === false && r.erro).toContain(".png");
    expect(r.ok === false && r.erro).toContain("download");
    expect(storage).toHaveLength(0);
    expect(escritas()).toHaveLength(0);
  });

  it("a MESMA imagem, só para download, é aceita", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PNG,
      originalName: "organograma.png",
      mime: "image/png",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: {},
    });

    expect(r).toEqual({ ok: true, documentId: DOC_NOVO, chunks: 0 });
    // Nasce PRONTO com zero trechos, e isto não é falha silenciosa: ninguém pediu
    // que ele fosse lido. Só é mentira quando alguém pediu a base de conhecimento.
    const insert = escritas().find((o) => o.op === "insert");
    expect(insert?.payload).toMatchObject({ status: "ready", download_liberado: true });
    expect(reindexDocumentChunks).not.toHaveBeenCalled();
  });

  it("nem conhecimento nem download é recusado: o arquivo não serviria para nada", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PDF,
      originalName: "manual.pdf",
      mime: "application/pdf",
      naBaseDeConhecimento: false,
      downloadLiberado: false,
      regra: {},
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("ao menos uma");
    expect(storage).toHaveLength(0);
    expect(escritas()).toHaveLength(0);
  });

  it("vídeo entra para DOWNLOAD — é o `{ midia: true }` da tarefa 17", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: MP4,
      originalName: "treinamento.mp4",
      mime: "video/mp4",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: {},
    });

    // Até a tarefa 16 este caso era RECUSADO, e o teste guardava a recusa para
    // a decisão aparecer ao ser mudada. Foi mudada de propósito: a tela promete
    // mídia, e prometer sem entregar era o defeito.
    expect(r).toEqual({ ok: true, documentId: DOC_NOVO, chunks: 0 });
    const insert = escritas().find((o) => o.op === "insert");
    expect(insert?.payload).toMatchObject({ status: "ready", download_liberado: true });
    expect(reindexDocumentChunks).not.toHaveBeenCalled();
  });

  it("o MESMO vídeo pedido para a base de conhecimento é RECUSADO com o motivo", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: MP4,
      originalName: "treinamento.mp4",
      mime: "video/mp4",
      naBaseDeConhecimento: true,
      downloadLiberado: true,
      regra: {},
    });

    // O que SOBE e o que vira CONHECIMENTO são listas diferentes de propósito:
    // vídeo não tem texto para o assistente ler, e aceitar produziria documento
    // "pronto" com zero trecho.
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain(".mp4");
    expect(r.ok === false && r.erro).toContain("download");
    expect(storage).toHaveLength(0);
    expect(escritas()).toHaveLength(0);
  });

  it("executável continua barrado pelo file-guard, antes de tudo", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
      originalName: "instalador.exe",
      mime: "application/octet-stream",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: {},
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toMatch(/execut/i);
    expect(storage).toHaveLength(0);
  });

  it("`podeVirarConhecimento` é a mesma lista que a recusa usa", () => {
    for (const nome of ["manual.pdf", "contrato.docx", "aula.pptx", "planilha.xlsx", "leiame.md", "notas.txt"]) {
      expect(podeVirarConhecimento(nome), nome).toBe(true);
    }
    for (const nome of ["organograma.png", "treinamento.mp4", "audio.mp3", "pacote.zip"]) {
      expect(podeVirarConhecimento(nome), nome).toBe(false);
    }
  });
});

/* ── O caminho no Storage nasce da base recebida ─────────────────────────── */

describe("o arquivo não consegue nascer na pasta de outro cliente", () => {
  it("o prefixo do caminho é a base recebida, e a linha grava a MESMA base", async () => {
    await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PDF,
      originalName: "manual da empresa (v2).pdf",
      mime: "application/pdf",
      naBaseDeConhecimento: true,
      downloadLiberado: true,
      regra: {},
    });

    const up = storage.find((s) => s.op === "upload");
    expect(up?.caminhos[0]).toMatch(new RegExp(`^bases/${BASE_DA_SESSAO}/[0-9a-f-]{36}-`));
    // Nome saneado: espaço e parênteses não entram no caminho, e a extensão fica.
    expect(up?.caminhos[0]).toMatch(/manual_da_empresa_v2_\.pdf$/);

    const insert = escritas().find((o) => o.op === "insert");
    expect(insert?.payload).toMatchObject({
      base_id: BASE_DA_SESSAO,
      space_id: null,
      storage_path: up?.caminhos[0],
      original_name: "manual da empresa (v2).pdf",
      status: "extracting",
    });
  });

  it("nome com `../` não sobe de pasta", async () => {
    await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: TXT,
      originalName: "../../etc/passwd.txt",
      mime: "text/plain",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: {},
    });

    const up = storage.find((s) => s.op === "upload");
    expect(up?.caminhos[0]).toMatch(new RegExp(`^bases/${BASE_DA_SESSAO}/[0-9a-f-]{36}-passwd\\.txt$`));
    expect(up?.caminhos[0]).not.toContain("..");
  });
});

/* ── Indexação e o desfazer ──────────────────────────────────────────────── */

describe("a base de conhecimento: chunks de verdade, ou nada", () => {
  it("indexa com spaceId NULO e grava o número de trechos", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PDF,
      originalName: "manual.pdf",
      mime: "application/pdf",
      naBaseDeConhecimento: true,
      downloadLiberado: false,
      regra: { portal: ["PG"] },
    });

    expect(r).toEqual({ ok: true, documentId: DOC_NOVO, chunks: 4 });
    expect(vi.mocked(reindexDocumentChunks).mock.calls[0]?.[1]).toMatchObject({
      documentId: DOC_NOVO,
      // Arquivo de empresa não pertence a espaço. É a razão de a migration ter
      // tornado `chunks.space_id` anulável.
      spaceId: null,
      withEmbeddings: true,
    });
    const update = escritas().find((o) => o.op === "update");
    expect(update?.payload).toMatchObject({ status: "ready", chunk_count: 4 });
  });

  it("zero trechos DESFAZ tudo: nada de documento 'pronto' sem conteúdo", async () => {
    vi.mocked(reindexDocumentChunks).mockResolvedValue(0);

    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PDF,
      originalName: "digitalizado.pdf",
      mime: "application/pdf",
      naBaseDeConhecimento: true,
      downloadLiberado: false,
      regra: {},
    });

    expect(r.ok).toBe(false);
    // A mensagem diz a saída — o download não depende de extrair texto.
    expect(r.ok === false && r.erro).toContain("download");
    // A linha SAI, e o arquivo SAI do bucket: nenhum resíduo na lista do cliente.
    expect(escritas().some((o) => o.op === "delete" && o.filtros.id === DOC_NOVO)).toBe(true);
    expect(storage.some((s) => s.op === "remove")).toBe(true);
    // E o status "pronto" nunca foi gravado.
    expect(escritas().some((o) => o.op === "update")).toBe(false);
  });

  it("falha na extração também desfaz, e o motivo chega a quem anexou", async () => {
    vi.mocked(extractDocument).mockRejectedValue(new Error("PDF corrompido na página 3"));

    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PDF,
      originalName: "manual.pdf",
      mime: "application/pdf",
      naBaseDeConhecimento: true,
      downloadLiberado: false,
      regra: {},
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("PDF corrompido na página 3");
    expect(storage.some((s) => s.op === "remove")).toBe(true);
    expect(escritas().some((o) => o.op === "delete")).toBe(true);
  });

  it("insert recusado limpa o arquivo que já subiu", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ falharInsert: true }) as never);

    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: TXT,
      originalName: "aviso.txt",
      mime: "text/plain",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: {},
    });

    expect(r.ok).toBe(false);
    // Sem documento não há linha para apagar; o que não pode ficar é o arquivo.
    expect(storage.filter((s) => s.op === "remove")).toHaveLength(1);
    expect(escritas().some((o) => o.op === "delete")).toBe(false);
  });

  it("upload recusado não escreve linha nenhuma", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => dublarDb({ falharUpload: true }) as never);

    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: TXT,
      originalName: "aviso.txt",
      mime: "text/plain",
      naBaseDeConhecimento: false,
      downloadLiberado: true,
      regra: {},
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("bucket cheio");
    expect(escritas()).toHaveLength(0);
  });
});

/* ── Ontologia: recusar em voz alta em vez de ignorar ────────────────────── */

describe("ontologia de arquivo de empresa ainda não existe", () => {
  it("pedido de varredura é RECUSADO com o motivo, antes de subir nada", async () => {
    const r = await anexarArquivoDaBase({
      baseId: BASE_DA_SESSAO,
      bytes: PDF,
      originalName: "manual.pdf",
      mime: "application/pdf",
      naBaseDeConhecimento: true,
      downloadLiberado: false,
      regra: {},
      varrerOntologia: true,
    });

    // `ontology_jobs.space_id` e `ontology_terms.space_id` são NOT NULL para
    // `spaces`, e este arquivo não tem espaço. Aceitar e não enfileirar seria a
    // falha silenciosa: o cliente marca, nada acontece, e ele nunca sabe.
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("ontologia");
    expect(storage).toHaveLength(0);
    expect(escritas()).toHaveLength(0);
  });
});

/* ── A listagem ──────────────────────────────────────────────────────────── */

describe("a listagem é sempre da base pedida", () => {
  it("filtra por base_id e ordena por id ANTES do range", async () => {
    const meu = linha({ id: DOC_NOVO, base_id: BASE_DA_SESSAO, created_at: "2026-09-24T09:00:00Z" });
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ linhas: [meu, linha()] }) as never,
    );

    const lista = await arquivosDaBase(BASE_DA_SESSAO);

    // A linha do vizinho está na tabela e NÃO volta.
    expect(lista.map((a) => a.id)).toEqual([DOC_NOVO]);
    const leitura = ops.find((o) => o.tabela === "knowledge_documents");
    expect(leitura?.filtros).toMatchObject({ base_id: BASE_DA_SESSAO });
  });

  it("`naBaseDeConhecimento` sai de ter chunk, não de uma coluna", async () => {
    vi.mocked(createAdminClient).mockImplementation(
      () =>
        dublarDb({
          linhas: [
            linha({ id: DOC_NOVO, base_id: BASE_DA_SESSAO, chunk_count: 7, created_at: "2026-09-24T09:00:00Z" }),
            linha({
              id: "55555555-5555-4555-8555-555555555555",
              base_id: BASE_DA_SESSAO,
              chunk_count: 0,
              download_liberado: true,
              created_at: "2026-09-23T09:00:00Z",
            }),
          ],
        }) as never,
    );

    const lista = await arquivosDaBase(BASE_DA_SESSAO);

    // Mais recente primeiro, e o RAG só alcança quem tem trecho.
    expect(lista.map((a) => [a.chunkCount, a.naBaseDeConhecimento])).toEqual([
      [7, true],
      [0, false],
    ]);
  });
});
