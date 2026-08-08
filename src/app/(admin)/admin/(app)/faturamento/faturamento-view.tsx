"use client";

import { useMemo, useState } from "react";
import { Download, TriangleAlert } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import {
  agrupar,
  fracaoCacheCobrada,
  fracaoEntradaEmCache,
  precosAusentes,
  rotuloAcao,
  somar,
  tokensCobrados,
  valorUsd,
  type BaseCobranca,
  type Grupo,
  type LinhaFaturamento,
  type Totais,
} from "@/lib/billing/pricing";

const nf = new Intl.NumberFormat("pt-BR");
const usd = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

type Aba = "cliente" | "provider" | "model" | "purpose";

const ABAS: { value: Aba; label: string }[] = [
  { value: "cliente", label: "Cliente" },
  { value: "provider", label: "Provedor" },
  { value: "model", label: "Modelo" },
  { value: "purpose", label: "Ação" },
];

const CHAVE: Record<Aba, (l: LinhaFaturamento) => string> = {
  cliente: (l) => l.cliente,
  provider: (l) => l.provider,
  model: (l) => l.model,
  purpose: (l) => rotuloAcao(l.purpose),
};

/** Um número grande com rótulo. `destaque` para o que vai na fatura. */
function Kpi({
  rotulo,
  valor,
  nota,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <Surface
      elevation={1}
      padding="md"
      className={destaque ? "border-primary bg-primary/5" : undefined}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{rotulo}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${
          destaque ? "text-2xl text-primary" : "text-xl text-text"
        }`}
      >
        {valor}
      </p>
      {nota ? <p className="mt-1 text-xs text-text-muted">{nota}</p> : null}
    </Surface>
  );
}

const th = "px-3 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap";
const thNum = "px-3 py-2 text-right text-xs font-semibold text-text-muted whitespace-nowrap";
const td = "px-3 py-2 text-sm text-text whitespace-nowrap";
const tdNum = "px-3 py-2 text-right text-sm tabular-nums text-text whitespace-nowrap";

/**
 * A tabela do relatório. As mesmas colunas em todos os recortes — trocar de aba
 * muda o agrupamento, nunca o significado de uma coluna.
 */
function Tabela({
  grupos,
  rotuloChave,
  base,
  usdPorMtok,
  total,
}: {
  grupos: Grupo[];
  rotuloChave: string;
  base: BaseCobranca;
  usdPorMtok: number;
  total: Totais;
}) {
  const cobrados = (t: Totais) => (base === "ponderado" ? t.tokensPonderados : t.tokensBrutos);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>{rotuloChave}</th>
            <th className={thNum}>Chamadas</th>
            <th className={thNum}>Entrada</th>
            <th className={thNum}>Saída</th>
            <th className={thNum}>Cache lido</th>
            <th className={thNum}>Cache escrito</th>
            <th className={thNum} title="Dos tokens que passaram pelo cache, quanto o provedor realmente cobra">
              % do cache cobrado
            </th>
            <th className={thNum}>Tokens brutos</th>
            <th className={thNum}>Tokens ponderados</th>
            <th className={thNum}>A cobrar</th>
            <th className={thNum}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.chave} className="border-b border-border/60 last:border-0">
              <td className={`${td} font-medium`}>{g.chave}</td>
              <td className={tdNum}>{nf.format(g.totais.chamadas)}</td>
              <td className={tdNum}>{nf.format(g.totais.entradaTotal)}</td>
              <td className={tdNum}>{nf.format(g.totais.saida)}</td>
              <td className={tdNum}>{nf.format(g.totais.cacheLido)}</td>
              <td className={tdNum}>{nf.format(g.totais.cacheEscrito)}</td>
              <td className={tdNum}>{pct(fracaoCacheCobrada(g.totais))}</td>
              <td className={tdNum}>{nf.format(g.totais.tokensBrutos)}</td>
              <td className={tdNum}>{nf.format(g.totais.tokensPonderados)}</td>
              <td className={`${tdNum} font-semibold`}>{nf.format(cobrados(g.totais))}</td>
              <td className={tdNum}>{usd(valorUsd(cobrados(g.totais), usdPorMtok))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border">
          <tr className="bg-surface-2">
            <td className={`${td} font-semibold`}>Total</td>
            <td className={`${tdNum} font-semibold`}>{nf.format(total.chamadas)}</td>
            <td className={`${tdNum} font-semibold`}>{nf.format(total.entradaTotal)}</td>
            <td className={`${tdNum} font-semibold`}>{nf.format(total.saida)}</td>
            <td className={`${tdNum} font-semibold`}>{nf.format(total.cacheLido)}</td>
            <td className={`${tdNum} font-semibold`}>{nf.format(total.cacheEscrito)}</td>
            <td className={`${tdNum} font-semibold`}>{pct(fracaoCacheCobrada(total))}</td>
            <td className={`${tdNum} font-semibold`}>{nf.format(total.tokensBrutos)}</td>
            <td className={`${tdNum} font-semibold`}>{nf.format(total.tokensPonderados)}</td>
            <td className={`${tdNum} font-semibold text-primary`}>{nf.format(cobrados(total))}</td>
            <td className={`${tdNum} font-semibold text-primary`}>
              {usd(valorUsd(cobrados(total), usdPorMtok))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function FaturamentoView({
  cobravel,
  naoCobravel,
  base,
  usdPorMtok,
  cobrarOverhead,
  periodo,
}: {
  cobravel: LinhaFaturamento[];
  naoCobravel: LinhaFaturamento[];
  base: BaseCobranca;
  usdPorMtok: number;
  cobrarOverhead: boolean;
  periodo: { de: string; ate: string };
}) {
  const [aba, setAba] = useState<Aba>("cliente");

  // O que entra na conta. Quando o overhead interno não é repassado, ele sai
  // daqui — mas continua visível no bloco de diagnóstico mais abaixo, para a
  // decisão poder ser revista com o número na mão.
  const faturaveis = useMemo(
    () => (cobrarOverhead ? cobravel : cobravel.filter((l) => l.kind !== "system")),
    [cobravel, cobrarOverhead],
  );
  const total = useMemo(() => somar(faturaveis), [faturaveis]);
  const grupos = useMemo(() => agrupar(faturaveis, CHAVE[aba], base), [faturaveis, aba, base]);
  const aCobrar = tokensCobrados(cobravel, base, cobrarOverhead);
  const semPreco = useMemo(() => precosAusentes(faturaveis), [faturaveis]);
  const overhead = useMemo(() => somar(cobravel.filter((l) => l.kind === "system")), [cobravel]);
  const foraDaFatura = useMemo(() => agrupar(naoCobravel, (l) => l.origem), [naoCobravel]);

  const baixarCsv = () => {
    const cab = [
      "cliente", "origem", "tipo", "provedor", "modelo", "acao", "chamadas",
      "entrada_total", "entrada_nova", "cache_lido", "cache_escrito", "saida",
      "tokens_brutos", "tokens_ponderados", "tokens_cobrados", "valor_usd",
      "custo_usd", "preco_confirmado",
    ];
    const linhas = faturaveis.map((l) => {
      const cob = base === "ponderado" ? l.tokens_ponderados : l.tokens_brutos;
      return [
        l.cliente, l.origem, l.kind, l.provider, l.model, rotuloAcao(l.purpose), l.chamadas,
        l.entrada_total, l.entrada_nova, l.cache_read, l.cache_write, l.saida,
        l.tokens_brutos, l.tokens_ponderados, cob, valorUsd(cob, usdPorMtok).toFixed(6),
        l.custo_usd ?? "", l.preco_confirmado ? "sim" : "nao",
      ].map(csvEscape).join(";");
    });
    // `;` e BOM: é o que o Excel em pt-BR abre em colunas sem pedir importação.
    const blob = new Blob(["﻿" + [cab.join(";"), ...linhas].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `faturamento_${periodo.de}_a_${periodo.ate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!cobravel.length && !naoCobravel.length) {
    return (
      <Surface elevation={1} padding="lg" className="mt-6 text-center">
        <p className="text-text">Nenhum consumo de IA registrado neste período.</p>
        <p className="mt-1 text-sm text-text-muted">
          Ajuste as datas acima, ou confirme que o widget esteve em uso.
        </p>
      </Surface>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* ── O número da fatura, e o que o explica ─────────────────────── */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            destaque
            rotulo="Tokens a cobrar"
            valor={nf.format(aCobrar)}
            nota={base === "ponderado" ? "base ponderada pelo cache" : "base bruta (tudo que trafegou)"}
          />
          <Kpi
            destaque
            rotulo="Valor a faturar"
            valor={usd(valorUsd(aCobrar, usdPorMtok))}
            nota={`${usd(usdPorMtok)} por milhão de tokens`}
          />
          <Kpi
            rotulo="Custo real do provedor"
            valor={total.custoUsd == null ? "—" : usd(total.custoUsd)}
            nota={
              total.custoUsd == null
                ? "há modelo sem preço cadastrado"
                : `margem ${usd(valorUsd(aCobrar, usdPorMtok) - total.custoUsd)}`
            }
          />
          <Kpi
            rotulo="Economia do cache"
            valor={nf.format(total.economia)}
            nota={`${pct(fracaoEntradaEmCache(total))} da entrada veio do cache; ${pct(
              fracaoCacheCobrada(total),
            )} dele é cobrado`}
          />
        </div>
      </section>

      {semPreco.length > 0 ? (
        <Surface elevation={1} padding="md" className="border-amber-500/40 bg-amber-500/5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <TriangleAlert className="size-4" />
            {semPreco.length} modelo{semPreco.length > 1 ? "s" : ""} sem preço cadastrado
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Os tokens estão contados; o <strong>custo</strong> e a margem, não — e o cache
            desses modelos é contado a preço cheio. Cadastre em{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">ai_model_prices</code>{" "}
            para o número de custo aparecer:{" "}
            {semPreco.map((p) => `${p.provider}/${p.model}`).join(", ")}
          </p>
        </Surface>
      ) : null}

      {/* ── Os quatro totalizadores ───────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-text">Totalizadores</h2>
            <p className="text-sm text-text-muted">
              Os quatro recortes saem das mesmas linhas — os subtotais sempre fecham com o total.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Segmented value={aba} onChange={setAba} options={ABAS} />
            <Button type="button" variant="secondary" size="sm" onClick={baixarCsv}>
              <Download className="size-3.5" /> CSV
            </Button>
          </div>
        </div>
        <Surface elevation={1} padding="none" className="overflow-hidden">
          <Tabela
            grupos={grupos}
            rotuloChave={ABAS.find((a) => a.value === aba)!.label}
            base={base}
            usdPorMtok={usdPorMtok}
            total={total}
          />
        </Surface>
      </section>

      {/* ── O que NÃO entrou, dito em voz alta ────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Surface elevation={1} padding="md">
          <h3 className="text-sm font-semibold text-text">Fora da fatura</h3>
          <p className="mt-1 text-sm text-text-muted">
            Consumo real da plataforma que nenhum cliente paga. Fica à vista para não virar
            surpresa no fim do mês.
          </p>
          <table className="mt-3 w-full">
            <tbody>
              {foraDaFatura.length === 0 ? (
                <tr>
                  <td className={`${td} text-text-muted`}>Nada neste período.</td>
                </tr>
              ) : (
                foraDaFatura.map((g) => (
                  <tr key={g.chave} className="border-b border-border/60 last:border-0">
                    <td className={td}>
                      {g.chave === "portal"
                        ? "Portal público (cortesia)"
                        : g.chave === "admin"
                          ? "Uso interno da equipe"
                          : "Jobs de sistema (importação, indexação)"}
                    </td>
                    <td className={tdNum}>{nf.format(g.totais.tokensBrutos)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Surface>

        <Surface elevation={1} padding="md">
          <h3 className="text-sm font-semibold text-text">Overhead interno do widget</h3>
          <p className="mt-1 text-sm text-text-muted">
            Reescrita de busca, classificador de assunto e embeddings: o cliente não pediu, mas
            rodaram dentro do turno dele.{" "}
            {cobrarOverhead ? "Está sendo cobrado." : "NÃO está sendo cobrado."}
          </p>
          <p className="mt-3 text-xl font-semibold tabular-nums text-text">
            {nf.format(overhead.tokensBrutos)}{" "}
            <span className="text-sm font-normal text-text-muted">
              tokens ·{" "}
              {total.tokensBrutos + (cobrarOverhead ? 0 : overhead.tokensBrutos) > 0
                ? pct(
                    overhead.tokensBrutos /
                      (cobrarOverhead
                        ? total.tokensBrutos
                        : total.tokensBrutos + overhead.tokensBrutos),
                  )
                : "—"}{" "}
              do consumo do widget
            </span>
          </p>
        </Surface>
      </section>

      {/* ── O detalhe, para conferência linha a linha ─────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-text">Detalhe</h2>
        <Surface elevation={1} padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>Cliente</th>
                  <th className={th}>Provedor</th>
                  <th className={th}>Modelo</th>
                  <th className={th}>Ação</th>
                  <th className={th}>Tipo</th>
                  <th className={thNum}>Chamadas</th>
                  <th className={thNum}>Entrada</th>
                  <th className={thNum}>Saída</th>
                  <th className={thNum}>Cache (L/E)</th>
                  <th className={thNum}>A cobrar</th>
                </tr>
              </thead>
              <tbody>
                {faturaveis.map((l, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className={td}>{l.cliente}</td>
                    <td className={td}>{l.provider}</td>
                    <td className={td}>{l.model}</td>
                    <td className={td}>{rotuloAcao(l.purpose)}</td>
                    <td className={`${td} text-text-muted`}>
                      {l.kind === "user" ? "pedido do usuário" : "interno do turno"}
                    </td>
                    <td className={tdNum}>{nf.format(l.chamadas)}</td>
                    <td className={tdNum}>{nf.format(l.entrada_total)}</td>
                    <td className={tdNum}>{nf.format(l.saida)}</td>
                    <td className={tdNum}>
                      {nf.format(l.cache_read)} / {nf.format(l.cache_write)}
                    </td>
                    <td className={`${tdNum} font-semibold`}>
                      {nf.format(base === "ponderado" ? l.tokens_ponderados : l.tokens_brutos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      </section>
    </div>
  );
}
