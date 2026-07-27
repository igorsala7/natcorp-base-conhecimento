/**
 * Desambiguação do RAG: quando os trechos recuperados disputam entre TEMAS
 * distintos (documentação › diretório/manual › arquivo) e o tema está FORA do
 * que a conversa vinha tratando, o assistente pergunta em qual o usuário quer
 * — com botões — em vez de misturar ou chutar.
 *
 * Puro: processa `RetrievedSource[]` (sem SDK/DOM/server-only). O tipo é
 * importado só como tipo (erased), então os clientes podem importar
 * `ClarifyOption`/`ClarifyScope` daqui sem puxar código de servidor.
 */
import type { RetrievedSource } from "@/lib/ai/rag";

/** Filtro de recuperação escolhido pelo usuário (ou o tema em foco na conversa). */
export type ClarifyScope = {
  spaceId?: string;
  /** Diretório (subárvore inteira). */
  nodeId?: string;
  /** Arquivo da base de conhecimento. */
  documentId?: string;
  /** "Buscar em tudo": escolha explícita de NÃO filtrar. */
  all?: boolean;
};

/** Um botão de opção na pergunta de desambiguação. */
export type ClarifyOption = {
  id: string;
  label: string;
  sublabel?: string;
  scope: ClarifyScope;
};

/** Resposta de desambiguação devolvida ao cliente. */
export type Disambiguation = { question: string; options: ClarifyOption[] };

/** Quantas fontes do topo consideramos ao medir a disputa de temas. */
const TOP_K = 6;

export const CLARIFY_QUESTION =
  "Encontrei conteúdo parecido em mais de um lugar. Sobre qual você quer saber?";

type Theme = {
  key: string;
  spaceId: string | null;
  spaceName: string | null;
  dirNodeId: string | null;
  dirTitle: string | null;
  documentId: string | null;
  /** Título do ARTIGO/arquivo representante do tema (o topo do grupo). */
  title: string;
  /** Resumo curto do conteúdo — "de onde pode estar o conteúdo". */
  resumo: string | null;
};

/**
 * Resumo de uma linha (~100 chars) para o sublabel da opção. O `snippet` vem do
 * `ts_headline` do Postgres, que envolve o termo casado em `<b>…</b>` e escapa
 * `<`/`>`/`&` do texto — como o botão mostra TEXTO PURO, essas tags apareciam
 * cruas ("<b>férias</b>"). Aqui removemos as tags e desescapamos as entidades.
 */
function resumir(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = texto
    // Só tags HTML de verdade (`<b>`, `</b>`, `<mark …>`): o `\b` após o nome
    // evita comer "a < b" do próprio conteúdo.
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (t.length <= 100) return t;
  return t.slice(0, 96).replace(/\s+\S*$/, "") + "…";
}

/** Tema de uma fonte: arquivo (documento) ou artigo (documentação + diretório). */
function themeOf(s: RetrievedSource): Theme {
  const resumo = resumir(s.snippet ?? s.content);
  if (s.document_id) {
    return {
      key: `doc:${s.document_id}`,
      spaceId: null,
      spaceName: null,
      dirNodeId: null,
      dirTitle: null,
      documentId: s.document_id,
      title: s.title,
      resumo,
    };
  }
  return {
    key: `dir:${s.space_id ?? "?"}:${s.dir_node_id ?? "root"}`,
    spaceId: s.space_id,
    spaceName: s.space_name,
    dirNodeId: s.dir_node_id,
    dirTitle: s.dir_title,
    documentId: null,
    title: s.title,
    resumo,
  };
}

/**
 * Monta o botão de um tema. NOVO (jul/2026, pedido do usuário): a opção de
 * DIRETÓRIO usa o NOME DO ARTIGO no rótulo e um resumo curto no sublabel (com o
 * diretório como local) — antes mostrava só o nome do diretório/sub-diretório.
 * As opções por documentação/arquivo seguem pelo nome próprio + resumo.
 */
