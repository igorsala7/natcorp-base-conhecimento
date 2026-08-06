"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClass } from "./input";

/**
 * Seletor com FILTRO POR DIGITAÇÃO — substitui o `<select>` nativo em todo o sistema.
 *
 * O nativo não deixa digitar para filtrar: em lista de 80 ferramentas, 40 módulos ou
 * 60 colaboradores, achar um item vira rolagem no escuro. Aqui o campo de busca aparece
 * a partir de `LIMIAR_BUSCA` opções — em lista curta (método HTTP, sim/não) ele não
 * aparece, porque caixa de busca com três opções é atrito, não ajuda.
 *
 * MIGRAÇÃO: aceita os mesmos `<option>` como filhos, então trocar `<select>` por
 * `<Select>` preserva o JSX. Só o `onChange` muda — recebe o VALOR, não o evento.
 *
 *   <Select id="x" value={v} onChange={setV}>
 *     <option value="a">Alfa</option>
 *   </Select>
 *
 * Alternativa para listas montadas de dados: a prop `options`.
 *
 * Posiciona por coordenada FIXA em portal (igual ao DropdownMenu): dentro de diálogo
 * ou coluna com overflow, um painel absoluto seria cortado.
 */

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean };

/** A partir de quantas opções o campo de busca aparece. */
export const LIMIAR_BUSCA = 8;

const norm = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Filtra por PEDAÇO em qualquer ordem: "recibo pag" acha "Relatório: recibo de
 * pagamento". Quem digita não lembra a frase exata — lembra duas palavras soltas.
 * Ignora acento e caixa, e olha rótulo, dica e valor.
 */
export function filtrarOpcoes(itens: SelectOption[], busca: string): SelectOption[] {
  const q = norm(busca);
  if (!q) return itens;
  const partes = q.split(/\s+/).filter(Boolean);
  return itens.filter((o) => {
    const alvo = norm(`${o.label} ${o.hint ?? ""} ${o.value}`);
    return partes.every((p) => alvo.includes(p));
  });
}

/** Extrai as opções dos filhos `<option>` (o que permite a migração por troca de tag). */
export function opcoesDosFilhos(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  React.Children.forEach(children, (filho) => {
    if (!React.isValidElement(filho)) return;
    // Fragmentos e arrays (o `.map()` do call site) entram recursivamente.
    if (filho.type === React.Fragment) {
      out.push(...opcoesDosFilhos((filho.props as { children?: React.ReactNode }).children));
      return;
    }
    if (filho.type !== "option") return;
    const props = filho.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    const label = React.Children.toArray(props.children)
      .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
      .join("")
      .trim();
    out.push({ value: String(props.value ?? label), label: label || String(props.value ?? ""), disabled: props.disabled });
  });
  return out;
}

