"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Código de INCORPORAÇÃO (iframe) de um artigo ou diretório, para o usuário
 * colar em outro site. O `url` é a página `/embed/...` (só conteúdo, sem a casca
 * do portal). Altura ajustável; largura sempre 100% (responsivo no site host).
 */
export function EmbedDialog({
  open,
  onClose,
  url,
  title,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  kind: "article" | "folder";
}) {
  const [altura, setAltura] = useState(kind === "folder" ? 480 : 640);
  const [copiado, setCopiado] = useState(false);

  const tituloAttr = title.replace(/"/g, "'").slice(0, 120);
  const snippet = useMemo(
    () =>
      `<iframe src="${url}" title="${tituloAttr}" width="100%" height="${altura}" ` +
      `style="border:0;width:100%;max-width:100%" loading="lazy"></iframe>`,
    [url, tituloAttr, altura],
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Incorporar em outro site"
      description={
        kind === "article"
          ? "Mostra apenas este artigo dentro de um iframe."
          : "Mostra apenas as subpastas e artigos deste diretório dentro de um iframe."
      }
      size="lg"
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">Altura (px)</span>
          <input
            type="number"
            min={200}
            max={2000}
            step={20}
            value={altura}
            onChange={(e) => setAltura(Math.max(200, Math.min(2000, Number(e.target.value) || 200)))}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm tabular-nums focus:border-primary focus:outline-none"
          />
          <span className="text-xs text-text-muted">a largura é sempre 100% (responsiva)</span>
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Código</span>
            <Button size="sm" variant="secondary" onClick={() => void copiar()}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado!" : "Copiar código"}
            </Button>
          </div>
          <textarea
            readOnly
            value={snippet}
            onFocus={(e) => e.currentTarget.select()}
            rows={3}
            aria-label="Código do iframe"
            className="w-full resize-none rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-text focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Prévia</span>
          <div className="mt-1.5 overflow-hidden rounded-lg border border-border">
            <iframe
              src={url}
              title="Prévia da incorporação"
              className="block w-full bg-surface"
              style={{ height: Math.min(altura, 420) }}
            />
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Só funciona com conteúdo <strong>público e publicado</strong>. Se você tornar a documentação
          privada, o iframe passa a pedir acesso.
        </p>
      </div>
    </Dialog>
  );
}