function opcaoDoTema(t: Theme, porDocumentacao: boolean): ClarifyOption | null {
  if (t.documentId) {
    return {
      id: `doc:${t.documentId}`,
      label: t.title,
      sublabel: t.resumo ? `Arquivo · ${t.resumo}` : "Arquivo",
      scope: { documentId: t.documentId },
    };
  }
  if (porDocumentacao && t.spaceId) {
    return {
      id: `space:${t.spaceId}`,
      label: t.spaceName ?? "Documentação",
      ...(t.resumo ? { sublabel: t.resumo } : {}),
      scope: { spaceId: t.spaceId },
    };
  }
  if (t.dirNodeId) {
    const local = [porDocumentacao ? t.spaceName : null, t.dirTitle].filter(Boolean).join(" › ");
    const sub = [local, t.resumo].filter(Boolean).join(" · ");
    return {
      id: `dir:${t.dirNodeId}`,
      label: t.title, // nome do ARTIGO
      ...(sub ? { sublabel: sub } : {}),
      scope: { ...(t.spaceId ? { spaceId: t.spaceId } : {}), nodeId: t.dirNodeId },
    };
  }
  return null;
}

/** O tema `t` bate com o escopo `s` (para saber se ainda estamos no contexto)? */
function matchesScope(t: Theme, s: ClarifyScope): boolean {
  if (s.all) return true;
  if (s.documentId) return t.documentId === s.documentId;
  if (s.nodeId) return t.dirNodeId === s.nodeId;
  if (s.spaceId) return t.spaceId === s.spaceId;
  return false;
}

/**
 * Decide se deve perguntar. Retorna a pergunta + opções, ou `null` para
 * responder direto. Regras:
 * - precisa de conflito REAL: ≥2 temas distintos entre as 3 fontes do topo;
 * - CIENTE DO CONTEXTO: se o tema em foco (`contextScope`) está entre os
 *   competidores, NÃO interrompe (o usuário segue no mesmo assunto);
 * - as opções saem no nível em que os temas divergem: se abrangem várias
 *   DOCUMENTAÇÕES → uma opção por documentação; senão → por diretório/manual;
 *   arquivos viram opção própria. Sempre com um "Buscar em tudo".
 */
export function analyzeAmbiguity(
  sources: RetrievedSource[],
  contextScope?: ClarifyScope | null,
): Disambiguation | null {
  if (contextScope?.all) return null; // usuário já optou por buscar em tudo
  const top = sources.slice(0, TOP_K);
  if (top.length < 2) return null;

  const themes = top.map(themeOf);
  const top3 = new Set(themes.slice(0, 3).map((t) => t.key));
  if (top3.size < 2) return null; // um tema domina o topo → responde direto

  // Competidores = temas distintos na ordem de 1ª aparição (no top-K), até 4.
  const vistos = new Set<string>();
  const competidores: Theme[] = [];
  for (const t of themes) {
    if (!vistos.has(t.key)) {
      vistos.add(t.key);
      competidores.push(t);
    }
  }
  const comp = competidores.slice(0, 4);

  // Ciente do contexto: se ainda estamos no tema da conversa, não pergunta.
  if (contextScope && comp.some((t) => matchesScope(t, contextScope))) return null;

  // Nível das opções: documentação (se disputam entre documentações) × diretório.
  const spacesDistintos = new Set(comp.filter((t) => t.spaceId).map((t) => t.spaceId));
  const porDocumentacao = spacesDistintos.size > 1;

  const options: ClarifyOption[] = [];
  const usados = new Set<string>();
  for (const t of comp) {
    const opt = opcaoDoTema(t, porDocumentacao);
    if (!opt || usados.has(opt.id)) continue;
    usados.add(opt.id);
    options.push(opt);
  }

  // Depois do dedupe pode sobrar 1 (ex.: 2 diretórios da mesma doc que colapsam
  // em documentação) — sem ≥2 opções reais, não vale perguntar.
  if (options.length < 2) return null;
  options.push({ id: "all", label: "Buscar em tudo", scope: { all: true } });
  return { question: CLARIFY_QUESTION, options };
}

