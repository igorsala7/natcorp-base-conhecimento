"use client";

import { CopyButton } from "./copy-button";

/**
 * Bloco de comando/código com rótulo e botão de copiar.
 *
 * Fundo escuro nos dois temas por escolha, não por descuido: é a convenção
 * visual de "isto é terminal", e o comando precisa ser lido como algo a colar
 * em outro lugar, não como texto da página.
 *
 * `overflow-x-auto` sem `whitespace-pre-wrap`: num comando de uma linha só, a
 * quebra por largura corta no meio de um argumento e atrapalha mais que a barra
 * de rolagem. O conteúdo é renderizado COMO STRING — passar por JSON.stringify
 * escaparia as quebras e as barras de continuação, e o texto copiado deixaria
 * de colar direto no terminal.
 */
export function CodeBlock({
  titulo,
  codigo,
  acoes,
}: {
  titulo?: string;
  codigo: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div>
      {(titulo || acoes) && (
        <div className="mb-1 flex items-center justify-between gap-2">
          {titulo && (
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">{titulo}</span>
          )}
          <span className="flex items-center gap-1">
            {acoes}
            <CopyButton text={codigo} />
          </span>
        </div>
      )}
      <pre className="overflow-x-auto rounded-lg border border-brand-gray-800 bg-brand-gray-950 p-3 font-mono text-xs leading-relaxed text-brand-gray-100">
        {codigo}
      </pre>
    </div>
  );
}
