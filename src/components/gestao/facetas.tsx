"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { fmtCreditos, fmtPercent, nomeDoPainel } from "@/lib/gestao/formato";

export type LinhaFaceta = { chave: string; creditos: number; chamadas: number };

export type Faceta = {
  id: string;
  rotulo: string;
  /** Cabeçalho da primeira coluna. "Painel" traduz o código; o resto é o valor cru. */
  coluna: string;
  linhas: LinhaFaceta[];
  traduzirPainel?: boolean;
};

const TETO = 12;

/**
 * CINCO RECORTES, UMA TABELA.
 *
 * ── O que havia antes ─────────────────────────────────────────────────
 * Cinco tabelas — painel, perfil, usuário, empresa, matrícula — em dois grids,
 * cada uma num cartão próprio, todas com as MESMAS três colunas. Lado a lado
 * elas competem por atenção sem se comparar: os números de duas delas nunca
 * somam a mesma coisa (um usuário aparece num painel e numa empresa), e mesmo
 * assim a diagramação sugere que sim. Em telas estreitas viravam dez linhas de
 * rolagem antes de chegar ao fim.
 *
 * ── Por que segmentado, e não abas ────────────────────────────────────
 * Abas sugerem seções diferentes. Aqui é o MESMO dado visto por outro eixo —
 * o controle segmentado diz isso: uma coisa, cinco ângulos. E o eixo escolhido
 * fica escrito no cabeçalho da coluna, para quem der print não perder o
 * contexto.
 *
 * O estado é local de propósito: trocar de recorte é olhar, não filtrar. O
 * filtro de verdade (período, painel, usuário) continua na URL, onde pode ser
 * colado num chamado.
 *
 * `totalGeral` é o consumo do CICLO (ou do filtro), não a soma das linhas:
 * serve para declarar a COBERTURA no rodapé, nunca para calcular a barra.
 */
export function Facetas({ facetas, totalGeral }: { facetas: Faceta[]; totalGeral: number }) {
  const comDados = facetas.filter((f) => f.linhas.length > 0);
  // Abre no primeiro recorte que TEM dado: abrir num vazio faria a tela
  // parecer quebrada quando o consumo está todo em outro eixo.
  const [ativa, setAtiva] = useState(() => (comDados[0] ?? facetas[0])?.id ?? "");
  const atual = facetas.find((f) => f.id === ativa) ?? facetas[0];
  if (!atual) return null;

  /*
    A BARRA COMPARA DENTRO DO RECORTE, e isso é correção de um defeito real.
    O percentual saía sobre o consumo do CICLO. Mas boa parte do consumo não é
    atribuível a eixo nenhum (conversa sem painel, sem perfil ou sem usuário
    identificado): na natcorp, as linhas somavam 9,7 de 969 créditos. Resultado
    na tela: "1%", "0%", "0%" e três barras invisíveis — números honestos e
    inúteis, com cara de bug.
    Comparar dentro do recorte responde a pergunta que a tabela existe para
    responder ("quem consome mais?"), e a cobertura vai escrita embaixo, onde
    não se confunde com a comparação.
  */
  const somaDoRecorte = atual.linhas.reduce((s, l) => s + l.creditos, 0);

  return (
    <section>
      {/* Mesmo padrão do `Bloco`: o título e o controle ficam na altura do
          canvas, e a superfície branca guarda só o conteúdo. */}
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Consumo por recorte</h2>
          <p className="mt-1 text-xs text-text-muted">
            O mesmo consumo, visto por um eixo de cada vez.
          </p>
        </div>
        {/*
          `Segmented` do design system, não um controle à mão. Escrevi este
          mesmo padrão três vezes em 23/09 sem procurar se já existia — a
          catraca de UI acusou os botões crus e o primitivo estava lá desde
          sempre. O "0" no rótulo continua: evita o clique que não leva a
          lugar nenhum.
        */}
        <Segmented
          value={atual.id}
          onChange={setAtiva}
          options={facetas.map((f) => ({
            value: f.id,
            label: f.linhas.length === 0 ? `${f.rotulo} 0` : f.rotulo,
            title: f.linhas.length === 0 ? "Nenhum consumo neste recorte" : undefined,
          }))}
        />
      </header>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-1">
        {atual.linhas.length === 0 ? (
          <EmptyState
            title="Nenhum consumo neste recorte"
            description="O consumo do período não foi atribuído a este eixo. Veja os outros recortes acima."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Consumo por {atual.rotulo.toLowerCase()}</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th scope="col" className="py-2 pr-2 font-medium">
                    {atual.coluna}
                  </th>
                  <th scope="col" className="w-28 py-2 pr-2 text-right font-medium">
                    Créditos
                  </th>
                  {/* A barra é a coluna que se lê sem ler: proporção é comparação,
                      e comparar percentuais em texto exige aritmética de cabeça. */}
                  <th scope="col" className="w-40 py-2 font-medium">
                    Participação
                  </th>
                </tr>
              </thead>
              <tbody>
                {atual.linhas.slice(0, TETO).map((l) => {
                  const pct =
                    somaDoRecorte > 0 ? Math.min(100, (l.creditos / somaDoRecorte) * 100) : 0;
                  return (
                    <tr key={l.chave} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-2">
                        {atual.traduzirPainel ? nomeDoPainel(l.chave) : l.chave}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {fmtCreditos(l.creditos)}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-text-muted">
                            {fmtPercent(l.creditos, somaDoRecorte)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
              {atual.linhas.length > TETO
                ? `Mostrando os ${TETO} maiores de ${atual.linhas.length}. `
                : ""}
              A participação compara <strong>dentro deste recorte</strong>, que soma{" "}
              {fmtCreditos(somaDoRecorte)} de {fmtCreditos(totalGeral)} crédito(s) do período
              {somaDoRecorte < totalGeral ? (
                <>
                  {" "}
                  — o restante veio de conversas sem {atual.coluna.toLowerCase()} identificado
                </>
              ) : null}
              .
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
