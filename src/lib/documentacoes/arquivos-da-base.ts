import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertArquivoSeguro,
  extDe,
  extensaoAceita,
  MAX_ANEXO_CLIENTE_BYTES,
  MAX_ANEXO_CLIENTE_MB,
} from "@/lib/importer/file-guard";
import { extractDocument } from "@/lib/importer/extract";
import { reindexDocumentChunks } from "@/lib/content/chunk";
import { chavesProblematicasDaRegra, normalizarRegra, type Regra } from "@/lib/elegibilidade";
import { criarJobOntologia } from "@/lib/ai/ontology-enqueue";
import { enqueueOntologyScan } from "@/lib/jobs/boss";

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
 * O resultado de ler a lista — com a falha DECLARADA, e não engolida.
 *
 * Lista vazia e leitura quebrada davam exatamente o mesmo valor de retorno, e a
 * tela então mostrava "Nenhum arquivo da sua empresa ainda" com um botão
 * convidando a anexar: um defeito nosso apresentado como convite, e com risco de
 * o cliente anexar de novo o que já está lá. `falhou` é o que separa os dois.
 */
export type LeituraDeArquivos = {
  /** O que deu para ler. Com `falhou = true`, pode estar VAZIA ou PARCIAL. */
  arquivos: ArquivoDaBase[];
  falhou: boolean;
};

/**
 * Os arquivos DESTA base.
 *
 * Sempre filtrado por `base_id`, e pagina por CONSULTA com `.order("id")` antes
 * do `.range()`. O teto de 1.000 linhas do PostgREST é o defeito que mais voltou
 * neste repositório: uma varredura sem ordem estável lê 1.014 de 5.569 linhas
 * achando que leu tudo, e sem `order` o corte de página nem é determinístico.
 * Hoje um cliente tem dezenas de arquivos, não milhares — o laço existe para o
 * dia em que isso mudar, não para hoje.
 *
 * ── O `break` MUDO ERA O TERCEIRO DA MESMA CLASSE NESTE RAMO ──────────────
 * `rag.ts` tinha um catch de embedding sem log, e `escopo-da-base.ts` caía em
 * silêncio nas duas RPCs de escopo — os dois corrigidos, e o comentário de lá
 * chama o log de "OBRIGATÓRIO, não enfeite". Aqui era a mesma coisa: um erro no
 * meio da paginação devolvia o que tinha acumulado (às vezes nada) sem uma linha
 * em lugar nenhum, então "o cliente não anexou nada" e "a leitura está quebrada"
 * produziam a MESMA tela e não havia como distingui-los de fora.
 *
 * Só a BASE entra na mensagem. A identidade de quem está olhando carrega
 * matrícula e usuário, e log não é lugar de dado de pessoa (mesma regra de
 * `escopo-da-base.ts`).
 */