export function Select({
  value,
  onChange,
  options,
  children,
  id,
  disabled,
  placeholder = "Selecione…",
  className,
  buscaPlaceholder = "Digite para filtrar…",
  "aria-label": ariaLabel,
  title,
}: {
  value: string;
  /** Recebe o VALOR escolhido (não o evento). */
  onChange: (value: string) => void;
  options?: SelectOption[];
  children?: React.ReactNode;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  buscaPlaceholder?: string;
  "aria-label"?: string;
  title?: string;
}) {
  const itens = React.useMemo(() => options ?? opcoesDosFilhos(children), [options, children]);
  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const [ativo, setAtivo] = React.useState(0);
  const [caixa, setCaixa] = React.useState<{ top: number; left: number; width: number; acima: boolean } | null>(null);
  const gatilhoRef = React.useRef<HTMLButtonElement>(null);
  const painelRef = React.useRef<HTMLDivElement>(null);
  const buscaRef = React.useRef<HTMLInputElement>(null);
  const listaId = React.useId();

  const comBusca = itens.length >= LIMIAR_BUSCA;
  const filtrados = React.useMemo(() => filtrarOpcoes(itens, busca), [itens, busca]);

  const escolhido = itens.find((o) => o.value === value);

  const medir = React.useCallback(() => {
    const el = gatilhoRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const alturaPainel = Math.min(320, filtrados.length * 36 + (comBusca ? 52 : 8));
    const abaixo = window.innerHeight - r.bottom;
    const acima = abaixo < alturaPainel && r.top > abaixo;
    setCaixa({
      top: acima ? Math.max(8, r.top - alturaPainel - 4) : r.bottom + 4,
      left: r.left,
      width: r.width,
      acima,
    });
  }, [filtrados.length, comBusca]);

  React.useEffect(() => {
    if (!aberto) return;
    medir();
    const fecha = () => setAberto(false);
    const clique = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (gatilhoRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    window.addEventListener("resize", fecha);
    window.addEventListener("scroll", fecha, true);
    document.addEventListener("mousedown", clique);
    return () => {
      window.removeEventListener("resize", fecha);
      window.removeEventListener("scroll", fecha, true);
      document.removeEventListener("mousedown", clique);
    };
  }, [aberto, medir]);

  // Só o FOCO no efeito (é DOM, não estado). O item ativo é calculado no `abrir()`:
  // setState dentro de efeito encadeia render à toa.
  React.useEffect(() => {
    if (!aberto) return;
    if (comBusca) buscaRef.current?.focus();
    else painelRef.current?.focus();
  }, [aberto, comBusca]);

  React.useEffect(() => {
    if (!aberto) return;
    painelRef.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  function abrir() {
    if (disabled) return;
    setBusca("");
    // Abre já no item atual — quem reabre para conferir não perde a referência.
    // Sem busca, a lista filtrada é a lista inteira, então o índice vale.
    const i = itens.findIndex((o) => o.value === value);
    setAtivo(i >= 0 ? i : 0);
    setAberto(true);
  }

  function escolher(o: SelectOption) {
    if (o.disabled) return;
    onChange(o.value);
    setAberto(false);
    gatilhoRef.current?.focus();
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      gatilhoRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setAtivo((i) => {
        if (!filtrados.length) return 0;
        let n = i;
        // Pula desabilitadas em vez de parar em cima delas.
        for (let k = 0; k < filtrados.length; k++) {
          n = (n + passo + filtrados.length) % filtrados.length;
          if (!filtrados[n]?.disabled) break;
        }
        return n;
      });
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setAtivo(e.key === "Home" ? 0 : filtrados.length - 1);
      return;
    }
    if (e.key === "Enter" || (e.key === " " && !comBusca)) {
      const o = filtrados[ativo];
      if (o) {
        e.preventDefault();
        escolher(o);
      }
    }
  }

  return (
    <>
      <button
        ref={gatilhoRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        aria-controls={aberto ? listaId : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={(e) => {
          if (!aberto && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            abrir();
          }
        }}
        className={cn(controlClass, "flex items-center justify-between gap-2 text-left", className)}
      >
        <span className={cn("min-w-0 flex-1 truncate", !escolhido && "text-text-muted")}>
          {escolhido?.label || placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
      </button>

      {aberto &&
        caixa &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={painelRef}
            tabIndex={-1}
            onKeyDown={teclado}
            style={{ position: "fixed", top: caixa.top, left: caixa.left, width: caixa.width, zIndex: 90 }}
            className="overflow-hidden rounded-md border border-border bg-surface shadow-lg outline-none"
          >
            {comBusca && (
              <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
                <Search className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setAtivo(0);
                  }}
                  placeholder={buscaPlaceholder}
                  aria-label="Filtrar opções"
                  aria-controls={listaId}
                  className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                />
              </div>
            )}
            <ul id={listaId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto py-1">
              {filtrados.length === 0 ? (
                <li className="px-3 py-3 text-center text-xs text-text-muted">Nada encontrado para “{busca}”.</li>
              ) : (
                filtrados.map((o, i) => {
                  const sel = o.value === value;
                  return (
                    <li key={`${o.value}-${i}`}>
                      <button
                        type="button"
                        data-i={i}
                        role="option"
                        aria-selected={sel}
                        disabled={o.disabled}
                        onMouseEnter={() => setAtivo(i)}
                        onClick={() => escolher(o)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text",
                          i === ativo && "bg-surface-2",
                          o.disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <Check className={cn("size-3.5 shrink-0", sel ? "text-primary" : "invisible")} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {o.hint && <span className="shrink-0 text-xs text-text-muted">{o.hint}</span>}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
