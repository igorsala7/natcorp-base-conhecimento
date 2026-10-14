/**
 * Catálogo de provedores e modelos oferecidos na tela de configurações.
 *
 * Puro e sem dependência de SDK: serve tanto ao servidor quanto à tela, e é
 * testável.
 */

export type ProviderKind = "anthropic" | "openai" | "google" | "maritaca";

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  google: "Google (Gemini)",
  maritaca: "Maritaca (Sabiá)",
};

/** Onde obter a chave — a tela mostra para quem está cadastrando. */
export const PROVIDER_HELP: Record<ProviderKind, string> = {
  anthropic: "console.anthropic.com → API Keys",
  openai: "platform.openai.com → API Keys",
  google: "aistudio.google.com → Get API key",
  maritaca: "plataforma.maritaca.ai → Chaves de API",
};

/**
 * URL base padrão quando o provedor não usa a do SDK. A Maritaca fala o
 * protocolo da OpenAI, mas em outro endereço: sem isto, a chave dela iria
 * para api.openai.com e voltaria "chave inválida" sem pista do motivo.
 */
export const PROVIDER_BASE_URL: Partial<Record<ProviderKind, string>> = {
  maritaca: "https://chat.maritaca.ai/api",
};

/**
 * Provedor que NÃO enxerga imagem: na Maritaca, imagens e PDFs passam por OCR
 * no servidor dela e o modelo recebe só o TEXTO. Serve para ler documento;
 * não serve para julgar o que só a imagem mostra (foto, carimbo, montagem).
 */
export function enxergaImagem(kind: ProviderKind): boolean {
  return kind !== "maritaca";
}

/**
 * Modelo que RECUSA o parâmetro `temperature` (HTTP 400 "`temperature` is
 * deprecated for this model"). Sondado em 14/10/2026 contra a API: no Claude,
 * opus-5, opus-5-5 e haiku-5-5 recusam; haiku-4-5, sonnet-5, sonnet-5-5,
 * fable-5 e fable-5-1 aceitam. Quem recusa recebe a chamada SEM o parâmetro
 * (config.ts) em vez de falhar: o editor, o importador ("criatividade") e o
 * OCR por visão passam `temperature`, e trocar o modelo deles para um destes
 * derrubaria a função inteira. Na OpenAI o SDK já descarta sozinho, com aviso.
 */
export function recusaTemperatura(kind: ProviderKind, model: string): boolean {
  return kind === "anthropic" && /^claude-(opus-5|opus-5-5|haiku-5-5)(-\d{8})?$/.test(model.trim());
}

/**
 * Modelos com processamento declarado 100% em território nacional. A tela de
 * OCR usa isto para avisar quando um documento pessoal sairia do país —
 * decisão do administrador, não trava do sistema.
 */
export function processaNoBrasil(kind: ProviderKind, model: string): boolean {
  return kind === "maritaca" && model.trim().endsWith("-br-sp");
}

export type Purpose =
  | "chat"
  | "chat_ferramentas"
  | "report_analysis"
  | "query_rewrite"
  | "embedding"
  | "import_structure"
  | "import_layout"
  | "editor_text"
  | "editor_generate"
  | "transcricao"
  | "ocr";

/**
 * Finalidades que aceitam MODELO DE RESERVA (outro provedor refaz a chamada
 * quando o principal falha). Fora: embedding (vetor de outro modelo não se
 * compara), OCR (documento pessoal só vai aonde o administrador escolheu) e
 * transcrição (só Whisper). O banco tem o mesmo CHECK
 * (20261014150000_modelo_reserva.sql).
 */
export const RESERVA_APLICAVEL: ReadonlySet<Purpose> = new Set<Purpose>([
  "chat",
  "chat_ferramentas",
  "report_analysis",
  "query_rewrite",
  "import_structure",
  "import_layout",
  "editor_text",
  "editor_generate",
]);

/**
 * Grupos da tela "Qual IA faz o quê". Finalidades do mesmo assunto ficam
 * juntas; a ordem aqui é a ordem na tela.
 */
export const PURPOSE_GROUPS = [
  { key: "atendimento", label: "Atendimento (chat e widget)" },
  { key: "busca", label: "Busca" },
  { key: "documentos", label: "Documentos e importação" },
  { key: "editor", label: "Editor" },
  { key: "midia", label: "Mídia" },
] as const;

export type PurposeGroup = (typeof PURPOSE_GROUPS)[number]["key"];

