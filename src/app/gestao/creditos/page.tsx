import { abrirSessaoGestao } from "@/lib/gestao/sessao";
import { lerSaldo, lerAlocacoes, mesCorrente } from "@/lib/gestao/dados";
import { cotacaoDeHoje, emReais } from "@/lib/gestao/cotacao";
import { ShellGestao, RecusaGestao, Bloco, Indicador } from "@/components/gestao/shell";
import { ComprarCreditos, DistribuirCreditos } from "@/components/gestao/creditos-form";
import { fmtCreditos, fmtUsd, fmtBrl, fmtPercent, fmtMes } from "@/lib/gestao/formato";

export default async function GestaoCreditosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;

  const base = sessao.identidade.baseCode;
  const mes = mesCorrente();

  const [saldo, alocacoes, cotacao] = await Promise.all([
    lerSaldo(base, mes),
    lerAlocacoes(base, mes),
    cotacaoDeHoje(),
  ]);

  const contratados = saldo?.creditos_contratados ?? 0;
  const extra = saldo?.creditos_extra ?? 0;
  const disponiveis = saldo?.creditos_disponiveis ?? 0;
  const consumidos = saldo?.creditos_consumidos ?? 0;
  const restante = saldo?.creditos_saldo ?? 0;
  const usdPorCredito = saldo?.usd_por_credito ?? 3.5;
  const estourou = disponiveis > 0 && restante < 0;

  return (
    <ShellGestao
      sessao={sessao}
      atual="creditos"
      titulo="Créditos"
      descricao={`Referência de ${fmtMes(mes)}. Cada crédito equivale a 1 milhão de tokens processados pelo assistente.`}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Plano do mês" valor={fmtCreditos(contratados)} detalhe="Créditos contratados" />
        <Indicador
          rotulo="Adicionais"
          valor={fmtCreditos(extra)}
          detalhe={extra > 0 ? "Cobrados na próxima fatura" : "Nenhum neste mês"}
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

      {contratados === 0 && extra === 0 ? (
        <div className="mb-6 rounded-lg border border-info-line bg-info-soft px-4 py-3">
          <p className="text-sm text-info">
            Ainda não há plano cadastrado para {fmtMes(mes)}. O assistente continua funcionando
            normalmente — o bloqueio por crédito só vale quando existe um plano contratado.
          </p>
        </div>
      ) : null}

      <Bloco
        titulo="Adquirir créditos adicionais"
        descricao="Use quando os créditos do mês acabarem ou estiverem perto do fim. Ficam disponíveis na hora."
      >
        <ComprarCreditos
          sessao={{ key: sessao.key, kbt: sessao.token }}
          usdPorCredito={usdPorCredito}
          usdBrl={cotacao?.usdBrl ?? null}
        />
      </Bloco>

      <Bloco
        titulo="Distribuição de créditos"
        descricao="Reserve parte do saldo para um perfil, um usuário ou um painel. Quem não tiver reserva consome do saldo geral da base."
      >
        <DistribuirCreditos
          sessao={{ key: sessao.key, kbt: sessao.token }}
          alocacoes={alocacoes}
          contratado={disponiveis}
        />
      </Bloco>

      <Bloco titulo="Preço" descricao="Valor unitário e conversão para real.">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Por crédito</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{fmtUsd(usdPorCredito)}</dd>
            <p className="mt-1 text-xs text-text-muted">
              {fmtBrl(emReais(usdPorCredito, cotacao))} pela cotação de hoje
            </p>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Total do mês</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtUsd(disponiveis * usdPorCredito)}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {fmtBrl(emReais(disponiveis * usdPorCredito, cotacao))}
            </p>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Cotação usada</dt>
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
      </Bloco>
    </ShellGestao>
  );
}
