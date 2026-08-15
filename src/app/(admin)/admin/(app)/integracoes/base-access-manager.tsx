"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { controlClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import type { BaseRow } from "./integrations-manager";
import type { BaseToolRow, ToolRow } from "./tools-manager";
import { setBaseToolAccess } from "./tool-actions";
import {
  aplicarIntervalo,
  diffAcesso,
  filtrarTools,
  habilitadasDaBase,
  ordenarPorNome,
} from "@/lib/integrations/base-access";

/**
 * ACESSO POR BASE — quais ferramentas cada cliente enxerga.
 *
 * A via anterior era abrir o diálogo de CADA tool e mexer no seletor de bases.
 * Com 118 tools, montar um cliente novo custava 118 diálogos: inviável, e por
 * isso ninguém fazia — as bases acabavam com tudo liberado por omissão.
 *
 * Aqui a lista é única e alfabética, e o volume sai por três caminhos, do mais
 * econômico para o mais fino:
 *
 *   1. COPIAR DE OUTRA BASE — um clique resolve o cliente parecido com um que já
 *      existe, que é o caso comum.
 *   2. BUSCAR e agir sobre o RESULTADO — "ponto" reduz 118 a 10, e um clique
 *      libera as 10. É o substituto do agrupamento por módulo.
 *   3. Marcar uma a uma, com shift+clique para intervalo.
 *
 * Nada vai ao servidor antes de "Salvar": a tela acumula o diff e grava de uma
 * vez. Meia configuração aplicada seria pior que nenhuma.
 */

type Props = {
  bases: BaseRow[];
  tools: ToolRow[];
  baseTools: BaseToolRow[];
};