export const PURPOSES: { key: Purpose; label: string; desc: string; grupo: PurposeGroup }[] = [
  { key: "chat", grupo: "atendimento", label: "Chat", desc: "Respostas do assistente e do widget." },
  {
    key: "chat_ferramentas",
    grupo: "atendimento",
    label: "Chat com ferramentas",
    desc: "Usado quando o turno do chat CHAMA ferramentas de integração/consulta a sistemas (dados reais, vários colaboradores, análises que combinam fontes). Esses turnos AGÊNTICOS convergem muito melhor num modelo FORTE (ex.: Claude ou Gemini Pro) — modelos rápidos entram em loop de chamadas. Deixe o Chat num modelo barato/rápido e este num forte. Sem atribuição própria, usa o modelo do Chat.",
  },
  {
    key: "report_analysis",
    grupo: "atendimento",
    label: "Análise de relatório",
    desc: "Usado quando o widget faz ANÁLISE PURA do relatório da tela (sem preencher/operar a tela). Prompt enxuto — dá para atribuir um modelo mais forte (raciocínio) OU mais barato/rápido, conforme sua prioridade. Sem atribuição própria, usa o modelo do Chat.",
  },
  {
    key: "query_rewrite",
    grupo: "busca",
    label: "Reescrita de busca",
    desc: "Reescreve a pergunta do usuário para o vocabulário da documentação ANTES do RAG. Roda no caminho crítico do chat — atribua um modelo RÁPIDO e barato (ex.: Gemini Flash-Lite / Haiku). Sem atribuição própria, usa o modelo do Chat.",
  },
  {
    key: "embedding",
    grupo: "busca",
    label: "Embeddings",
    desc: "Vetores da busca semântica. Trocar exige reindexar tudo.",
  },
  {
    key: "import_structure",
    grupo: "documentos",
    label: "Importação — estrutura",
    desc: "Monta a árvore de documentos e artigos a partir do arquivo. Com a leitura por IA ligada, precisa de um modelo com VISÃO (lê o PDF/páginas).",
  },
  {
    key: "import_layout",
    grupo: "documentos",
    label: "Importação — layout",
    desc: "Gera/reformata o conteúdo em blocos ricos. Com a leitura por IA ligada, é quem escreve o conteúdo de cada artigo.",
  },
  {
    key: "editor_text",
    grupo: "editor",
    label: "Editor — texto",
    desc: "Reescrever, expandir, resumir e mudar o tom no editor (com revisão). Sem atribuição própria, usa o provedor do Chat.",
  },
  {
    key: "editor_generate",
    grupo: "editor",
    label: "Editor — gerar artigo",
    desc: "Wizard \"Artigo com IA\" (outline e corpo) e remix (FAQ, resumo). Sem atribuição própria, usa o provedor do Chat.",
  },
  {
    key: "transcricao",
    grupo: "midia",
    label: "Transcrição de voz",
    desc: "Transforma a fala da gravação de tela (extensão) em texto. Só provedor OpenAI (Whisper).",
  },
  {
    key: "ocr",
    grupo: "documentos",
    label: "Leitura de documentos (OCR)",
    desc: "Lê PDF e imagem de documento (RG, CPF, CNH, comprovante, certidão, atestado…) e devolve o texto. Maritaca faz OCR nativo e só entrega TEXTO; Gemini, GPT e Claude ENXERGAM a imagem. Não herda do Chat: documento pessoal só vai para onde foi apontado aqui.",
  },
];

/**
 * Modelos de LINGUAGEM sugeridos (chat e todas as finalidades de texto:
 * importação, editor). Texto livre continua aceito na tela — esta lista é só a
 * sugestão do datalist. TODOS aceitam entrada de IMAGEM/PDF (necessário para a
 * leitura por IA na importação). Atual em jul/2026; conferir na doc do provedor
 * ao adicionar novos.
 */
export const CHAT_MODELS: Record<ProviderKind, string[]> = {
  anthropic: [
    // Atuais
    "claude-fable-5",
    "claude-opus-4-8",
    "claude-sonnet-5",
    "claude-haiku-4-5",
    // Ainda disponíveis (geração anterior)
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-opus-4-5",
  ],
  openai: [
    "gpt-5.6",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.5-pro",
    "gpt-5.4",
    "gpt-5.4-pro",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ],
  // Conferido em ai.google.dev (preços e descontinuação) em 14/10/2026. Fora da
  // lista por serem só redirecionamento: 3.5-flash → 3.6-flash, 3.7-flash →
  // 3.8-flash, 3-flash-preview (legado) → 3.6-flash. 3.1-flash-lite sai em
  // 07/05/2027 (substituto: 3.5-flash-lite).
  google: [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-4-argon",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
  ],
  // Sem visão (imagem vira texto por OCR) e sem embeddings. `-br-sp` = mesmo
  // modelo processado só no Brasil, 30% mais caro. Conferido em 13/10/2026.
  maritaca: [
    "sabia-4",
    "sabiazinho-4",
    "sabia-4-thinking",
    "sabia-4-br-sp",
    "sabiazinho-4-br-sp",
    "sabia-4-thinking-br-sp",
  ],
};

