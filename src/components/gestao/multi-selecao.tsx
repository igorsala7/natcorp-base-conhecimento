"use client";

import { useMemo, useState } from "react";

/**
 * Seleção múltipla com busca.
 *
 * Um `<select multiple>` nativo resolveria o dado, mas não o uso: com 100
 * perfis ou 60 módulos, escolher cinco exige ctrl+clique sem errar, e um
 * clique solto apaga a seleção inteira sem aviso. Caixas de seleção não têm
 * esse modo de falha, e a busca é o que torna a lista longa navegável.
 *
 * O que está escolhido aparece como fichas acima da lista — sem isso, uma
 * seleção rolada para fora da vista fica invisível na hora de conferir.
 */
export function MultiSelecao({
  id,
  rotulo,
  opcoes,
  valor,
  onChange,
  placeholder = "Buscar…",
  vazio = "Nenhuma opção disponível.",
  desabilitadas,
  dicaDesabilitada,
}: {
  id: string;
  rotulo: string;
  opcoes: string[];
  valor: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  vazio?: string;
  /** Opções que não podem ser marcadas (ex.: consultas protegidas). */
  desabilitadas?: Set<string>;
  dicaDesabilitada?: string;
}) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter((o) => o.toLowerCase().includes(q));
  }, [opcoes, busca]);

  function alternar(o: string) {
    onChange(valor.includes(o) ? valor.filter((v) => v !== o) : [...valor, o]);
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 block text-xs font-medium text-text-muted">
        {rotulo}
        {valor.length > 0 ? (
          <span className="ml-1 text-text">({valor.length} selecionado{valor.length > 1 ? "s" : ""})</span>
        ) : null}
      </legend>

      {valor.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1">
          {valor.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => alternar(v)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-purple-100 px-2 py-0.5 text-xs text-brand-purple-800 hover:bg-brand-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remover ${v}`}
              >
                {v}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={placeholder}
        aria-label={`Buscar em ${rotulo}`}
        className="mb-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div
        id={id}
        className="max-h-48 overflow-y-auto rounded-md border border-border bg-surface p-1"
        role="group"
        aria-label={rotulo}
      >
        {opcoes.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-text-muted">{vazio}</p>
        ) : filtradas.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-text-muted">
            Nada encontrado para “{busca}”.
          </p>
        ) : (
          filtradas.map((o) => {
            const bloqueada = desabilitadas?.has(o) ?? false;
            return (
              <label
                key={o}
                className={[
                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                  bloqueada
                    ? "cursor-not-allowed text-text-muted"
                    : "cursor-pointer text-text hover:bg-surface-2",
                ].join(" ")}
                title={bloqueada ? dicaDesabilitada : undefined}
              >
                <input
                  type="checkbox"
                  checked={valor.includes(o)}
                  disabled={bloqueada}
                  onChange={() => alternar(o)}
                  className="h-4 w-4 rounded border-border-strong text-primary focus:ring-2 focus:ring-ring"
                />
                <span className="min-w-0 flex-1 truncate">{o}</span>
                {bloqueada ? (
                  <span className="shrink-0 text-2xs uppercase tracking-wide">obrigatória</span>
                ) : null}
              </label>
            );
          })
        )}
      </div>
    </fieldset>
  );
}
