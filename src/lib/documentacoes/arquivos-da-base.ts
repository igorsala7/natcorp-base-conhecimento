import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertArquivoSeguro,
  extDe,
  extensaoAceita,
  MAX_UPLOAD_BYTES,
} from "@/lib/importer/file-guard";
import { extractDocument } from "@/lib/importer/extract";
import { reindexDocumentChunks } from "@/lib/content/chunk";
import { chavesProblematicasDaRegra, normalizarRegra, type Regra } from "@/lib/elegibilidade";

/**
 * O ARQUIVO DO CLIENTE: ingestão, exclusão e listagem.
 *
 * Pedido do dono, verbatim: *"ele pode anexar qualquer tipo de mídia para ficar
 * disponível para download, e se for word, pdf, ppt, txt ou md, o usuário decidir
 * se quer que o conteúdo seja incluído na base de conhecimento e/ou disponível
 * para download pelo usuário no chatbot"*. E de 24/09: *"Quando for adicionado um
 * arquivo que vai para o RAG, se for deletado precisa apagar do RAG também"*.
 *
 * ── DUAS PORTAS, UM MOTOR ────────────────────────────────────────────────
 * `ingestKnowledgeFile` em `src/app/(admin)/admin/(app)/base-conhecimento/
 * actions.ts` faz o mesmo trabalho pelo lado do ADMIN, e autoriza com
 * `content.edit` em um ESPAÇO. Este arquivo é a porta do CLIENTE, que autoriza
 * pela sessão da gestão (token do APEX revalidado). As duas portas continuam
 * separadas de propósito: generalizar a de lá em "uma função que serve as duas"
 * juntaria dois modelos de autorização num só lugar, e é assim que um dia o
 * cliente passa pela porta do admin.
 *
 * O que é compartilhado é o MOTOR: `extractDocument`, `reindexDocumentChunks` e o
 * mesmo bucket. Um arquivo de cliente entra nos MESMOS `chunks` que a
 * documentação — é isso que faz o RAG achá-lo sem um segundo pipeline.
 *
 * ── A RLS NÃO PROTEGE NADA NESTE CAMINHO ─────────────────────────────────
 * A área do cliente não tem sessão do Supabase: grava com `service_role`, que tem
 * `rolbypassrls`. As policies de `knowledge_documents` exigem `ai.configure`,
 * permissão de admin técnico que o cliente não tem e não deve ter. Então as
 * garantias são DO CÓDIGO, e são duas:
 *
 *   1. na ingestão, o `base_id` da linha E o prefixo do caminho no Storage saem
 *      do `baseId` que quem chama recebeu da SESSÃO revalidada, nunca do
 *      formulário. Mesmo que todo o resto falhasse, o arquivo de um cliente não
 *      consegue NASCER na pasta de outro;
 *   2. na exclusão, o documento é procurado com `id` E `base_id` juntos. Um id
 *      vazado não acha linha e a exclusão para antes de tocar em nada — sem isso,
 *      um POST forjado apagaria o arquivo (e os chunks) de outro cliente.
 *
 * Quem passa o `baseId` é `src/app/gestao/conteudo/actions.ts`, que o obtém de
 * `baseDaSessao`. Este módulo é puro de UI e de sessão de propósito: assim ele é
 * testável, e a decisão de quem pode chamar fica num lugar só.
 *
 * ── O QUE VIRA CONHECIMENTO E O QUE SÓ BAIXA ─────────────────────────────
 * Ver `podeVirarConhecimento` — e o comentário dela, que registra a distância
 * entre "qualquer tipo de mídia" e o que a allowlist de fato aceita hoje.
 */

/** Bucket único: arquivo de cliente não ganha bucket novo, ganha PREFIXO. */
export const BUCKET_ARQUIVOS = "imports";