/**
 * Modelos sugeridos para OCR. Na Maritaca a extração roda ANTES do modelo
 * (cobrada por página de PDF), então o barato basta: o texto devolvido é o
 * da extração, não a resposta dele. Nos demais, o modelo lê a imagem — os de
 * visão rápidos e baratos vêm primeiro.
 */
export const OCR_MODELS: Record<ProviderKind, string[]> = {
  maritaca: ["sabiazinho-4-br-sp", "sabiazinho-4", "sabia-4-br-sp", "sabia-4"],
  google: ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.1-pro-preview"],
  openai: ["gpt-5.4-mini", "gpt-5.5", "gpt-5.6"],
  anthropic: ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"],
};

/** Nível de extração de PDF na Maritaca (não afeta imagem nem outros tipos). */
export type EsforcoOcr = "medium" | "advanced";

/**
 * Modelos de embedding — SÓ os que entregam **1536 dimensões**.
 *
 * `chunks.embedding` é `vector(1536)`: um modelo de outra dimensão não cabe na
 * coluna e invalidaria todos os vetores existentes. Os que não são 1536 por
 * padrão entram com `dimensions: 1536` (ver `precisaDimensoes`).
 */
export const EMBEDDING_MODELS: Record<ProviderKind, string[]> = {
  // A Anthropic não tem API de embeddings própria.
  anthropic: [],
  // Só modelos que entregam 1536 dims (nativo ou por parâmetro). Não incluir os
  // que fixam outra dimensão (ex.: text-embedding-004, 768) — não cabem na coluna.
  openai: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
  // gemini-embedding-2 em uso desde 14/10/2026; o 001 é servido até 14/05/2028.
  google: ["gemini-embedding-2", "gemini-embedding-001"],
  // A Maritaca não tem modelo de embeddings (a doc dela indica a DeepInfra).
  maritaca: [],
};

export const EMBEDDING_DIM = 1536;

/**
 * O modelo precisa que a dimensão seja pedida explicitamente?
 * `text-embedding-3-small` e `text-embedding-ada-002` já são 1536 NATIVOS e NÃO
 * aceitam o parâmetro `dimensions` (pedi-lo neles quebra a chamada). Os demais
 * são maiores e aceitam truncagem via parâmetro (`dimensions`/`outputDimensionality`).
 */
export function precisaDimensoes(model: string): boolean {
  return model !== "text-embedding-3-small" && model !== "text-embedding-ada-002";
}

/** O provedor serve para esta finalidade? */
/** Modelos de TRANSCRIÇÃO (STT). Whisper/gpt-*-transcribe são OpenAI-compatíveis. */
export const TRANSCRIBE_MODELS: Record<ProviderKind, string[]> = {
  openai: ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"],
  google: [],
  anthropic: [],
  maritaca: [],
};

/**
 * `kind` vem do banco, e o banco pode estar à frente do código: em 13/10/2026
 * uma linha `maritaca` gravada antes do deploy derrubou Sistema → IA inteira
 * (`EMBEDDING_MODELS["maritaca"].length` em código antigo). Provedor que esta
 * versão não conhece não serve para nada, mas também não quebra a tela.
 */
export function suportaFinalidade(kind: ProviderKind, purpose: Purpose): boolean {
  if (!(kind in CHAT_MODELS)) return false;
  if (purpose === "embedding") return EMBEDDING_MODELS[kind].length > 0;
  if (purpose === "transcricao") return TRANSCRIBE_MODELS[kind].length > 0; // só OpenAI
  if (purpose === "ocr") return OCR_MODELS[kind].length > 0;
  return true;
}

/** Modelos sugeridos para o par (provedor, finalidade). Vazio para provedor desconhecido. */
export function modelosDe(kind: ProviderKind, purpose: Purpose): string[] {
  if (!(kind in CHAT_MODELS)) return [];
  if (purpose === "embedding") return EMBEDDING_MODELS[kind];
  if (purpose === "transcricao") return TRANSCRIBE_MODELS[kind];
  if (purpose === "ocr") return OCR_MODELS[kind];
  return CHAT_MODELS[kind];
}
