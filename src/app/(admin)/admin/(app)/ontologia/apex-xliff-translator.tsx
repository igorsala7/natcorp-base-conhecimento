"use client";

import { useState, useTransition } from "react";
import { Copy, Download, FileCode, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { IDIOMAS } from "@/lib/i18n/languages";
import { traduzirXliff } from "./actions";

/**
 * Fase 2 — assistente de tradução do APEX. Cola o XLIFF exportado do APEX (ou uma
 * lista de textos, 1 por linha), a IA traduz usando o glossário da ontologia, e
 * devolve o XLIFF pronto para REIMPORTAR na tradução nativa do APEX (não é runtime).
 */
export function ApexXliffTranslator({ spaceId, activeLangs }: { spaceId: string; activeLangs: string[] }) {
  const toast = useToast();
  const traduziveis = IDIOMAS.filter((i) => i.code !== "pt");
  const langs = activeLangs.length ? activeLangs : traduziveis.map((i) => i.code);
  const [modo, setModo] = useState<"xliff" | "lista">("xliff");
  const [lang, setLang] = useState(langs[0] ?? "en");
  const [entrada, setEntrada] = useState("");
  const [saida, setSaida] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [rodando, start] = useTransition();

  function traduzir() {
    start(async () => {
      const r = await traduzirXliff(spaceId, lang, entrada, modo);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSaida(r.xliff);
      const cap = r.unidades > 300 ? " (limite de 300 por vez — divida o restante em outra rodada)" : "";
      setInfo(`${r.traduzidos} de ${r.unidades} textos traduzidos${cap}.`);
      toast.success("Tradução gerada — baixe o XLIFF e importe no APEX.");
    });
  }

  function baixar() {
    const blob = new Blob([saida], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `apex-${lang}.xlf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Surface elevation={1} padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <FileCode className="size-4 text-text-muted" />
        <h2 className="text-base font-semibold">Traduzir a interface do APEX (XLIFF)</h2>
      </div>
      <p className="text-sm text-text-muted">
        A IA traduz os rótulos da tela usando o MESMO glossário da ontologia (interface e chatbot
        falam a mesma língua). Exporte o XLIFF no APEX (Shared Components → Translate), cole aqui,
        gere e reimporte. É a tradução NATIVA do APEX — não mexe no runtime.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {(["xliff", "lista"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`px-3 py-1.5 text-sm ${modo === m ? "bg-primary/10 text-primary" : "text-text-muted"}`}
            >
              {m === "xliff" ? "XLIFF do APEX" : "Lista de textos"}
            </button>
          ))}
        </div>
        <select className={`${controlClass} h-9`} value={lang} onChange={(e) => setLang(e.target.value)}>
          {langs.map((code) => (
            <option key={code} value={code}>
              {IDIOMAS.find((i) => i.code === code)?.nativo ?? code}
            </option>
          ))}
        </select>
        <Button onClick={traduzir} disabled={rodando || !entrada.trim()}>
          {rodando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Traduzir
        </Button>
      </div>

      <textarea
        className={`${controlClass} min-h-[9rem] w-full font-mono text-xs`}
        placeholder={
          modo === "xliff"
            ? "Cole aqui o XLIFF exportado do APEX (com os <source>)…"
            : "Cole os textos, um por linha (ex.: Salvar / Cancelar / Nome do colaborador)…"
        }
        value={entrada}
        onChange={(e) => setEntrada(e.target.value)}
      />

      {saida && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Resultado (XLIFF)</span>
            {info && <span className="text-xs text-text-muted">{info}</span>}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(saida).then(() => toast.success("Copiado."))}>
                <Copy className="size-4" /> Copiar
              </Button>
              <Button variant="ghost" onClick={baixar}>
                <Download className="size-4" /> Baixar .xlf
              </Button>
            </div>
          </div>
          <textarea readOnly className={`${controlClass} min-h-[9rem] w-full font-mono text-xs`} value={saida} />
        </div>
      )}
    </Surface>
  );
}
