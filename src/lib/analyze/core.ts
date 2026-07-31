/**
 * Lógica PURA da análise de dados — sem `server-only` nem dependências de IA/DB,
 * para ser testável e reutilizável. A chamada ao modelo fica em `analyze.ts`.
 */

export type Coluna = string;
export type Linha = unknown[] | Record<string, unknown>;

export type ResumoColuna =
  | { coluna: string; tipo: "numérica"; nao_nulos: number; min: number; max: number; soma: number; media: number | null }
  | { coluna: string; tipo: "texto"; nao_nulos: number; distintos: number; top: { valor: string; qtd: number }[] };

export type Resumo = { linhas: number; colunas: number; por_coluna: ResumoColuna[] };

export type ResultadoAnalise = {
  analise: string;
  resumo: Resumo;
  meta: { linhas: number; colunas: number; tokens_estimados: number; reduzido: boolean; janelas?: number };
};

/** Estimativa grosseira de tokens (~4 chars/token). */
export function estimarTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/** Decodifica bytes p/ texto tolerando encoding (UTF-8 → windows-1252 → latin1).
 *  IR do Oracle costuma sair em Windows-1252/latin1. */
export function decodeBytesToText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      return new TextDecoder("latin1").decode(bytes);
    }
  }
}

/** Detecta o delimitador pelo cabeçalho (vírgula, ponto-e-vírgula, tab ou pipe). */
export function detectarDelimitador(linha: string): string {
  let melhor = ",", max = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const n = linha.split(d).length - 1;
    if (n > max) { max = n; melhor = d; }
  }
  return melhor;
}

/** Parser de CSV robusto (aspas, "" escapado, CRLF, BOM). Delimitador auto-
 *  detectado se não informado. Devolve matriz de células (string). */
export function parseCsv(texto: string, delim?: string): string[][] {
  const t = texto.replace(/^﻿/, ""); // remove BOM
  const nl = t.search(/\r?\n/);
  const d = delim && delim.length === 1 ? delim : detectarDelimitador(nl >= 0 ? t.slice(0, nl) : t);
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], emAspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (emAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else emAspas = false;
      } else campo += c;
    } else if (c === '"') emAspas = true;
    else if (c === d) { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); campo = ""; linhas.push(linha); linha = []; }
    else if (c === "\r") { /* ignora — o \n fecha a linha */ }
    else campo += c;
  }
  if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => !(l.length === 1 && l[0] === "")); // descarta linhas vazias
}

function linhaParaArray(linha: Linha, colunas: Coluna[]): unknown[] {
  if (Array.isArray(linha)) return linha;
  const o = linha as Record<string, unknown>;
  return colunas.map((c) => o[c]);
}

function csvCampo(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV compacto (cabeçalho + linhas) — bem menos tokens que JSON. */
export function montarCsv(colunas: Coluna[], linhas: Linha[]): string {
  const head = colunas.map(csvCampo).join(",");
  const body = linhas.map((l) => linhaParaArray(l, colunas).map(csvCampo).join(",")).join("\n");
  return head + (body ? "\n" + body : "");
}

/** Converte um valor para número, tolerando o formato BR (1.234,56). */
export function parseNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").trim();
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Agregados EXATOS calculados em código (não dependem do LLM). */
export function resumoDeterministico(colunas: Coluna[], linhas: Linha[]): Resumo {
  const arrs = linhas.map((l) => linhaParaArray(l, colunas));
  const por_coluna: ResumoColuna[] = colunas.map((nome, i) => {
    let naoNulos = 0, numericos = 0, soma = 0, min = Infinity, max = -Infinity;
    const distintos = new Set<string>();
    const freq = new Map<string, number>();
    for (const row of arrs) {
      const v = row[i];
      if (v == null || v === "") continue;
      naoNulos++;
      const s = String(v);
      if (distintos.size < 10000) distintos.add(s);
      if (freq.size < 10000) freq.set(s, (freq.get(s) ?? 0) + 1);
      const num = parseNum(v);
      if (num != null) { numericos++; soma += num; if (num < min) min = num; if (num > max) max = num; }
    }
    if (naoNulos > 0 && numericos / naoNulos >= 0.8) {
      return { coluna: nome, tipo: "numérica", nao_nulos: naoNulos, min, max, soma, media: numericos ? soma / numericos : null };
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([valor, qtd]) => ({ valor, qtd }));
    return { coluna: nome, tipo: "texto", nao_nulos: naoNulos, distintos: distintos.size, top };
  });
  return { linhas: linhas.length, colunas: colunas.length, por_coluna };
}
