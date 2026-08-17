import { degradarTipo, normalizeSpec, type ChartSpec, type DestinoGrafico } from "@/lib/chat/chart-spec";

/**
 * Spec de RELATÓRIO que a IA preenche (`gerar_relatorio`) e o construtor de PDF
 * consome. Blocos "planos" (um objeto com campos opcionais por `tipo`) em vez de
 * união discriminada — as gramáticas de schema da Anthropic/Google recusam
 * uniões complexas. Ver [[blocks-schema-grammar-limit]].
 *
 * Client-safe: só tipos + saneamento puro.
 */

/**
 * O VOCABULÁRIO DE LAYOUT.
 *
 * Eram três tipos, e o renderizador fazia um bloco por página/slide, sempre
 * igual. O deck institucional da Natcorp tem nove arquétipos — capa, faixa de
 * seção, cards em três colunas, faixa de números, tabela comparativa. A
 * diferença entre o material deles e o que o gerador produzia não era capricho:
 * era vocabulário.
 *
 * `secao`, `destaques` e `cards` são os três que faltavam e que os outros
 * arquétipos derivam. Continuam PLANOS (campos opcionais por `tipo`, não união
 * discriminada) porque as gramáticas de schema da Anthropic/Google recusam
 * uniões complexas — ver [[blocks-schema-grammar-limit]].
 *
 * `nota` existe em todo bloco e é o que carrega a NARRATIVA sem custar uma
 * segunda passada de IA: no PPTX vira notas do apresentador, no PDF e no Word
 * vira a linha em itálico sob a tabela/gráfico dizendo o que aquilo mostra.
 */
export type ReportBlock =
  | { tipo: "texto"; titulo?: string; texto: string; nota?: string }
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][]; nota?: string }
  | { tipo: "grafico"; grafico: ChartSpec; nota?: string }
  /** Divisor de assunto: faixa em degradê com o título. Abre um capítulo. */
  | { tipo: "secao"; titulo: string; subtitulo?: string; nota?: string }
  /** 2 a 4 números grandes com rótulo — o "+30 Módulos · +70% Produtividade" do deck. */
  | { tipo: "destaques"; titulo?: string; itens: { valor: string; rotulo: string; nota?: string }[]; nota?: string }
  /** 2 a 4 cartões com título e texto — a grade de três colunas do deck. */
  | { tipo: "cards"; titulo?: string; itens: { titulo: string; texto: string }[]; nota?: string };

/** Formato de saída do arquivo gerado. */
export type ReportFormat = "pdf" | "xlsx" | "csv" | "docx" | "pptx";
export const REPORT_FORMATS: ReportFormat[] = ["pdf", "xlsx", "csv", "docx", "pptx"];

export type ReportSpec = {
  titulo: string;
  subtitulo?: string;
  formato: ReportFormat;
  blocos: ReportBlock[];
  /** O que o formato NÃO conseguiu entregar como pedido (tipo de gráfico trocado,
   *  gráfico omitido em CSV…). Devolvido ao modelo para ele CONTAR ao usuário e
   *  impresso como legenda no arquivo — degradar em silêncio é o que queremos matar. */
  avisos?: string[];
};

/** Quem desenha o gráfico em cada formato de arquivo. */
const DESTINO_DO_FORMATO: Record<ReportFormat, DestinoGrafico | null> = {
  pdf: "pdf",
  xlsx: "svg",   // vira imagem (SVG → PNG) na planilha
  docx: "svg",   // tenta OOXML nativo, cai para imagem — o piso é o SVG
  pptx: "pptx",
  csv: null,     // CSV é texto puro: não existe gráfico
};

const MAX_BLOCOS = 40;
const MAX_COLS = 40; // relatórios reais (IR) têm muitas colunas — não truncar
// Teto alto: tabelas de relatório podem vir de um DATASET completo (o servidor
// expande TODAS as linhas reais — não são redigitadas pelo modelo). Ver datasets.ts.
const MAX_LINHAS = 50000;
const MAX_TEXTO = 4000;
/**
 * Dois a quatro itens em `destaques`/`cards`.
 *
 * Não é limite técnico, é de leitura: cinco números grandes lado a lado deixam
 * de ser destaque e viram tabela mal formatada. Um item só também não funciona —
 * destaque só existe em contraste com outra coisa. Acima do teto o excedente é
 * cortado, não recusado: perder o quinto cartão é melhor que perder o bloco.
 */
const MIN_ITENS = 2;
const MAX_ITENS = 4;
const MAX_NOTA = 600;

function str(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}

/** Saneia a tabela (coage células a texto, limita colunas/linhas). */
function normalizeTabela(raw: unknown): Extract<ReportBlock, { tipo: "tabela" }> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const colunas = Array.isArray(o.colunas) ? o.colunas.slice(0, MAX_COLS).map((c) => str(c, 60)) : [];
  if (colunas.length === 0) return null;
  const linhasRaw = Array.isArray(o.linhas) ? o.linhas.slice(0, MAX_LINHAS) : [];
  const linhas = linhasRaw.map((l) =>
    (Array.isArray(l) ? l : [l]).slice(0, colunas.length).map((c) => str(c, 200)),
  );
  if (linhas.length === 0) return null;
  return { tipo: "tabela", titulo: o.titulo ? str(o.titulo, 120) : undefined, colunas, linhas };
}

