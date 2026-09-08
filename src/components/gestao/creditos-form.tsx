"use client";

import { useState, useTransition } from "react";
import { comprarCreditos, salvarAlocacao, removerAlocacao } from "@/app/gestao/actions";
import { fmtCreditos, fmtUsd, fmtBrl, nomeDoPainel } from "@/lib/gestao/formato";
import type { Alocacao } from "@/lib/gestao/dados";

/**
 * Parâmetros que reabrem a MESMA sessão na Server Action — vindos de
 * `paramsDaSessao`. Genérico de propósito: no modo cliente são `key` + `kbt`,
 * no suporte são `suporte` + `base`, e o formulário não precisa saber qual é.
 */
type Sessao = Record<string, string>;

const botao =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-ui font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60";
const primario = `${botao} bg-primary text-primary-fg hover:bg-primary-hover`;
const secundario = `${botao} border border-border-strong bg-surface text-text hover:bg-surface-2`;
const campo =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring";
const rotulo = "mb-1 block text-xs font-medium text-text-muted";

/**
 * Compra de créditos adicionais.
 *
 * O disclaimer não é uma nota de rodapé: fica ao lado do botão, com o valor já
 * calculado. Quem clica precisa saber quanto vai ser cobrado e quando — e a
 * cobrança é na PRÓXIMA fatura, não agora.
 */
