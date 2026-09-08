"use client";

import { useState, useTransition } from "react";
import { salvarPlano, removerPlano } from "./plano-actions";

/**
 * Plano contratado por cliente — tela INTERNA.
 *
 * Os quatro campos são termos de contrato, e três deles nunca aparecem para o
 * cliente: o lastro em tokens, porque é negociação; o dia do ciclo, que ele vê
 * só como período; e a vigência, que existe para uma fatura antiga continuar
 * batendo depois de um reajuste.
 */

export type PlanoLinha = {
  id: string;
  base_code: string;
  creditos_por_ciclo: number;
  usd_por_credito: number;
  tokens_por_credito: number;
  dia_inicio_ciclo: number;
  vigente_desde: string;
  observacao: string | null;
  vigente: boolean;
};

const campo =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring";
const rotulo = "mb-1 block text-xs font-medium text-text-muted";
const botao =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-ui font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60";

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
  const [usd, setUsd] = useState(String(vigente?.usd_por_credito ?? 3.5));
  const [tokens, setTokens] = useState(String(vigente?.tokens_por_credito ?? 1_000_000));
  const [dia, setDia] = useState(String(vigente?.dia_inicio_ciclo ?? 1));
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
        dia_inicio_ciclo: dia,
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
            step="0.01"
            className={campo}
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="pl-tokens">Tokens por crédito</label>
          <input
            id="pl-tokens"
            type="number"
            min={1}
            step={100000}
            className={campo}
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
          />
          <p className="mt-1 text-2xs text-text-muted">Padrão 1.000.000</p>
        </div>
        <div>
          <label className={rotulo} htmlFor="pl-dia">Dia da virada do ciclo</label>
          <input
            id="pl-dia"
            type="number"
            min={1}
            max={31}
            className={campo}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
          <p className="mt-1 text-2xs text-text-muted">
            14 = de 14/09 a 13/10. Dias 29-31 encurtam em fevereiro.
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
        <button
          type="button"
          className={`${botao} bg-primary text-primary-fg hover:bg-primary-hover`}
          onClick={salvar}
          disabled={pendente}
        >
          {pendente ? "Salvando…" : "Salvar plano"}
        </button>
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
                <th scope="col" className="py-2 pr-2 text-right font-medium">Dia</th>
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
                  <td className="py-2 pr-2 text-right tabular-nums">{p.dia_inicio_ciclo}</td>
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
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
          Nenhum plano cadastrado. Sem plano, o cliente usa o assistente sem controle de créditos.
        </p>
      )}
    </div>
  );
}
