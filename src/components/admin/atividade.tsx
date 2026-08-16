"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, X } from "lucide-react";
import { atividadeRecente, type ItemAtividade } from "@/app/(admin)/admin/(app)/atividade-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * O TRABALHO QUE SOBREVIVE À TELA QUE O DISPAROU.
 *
 * São dez filas de job e nenhuma era visível depois que a pessoa saía da página
 * de origem: quem saía de "Importar" perdia a importação de vista, e a única
 * forma de saber se terminou era voltar lá.
 *
 * Isso não era falta de feedback — há toast em 42 arquivos, barra de progresso
 * no topo e um overlay bloqueante. Aviso efêmero não cobre um trabalho que dura
 * mais que a visita à página; ele avisa e some, e o job continua.
 *
 * O indicador só aparece quando há ALGO. Um ícone permanentemente aceso vira
 * mobília e deixa de ser lido — e o dia em que uma importação falhar, ninguém
 * vai notar diferença.
 */

const ROTULO: Record<string, string> = {
  importacao: "Importação",
  embeddings: "Embeddings",
  ontologia: "Ontologia",
  traducao: "Tradução",
  lote: "Processamento em lote",
  captura: "Captura de tela",
  dicionario: "Dicionário de dados",
  analise: "Análise",
  analise_widget: "Análise do widget",
  backup: "Backup",
};

const INTERVALO = 15_000;

export function Atividade() {
  const [itens, setItens] = useState<ItemAtividade[]>([]);
  const [aberta, setAberta] = useState(false);

  const carregar = useCallback(() => {
    void atividadeRecente().then(setItens);
  }, []);

  useEffect(() => {
    carregar();
    // Sondagem simples em vez de Realtime: são dez tabelas, e assinar as dez
    // custaria mais canal do que o problema pede. Quinze segundos é folgado
    // para um trabalho que dura minutos.
    const t = setInterval(carregar, INTERVALO);
    return () => clearInterval(t);
  }, [carregar]);

  const comErro = itens.filter((i) => i.status === "error");
  const emCurso = itens.filter((i) => i.status !== "error");
  if (itens.length === 0 && !aberta) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setAberta(true);
          carregar();
        }}
        aria-label={`Atividade: ${emCurso.length} em andamento, ${comErro.length} com erro`}
        className="gap-1.5"
      >
        {comErro.length > 0 ? (
          <AlertTriangle className="text-rose-600 dark:text-rose-400" />
        ) : (
          // O giro é o próprio sinal de "acontecendo" — sem ele, o ícone parado
          // não distingue trabalho em curso de trabalho terminado.
          <Activity className="animate-pulse motion-reduce:animate-none" />
        )}
        <span className="tabular-nums">{itens.length}</span>
      </Button>

      {aberta && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Atividade">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAberta(false)} role="presentation" />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-border bg-surface shadow-3">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Atividade</h2>
              <Button variant="ghost" size="icon" onClick={() => setAberta(false)} aria-label="Fechar">
                <X />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {itens.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Nada rodando"
                  description="Importações, embeddings e backups aparecem aqui enquanto acontecem — e ficam se falharem."
                />
              ) : (
                <ul className="space-y-2">
                  {[...comErro, ...emCurso].map((i) => (
                    <li
                      key={`${i.tipo}-${i.id}`}
                      className={cn(
                        "rounded-lg border p-3",
                        i.status === "error" ? "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20" : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{ROTULO[i.tipo] ?? i.tipo}</span>
                        <Badge tone={i.status === "error" ? "danger" : "info"}>
                          {i.status === "error" ? "erro" : i.status}
                        </Badge>
                        {i.status !== "error" && (
                          <span className="ml-auto text-2xs tabular-nums text-text-muted">{i.progresso}%</span>
                        )}
                      </div>

                      {i.rotulo && <p className="mt-1 truncate text-xs text-text-muted">{i.rotulo}</p>}

                      {i.status === "error" && i.error && (
                        // A mensagem do worker inteira, não truncada: é o único
                        // lugar onde ela aparece depois que a tela de origem
                        // foi fechada.
                        <p className="mt-1.5 text-xs text-rose-700 dark:text-rose-300">{i.error}</p>
                      )}

                      {i.status !== "error" && (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, i.progresso))}%` }}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
