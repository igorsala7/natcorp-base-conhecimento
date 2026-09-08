import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { lerSaldo, lerAlocacoes, lerCompras } from "@/lib/gestao/dados";
import { cotacaoDeHoje, emReais } from "@/lib/gestao/cotacao";
import { ShellGestao, RecusaGestao, Bloco, Indicador, Vazio } from "@/components/gestao/shell";
import { ComprarCreditos, DistribuirCreditos } from "@/components/gestao/creditos-form";
import {
  fmtCreditos,
  fmtUsd,
  fmtBrl,
  fmtPercent,
  fmtPeriodo,
  fmtDataHora,
  soData,
} from "@/lib/gestao/formato";

/**
 * Créditos: saldo do ciclo, compra de adicionais, distribuição e histórico.
 *
 * Nada aqui fala em token. O cliente compra crédito; o lastro é do contrato.
 */
export default async function GestaoCreditosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;
  await registrarAcessoSuporte(sessao, "creditos");

  const base = sessao.identidade.baseCode;
  const saldo = await lerSaldo(base);

  const um = (v: string | string[] | undefined) => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === "string" && x.trim() !== "" ? x.trim() : "";
  };
  const deTxt = um(sp.de);
  const ateTxt = um(sp.ate);

  // O histórico respeita as datas quando informadas; senão, mostra o ciclo.
  const de = deTxt ? new Date(`${deTxt}T00:00:00-03:00`) : undefined;
  const ate = ateTxt ? new Date(`${ateTxt}T00:00:00-03:00`) : undefined;
  if (ate) ate.setDate(ate.getDate() + 1);

  const [alocacoes, compras, cotacao] = await Promise.all([
    lerAlocacoes(base),
    lerCompras(base, de, ate),
    cotacaoDeHoje(),
  ]);

  const contratados = saldo?.creditos_contratados ?? 0;
  const extra = saldo?.creditos_extra ?? 0;
  const disponiveis = saldo?.creditos_disponiveis ?? 0;
  const consumidos = saldo?.creditos_consumidos ?? 0;
  const restante = saldo?.creditos_saldo ?? 0;
  const usdPorCredito = saldo?.usd_por_credito ?? 3.5;
  const semPlano = !saldo?.tem_plano;
  const estourou = !semPlano && restante < 0;

  const sessaoParams = paramsDaSessao(sessao);
  const cicloIni = saldo ? soData(new Date(saldo.ciclo_inicio)) : "";
  const cicloFim = saldo ? soData(new Date(new Date(saldo.ciclo_fim).getTime() - 86400000)) : "";

  return (
    <ShellGestao
      sessao={sessao}
      atual="creditos"
      titulo="Créditos"
      descricao={
        saldo ? `Ciclo atual: ${fmtPeriodo(saldo.ciclo_inicio, saldo.ciclo_fim)}.` : undefined
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Plano do ciclo"
          valor={fmtCreditos(contratados)}
          detalhe="Créditos contratados"
        />
        <Indicador
          rotulo="Adicionais"
          valor={fmtCreditos(extra)}
          detalhe={extra > 0 ? "Cobrados na próxima fatura" : "Nenhum neste ciclo"}
        />
        <Indicador
          rotulo="Consumido"
          valor={fmtCreditos(consumidos)}
          detalhe={disponiveis > 0 ? fmtPercent(consumidos, disponiveis) : undefined}
          tom={estourou ? "ruim" : "neutro"}
        />
        <Indicador
          rotulo="Saldo"
          valor={fmtCreditos(restante)}
          tom={restante <= 0 ? "ruim" : restante / Math.max(disponiveis, 1) < 0.2 ? "atencao" : "bom"}
        />
      </div>

      {semPlano ? (
        <div className="mb-6 rounded-lg border border-info-line bg-info-soft px-4 py-3">
          <p className="text-sm text-info">
            Ainda não há plano cadastrado para este cliente. O assistente continua funcionando
            normalmente — o controle de créditos só passa a valer quando existe um plano.
          </p>
        </div>
      ) : null}

      <Bloco
        titulo="Adquirir créditos adicionais"
        descricao="Use quando os créditos do ciclo acabarem ou estiverem perto do fim. Ficam disponíveis na hora."
      >
        <ComprarCreditos
          sessao={sessaoParams}
          usdPorCredito={usdPorCredito}
          usdBrl={cotacao?.usdBrl ?? null}
        />
      </Bloco>

      <Bloco
        titulo="Histórico de aquisições"
        descricao={
          deTxt || ateTxt
            ? "Compras no período filtrado."
            : "Compras feitas no ciclo atual. Use o filtro para ver outros períodos."
        }
        acoes={
          <form method="get" action="/gestao/creditos" className="flex flex-wrap items-end gap-2">
            {Object.entries(sessaoParams).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <div>
              <label className="mb-1 block text-2xs text-text-muted" htmlFor="compras-de">
                De
              </label>
              <input
                id="compras-de"
                type="date"
                name="de"
                defaultValue={deTxt || cicloIni}
                className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-ui text-text focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-2xs text-text-muted" htmlFor="compras-ate">
                Até
              </label>
              <input
                id="compras-ate"
                type="date"
                name="ate"
                defaultValue={ateTxt || cicloFim}
                className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-ui text-text focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="rounded-md border border-border-strong px-3 py-1.5 text-ui text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Filtrar
            </button>
          </form>
        }
      >
        {compras.length === 0 ? (
          <Vazio>Nenhuma aquisição no período.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Histórico de aquisições de créditos</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th scope="col" className="py-2 pr-2 font-medium">Quando</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Créditos</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Valor unitário</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Total</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Solicitado por</th>
                  <th scope="col" className="py-2 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap text-xs">{fmtDataHora(c.criado_em)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums font-medium">
                      {fmtCreditos(c.creditos)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {fmtUsd(c.usd_por_credito)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtUsd(c.usd_total)}</td>
                    <td className="py-2 pr-2 text-xs">{c.solicitado_por ?? "—"}</td>
                    <td className="py-2 text-xs text-text-muted">{c.motivo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td className="py-2 pr-2 text-xs uppercase tracking-wide text-text-muted">
                    Total
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {fmtCreditos(compras.reduce((s, c) => s + Number(c.creditos), 0))}
                  </td>
                  <td />
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {fmtUsd(compras.reduce((s, c) => s + Number(c.usd_total), 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Distribuição de créditos"
        descricao="Reserve parte do saldo para um perfil, um usuário ou um painel. Quem não tiver reserva consome do saldo geral."
      >
        <DistribuirCreditos
          sessao={sessaoParams}
          alocacoes={alocacoes}
          contratado={disponiveis}
        />
      </Bloco>

      <Bloco titulo="Valor do crédito">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Por crédito</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{fmtUsd(usdPorCredito)}</dd>
            <p className="mt-1 text-xs text-text-muted">
              {fmtBrl(emReais(usdPorCredito, cotacao))} pela cotação de hoje
            </p>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Total do ciclo</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtUsd(disponiveis * usdPorCredito)}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {fmtBrl(emReais(disponiveis * usdPorCredito, cotacao))}
            </p>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Cotação de referência</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {cotacao ? `R$ ${cotacao.usdBrl.toFixed(4)}` : "—"}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {cotacao
                ? cotacao.defasada
                  ? `Cotação de ${cotacao.dia} — não foi possível atualizar hoje.`
                  : `Atualizada hoje · fonte ${cotacao.fonte}`
                : "Indisponível. Os valores em real não podem ser calculados agora."}
            </p>
          </div>
        </dl>

        <p className="mt-4 rounded-md border border-info-line bg-info-soft px-3 py-2 text-xs text-info">
          Os valores em real são apenas uma <strong>referência</strong>, convertidos pela cotação do
          dia. A cobrança usa a cotação vigente na data de fechamento da fatura e pode ser diferente
          da exibida aqui.
        </p>
      </Bloco>
    </ShellGestao>
  );
}