export type ArquivoDaBase = {
  id: string;
  nome: string;
  tamanhoBytes: number | null;
  mime: string | null;
  status: string;
  chunkCount: number;
  /**
   * Está na base de conhecimento?
   *
   * DERIVADO de `chunk_count > 0`, e não de uma coluna, porque é isso que a
   * verdade é: o RAG só alcança um documento pelos `chunks` dele
   * (`documentos_da_base` devolve ids, e a busca filtra chunks por esses ids).
   * Uma coluna `na_base_de_conhecimento` poderia dizer `true` com zero chunk —
   * exatamente a mentira que a ingestão abaixo se recusa a gravar.
   */
  naBaseDeConhecimento: boolean;
  downloadLiberado: boolean;
  regra: Regra;
  criadoEm: string;
  /** Caminho no Storage. Quem baixa precisa dele; a tela, não. */
  storagePath: string;
  erro: string | null;
};

export type ResultadoAnexo =
  | { ok: true; documentId: string; chunks: number }
  | { ok: false; erro: string };

export type ResultadoExclusao =
  | { ok: true; nome: string; tinhaChunks: boolean }
  | { ok: false; erro: string };

/**
 * Este tipo de arquivo pode entrar na base de conhecimento?
 *
 * ── A REGRA, como o CÓDIGO decide ────────────────────────────────────────
 * `EXT_ACEITAS` = `EXT_EXTRAI` ∪ `EXT_TEXTO`, em `file-guard.ts`. Ou seja: pdf,
 * docx, pptx, xlsx/xlsm, html, md — e a lista longa de texto/código (txt, csv,
 * json, sql, yaml e companhia). É MAIS do que o dono listou ("word, pdf, ppt, txt
 * ou md") porque planilha e csv também têm extrator, e recusá-los seria inventar
 * restrição que o extrator não tem.
 *
 * E é MENOS num ponto que vale dizer em voz alta: `.ppt` ANTIGO (binário OLE)
 * SOBE — no modo mídia ele é aceito — mas não vira conhecimento, porque não há
 * extrator para ele. Quando o dono escreveu "ppt" pensando em conteúdo, o
 * código entende `pptx`; o `.ppt` fica disponível para download.
 *
 * Imagem, vídeo, áudio, compactado e o Office ANTIGO (.doc/.xls/.ppt, binário
 * OLE) ficam de fora: eles ENTRAM na ingestão — é o `{ midia: true }` de
 * `assertArquivoSeguro` —, mas só para download. Não viram texto, e um documento
 * com `chunk_count = 0` e status "pronto" é a falha silenciosa clássica deste
 * produto. Por isso pedir a base de conhecimento para um tipo assim é RECUSADO
 * com o motivo, em vez de aceito e indexado com zero trecho.
 *
 * A assimetria é de propósito e tem um lugar só: `EXT_MIDIA` diz o que pode
 * SUBIR, `EXT_ACEITAS` (esta função) diz o que pode VIRAR CONHECIMENTO.
 *
 * A tela (tarefa 11) deve usar ESTA função para desabilitar a opção, e não uma
 * segunda lista escrita à mão que um dia divergiria desta.
 */
export function podeVirarConhecimento(nome: string): boolean {
  return extensaoAceita(nome);
}

/**
 * Nome de arquivo seguro para compor caminho de Storage.
 *
 * Corta diretório (um `../` no nome não pode subir prefixo), troca o que não é
 * `\w.-` por `_`, e limita pelo FIM — o corte pelo fim preserva a extensão, que é
 * o que o extrator e o navegador leem para saber o que é o arquivo.
 */
function nomeSaneado(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const limpo = base.replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "");
  return (limpo || "arquivo").slice(-120);
}

