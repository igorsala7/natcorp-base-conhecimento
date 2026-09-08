import { abrirSessaoGestao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { lerSaldo, lerConsumo, mesCorrente } from "@/lib/gestao/dados";
import { cotacaoDeHoje, emReais } from "@/lib/gestao/cotacao";
import { ShellGestao, RecusaGestao, Bloco, Indicador, Vazio } from "@/components/gestao/shell";
import {
  fmtCreditos,
  fmtNumero,
  fmtUsd,
  fmtBrl,
  fmtPercent,
  fmtMes,
  nomeDoPainel,
} from "@/lib/gestao/formato";

/**
 * Visão geral: quanto foi consumido no mês, por quem, e quanto sobra.
 *
 * O consumo é medido em CRÉDITOS (1 crédito = 1 milhão de tokens brutos), e só
 * conta a origem `widget` — o mesmo recorte de `faturamento_detalhe`. Uso
 * interno da Natcorp (avaliações, indexação) nunca aparece aqui porque nunca é
 * cobrado.
 */
export default async function GestaoConsumoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;
  await registrarAcessoSuporte(sessao, "consumo");

  const base = sessao.identidade.baseCode;
  const mes = mesCorrente();
  const inicio = new Date(`${mes}T00:00:00-03:00`);
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);

  const [saldo, consumo, cotacao] = await Promise.all([
    lerSaldo(base, mes),
    lerConsumo(base, inicio, fim),
    cotacaoDeHoje(),
  ]);

  const consumidos = saldo?.creditos_consumidos ?? 0;
  const disponiveis = saldo?.creditos_disponiveis ?? 0;
  const restante = saldo?.creditos_saldo ?? 0;
  const semContrato = disponiveis === 0;
  const estourou = !semContrato && restante < 0;
  const perto = !semContrato && !estourou && disponiveis > 0 && consumidos / disponiveis >= 0.8;

  // As linhas não atribuíveis somam no total da base, mas não pertencem a
  // ninguém. Ficam separadas para não inflar o consumo de um perfil.
  const atribuidas = consumo.filter((l) => l.atribuido);
  const naoAtribuidas = consumo.filter((l) => !l.atribuido);
  const creditosNaoAtribuidos = naoAtribuidas.reduce((s, l) => s + Number(l.creditos), 0);

  const porPainel = agrupar(atribuidas, (l) => l.painel);
  const porPerfil = agrupar(atribuidas, (l) => l.perfil);
  const porUsuario = agrupar(atribuidas, (l) => l.usuario);

  return (
    <ShellGestao
      sessao={sessao}
      atual="consumo"
      titulo="Consumo do assistente"
      descricao={`Referência de ${fmtMes(mes)}. 1 crédito equivale a 1 milhão de tokens processados.`}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Contratado"
          valor={semContrato ? "—" : fmtCreditos(disponiveis)}
          detalhe={
            semContrato
              ? "Nenhum contrato cadastrado para este mês"
              : `${fmtCreditos(saldo?.creditos_contratados ?? 0)} do plano + ${fmtCreditos(saldo?.creditos_extra ?? 0)} adicionais`
          }
        />
        <Indicador
          rotulo="Consumido"
          valor={fmtCreditos(consumidos)}
          detalhe={semContrato ? undefined : `${fmtPercent(consumidos, disponiveis)} do contratado`}
          tom={estourou ? "ruim" : perto ? "atencao" : "neutro"}
        />
        <Indicador
          rotulo="Saldo"
          valor={semContrato ? "—" : fmtCreditos(restante)}
          detalhe={estourou ? "Créditos esgotados" : undefined}
          tom={estourou ? "ruim" : perto ? "atencao" : "bom"}
        />
        <Indicador
          rotulo="Tokens processados"
          valor={fmtNumero(saldo?.tokens_brutos ?? 0)}
          detalhe={
            cotacao
              ? `US$ ${(saldo?.usd_por_credito ?? 3.5).toFixed(2)} por crédito · câmbio ${cotacao.usdBrl.toFixed(4)}${cotacao.defasada ? " (defasado)" : ""}`
              : `US$ ${(saldo?.usd_por_credito ?? 3.5).toFixed(2)} por crédito`
          }
        />
      </div>

      {estourou ? (
        <div className="mb-6 rounded-lg border border-danger-line bg-danger-soft px-4 py-3">
          <p className="text-sm font-medium text-danger">
            Os créditos deste mês acabaram e o assistente está bloqueado.
          </p>
          <p className="mt-1 text-sm text-text">
            Adquira créditos adicionais na aba <strong>Créditos</strong> para liberar o uso. Eles
            serão cobrados na próxima fatura.
          </p>
        </div>
      ) : perto ? (
        <div className="mb-6 rounded-lg border border-warning-line bg-warning-soft px-4 py-3">
          <p className="text-sm text-warning">
            Você já usou {fmtPercent(consumidos, disponiveis)} dos créditos do mês. Restam{" "}
            {fmtCreditos(restante)}.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <TabelaResumo titulo="Por painel" linhas={porPainel} total={consumidos} rotularPainel />
        <TabelaResumo titulo="Por perfil" linhas={porPerfil} total={consumidos} />
        <TabelaResumo titulo="Por usuário" linhas={porUsuario} total={consumidos} />
      </div>

      {creditosNaoAtribuidos > 0 ? (
        <Bloco
          titulo="Consumo não atribuído"
          descricao="Chamadas em que o painel, o perfil ou o usuário não vieram identificados. Contam no total da base, mas não podem ser imputadas a um recorte."
        >
          <p className="text-sm text-text">
            {fmtCreditos(creditosNaoAtribuidos)} crédito(s) em {fmtNumero(naoAtribuidas.length)}{" "}
            agrupamento(s).
          </p>
        </Bloco>
      ) : null}

      <Bloco
        titulo="Custo estimado"
        descricao="Valor dos créditos contratados no mês. A conversão usa a cotação do dia; a fatura congela a cotação da data de fechamento."
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Em dólar</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtUsd(saldo?.usd_total ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Em real</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtBrl(emReais(saldo?.usd_total ?? 0, cotacao))}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Cotação</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {cotacao ? `R$ ${cotacao.usdBrl.toFixed(4)}` : "—"}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {cotacao
                ? cotacao.defasada
                  ? `Última cotação disponível (${cotacao.dia}). A conversão pode estar desatualizada.`
                  : `Fonte: ${cotacao.fonte}`
                : "Cotação indisponível no momento — o valor em real não pode ser calculado."}
            </p>
          </div>
        </dl>
      </Bloco>
    </ShellGestao>
  );
}

type Linha = { chave: string; creditos: number; chamadas: number };

function agrupar<T extends { creditos: number; chamadas: number }>(
  linhas: readonly T[],
  chave: (l: T) => string,
): Linha[] {
  const mapa = new Map<string, Linha>();
  for (const l of linhas) {
    const k = chave(l);
    const atual = mapa.get(k) ?? { chave: k, creditos: 0, chamadas: 0 };
    atual.creditos += Number(l.creditos);
    atual.chamadas += Number(l.chamadas);
    mapa.set(k, atual);
  }
  return [...mapa.values()].sort((a, b) => b.creditos - a.creditos);
}

function TabelaResumo({
  titulo,
  linhas,
  total,
  rotularPainel,
}: {
  titulo: string;
  linhas: Linha[];
  total: number;
  rotularPainel?: boolean;
}) {
  return (
    <Bloco titulo={titulo}>
      {linhas.length === 0 ? (
        <Vazio>Nenhum consumo registrado neste mês.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th scope="col" className="py-2 pr-2 font-medium">
                  {rotularPainel ? "Painel" : "Nome"}
                </th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">
                  Créditos
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, 12).map((l) => (
                <tr key={l.chave} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-2">{rotularPainel ? nomeDoPainel(l.chave) : l.chave}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtCreditos(l.creditos)}</td>
                  <td className="py-2 text-right tabular-nums text-text-muted">
                    {fmtPercent(l.creditos, total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {linhas.length > 12 ? (
            <p className="mt-2 text-xs text-text-muted">
              e mais {linhas.length - 12} — os 12 maiores estão listados.
            </p>
          ) : null}
        </div>
      )}
    </Bloco>
  );
}