export function BaseAccessManager({ bases, tools, baseTools }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [salvando, startSalvar] = useTransition();

  const [baseId, setBaseId] = useState(bases[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [verInativas, setVerInativas] = useState(false);
  const [copiarDe, setCopiarDe] = useState<string | null>(null);
  // Âncora do shift+clique: a última linha marcada à mão.
  const [ancora, setAncora] = useState<string | null>(null);

  // Estado GRAVADO. Recalculado quando o servidor devolve dados novos, o que
  // zera o "não salvo" sozinho depois do refresh.
  const original = useMemo(() => habilitadasDaBase(baseTools, baseId), [baseTools, baseId]);
  const [sel, setSel] = useState<Set<string>>(() => new Set(original));
  const [baseEditada, setBaseEditada] = useState(baseId);
  // Trocar de base descarta a seleção da anterior: manter seria aplicar a
  // configuração de um cliente em outro sem ninguém pedir.
  if (baseEditada !== baseId) {
    setBaseEditada(baseId);
    setSel(new Set(original));
    setAncora(null);
  }

  const visiveis = useMemo(() => {
    const base = verInativas ? tools : tools.filter((t) => t.active);
    return ordenarPorNome(filtrarTools(base, busca));
  }, [tools, busca, verInativas]);

  const { ligar, desligar } = useMemo(() => diffAcesso(original, sel), [original, sel]);
  const pendentes = ligar.length + desligar.length;
  const inativasOcultas = tools.length - tools.filter((t) => t.active).length;

  function marcar(id: string, valor: boolean) {
    setSel((prev) => {
      const n = new Set(prev);
      if (valor) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  /** Clique numa linha. Com shift, aplica o mesmo valor ao intervalo visível. */
  function clicarLinha(id: string, comShift: boolean) {
    const valor = !sel.has(id);
    if (comShift && ancora) {
      setSel((prev) => aplicarIntervalo(visiveis, prev, ancora, id, valor));
      return;
    }
    marcar(id, valor);
    setAncora(id);
  }

  /** Age sobre o RESULTADO DA BUSCA — é o que substitui o agrupamento. */
  function todasVisiveis(valor: boolean) {
    setSel((prev) => {
      const n = new Set(prev);
      for (const t of visiveis) {
        if (valor) n.add(t.id);
        else n.delete(t.id);
      }
      return n;
    });
  }

  function aplicarCopia(origemId: string) {
    const origem = habilitadasDaBase(baseTools, origemId);
    // Só as tools que EXISTEM e estão ativas: copiar uma inativa criaria linha
    // para algo que não roda, e a conta de "liberadas" mentiria.
    const validas = new Set(tools.filter((t) => t.active).map((t) => t.id));
    setSel(new Set([...origem].filter((id) => validas.has(id))));
    setCopiarDe(null);
    toast.info("Copiado para a tela. Confira e clique em Salvar para aplicar.");
  }

  function salvar() {
    if (!pendentes) return;
    startSalvar(async () => {
      const r = await setBaseToolAccess({ baseId, ligar, desligar });
      if (!r.ok) return toast.error(r.error);
      toast.success(
        `${r.ligadas ?? 0} liberada(s) · ${r.desligadas ?? 0} bloqueada(s).` +
          (r.ligadas ? " Os vetores de busca já foram regerados." : ""),
      );
      router.refresh();
    });
  }

  async function bloquearTudo() {
    const ok = await confirmar({
      title: "Bloquear todas as ferramentas?",
      description:
        `A base deixa de enxergar as ${sel.size} ferramentas liberadas hoje. ` +
        "Se ela estiver em produção, o chatbot para de responder consultas a sistemas até você liberar de novo.",
      confirmLabel: "Bloquear todas",
      tone: "danger",
    });
    if (ok) setSel(new Set());
  }

  if (bases.length === 0) {
    return (
      <EmptyState
        title="Nenhuma base cadastrada"
        description="Cadastre um cliente em Bases / Clientes para depois definir quais ferramentas ele enxerga."
      />
    );
  }

  const baseAtual = bases.find((b) => b.id === baseId);
  const outrasBases = bases.filter((b) => b.id !== baseId);

  return (
    <div className="space-y-4">
      {/* Barra de contexto: de quem estamos falando e quanto já está liberado. */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="min-w-56">
          <label htmlFor="acesso_base" className="mb-1 block text-xs font-medium text-text-muted">
            Cliente / base
          </label>
          <Select id="acesso_base" value={baseId} onChange={setBaseId}>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>

        <div className="flex-1 min-w-56">
          <label htmlFor="acesso_busca" className="mb-1 block text-xs font-medium text-text-muted">
            Buscar ferramenta
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              id="acesso_busca"
              className={cn(controlClass, "pl-8")}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="ex.: ponto, férias, holerite…"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCopiarDe("")} disabled={outrasBases.length === 0}>
            <Copy className="size-4" aria-hidden="true" />
            Copiar de outra base
          </Button>
          <Button onClick={salvar} disabled={!pendentes || salvando}>
            {salvando ? "Salvando…" : pendentes ? `Salvar (${pendentes})` : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Resumo + ações sobre o RESULTADO DA BUSCA. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-medium text-text">
          {sel.size} de {tools.filter((t) => t.active).length} liberadas
          {baseAtual ? <span className="text-text-muted"> em {baseAtual.name}</span> : null}
        </span>

        {pendentes > 0 && (
          <Badge tone="warning">
            {ligar.length} a liberar · {desligar.length} a bloquear — não salvo
          </Badge>
        )}

        <span className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => todasVisiveis(true)}>
            {busca ? `Liberar as ${visiveis.length} da busca` : "Liberar todas"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (busca ? todasVisiveis(false) : void bloquearTudo())}
          >
            {busca ? `Bloquear as ${visiveis.length} da busca` : "Bloquear todas"}
          </Button>
        </span>
      </div>

      {/* Lista alfabética. */}
      <div className="overflow-hidden rounded-lg border border-border">
        {visiveis.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-text-muted">
            Nenhuma ferramenta para “{busca}”.
          </p>
        ) : (
          <ul>
            {visiveis.map((t, i) => {
              const on = sel.has(t.id);
              const mudou = on !== original.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={(e) => clicarLinha(t.id, e.shiftKey)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2",
                      i > 0 && "border-t border-border",
                      mudou && "bg-warning-soft",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        on ? "border-primary bg-primary text-white" : "border-border",
                      )}
                    >
                      {on && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text">
                        {t.name}
                        {!t.active && <span className="ml-2 text-xs text-text-muted">(inativa)</span>}
                      </span>
                      {t.description && (
                        <span className="block truncate text-xs text-text-muted">{t.description}</span>
                      )}
                    </span>
                    <code className="shrink-0 text-xs text-text-muted">{t.key}</code>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Clique para liberar ou bloquear. <kbd>Shift</kbd>+clique aplica ao intervalo.
        {inativasOcultas > 0 && (
          <>
            {" "}
            {inativasOcultas} ferramenta(s) inativa(s) fora da lista.{" "}
            <button type="button" className="underline" onClick={() => setVerInativas((v) => !v)}>
              {verInativas ? "Ocultar" : "Mostrar"}
            </button>
          </>
        )}
      </p>

      {copiarDe !== null && (
        <Dialog
          open
          onClose={() => setCopiarDe(null)}
          title="Copiar acesso de outra base"
          description="Traz para a tela o mesmo conjunto de ferramentas liberadas na base escolhida. Nada é gravado até você clicar em Salvar."
          footer={
            <>
              <Button variant="secondary" onClick={() => setCopiarDe(null)}>
                <X className="size-4" aria-hidden="true" />
                Cancelar
              </Button>
              <Button disabled={!copiarDe} onClick={() => copiarDe && aplicarCopia(copiarDe)}>
                Copiar para a tela
              </Button>
            </>
          }
        >
          <Select value={copiarDe} onChange={setCopiarDe} placeholder="Escolha a base de origem…">
            {outrasBases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {habilitadasDaBase(baseTools, b.id).size} liberadas
              </option>
            ))}
          </Select>
        </Dialog>
      )}
    </div>
  );
}
