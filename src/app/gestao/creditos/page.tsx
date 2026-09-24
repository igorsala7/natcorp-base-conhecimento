import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { Button } from "@/components/ui/button";
import { lerSaldo, lerAlocacoes, lerCompras } from "@/lib/gestao/dados";
import { comBase } from "@/lib/base-path";
import { cotacaoDeHoje, emReais } from "@/lib/gestao/cotacao";
import { USD_POR_CREDITO_EXTRA, CREDITOS_POR_LOTE } from "@/lib/gestao/creditos";
import { ShellGestao, RecusaGestao, Bloco, Vazio, FaixaResumo } from "@/components/gestao/shell";
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
  /*
    SEM PLANO NÃO HÁ PREÇO CONTRATADO — e o padrão anterior (3.5) era um
    número inventado na unidade errada: US$3,50 POR CRÉDITO daria US$350 a
    cada 100. Nulo vira travessão, como o resto da área já faz com cotação
    ausente.
  */
  const usdPorCredito = saldo?.usd_por_credito ?? null;
  const semPlano = !saldo?.tem_plano;
  const estourou = !semPlano && restante <= 0;
  // "Perto do fim" é o mesmo limiar que dispara o aviso no painel e na faixa
  // de 10% da regra de crédito — um segundo número aqui faria a tela avisar em
  // momento diferente do resto do produto.
  const perto = !semPlano && !estourou && disponiveis > 0 && restante / disponiveis <= 0.1;

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
      {/*
        UMA RESPOSTA, NÃO QUATRO NÚMEROS.
        Aqui havia quatro cartões de peso igual e, logo ABAIXO deles, um aviso
        azul explicando por que três estavam zerados. Pior: o saldo zero
        aparecia em VERMELHO enquanto o aviso dizia que estava tudo bem — dois
        sinais opostos sobre o mesmo fato, na mesma dobra.
        A faixa diz o estado primeiro e o vermelho só aparece quando é para
        agir.
      */}
      {semPlano ? (
        <FaixaResumo
          frase={
            <>
              Este cliente <strong>ainda não tem plano cadastrado</strong>. O assistente funciona
              normalmente e o consumo segue registrado — o controle de créditos passa a valer
              quando houver contrato. Já foram consumidos {fmtCreditos(consumidos)} crédito(s)
              neste ciclo.
            </>
          }
        />
      ) : (
        <FaixaResumo
          numero={fmtCreditos(restante)}
          unidade="créditos restantes"
          tom={estourou ? "ruim" : perto ? "atencao" : "bom"}
          frase={
            estourou ? (
              <>
                <strong>Os créditos deste ciclo acabaram.</strong> O assistente continua
                respondendo pela documentação, mas deixou de consultar dados. Adquira adicionais
                abaixo — eles não vencem e ficam disponíveis na hora.
              </>
            ) : perto ? (
              <>
                de {fmtCreditos(disponiveis)} disponíveis — {fmtPercent(consumidos, disponiveis)}{" "}
                já foram usados neste ciclo. Ao zerar, o assistente deixa de consultar dados.
              </>
            ) : (
              <>
                de {fmtCreditos(disponiveis)} disponíveis neste ciclo, com{" "}
                {fmtPercent(consumidos, disponiveis)} já consumidos. O contratado renova na
                virada; o adicional acumula.
              </>
            )
          }
          apoio={[
            { rotulo: "Contratado", valor: fmtCreditos(contratados) },
            { rotulo: "Adicionais", valor: fmtCreditos(extra) },
            { rotulo: "Consumido", valor: fmtCreditos(consumidos) },
          ]}
        />
      )}

      <Bloco
        titulo="Adquirir créditos adicionais"
        descricao="Use quando os créditos do ciclo acabarem ou estiverem perto do fim. Ficam disponíveis na hora."
      >
        <ComprarCreditos sessao={sessaoParams} usdBrl={cotacao?.usdBrl ?? null} />
      </Bloco>

      <Bloco
        titulo="Histórico de aquisições"
        descricao={
          deTxt || ateTxt
            ? "Compras no período filtrado."
            : "Compras feitas no ciclo atual. Use o filtro para ver outros períodos."
        }
        acoes={
          // `comBase`: o basePath do Next não reescreve `action` de
          // formulário. Ver o comentário em `consumo-filtros.tsx`.
          <form
            method="get"
            action={comBase("/gestao/creditos")}
            className="flex flex-wrap items-end gap-2"
          >
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
            <Button variant="secondary"
              type="submit">
              Filtrar
            </Button>
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

      {/*
        OS DOIS PREÇOS, LADO A LADO E NOMEADOS.
        O contratado (US$5,00) e o adicional (US$3,50) são diferentes de
        propósito — avulso é mais barato que compromisso mensal. Separados pela
        tela, um no bloco de valores e outro na caixa de compra, pareciam
        contradição; juntos e rotulados, são uma tabela de preços.
        A unidade é o LOTE DE 100, que é como o preço é negociado e dito. Por
        crédito daria US$0,05 e US$0,035 — e este último `fmtUsd` arredonda
        para US$0,04, visivelmente errado.
      */}
      <Bloco titulo="Valor do crédito">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Contratado · {CREDITOS_POR_LOTE} créditos
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {usdPorCredito == null ? "—" : fmtUsd(usdPorCredito * CREDITOS_POR_LOTE)}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {usdPorCredito == null
                ? "Sem plano cadastrado."
                : `${fmtBrl(emReais(usdPorCredito * CREDITOS_POR_LOTE, cotacao))} pela cotação de hoje`}
            </p>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Adicional · {CREDITOS_POR_LOTE} créditos
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtUsd(USD_POR_CREDITO_EXTRA * CREDITOS_POR_LOTE)}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              Compra avulsa, mais barata que o contratado.
            </p>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Total do ciclo</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {usdPorCredito == null ? "—" : fmtUsd(disponiveis * usdPorCredito)}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {usdPorCredito == null ? "" : fmtBrl(emReais(disponiveis * usdPorCredito, cotacao))}
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
