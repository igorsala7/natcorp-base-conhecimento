import ExcelJS from "exceljs";
import type { ExtractedBlock, Extraction } from "./extract";

/**
 * Planilha → blocos de texto para embedding.
 *
 * O ponto delicado é que uma linha de planilha, sozinha, não diz nada: um chunk
 * com `"Alfa | 1.200 | 5"` é irrecuperável para o RAG. Por isso cada linha é
 * reescrita com o CABEÇALHO DA COLUNA repetido — `"Produto: Alfa; Preço: 1.200"`
 * —, que é o que permite ao chatbot responder "qual o preço do Alfa?".
 *
 * Cada aba vira um título (nível 1) seguido das linhas, então o `heading_path`
 * do chunk já sai como "Nome da aba" e a citação fica compreensível.
 */

/** Teto de linhas por aba: planilha enorme estouraria a memória do worker. */
export const MAX_LINHAS_POR_ABA = 5000;

/** Converte o valor de uma célula em texto legível. */
export function cellToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toLocaleDateString("pt-BR");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Fórmula: interessa o RESULTADO, não a expressão. `=A1*B1` não ajuda
    // ninguém a responder uma pergunta.
    if ("result" in o) return cellToText(o.result);
    if ("text" in o) return cellToText(o.text);
    // Texto rico do Excel vem como { richText: [{ text }, …] }.
    if ("richText" in o && Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((r) => r.text ?? "").join("").trim();
    }
    if ("hyperlink" in o) return cellToText(o.text ?? o.hyperlink);
  }
  return String(v);
}

/** Monta a linha como "Cabeçalho: valor; …", pulando colunas vazias. */
export function linhaComCabecalho(cabecalhos: string[], valores: string[]): string {
  const partes: string[] = [];
  for (let i = 0; i < valores.length; i++) {
    const valor = valores[i]?.trim();
    if (!valor) continue;
    const cab = cabecalhos[i]?.trim();
    partes.push(cab ? `${cab}: ${valor}` : valor);
  }
  return partes.join("; ");
}

export async function extractSheet(buf: Buffer): Promise<Extraction> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);

  const blocks: ExtractedBlock[] = [];

  wb.eachSheet((ws) => {
    const linhas: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (linhas.length >= MAX_LINHAS_POR_ABA) return;
      const valores = Array.isArray(row.values) ? row.values.slice(1) : [];
      linhas.push(valores.map(cellToText));
    });

    // Aba sem nenhuma linha não vira bloco: geraria um título órfão no índice.
    if (linhas.length === 0) return;

    blocks.push({ text: ws.name || "Planilha", level: 1 });

    // A primeira linha é o cabeçalho quando tem ao menos duas células com
    // texto — planilha sem cabeçalho existe, e inventar um piora o resultado.
    const primeira = linhas[0] ?? [];
    const temCabecalho = primeira.filter((c) => c.trim()).length >= 2;
    const cabecalhos = temCabecalho ? primeira : [];
    const corpo = temCabecalho ? linhas.slice(1) : linhas;

    for (const valores of corpo) {
      const texto = linhaComCabecalho(cabecalhos, valores);
      if (texto) blocks.push({ text: texto, level: 0 });
    }

    if (linhas.length >= MAX_LINHAS_POR_ABA) {
      // Truncar em silêncio faria a base parecer completa quando não está.
      blocks.push({
        text: `(A aba "${ws.name}" foi truncada em ${MAX_LINHAS_POR_ABA} linhas.)`,
        level: 0,
      });
    }
  });

  return { source: "sheet", blocks, images: [] };
}