export function ComprarCreditos({
  sessao,
  usdPorCredito,
  usdBrl,
}: {
  sessao: Sessao;
  usdPorCredito: number;
  usdBrl: number | null;
}) {
  const [creditos, setCreditos] = useState(100);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();

  const totalUsd = creditos * usdPorCredito;
  const totalBrl = usdBrl != null ? totalUsd * usdBrl : null;

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const r = await comprarCreditos({ ...sessao, creditos, motivo: motivo || undefined });
      if (r.ok) {
        setFeito(true);
        setConfirmando(false);
        setMotivo("");
      } else {
        setErro(r.erro);
      }
    });
  }

  if (feito) {
    return (
      <div className="rounded-md border border-success-line bg-success-soft px-4 py-3">
        <p className="text-sm font-medium text-success">
          {fmtCreditos(creditos)} crédito(s) adicionados.
        </p>
        <p className="mt-1 text-sm text-text">
          Já estão disponíveis para uso e serão cobrados na próxima fatura.
        </p>
        <button type="button" className={`${secundario} mt-3`} onClick={() => setFeito(false)}>
          Adquirir mais
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
      <div>
        <label className={rotulo} htmlFor="qtd-creditos">
          Quantidade de créditos
        </label>
        <input
          id="qtd-creditos"
          type="number"
          min={1}
          max={100000}
          step={1}
          value={creditos}
          onChange={(e) => {
            setCreditos(Math.max(1, Number(e.target.value) || 1));
            setConfirmando(false);
          }}
          className={campo}
        />
        <label className={`${rotulo} mt-3`} htmlFor="motivo-compra">
          Observação (opcional)
        </label>
        <input
          id="motivo-compra"
          type="text"
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: pico de uso em setembro"
          className={campo}
        />
      </div>

      <div className="flex flex-col justify-between gap-3">
        <div className="rounded-md border border-border bg-surface-2 px-4 py-3">
          <p className="text-sm text-text">
            {fmtCreditos(creditos)} crédito(s) ={" "}
            <strong>{fmtCreditos(creditos)} milhão(ões) de tokens</strong>
          </p>
          <p className="mt-1 text-sm text-text">
            {fmtUsd(usdPorCredito)} por crédito · total <strong>{fmtUsd(totalUsd)}</strong>
            {totalBrl != null ? (
              <>
                {" "}
                (aprox. <strong>{fmtBrl(totalBrl)}</strong>)
              </>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            O valor em real é uma estimativa pela cotação de hoje. A cobrança usa a cotação do dia
            do fechamento da fatura.
          </p>
        </div>

        <div className="rounded-md border border-warning-line bg-warning-soft px-4 py-3">
          <p className="text-sm text-warning">
            Os créditos adquiridos aqui serão cobrados na <strong>próxima fatura</strong>.
          </p>
        </div>

        {erro ? (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        ) : null}

        {confirmando ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={primario} onClick={enviar} disabled={pendente}>
              {pendente ? "Confirmando…" : `Confirmar ${fmtCreditos(creditos)} crédito(s)`}
            </button>
            <button
              type="button"
              className={secundario}
              onClick={() => setConfirmando(false)}
              disabled={pendente}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className={primario} onClick={() => setConfirmando(true)}>
            Adquirir créditos
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Distribuição do saldo por painel, perfil e usuário.
 *
 * A soma das alocações PODE passar do contratado — e a tela avisa em vez de
 * impedir. Alocação é orçamento, não reserva: um recorte sem alocação continua
 * consumindo do saldo geral, então travar a soma criaria uma falsa sensação de
 * controle e atrapalharia o cadastro em andamento.
 */
export function DistribuirCreditos({
  sessao,
  alocacoes,
  contratado,
}: {
  sessao: Sessao;
  alocacoes: Alocacao[];
  contratado: number;
}) {
  const [alvoTipo, setAlvoTipo] = useState<"perfil" | "usuario" | "painel">("perfil");
  const [painel, setPainel] = useState<string>("PO");
  const [alvo, setAlvo] = useState("");
  const [creditos, setCreditos] = useState(50);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const somaAlocada = alocacoes.reduce((s, a) => s + Number(a.creditos_alocados), 0);
  const excede = contratado > 0 && somaAlocada > contratado;

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarAlocacao({
        ...sessao,
        alvo_tipo: alvoTipo,
        alvo: alvoTipo === "painel" ? null : alvo,
        painel: painel === "*" ? null : painel,
        creditos,
      });
      if (r.ok) setAlvo("");
      else setErro(r.erro);
    });
  }

  function remover(id: string) {
    iniciar(async () => {
      const r = await removerAlocacao({ ...sessao, id });
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[150px_150px_1fr_130px_auto] sm:items-end">
        <div>
          <label className={rotulo} htmlFor="alvo-tipo">
            Distribuir para
          </label>
          <select
            id="alvo-tipo"
            className={campo}
            value={alvoTipo}
            onChange={(e) => setAlvoTipo(e.target.value as typeof alvoTipo)}
          >
            <option value="perfil">Perfil</option>
            <option value="usuario">Usuário</option>
            <option value="painel">Painel inteiro</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="alvo-painel">
            Painel
          </label>
          <select
            id="alvo-painel"
            className={campo}
            value={painel}
            onChange={(e) => setPainel(e.target.value)}
          >
            {alvoTipo !== "painel" ? <option value="*">Todos</option> : null}
            <option value="PO">Operador</option>
            <option value="PG">Gestor</option>
            <option value="PC">Colaborador</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="alvo-nome">
            {alvoTipo === "painel" ? "—" : alvoTipo === "perfil" ? "Perfil" : "Usuário"}
          </label>
          <input
            id="alvo-nome"
            className={campo}
            value={alvo}
            disabled={alvoTipo === "painel"}
            onChange={(e) => setAlvo(e.target.value)}
            placeholder={alvoTipo === "perfil" ? "Ex.: FOLHA" : "Ex.: FGOMES"}
          />
        </div>

        <div>
          <label className={rotulo} htmlFor="alvo-creditos">
            Créditos
          </label>
          <input
            id="alvo-creditos"
            type="number"
            min={0}
            step={1}
            className={campo}
            value={creditos}
            onChange={(e) => setCreditos(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>

        <button type="button" className={primario} onClick={salvar} disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}

      {excede ? (
        <div className="rounded-md border border-warning-line bg-warning-soft px-4 py-2">
          <p className="text-sm text-warning">
            A soma distribuída ({fmtCreditos(somaAlocada)}) passa do contratado (
            {fmtCreditos(contratado)}). Quem consumir primeiro usa os créditos disponíveis.
          </p>
        </div>
      ) : null}

      {alocacoes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
          Nenhuma distribuição cadastrada. Sem distribuição, todos consomem do saldo geral da base.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Distribuição de créditos</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th scope="col" className="py-2 pr-2 font-medium">Tipo</th>
                <th scope="col" className="py-2 pr-2 font-medium">Alvo</th>
                <th scope="col" className="py-2 pr-2 font-medium">Painel</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Alocado</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Consumido</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Saldo</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {alocacoes.map((a) => {
                const zerou = Number(a.creditos_saldo) <= 0;
                return (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2 capitalize">{a.alvo_tipo}</td>
                    <td className="py-2 pr-2 font-medium">{a.alvo ?? "—"}</td>
                    <td className="py-2 pr-2">{nomeDoPainel(a.painel)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {fmtCreditos(a.creditos_alocados)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {fmtCreditos(a.creditos_consumidos)}
                    </td>
                    <td
                      className={`py-2 pr-2 text-right tabular-nums ${zerou ? "font-medium text-danger" : ""}`}
                    >
                      {fmtCreditos(a.creditos_saldo)}
                      {zerou ? <span className="ml-1 text-xs">(bloqueado)</span> : null}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => remover(a.id)}
                        disabled={pendente}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