/**
 * As colunas reais de `knowledge_documents` que esta tela usa.
 *
 * `base_id`, `regra` e `download_liberado` entraram na migration
 * `20260925110000_arquivo_de_base.sql` e `src/lib/database.types.ts` ainda não foi
 * regerado — o tipo gerado ainda diz que `space_id` é `NOT NULL` e não conhece as
 * três colunas novas (conferido contra o banco em 25/09). Enquanto isso:
 *
 *   · a LEITURA usa `select("*")` + `.filter()`, que aceitam coluna fora do tipo
 *     gerado sem `as never`, e a linha é convertida para este tipo aqui — a
 *     fronteira fica declarada num lugar só;
 *   · a ESCRITA leva um `as never` no payload, comentado onde acontece.
 *
 * Regerar o arquivo de tipos inteiro é trabalho de outra tarefa (ele é grande e o
 * diff tocaria tabelas que nada disto usa).
 */
type LinhaCrua = {
  id: string;
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

function daLinha(l: LinhaCrua): ArquivoDaBase {
  return {
    id: l.id,
    nome: l.original_name,
    tamanhoBytes: l.size_bytes,
    mime: l.mime,
    status: l.status,
    chunkCount: l.chunk_count ?? 0,
    naBaseDeConhecimento: (l.chunk_count ?? 0) > 0,
    downloadLiberado: l.download_liberado === true,
    regra: (l.regra ?? {}) as Regra,
    criadoEm: l.created_at,
    storagePath: l.storage_path,
    erro: l.error,
  };
}

/** Quantas linhas por página na varredura. Bem abaixo do teto do PostgREST. */
const PAGINA = 500;

/**
 * Os arquivos DESTA base.
 *
 * Sempre filtrado por `base_id`, e pagina por CONSULTA com `.order("id")` antes
 * do `.range()`. O teto de 1.000 linhas do PostgREST é o defeito que mais voltou
 * neste repositório: uma varredura sem ordem estável lê 1.014 de 5.569 linhas
 * achando que leu tudo, e sem `order` o corte de página nem é determinístico.
 * Hoje um cliente tem dezenas de arquivos, não milhares — o laço existe para o
 * dia em que isso mudar, não para hoje.
 */
export async function arquivosDaBase(baseId: string): Promise<ArquivoDaBase[]> {
  const db = createAdminClient();
  const linhas: LinhaCrua[] = [];

  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("knowledge_documents")
      .select("*")
      .filter("base_id", "eq", baseId)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) break;
    const lote = (data ?? []) as unknown as LinhaCrua[];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
  }

  // Ordem de EXIBIÇÃO é a mais recente primeiro; a ordem por `id` acima existe
  // só para a paginação ser estável, e as duas não precisam coincidir.
  return linhas
    .map(daLinha)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

type EntradaAnexo = {
  /** DA SESSÃO revalidada. Ver o cabeçalho deste arquivo. */
  baseId: string;
  bytes: Uint8Array;
  originalName: string;
  mime: string;
  naBaseDeConhecimento: boolean;
  downloadLiberado: boolean;
  /**
   * `unknown` de propósito: quem julga o conteúdo é `chavesProblematicasDaRegra`,
   * que nomeia o campo errado em português. Um `z.object({...doze})` aqui
   * descartaria chave desconhecida em silêncio.
   */
  regra: unknown;
  varrerOntologia?: boolean;
  /** `auth.users.id`, quando existe (modo suporte). Nulo no modo cliente. */
  criadoPor?: string | null;
};

/**
 * Anexa um arquivo do cliente: sobe, registra e — se pedido — indexa para o RAG.
 *
 * ── A ORDEM DAS RECUSAS, e por que nenhuma delas vem depois do upload ────
 * Tudo o que pode ser recusado é recusado ANTES de escrever um byte: upload que
 * precisa ser desfeito é upload que um dia não vai ser (a exceção fica a cargo de
 * `desfazer`, abaixo, para o que só dá para descobrir processando).
 *
 *   1. tamanho e `assertArquivoSeguro` — a validação por magic bytes mora no
 *      file-guard porque extensão é palpite, e é ela que barra o executável
 *      renomeado para `.pdf`;
 *   2. base de conhecimento pedida para tipo que não extrai → recusa COM O
 *      MOTIVO (ver `podeVirarConhecimento`);
 *   3. nem conhecimento nem download → recusa: é um arquivo que não serve para
 *      nada, e ninguém quis isso de propósito;
 *   4. a regra, com `chavesProblematicasDaRegra` ANTES de `normalizarRegra`. A
 *      ordem é obrigatória: a segunda DESCARTA chave desconhecida, então uma
 *      regra que FECHA (typo como `centro_custos` no plural) seria gravada como
 *      regra VAZIA, e regra vazia LIBERA. Gravaríamos o oposto do que foi pedido.
 *
 * Diferente da tela de documentações, aqui NÃO há quarta trava de combinação: o
 * arquivo é do cliente, então existe uma regra só e nada com que interseccionar.
 */