/** `{valor, rotulo}` de `destaques`. Item sem os dois não é destaque de nada. */
function normalizeDestaques(raw: unknown): { valor: string; rotulo: string; nota?: string }[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: { valor: string; rotulo: string; nota?: string }[] = [];
  for (const i of arr.slice(0, MAX_ITENS)) {
    if (!i || typeof i !== "object") continue;
    const o = i as Record<string, unknown>;
    const valor = str(o.valor, 24).trim();
    const rotulo = str(o.rotulo, 60).trim();
    if (!valor || !rotulo) continue;
    out.push({ valor, rotulo, ...(o.nota ? { nota: str(o.nota, 120) } : {}) });
  }
  return out;
}

/** `{titulo, texto}` de `cards`. */
function normalizeCards(raw: unknown): { titulo: string; texto: string }[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: { titulo: string; texto: string }[] = [];
  for (const i of arr.slice(0, MAX_ITENS)) {
    if (!i || typeof i !== "object") continue;
    const o = i as Record<string, unknown>;
    const titulo = str(o.titulo, 60).trim();
    const texto = str(o.texto, 240).trim();
    if (!titulo && !texto) continue;
    out.push({ titulo, texto });
  }
  return out;
}

/** Saneia a spec do relatório vinda do modelo (ignora blocos inválidos). */
export function normalizeReport(raw: unknown): ReportSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const blocosRaw = Array.isArray(o.blocos) ? o.blocos.slice(0, MAX_BLOCOS) : [];
  const formato = (REPORT_FORMATS as string[]).includes(String(o.formato)) ? (o.formato as ReportFormat) : "pdf";
  const destino = DESTINO_DO_FORMATO[formato];
  const blocos: ReportBlock[] = [];
  const avisos: string[] = [];
  for (const b of blocosRaw) {
    if (!b || typeof b !== "object") continue;
    const bo = b as Record<string, unknown>;
    // A nota vale para qualquer bloco — anexada depois de o bloco existir.
    const nota = bo.nota ? str(bo.nota, MAX_NOTA).trim() : "";
    const comNota = <T extends ReportBlock>(b: T): T => (nota ? { ...b, nota } : b);

    if (bo.tipo === "texto" && typeof bo.texto === "string" && bo.texto.trim()) {
      blocos.push(comNota({
        tipo: "texto",
        ...(bo.titulo ? { titulo: str(bo.titulo, 120) } : {}),
        texto: str(bo.texto, MAX_TEXTO),
      }));
    } else if (bo.tipo === "secao") {
      // Seção é só título: sem ele não há o que dividir, e um divisor vazio é
      // uma página em branco no meio do relatório.
      const titulo = str(bo.titulo, 120).trim();
      if (!titulo) continue;
      blocos.push(comNota({ tipo: "secao", titulo, ...(bo.subtitulo ? { subtitulo: str(bo.subtitulo, 200) } : {}) }));
    } else if (bo.tipo === "destaques") {
      const itens = normalizeDestaques(bo.itens);
      if (itens.length < MIN_ITENS) continue;
      blocos.push(comNota({ tipo: "destaques", ...(bo.titulo ? { titulo: str(bo.titulo, 120) } : {}), itens }));
    } else if (bo.tipo === "cards") {
      const itens = normalizeCards(bo.itens);
      if (itens.length < MIN_ITENS) continue;
      blocos.push(comNota({ tipo: "cards", ...(bo.titulo ? { titulo: str(bo.titulo, 120) } : {}), itens }));
    } else if (bo.tipo === "tabela") {
      const t = normalizeTabela(bo.tabela ?? bo);
      if (t) blocos.push(comNota(t));
    } else if (bo.tipo === "grafico") {
      const g = normalizeSpec(bo.grafico ?? bo);
      if (!g) continue;
      if (!destino) { avisos.push("O CSV é só texto: o gráfico ficou de fora (peça xlsx ou pdf para incluí-lo)."); continue; }
      // Nada de trocar o tipo por baixo do pano: troca e AVISA.
      const d = degradarTipo(g.tipo, destino);
      if (d.aviso) avisos.push(d.aviso);
      blocos.push(comNota({ tipo: "grafico", grafico: d.tipo === g.tipo ? g : { ...g, tipo: d.tipo } }));
    }
  }
  if (blocos.length === 0) return null;
  return {
    titulo: str(o.titulo, 160) || "Relatório",
    subtitulo: o.subtitulo ? str(o.subtitulo, 200) : undefined,
    formato,
    blocos,
    ...(avisos.length ? { avisos: [...new Set(avisos)] } : {}),
  };
}