export async function arquivosDaBase(baseId: string): Promise<LeituraDeArquivos> {
  const db = createAdminClient();
  const linhas: LinhaCrua[] = [];
  let falhou = false;

  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("knowledge_documents")
      .select("*")
      .filter("base_id", "eq", baseId)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) {
      console.error(
        `[arquivos-da-base] falha ao ler os arquivos da base ${baseId} (a partir da linha ${de}):`,
        error.message,
      );
      falhou = true;
      break;
    }
    const lote = (data ?? []) as unknown as LinhaCrua[];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
  }

  return {
    // Ordem de EXIBIÇÃO é a mais recente primeiro; a ordem por `id` acima existe
    // só para a paginação ser estável, e as duas não precisam coincidir.
    arquivos: linhas.map(daLinha).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    falhou,
  };
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
  /**
   * Varrer o vocabulário próprio da empresa deste arquivo (ontologia por base).
   *
   * OPT-IN, e o motivo está no corpo de `anexarArquivoDaBase`, onde o job é
   * enfileirado — é o mesmo motivo de custo que `ingestKnowledgeFile` declara
   * para a porta do admin.
   */
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
  /*
    O TETO AQUI É O DA SERVER ACTION, não os 60 MB do file-guard.

    Este caminho chega por Server Action, e o corpo dela é cortado em
    `serverActions.bodySizeLimit` muito antes de 60 MB — ver
    `MAX_ANEXO_CLIENTE_BYTES`. Na prática esta recusa quase nunca dispara (o
    corpo grande nem chega a virar chamada), e é por isso que a tela também
    confere ANTES de enviar. Ela fica porque Server Action é endpoint: quem
    chamar este módulo por outro caminho tem de bater no mesmo número que a tela
    anuncia, e não num maior.
  */
  if (bytes.length > MAX_ANEXO_CLIENTE_BYTES) {
    return {
      ok: false,
      erro: `Arquivo maior que ${MAX_ANEXO_CLIENTE_MB} MB.`,
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
    VOCABULÁRIO SEM TEXTO NÃO EXISTE — recusa com o motivo, como as de cima.

    A varredura lê os CHUNKS do documento. Arquivo que não entra na base de
    conhecimento não tem chunk nenhum, então aceitar o pedido aqui varreria o
    vazio e gravaria zero termo — a falha silenciosa de sempre: o cliente marca a
    opção, nada acontece, e ele descobre semanas depois que a busca não melhorou.

    Na prática a tela só oferece a opção junto da base de conhecimento; esta
    recusa existe porque este módulo é chamado por uma Server Action, que é
    endpoint.
  */
  if (entrada.varrerOntologia && !naBaseDeConhecimento) {
    return {
      ok: false,
      erro:
        "Para ensinar os termos da sua empresa ao assistente, marque também " +
        "“o assistente pode responder com o conteúdo deste arquivo”: o vocabulário " +
        "é lido do texto do arquivo.",
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

    `bases/<base_id>/<sha256 do conteúdo>-<nome saneado>`, com o `base_id` que
    veio da sessão revalidada. É a garantia que sobrevive a todas as outras
    falharem: o arquivo de um cliente não consegue nem NASCER na pasta de outro.

    ── POR QUE O CHECKSUM, E NÃO UM UUID ──────────────────────────────────
    Até a tarefa 18 era um `randomUUID()`, e ele resolvia colisão de nome: dois
    envios do mesmo nome com conteúdos diferentes não se sobrescreviam. O
    checksum resolve a MESMA coisa (conteúdo diferente ⇒ hash diferente ⇒
    caminho diferente) e resolve uma segunda, que o uuid não só não resolvia
    como impedia: com uuid, reenviar o MESMO arquivo produzia um segundo
    caminho, e a duplicata era invisível para qualquer conferência.

    E o checksum tem de morar em algum lugar DURÁVEL para a conferência
    existir. `knowledge_documents` não tem coluna de checksum, e o banco é
    produção — então ele mora no CAMINHO, que é exatamente o que
    `capture/rehost-images.ts` já faz no bucket `assets`
    (`<escopo>/web/<sha256>.<ext>`), a dedup por checksum que este projeto já
    tinha. Sem migration, e sem uma segunda fonte para o mesmo dado.

    `upsert: true` pelo mesmo motivo que lá: o caminho É o conteúdo. Regravar
    escreve bytes idênticos, por definição de sha256 — e isso limpa de graça o
    caso do objeto órfão (um `desfazer` que apagou a linha e não conseguiu
    apagar o arquivo travaria um reenvio legítimo com "resource already
    exists").
  */
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const caminho = `bases/${baseId}/${checksum}-${nomeSaneado(nome)}`;

  /*
    REENVIO DO MESMO ARQUIVO NÃO CRIA UMA SEGUNDA LINHA.

    O caso real: a extração de um PDF grande roda DENTRO desta ação (ver o
    comentário logo abaixo) e pode passar do `proxy_read_timeout` do nginx. O
    cliente lê um erro, o Node termina o trabalho e marca `ready`, e a pessoa
    reenvia — ficando com duas linhas do mesmo arquivo, dois conjuntos de chunks
    e o assistente citando o mesmo documento duas vezes.

    Mesmo nome E mesmo conteúdo ⇒ mesmo caminho, então a conferência é uma
    igualdade, não uma heurística. Só `extracting` e `ready` barram: linha em
    `error` é resíduo que a pessoa está justamente tentando substituir, e
    recusar ali a deixaria presa.

    Falha na LEITURA não bloqueia o envio — bloquear por não conseguir conferir
    trocaria uma duplicata eventual por uma tela que não anexa nada. Mas vai para
    o log: é a única pista de que a idempotência não foi exercida.
  */
  const { data: mesmos, error: erroDaConferencia } = await db
    .from("knowledge_documents")
    .select("id, status")
    .filter("base_id", "eq", baseId)
    .eq("storage_path", caminho)
    .in("status", ["extracting", "ready"])
    .limit(1);
  if (erroDaConferencia) {
    console.error(
      `[arquivos-da-base] não deu para conferir reenvio na base ${baseId}:`,
      erroDaConferencia.message,
    );
  }
  const jaExiste = (mesmos ?? [])[0] as { id: string; status: string } | undefined;
  if (jaExiste) {
    return {
      ok: false,
      erro:
        jaExiste.status === "ready"
          ? `“${nome}” já está anexado nesta empresa, com exatamente este conteúdo. ` +
            `Ele está na lista abaixo — não precisa enviar de novo. Para trocar o conteúdo, ` +
            `exclua o arquivo atual e anexe a versão nova.`
          : `“${nome}” está sendo processado agora, com exatamente este conteúdo. ` +
            `Aguarde e atualize a página: quando terminar, ele aparece como “Pronto” na lista abaixo. ` +
            `Enviar de novo criaria uma segunda cópia do mesmo arquivo.`,
    };
  }

  const up = await db.storage.from(BUCKET_ARQUIVOS).upload(caminho, bytes, {
    contentType: mime || "application/octet-stream",
    upsert: true,
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

    A exceção é o desfazer que NÃO CONSEGUE desfazer: aí a linha fica, marcada
    como `error` com o motivo, porque uma linha presa em "Processando" para
    sempre é pior que uma linha "Falhou" que o cliente consegue excluir. Ver
    `desfazer`.
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

    /*
      ── ISTO VIOLA UMA REGRA DO PRÓPRIO PROJETO, E NÃO É DESCUIDO ──────────

      "Toda operação assíncrona longa vira job, não request HTTP" (CLAUDE.md,
      Parte 3, regra 6). Extrair um PDF e gerar embeddings dele são as duas
      operações longas deste repositório, e as duas rodam AQUI, segurando um
      worker do Next pela duração inteira. O importador já faz certo: arquivo em
      Storage, `import_jobs`, worker com pg-boss e progresso por Realtime.

      O que isso custa, concretamente: com `proxy_read_timeout 300s` no nginx
      (DEPLOY.md), um arquivo que passe disso faz o cliente ler um erro enquanto
      o Node termina e grava `ready`. O dano do reenvio está contido pela
      conferência de checksum acima; o que continua em aberto é o tempo de
      espera com a tela parada, e um worker preso por minutos.

      A VERSÃO EM JOB ESTÁ PENDENTE, e é maior que esta correção: pede fila
      própria (ou reuso de `import_jobs`), progresso na tela do cliente e uma
      decisão sobre o que a lista mostra enquanto o arquivo está na fila. Quem
      chegar aqui pensando "isto está esquecido": não está — está declarado.
    */
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

    /*
      ── O VOCABULÁRIO DA EMPRESA, quando o cliente pede ────────────────────

      Job com `base_id` (nunca `space_id`): o termo extraído daqui é DO CLIENTE e
      não entra na ontologia global. Quem garante isso é o CHECK
      `ontology_jobs_um_dono`/`ontology_terms_um_dono` no banco, a união
      `DonoDaOntologia` no tipo, e a expansão da consulta, que SOMA os dois
      conjuntos sem misturá-los (`carregarOntologia`).

      OPT-IN, pelo mesmo motivo que o admin já usa em `ingestKnowledgeFile`: a
      varredura é chamada de IA por lote de texto, e um acervo grande pagaria caro
      por vocabulário que às vezes não existe — nem todo documento tem jargão que
      valha virar termo. Quem liga ganha o outro lado: o RAG usa os sinônimos para
      casar a pergunta com o vocabulário do documento.

      Falha aqui NUNCA desfaz a ingestão — o arquivo já está no ar para o
      assistente, e a ontologia é acréscimo. Mesma regra da publicação de artigo e
      da porta do admin. O log é o que distingue "o cliente não pediu" de "a fila
      está fora do ar".
    */
    if (entrada.varrerOntologia) {
      try {
        const jobId = await criarJobOntologia(db, {
          baseId,
          scope: "document",
          targetId: documentId,
          createdBy: entrada.criadoPor ?? null,
        });
        if (jobId) await enqueueOntologyScan(jobId);
        else throw new Error("o job não foi registrado");
      } catch (e) {
        console.error(
          `[arquivos-da-base] varredura de vocabulário não enfileirada para o documento ${documentId} da base ${baseId}:`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    return { ok: true, documentId, chunks };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    /*
      O MOTIVO PRIMEIRO, e o recado do desfazer depois — truncando só o motivo.

      Truncar a frase inteira em 500 cortaria justamente a parte que diz o que
      fazer, e ela só aparece quando o desfazer falhou, que é o caso em que a
      pessoa mais precisa de instrução.

      O mesmo texto é o que `desfazer` grava na coluna `error` se a linha
      resistir: a tela então mostra ao cliente exatamente a frase que ele teria
      lido aqui, e não uma segunda redação do mesmo problema.
    */
    const motivo = `Falha ao processar: ${msg}`.slice(0, 400);
    const desfeito = await desfazer(db, baseId, caminho, documentId, motivo);
    return {
      ok: false,
      erro: desfeito
        ? motivo
        : `${motivo} O registro do arquivo não pôde ser removido: ele aparece na lista como “Falhou”, e você pode excluí-lo por lá.`,
    };
  }
}

/**
 * Remove um objeto do bucket em MELHOR ESFORÇO, e registra a sobra.
 *
 * Existe porque os dois caminhos que apagam arquivo (o `desfazer` da ingestão e o
 * `excluirArquivoDaBase` do cliente) precisam da mesma decisão, e ela estava nos
 * dois com pesos opostos: o `desfazer` escrevia a MESMA frase de órfão em dois
 * lugares (o ramo do `error` e o do `catch`), e a exclusão do cliente descartava
 * o retorno e não escrevia nada. Duas leituras da mesma regra, nenhuma delas
 * completa.
 *
 * Órfão no bucket é invisível para o cliente e não tem ação possível do lado dele,
 * então isto NUNCA muda o retorno de quem chamou. O log é o único jeito de a
 * sobra ser achada depois — pelo caminho, que é o que o bucket entende.
 *
 * O log leva a base e o CAMINHO, nunca a identidade de quem enviou (mesma regra de
 * `escopo-da-base.ts`).
 */
async function removerDoBucket(
  db: ReturnType<typeof createAdminClient>,
  baseId: string,
  caminho: string,
): Promise<void> {
  try {
    const { error } = await db.storage.from(BUCKET_ARQUIVOS).remove([caminho]);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error(
      `[arquivos-da-base] arquivo órfão em "${caminho}" (base ${baseId}):`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Desfaz um anexo pela metade: apaga a linha (chunks por cascade) e o arquivo.
 *
 * A LINHA PRIMEIRO, de propósito. Se a ordem fosse ao contrário e a remoção da
 * linha falhasse, ficaria um documento na lista do cliente apontando para um
 * arquivo que não existe — download quebrado e nada explicando. Arquivo órfão no
 * bucket é invisível e custa espaço; linha órfã é visível e custa confiança.
 *
 * ── "MELHOR ESFORÇO" NÃO PODE SIGNIFICAR "SEM SABER SE DEU CERTO" ────────
 * A versão anterior ignorava o retorno do `delete` e engolia a exceção. Quando
 * a remoção falhava, a linha ficava em `extracting` PARA SEMPRE: a tela do
 * cliente mostrava "Processando" indefinidamente, sem erro em canto nenhum e
 * sem nada que explicasse. Agora:
 *
 *   1. o retorno é conferido e a falha vai para o log — com a base e o
 *      documento, nunca a identidade de quem enviou (mesma regra de
 *      `escopo-da-base.ts`);
 *   2. se a linha resistiu, ela é MARCADA como `error` com o motivo. Não é
 *      enfeite: é o que faz a lista parar de mentir "Processando" e é o que
 *      torna alcançável o distintivo "Falhou" da tela, que até aqui era peça
 *      morta — nada escrevia `error` numa linha de base. De quebra fecha o
 *      download da sobra: `documentos_da_base` só devolve `status = 'ready'`,
 *      então a linha marcada deixa de ser baixável;
 *   3. o `boolean` de volta é o que permite a quem chamou DIZER isso a quem
 *      anexou, em vez de deixar a pessoa olhando uma linha presa.
 *
 * E o arquivo no bucket só sai quando a LINHA saiu: linha viva apontando para
 * objeto apagado é download quebrado, que é pior que espaço ocupado — a mesma
 * troca que justifica a ordem lá em cima.
 *
 * @returns `true` se não sobrou resíduo visível para o cliente.
 */
async function desfazer(
  db: ReturnType<typeof createAdminClient>,
  baseId: string,
  caminho: string,
  documentId: string | null,
  motivo: string,
): Promise<boolean> {
  let linhaRemovida = true;

  if (documentId) {
    linhaRemovida = false;
    try {
      const { error } = await db
        .from("knowledge_documents")
        .delete()
        .eq("id", documentId)
        // A mesma cerca da exclusão: o desfazer também não alcança outra base.
        .filter("base_id", "eq", baseId);
      if (error) throw new Error(error.message);
      linhaRemovida = true;
    } catch (e) {
      console.error(
        `[arquivos-da-base] desfazer NÃO removeu a linha ${documentId} da base ${baseId}:`,
        e instanceof Error ? e.message : String(e),
      );
      try {
        const { error } = await db
          .from("knowledge_documents")
          .update({ status: "error", error: motivo.slice(0, 500) })
          .eq("id", documentId)
          .filter("base_id", "eq", baseId);
        if (error) throw new Error(error.message);
      } catch (e2) {
        // Segunda queda: a linha fica em `extracting`. Nada mais a tentar daqui,
        // e o log é o que permite achá-la depois pelo id.
        console.error(
          `[arquivos-da-base] a linha ${documentId} da base ${baseId} ficou presa em "extracting":`,
          e2 instanceof Error ? e2.message : String(e2),
        );
      }
    }
  }

  if (!linhaRemovida) return false;

  await removerDoBucket(db, baseId, caminho);

  return true;
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
  // linha apontando para arquivo inexistente (ver `desfazer`). "Melhor esforço"
  // não quer dizer "em silêncio": o retorno é lido e a falha vai para o log, pelo
  // MESMO helper do `desfazer`. Aqui o retorno era descartado, e um bucket que
  // recusasse a remoção guardaria o arquivo de um cliente que pediu para apagá-lo
  // sem nada em lugar nenhum dizendo isso.
  await removerDoBucket(db, entrada.baseId, linha.storage_path);

  return { ok: true, nome: linha.original_name, tinhaChunks: (linha.chunk_count ?? 0) > 0 };
}
