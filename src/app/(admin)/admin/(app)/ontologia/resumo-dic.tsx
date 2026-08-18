"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { resumoDicionario, enriquecerOntologiaDoDicionario, type LinhaResumoDic } from "./apex-actions";
import { relativo } from "@/lib/format/quando";

/**
 * O QUE ESTÁ NO DICIONÁRIO AGORA.
 *
 * "Subi uma nova leva mas não dá pra saber se realmente foi, se substituiu o
 * anterior, se apenas adicionou — não tem feedback nenhum" (Igor, 16/08/2026).
 *
 * Havia feedback: a action devolve as contagens e a tela mostra um toast. Mas as
 * três perguntas não são sobre o EVENTO, são sobre o ESTADO — e estado não se
 * comunica com aviso efêmero. O toast dura 5s; a importação de 65 mil linhas
 * leva 12s; e "o que tem lá?" volta a ser perguntado amanhã, quando não há mais
 * toast nenhum.
 *
 * Por origem, e não um total só, porque é a origem que responde "substituiu ou
 * somou": cada ingestão apaga e regrava APENAS a sua, e as outras ficam intactas.
 * Ver `csv-actions.ts` e `ingest-run.ts`.
 */

const NOME: Record<string, { titulo: string; de: string }> = {
  db_ddl: { titulo: "Tabelas e colunas", de: "do CSV/JSON de estrutura do banco" },
  apex_dict: { titulo: "Aplicação APEX", de: "do metadado da aplicação" },
  apex_export: { titulo: "Exportação APEX", de: "do export da aplicação" },
  manual: { titulo: "Escrito à mão", de: "editado aqui" },
};

const num = (n: number) => n.toLocaleString("pt-BR");


export function ResumoDicionario({ spaceId, recarga }: { spaceId: string; recarga?: number }) {
  const [linhas, setLinhas] = useState<LinhaResumoDic[] | null>(null);
  const [pend, setPend] = useState(false);
  const [enriquecendo, setEnriquecendo] = useState(false);
  const toast = useToast();

  // `buscar` não toca em `pend`: chamar setState no corpo de um efeito dispara
  // renderização em cascata (o lint pega, e está certo). Na primeira carga quem
  // sinaliza é o próprio Skeleton — `linhas === null` já diz "carregando".
  const buscar = useCallback(() => resumoDicionario(spaceId).then(setLinhas), [spaceId]);

  useEffect(() => {
    void buscar();
  }, [buscar, recarga]);

  /**
   * A IA que a regra determinística não alcança: "Filial" → "unidade",
   * "estabelecimento". A ingestão já criou os termos; isto acrescenta o
   * vocabulário de quem PERGUNTA, que não é o de quem modelou o banco.
   */
  async function enriquecer() {
    setEnriquecendo(true);
    try {
      const r = await enriquecerOntologiaDoDicionario(spaceId);
      if (r.ok) toast.success("Enriquecimento na fila. Acompanhe em Atividade — leva alguns minutos.");
      else toast.error(r.error ?? "Não consegui enfileirar.");
    } finally {
      setEnriquecendo(false);
    }
  }

  /** O botão explícito: aí sim o giro é a resposta ao clique. */
  const carregar = useCallback(() => {
    setPend(true);
    void buscar().finally(() => setPend(false));
  }, [buscar]);

  return (
    <Surface elevation={1} padding="lg" className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-text-muted" aria-hidden="true" />
        <h2 className="text-base font-semibold">O que está no dicionário</h2>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={carregar} loading={pend} loadingLabel="Conferindo">
          <RefreshCw className="size-3.5" />
          Conferir
        </Button>
      </div>

      {linhas === null ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-text-muted">
          Nada ainda. Suba um CSV/JSON de tabelas e colunas, ou o metadado de uma aplicação APEX.
        </p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((l) => {
            const nome = NOME[l.origem] ?? { titulo: l.origem, de: "" };
            // O que FALTA é mais acionável que o que existe: 0 rótulos é a razão
            // de o assistente não conseguir traduzir COD_FILIAL para "Filial".
            const semRotulo = l.linhas - l.com_label;
            return (
              <li key={l.origem} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-text">{nome.titulo}</span>
                  <span className="text-2xs text-text-muted">{nome.de}</span>
                  <span className="ml-auto text-2xs text-text-muted">{relativo(l.atualizado_em)}</span>
                </div>
                <p className="mt-1 text-sm tabular-nums text-text">
                  {num(l.linhas)} colunas <span className="text-text-muted">em</span> {num(l.tabelas)} tabelas
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs tabular-nums text-text-muted">
                  <span>{num(l.com_label)} com rótulo</span>
                  <span>{num(l.com_descricao)} com comentário</span>
                  <span>{num(l.com_tipo)} com tipo</span>
                </p>
                {semRotulo === l.linhas && l.linhas > 0 && (
                  <p className="mt-1.5 text-2xs text-warning">
                    Nenhuma tem rótulo humano — sem isso o assistente não consegue dizer
                    &ldquo;Filial&rdquo; no lugar de <code>COD_FILIAL</code>. Os rótulos vêm do metadado da
                    aplicação APEX ou de uma coluna <code>label</code> no CSV.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(linhas?.some((l) => l.com_label > 0) ?? false) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Sinônimos por IA</p>
            <p className="text-2xs leading-relaxed text-text-muted">
              A importação já ligou o rótulo à coluna (&ldquo;Filial&rdquo; ↔ <code>COD_FILIAL</code>). A IA
              acrescenta como as pessoas realmente perguntam — &ldquo;unidade&rdquo;, &ldquo;estabelecimento&rdquo;
              — que nenhuma regra deriva do nome do campo.
            </p>
          </div>
          <Button onClick={() => void enriquecer()} loading={enriquecendo} loadingLabel="Enfileirando">
            <Sparkles className="size-4" />
            Gerar sinônimos
          </Button>
        </div>
      )}

      {/* Dito no lugar onde a dúvida aparece, não só ao lado do botão de importar. */}
      <p className="text-2xs leading-relaxed text-text-muted">
        Cada origem é <strong>substituída</strong> por inteiro quando você reimporta aquela origem — não
        acumula. As outras ficam intactas: subir o metadado do APEX não apaga o CSV de tabelas, e
        vice-versa.
      </p>
    </Surface>
  );
}
