"use client";

import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { salvarPlano, removerPlano } from "./plano-actions";

/**
 * Plano contratado por cliente — tela INTERNA.
 *
 * Os campos são termos de contrato, e dois nunca aparecem para o cliente: o
 * lastro em tokens, porque é negociação, e a vigência, que existe para uma
 * fatura antiga continuar batendo depois de um reajuste.
 *
 * O "dia da virada do ciclo" saiu em 24/09. O dono fixou o ciclo em mês
 * fechado, do dia 1 ao último, e um campo que aceita 1 a 31, grava, e não muda
 * o relatório é pior que campo nenhum: quem o preenchesse conferiria o
 * fechamento e encontraria um número que ignora o que acabou de configurar.
 */

export type PlanoLinha = {
  id: string;
  base_code: string;
  creditos_por_ciclo: number;
  usd_por_credito: number;
  tokens_por_credito: number;
  vigente_desde: string;
  observacao: string | null;
  vigente: boolean;
};

const campo =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring";
const rotulo = "mb-1 block text-xs font-medium text-text-muted";

const N = new Intl.NumberFormat("pt-BR");

export function PlanoForm({
  baseCode,
  baseNome,
  planos,
}: {
  baseCode: string;
  baseNome: string;
  planos: PlanoLinha[];
}) {
  const vigente = planos.find((p) => p.vigente) ?? planos[0];

  const [creditos, setCreditos] = useState(String(vigente?.creditos_por_ciclo ?? 500));
  /*
    PADRÕES NA UNIDADE ATUAL. Eram 3.5 e 1.000.000 — a denominação de ANTES de
    23/09, quando 1 crédito valia 1 milhão de tokens. Deixados como estavam,
    cadastrar o próximo cliente criaria um plano cem vezes fora da régua de
    todos os outros, e o erro só apareceria na fatura.
    Hoje: 1 crédito = 10.000 tokens, e o contratado custa US$0,05 por crédito
    (US$5,00 a cada 100, que é como o preço é negociado).
  */
  const [usd, setUsd] = useState(String(vigente?.usd_por_credito ?? 0.05));
  const [tokens, setTokens] = useState(String(vigente?.tokens_por_credito ?? 10_000));
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setErro(null);
    setOk(null);
    iniciar(async () => {
      const r = await salvarPlano({
        base_code: baseCode,
        creditos_por_ciclo: creditos,
        usd_por_credito: usd,
        tokens_por_credito: tokens,
        vigente_desde: desde,
        observacao: obs || undefined,
      });
      if (r.ok) {
        setOk("Plano salvo.");
        setObs("");
      } else setErro(r.erro);
    });
  }

  function remover(id: string) {
    iniciar(async () => {
      const r = await removerPlano({ id });
      if (!r.ok) setErro(r.erro);
    });
  }

  const creditosN = Number(creditos) || 0;
  const usdN = Number(usd) || 0;
  const tokensN = Number(tokens) || 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold">Plano contratado — {baseNome}</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          Termos do contrato. O cliente vê o efeito na área de gestão, mas nunca o lastro em tokens.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className={rotulo} htmlFor="pl-creditos">Créditos por ciclo</label>
          <input
            id="pl-creditos"
            type="number"
            min={0}
            step="0.01"
            className={campo}
            value={creditos}
            onChange={(e) => setCreditos(e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="pl-usd">US$ por crédito</label>
          <input
            id="pl-usd"
            type="number"
            min={0}
            /* 0.001: o adicional é US$0,035 e com passo de 0,01 não se digita. */
            step="0.001"
            className={campo}
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
          />
          {/*
            A equivalência ao vivo, porque o campo é POR CRÉDITO e a negociação
            é por 100. Sem ela, quem combinou "US$5,00" digita 5 aqui e cria um
            plano cem vezes mais caro — o número fica plausível na tela e só
            aparece na fatura.
          */}
          <p className="mt-1 text-2xs text-text-muted">
            {`US$ ${(usdN * 100).toFixed(2)} a cada 100 créditos`}
          </p>
        </div>
        <div>
          <label className={rotulo} htmlFor="pl-tokens">Tokens por crédito</label>
          <input
            id="pl-tokens"
            type="number"
            min={1}
            step={1000}
            className={campo}
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
          />
          <p className="mt-1 text-2xs text-text-muted">
            Padrão 10.000 — assim 100 créditos = 1 milhão de tokens.
          </p>
        </div>
        <div>
          <label className={rotulo} htmlFor="pl-desde">Vigente desde</label>
          <input
            id="pl-desde"
            type="date"
            className={campo}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <p className="mt-1 text-2xs text-text-muted">Data nova cria versão</p>
        </div>
      </div>

      <div>
        <label className={rotulo} htmlFor="pl-obs">Observação (opcional)</label>
        <input
          id="pl-obs"
          className={campo}
          maxLength={300}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Ex.: renovação 2026, desconto por volume"
        />
      </div>

      <div className="rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
        <p className="text-text">
          <strong>{N.format(creditosN)}</strong> créditos ={" "}
          <strong>{N.format(creditosN * tokensN)}</strong> tokens no ciclo · fatura de{" "}
          <strong>US$ {(creditosN * usdN).toFixed(2)}</strong>
        </p>
        {/*
          O custo real medido é US$ 1,19 por milhão de tokens brutos na origem
          widget (120 dias). Mostrar a margem aqui evita fechar um contrato cujo
          lastro come o preço sem ninguém perceber na hora da negociação.
        */}
        <p className="mt-1 text-xs text-text-muted">
          Custo estimado a US$ 1,19/milhão:{" "}
          <strong>US$ {((creditosN * tokensN * 1.19) / 1_000_000).toFixed(2)}</strong> · margem{" "}
          <strong>
            {tokensN > 0 && usdN > 0
              ? `${(usdN / ((tokensN * 1.19) / 1_000_000)).toFixed(2)}×`
              : "—"}
          </strong>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={salvar}
          disabled={pendente}
        >
          {pendente ? "Salvando…" : "Salvar plano"}
        </Button>
        {erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
        {ok ? <p className="text-sm text-success">{ok}</p> : null}
      </div>

      {planos.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Histórico de planos</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th scope="col" className="py-2 pr-2 font-medium">Vigente desde</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Créditos</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">US$/crédito</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Tokens/crédito</th>
                <th scope="col" className="py-2 pr-2 font-medium">Observação</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-2">
                    {p.vigente_desde.split("-").reverse().join("/")}
                    {p.vigente ? (
                      <span className="ml-2 rounded bg-success-soft px-1.5 py-0.5 text-2xs font-medium text-success">
                        vigente
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{N.format(p.creditos_por_ciclo)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {p.usd_por_credito.toFixed(2)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {N.format(p.tokens_por_credito)}
                  </td>
                  <td className="py-2 pr-2 text-xs text-text-muted">{p.observacao ?? "—"}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => remover(p.id)}
                      disabled={pendente}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Nenhum plano cadastrado. Sem plano, o cliente usa o assistente sem controle de créditos." />
      )}
    </div>
  );
}