/**
 * Limiar de CONFIANÇA da recuperação (score RRF da fonte de topo). Calibrado em
 * dados reais: perguntas no assunto ficam ~0.033–0.061; perguntas sem sentido/
 * fora de contexto batem no piso ~0.015–0.017. 0.022 separa com folga dos dois
 * lados. Abaixo dele, a recuperação é FRACA → melhor perguntar que chutar.
 */
export const LIMIAR_CONFIANCA = 0.022;

export const DIDYOUMEAN_QUESTION =
  "Não tenho certeza do que você procura. Era sobre algum destes assuntos?";

/**
 * Rede de segurança quando a busca vem FRACA mesmo após entender a consulta:
 * em vez de arriscar uma resposta (ou só dizer "não encontrei"), oferece
 * "você quis dizer…" com os assuntos mais próximos — quando dá para confiar
 * neles. Complementa `analyzeAmbiguity` (que trata o conflito de temas FORTES).
 *
 * Só sugere quando a recuperação fraca CONCENTRA em poucos temas (quase-acerto);
 * se vier ESPALHADA em muitos temas distintos, é ruído/fora do domínio →
 * devolve `null` e deixa a resposta dizer que não encontrou. Fontes forçadas
 * pelo vínculo termo→artigo da ontologia contam como ALTA confiança (não pergunta).
 */
export function analyzeConfidence(
  sources: RetrievedSource[],
  contextScope?: ClarifyScope | null,
): Disambiguation | null {
  if (contextScope?.all) return null; // usuário já pediu "buscar em tudo"
  const top = sources[0];
  if (!top) return null; // nada recuperado → a resposta trata o "não encontrei"
  if (top.forced) return null; // ontologia vinculou o termo a este artigo → confiante
  if (top.score >= LIMIAR_CONFIANCA) return null; // recuperação forte → responde direto

  // FRACA: só vale sugerir se os poucos primeiros CONCENTRAM em ≤3 temas.
  const distintos: Theme[] = [];
  const vistos = new Set<string>();
  for (const t of sources.slice(0, 5).map(themeOf)) {
    if (!vistos.has(t.key)) {
      vistos.add(t.key);
      distintos.push(t);
    }
  }
  if (distintos.length === 0 || distintos.length > 3) return null; // espalhado = ruído

  const porDocumentacao = new Set(distintos.filter((t) => t.spaceId).map((t) => t.spaceId)).size > 1;
  const options: ClarifyOption[] = [];
  const usados = new Set<string>();
  for (const t of distintos.slice(0, 3)) {
    const opt = opcaoDoTema(t, porDocumentacao);
    if (!opt || usados.has(opt.id)) continue;
    usados.add(opt.id);
    options.push(opt);
  }
  if (!options.length) return null;
  options.push({ id: "all", label: "Nenhum desses — buscar em tudo", scope: { all: true } });
  return { question: DIDYOUMEAN_QUESTION, options };
}

/**
 * Tema resolvido de uma resposta (a fonte de topo) — o servidor devolve isto ao
 * cliente, que passa a mandá-lo como `contextScope` (é o que mantém a conversa
 * "no contexto" e evita perguntar de novo no mesmo assunto).
 */
export function resolveTheme(sources: RetrievedSource[]): { scope: ClarifyScope; label: string } | null {
  const s = sources[0];
  if (!s) return null;
  const t = themeOf(s);
  if (t.documentId) return { scope: { documentId: t.documentId }, label: t.title };
  if (t.dirNodeId) {
    return {
      scope: { ...(t.spaceId ? { spaceId: t.spaceId } : {}), nodeId: t.dirNodeId },
      label: t.dirTitle ?? t.spaceName ?? "",
    };
  }
  if (t.spaceId) return { scope: { spaceId: t.spaceId }, label: t.spaceName ?? "" };
  return null;
}
