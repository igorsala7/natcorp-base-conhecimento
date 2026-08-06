import { degradarTipo, normalizeSpec, type ChartSpec, type DestinoGrafico } from "@/lib/chat/chart-spec";

/**
 * Spec de RELATÓRIO que a IA preenche (`gerar_relatorio`) e o construtor de PDF
 * consome. Blocos "planos" (um objeto com campos opcionais por `tipo`) em vez de
 * união discriminada — as gramáticas de schema da Anthropic/Google recusam
 * uniões complexas. Ver [[blocks-schema-grammar-limit]].
 *
 * Client-safe: só tipos + saneamento puro.
 */

export type ReportBlock =
  | { tipo: "texto"; texto: string }
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][] }
  | { tipo: "grafico"; grafico: ChartSpec };

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
    if (bo.tipo === "texto" && typeof bo.texto === "string" && bo.texto.trim()) {
      blocos.push({ tipo: "texto", texto: str(bo.texto, MAX_TEXTO) });
    } else if (bo.tipo === "tabela") {
      const t = normalizeTabela(bo.tabela ?? bo);
      if (t) blocos.push(t);
    } else if (bo.tipo === "grafico") {
      const g = normalizeSpec(bo.grafico ?? bo);
      if (!g) continue;
      if (!destino) { avisos.push("O CSV é só texto: o gráfico ficou de fora (peça xlsx ou pdf para incluí-lo)."); continue; }
      // Nada de trocar o tipo por baixo do pano: troca e AVISA.
      const d = degradarTipo(g.tipo, destino);
      if (d.aviso) avisos.push(d.aviso);
      blocos.push({ tipo: "grafico", grafico: d.tipo === g.tipo ? g : { ...g, tipo: d.tipo } });
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
