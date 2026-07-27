"use client";

import { useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { parseDelimited } from "@/lib/blocks/tabular";

/**
 * Colar OU enviar CSV/TSV/Excel → devolve as células cruas (`string[][]`). Quem
 * usa converte para gráfico (`rowsToChart`) ou tabela (`rowsToTable`). O .xlsx é
 * lido com SheetJS carregado sob demanda (só quando o usuário envia um).
 */
export function DataImport({ onRows }: { onRows: (rows: string[][]) => void }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function aplicarTexto(t: string) {
    const rows = parseDelimited(t);
    if (rows.length) {
      onRows(rows);
      setTexto("");
      setErro(null);
    } else setErro("Não reconheci dados tabulares.");
  }

  async function aoArquivo(file: File) {
    setErro(null);
    const nome = file.name.toLowerCase();
    try {
      if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined;
        if (!ws) {
          setErro("Planilha sem abas.");
          return;
        }
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
        const grid = rows.map((r) => r.map((c) => String(c ?? "")));
        if (grid.some((r) => r.some((c) => c.trim()))) onRows(grid);
        else setErro("Planilha vazia.");
      } else {
        aplicarTexto(await file.text());
      }
    } catch {
      setErro("Falha ao ler o arquivo.");
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          // Cola de planilha vem com TAB entre colunas → aplica na hora.
          if (t.includes("\t") || /,|;/.test(t.split("\n")[0] ?? "")) {
            e.preventDefault();
            aplicarTexto(t);
          }
        }}
        placeholder="Cole aqui dados do Excel / Google Sheets / CSV…"
        rows={3}
        className="w-full resize-none rounded-md border border-border bg-surface-2 p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex flex-wrap items-center gap-2">
        {texto.trim() && (
          <button
            type="button"
            onClick={() => aplicarTexto(texto)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-fg"
          >
            <Check className="size-3.5" /> Aplicar colado
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary"
        >
          <Upload className="size-3.5" /> Enviar CSV/Excel
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void aoArquivo(f);
            e.target.value = "";
          }}
        />
      </div>
      {erro && <p className="text-xs text-rose-600">{erro}</p>}
    </div>
  );
}