export async function anexarArquivoDaBase(entrada: EntradaAnexo): Promise<ResultadoAnexo> {
  const { baseId, bytes, originalName, mime, naBaseDeConhecimento, downloadLiberado } = entrada;

  const nome = (originalName ?? "").trim();
  if (!nome) return { ok: false, erro: "Arquivo sem nome." };
  if (bytes.length === 0) return { ok: false, erro: "O arquivo está vazio." };
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      erro: `Arquivo maior que ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    };
  }

  try {
    /*
      `midia: true` é o que torna verdadeira a frase *"qualquer tipo de mídia
      para ficar disponível para download"*: com ela entram imagem, vídeo,
      áudio, compactado e o Office antigo, cada um com a assinatura conferida
      por magic bytes lá dentro, e executável/script saem com o motivo.

      A opção é SÓ desta ingestão. O importador e os anexos de chat chamam a
      mesma função sem ela e continuam com a allowlist de sempre — o arquivo
      que eles recebem vira TEXTO, e um .mp4 lá produziria documento com zero
      trecho.
    */
    assertArquivoSeguro(bytes, nome, { midia: true });
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Arquivo não aceito." };
  }

  if (naBaseDeConhecimento && !podeVirarConhecimento(nome)) {
    return {
      ok: false,
      erro:
        `Não é possível incluir .${extDe(nome) || "?"} na base de conhecimento: ` +
        `este tipo não tem texto para o assistente ler. ` +
        `Deixe apenas o download liberado, ou envie o conteúdo em PDF, Word, PowerPoint, texto ou Markdown.`,
    };
  }

  if (!naBaseDeConhecimento && !downloadLiberado) {
    return {
      ok: false,
      erro:
        "Escolha ao menos uma coisa para o arquivo fazer: entrar na base de conhecimento " +
        "do assistente, ficar disponível para download, ou as duas.",
    };
  }

  /*
    ONTOLOGIA NÃO EXISTE PARA ARQUIVO DE EMPRESA — e recusar é melhor que ignorar.

    `ontology_jobs.space_id` e `ontology_terms.space_id` são `NOT NULL references
    spaces(id)` (conferido no banco em 25/09). Arquivo de empresa não tem espaço:
    o CHECK `knowledge_documents_um_dono` garante que ele tem `base_id` e
    `space_id` NULO. Não existe onde pendurar nem o job nem os termos.

    Aceitar o pedido e não enfileirar nada seria a falha silenciosa de sempre: o
    cliente marca a opção, nada acontece, e ele descobre semanas depois que a
    busca não melhorou. Então recusa aqui, antes de subir o arquivo.

    Fazer funcionar exige migration (as duas colunas passarem a aceitar base) E
    uma decisão do dono que a migration não resolve: o vocabulário de um cliente
    não pode vazar para a ontologia global, senão o sinônimo de um cliente
    reescreveria a consulta de outro.
  */
  if (entrada.varrerOntologia) {
    return {
      ok: false,
      erro:
        "A varredura de ontologia ainda não vale para arquivo da empresa — ela é por " +
        "documentação, e este arquivo não pertence a nenhuma. Anexe sem ela.",
    };
  }

  const bruta = entrada.regra ?? {};
  if (typeof bruta !== "object" || bruta === null || Array.isArray(bruta)) {
    return { ok: false, erro: "Configuração de alcance inválida. Atualize a página e tente de novo." };
  }
  const problemas = chavesProblematicasDaRegra(bruta as Regra);
  if (problemas.length) {
    return {
      ok: false,
      erro:
        `Estes campos não alcançariam ninguém ou alcançariam todo mundo sem você ` +
        `pedir: ${problemas.join(", ")}. Corrija ou remova.`,
    };
  }
  const regra = normalizarRegra(bruta as Regra);

  const db = createAdminClient();
  /*
    O PREFIXO SAI DA SESSÃO, NÃO DO FORMULÁRIO.

    `bases/<base_id>/<uuid>-<nome saneado>`, com o `base_id` que veio da sessão
    revalidada. É a garantia que sobrevive a todas as outras falharem: o arquivo
    de um cliente não consegue nem NASCER na pasta de outro. O uuid na frente
    evita colisão entre dois envios do mesmo nome — sobrescrever o arquivo antigo
    com o novo deixaria o documento antigo apontando para conteúdo trocado.
  */
  const caminho = `bases/${baseId}/${randomUUID()}-${nomeSaneado(nome)}`;

  const up = await db.storage.from(BUCKET_ARQUIVOS).upload(caminho, bytes, {
    contentType: mime || "application/octet-stream",
    upsert: false,
  });
  if (up.error) return { ok: false, erro: `Falha ao enviar o arquivo: ${up.error.message}` };

  /*
    DAQUI PARA BAIXO, QUALQUER FALHA DESFAZ O UPLOAD E A LINHA.

    O motor do admin grava `status = 'error'` e deixa a linha lá, porque lá existe
    uma tela de equipe interna que a vê e a limpa. Aqui a lista é do CLIENTE: uma
    linha "erro" que ninguém limpa fica cobrando espaço no bucket e aparecendo na
    tela dele para sempre, sem ação possível além de excluir manualmente um
    arquivo que nunca funcionou. Desfazer é o comportamento que não deixa
    resíduo — e quem tentou anexar recebe o motivo e tenta de novo.
  */
  let documentId: string | null = null;
  try {
    const { data: doc, error } = await db
      .from("knowledge_documents")
      .insert({
        // `space_id` NULO + `base_id` preenchido: é o CHECK
        // `knowledge_documents_um_dono`. `as never` porque o tipo gerado ainda
        // não conhece as três colunas novas — ver `LinhaCrua`.
        space_id: null,
        base_id: baseId,
        storage_path: caminho,
        original_name: nome,
        mime: mime || null,
        size_bytes: bytes.length,
        regra,
        download_liberado: downloadLiberado,
        // Só quem vai indexar nasce "extraindo". Arquivo de download já nasce
        // pronto, e `chunk_count = 0` nele é a verdade, não uma falha silenciosa.
        status: naBaseDeConhecimento ? "extracting" : "ready",
        created_by: entrada.criadoPor ?? null,
      } as never)
      .select("id")
      .single();
    if (error || !doc) throw new Error(error?.message ?? "Falha ao registrar o arquivo.");
    documentId = doc.id;

    if (!naBaseDeConhecimento) return { ok: true, documentId, chunks: 0 };

    const { blocks } = await extractDocument(Buffer.from(bytes), nome, mime || undefined);
    const chunks = await reindexDocumentChunks(db, {
      documentId,
      // O arquivo não pertence a espaço nenhum. Foi por isto que
      // `20260925110000_arquivo_de_base.sql` tornou `chunks.space_id` anulável.
      spaceId: null,
      blocks,
      withEmbeddings: true,
      embeddedBy: entrada.criadoPor ?? null,
    });

    if (chunks === 0) {
      // "Pronto com zero trechos" seria mentira: o assistente não ganharia nada.
      // Mensagem com a saída, porque a saída existe — o download não depende de
      // extrair texto.
      throw new Error(
        "não foi possível extrair texto deste arquivo. " +
          'Se ele for digitalizado (imagem de página), desmarque "incluir na base de conhecimento" ' +
          "e deixe apenas o download.",
      );
    }

    const { error: erroFim } = await db
      .from("knowledge_documents")
      .update({ status: "ready", chunk_count: chunks, error: null })
      .eq("id", documentId);
    if (erroFim) throw new Error(erroFim.message);

    return { ok: true, documentId, chunks };
  } catch (e) {
    await desfazer(db, caminho, documentId);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: `Falha ao processar: ${msg}`.slice(0, 500) };
  }
}

/**
 * Desfaz um anexo pela metade: apaga a linha (chunks por cascade) e o arquivo.
 *
 * A LINHA PRIMEIRO, de propósito. Se a ordem fosse ao contrário e a remoção da
 * linha falhasse, ficaria um documento na lista do cliente apontando para um
 * arquivo que não existe — download quebrado e nada explicando. Arquivo órfão no
 * bucket é invisível e custa espaço; linha órfã é visível e custa confiança.
 */
async function desfazer(
  db: ReturnType<typeof createAdminClient>,
  caminho: string,
  documentId: string | null,
) {
  try {
    if (documentId) await db.from("knowledge_documents").delete().eq("id", documentId);
    await db.storage.from(BUCKET_ARQUIVOS).remove([caminho]);
  } catch {
    /* melhor esforço: o erro que trouxe a gente aqui é o que o cliente precisa ler */
  }
}

/**
 * Exclui um arquivo do cliente — da lista, do RAG e do Storage.
 *
 * ── A LINHA QUE PARA O id VAZADO ─────────────────────────────────────────
 * O `.filter("base_id", "eq", baseId)` da leitura abaixo. O documento é procurado
 * por `id` E `base_id` juntos, então o id de outro cliente simplesmente não acha
 * linha e a função para em "Arquivo não encontrado" sem tocar em nada. Sem isso,
 * este caminho apagaria arquivo alheio: não há RLS aqui (`service_role` tem
 * `rolbypassrls`), e um `delete().eq("id", id)` cru obedeceria.
 *
 * ── "se for deletado precisa apagar do RAG também" ───────────────────────
 * Os `chunks` somem por `ON DELETE CASCADE` em `chunks.document_id`
 * (`20260720140000_knowledge_documents.sql`, conferido — não é confiança, é a
 * migration). É o que atende o pedido de 24/09: o arquivo sai da lista e, no
 * mesmo movimento, deixa de existir para a busca.
 */
export async function excluirArquivoDaBase(entrada: {
  baseId: string;
  documentId: string;
}): Promise<ResultadoExclusao> {
  const db = createAdminClient();

  const { data } = await db
    .from("knowledge_documents")
    .select("*")
    .eq("id", entrada.documentId)
    .filter("base_id", "eq", entrada.baseId)
    .maybeSingle();
  const linha = (data ?? null) as unknown as LinhaCrua | null;
  if (!linha) {
    // Mesma mensagem para "não existe" e "é de outro cliente", de propósito:
    // distinguir contaria a quem forjou o pedido que o id existe em outra base.
    return { ok: false, erro: "Arquivo não encontrado nesta empresa." };
  }

  const { error } = await db
    .from("knowledge_documents")
    .delete()
    .eq("id", entrada.documentId)
    .filter("base_id", "eq", entrada.baseId);
  if (error) return { ok: false, erro: `Falha ao excluir: ${error.message}` };

  // Melhor esforço, e DEPOIS da linha: arquivo órfão no bucket é menos grave que
  // linha apontando para arquivo inexistente (ver `desfazer`).
  await db.storage.from(BUCKET_ARQUIVOS).remove([linha.storage_path]);

  return { ok: true, nome: linha.original_name, tinhaChunks: (linha.chunk_count ?? 0) > 0 };
}
