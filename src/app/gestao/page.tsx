import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { lerSaldo, lerConsumo, lerFacetas } from "@/lib/gestao/dados";
import { cotacaoDeHoje, emReais } from "@/lib/gestao/cotacao";
import { ShellGestao, RecusaGestao, Bloco, Indicador, Vazio } from "@/components/gestao/shell";
import { ConsumoFiltros } from "@/components/gestao/consumo-filtros";
import {
  fmtCreditos,
  fmtUsd,
  fmtBrl,
  fmtPercent,
  fmtNumero,
  fmtPeriodo,
  nomeDoPainel,
  soData,
} from "@/lib/gestao/formato";

/**
 * Visão geral: quanto foi consumido no ciclo, por quem, e quanto sobra.
 *
 * ── O que NÃO aparece aqui ─────────────────────────────────────────────
 * Token. O cliente compra CRÉDITO, e quantos tokens lastreiam um crédito
 * (`ai_cliente_plano.tokens_por_credito`) é negociação, não informação de
 * produto — pode ser 1 milhão para um cliente e 2 para outro. Expor o número
 * transformaria cada renovação numa conversa sobre o lastro dos outros.
 *
 * ── O período ──────────────────────────────────────────────────────────
 * O padrão é o CICLO do contrato, que pode ir de 14/09 a 13/10. Os filtros de
 * data recortam livremente dentro ou fora dele — mas o saldo continua sendo o
 * do ciclo, porque é ele que a fatura cobra.
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
  const saldo = await lerSaldo(base);

  const um = (v: string | string[] | undefined) => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === "string" && x.trim() !== "" ? x.trim() : "";
  };

  // Janela: o ciclo por padrão; as datas da URL quando informadas. O fim ganha
  // um dia porque o campo é inclusivo para quem preenche e exclusivo na
  // consulta — sem isso, filtrar "até 30/09" perderia o próprio dia 30.
  const cicloIni = saldo ? new Date(saldo.ciclo_inicio) : new Date();
  const cicloFim = saldo ? new Date(saldo.ciclo_fim) : new Date();
  const deTxt = um(sp.de);
  const ateTxt = um(sp.ate);
  const inicio = deTxt ? new Date(`${deTxt}T00:00:00-03:00`) : cicloIni;
  const fim = ateTxt ? new Date(`${ateTxt}T00:00:00-03:00`) : cicloFim;
  if (ateTxt) fim.setDate(fim.getDate() + 1);

  const filtros = {
    painel: um(sp.painel),
    perfil: um(sp.perfil),
    usuario: um(sp.usuario),
    empresa: um(sp.empresa),
    matricula: um(sp.matricula),
  };
  const temFiltro = Object.values(filtros).some(Boolean) || Boolean(deTxt || ateTxt);

  const [consumo, facetas, cotacao] = await Promise.all([
    lerConsumo(base, inicio, fim, filtros),
    lerFacetas(base, inicio, fim),
    cotacaoDeHoje(),
  ]);

  const consumidos = saldo?.creditos_consumidos ?? 0;
  const disponiveis = saldo?.creditos_disponiveis ?? 0;
  const restante = saldo?.creditos_saldo ?? 0;
  const semPlano = !saldo?.tem_plano;
  const estourou = !semPlano && restante < 0;
  const perto = !semPlano && !estourou && disponiveis > 0 && consumidos / disponiveis >= 0.8;

  // Com filtro, as tabelas mostram um RECORTE. O total do recorte não é o
  // consumo do ciclo, e usar um no lugar do outro faria as porcentagens somarem
  // qualquer coisa menos 100%.
  const consumoDoRecorte = consumo.reduce((acc, l) => acc + Number(l.creditos), 0);
  const totalDasTabelas = temFiltro ? consumoDoRecorte : consumidos;

  const atribuidas = consumo.filter((l) => l.atribuido);
  const naoAtribuidas = consumo.filter((l) => !l.atribuido);
  const creditosNaoAtribuidos = naoAtribuidas.reduce((s, l) => s + Number(l.creditos), 0);

  const porPainel = agrupar(atribuidas, (l) => l.painel);
  const porPerfil = agrupar(atribuidas, (l) => l.perfil);
  const porUsuario = agrupar(atribuidas, (l) => l.usuario);
  // Empresa e matrícula agrupam sobre TODAS as linhas: `atribuido` fala de
  // painel/perfil/usuário, e uma conversa sem usuário pode ter empresa
  // perfeitamente identificada.
  const porEmpresa = agrupar(consumo, (l) => l.empresa);
  const porMatricula = agrupar(consumo, (l) => l.matricula);

  return (
    <ShellGestao
      sessao={sessao}
      atual="consumo"
      titulo="Consumo do assistente"
      descricao={
        saldo
          ? `Ciclo atual: ${fmtPeriodo(saldo.ciclo_inicio, saldo.ciclo_fim)}.`
          : "Acompanhe o consumo de créditos do assistente."
      }
    >
      <ConsumoFiltros
        acao="/gestao"
        sessaoParams={paramsDaSessao(sessao)}
        opcoes={facetas}
        atuais={filtros}
        de={deTxt}
        ate={ateTxt}
        placeholderDe={soData(cicloIni)}
        placeholderAte={soData(new Date(cicloFim.getTime() - 86400000))}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Contratado"
          valor={semPlano ? "—" : fmtCreditos(disponiveis)}
          detalhe={
            semPlano
              ? "Nenhum plano cadastrado"
              : `${fmtCreditos(saldo?.creditos_contratados ?? 0)} do plano + ${fmtCreditos(saldo?.creditos_extra ?? 0)} adicionais`
          }
        />
        <Indicador
          rotulo="Consumido no ciclo"
          valor={fmtCreditos(consumidos)}
          detalhe={semPlano ? undefined : `${fmtPercent(consumidos, disponiveis)} do contratado`}
          tom={estourou ? "ruim" : perto ? "atencao" : "neutro"}
        />
        <Indicador
          rotulo="Saldo"
          valor={semPlano ? "—" : fmtCreditos(restante)}
          detalhe={estourou ? "Créditos esgotados" : undefined}
          tom={estourou ? "ruim" : perto ? "atencao" : "bom"}
        />
        <Indicador
          rotulo="Conversas no período"
          valor={fmtNumero(consumo.reduce((s, l) => s + Number(l.conversas), 0))}
          detalhe={temFiltro ? "Com os filtros aplicados" : "No ciclo atual"}
        />
      </div>

      {estourou ? (
        <div className="mb-6 rounded-lg border border-danger-line bg-danger-soft px-4 py-3">
          <p className="text-sm font-medium text-danger">
            Os créditos deste ciclo acabaram e o assistente está bloqueado.
          </p>
          <p className="mt-1 text-sm text-text">
            Adquira créditos adicionais na aba <strong>Créditos</strong> para liberar o uso. Eles
            serão cobrados na próxima fatura.
          </p>
        </div>
      ) : perto ? (
        <div className="mb-6 rounded-lg border border-warning-line bg-warning-soft px-4 py-3">
          <p className="text-sm text-warning">
            Você já usou {fmtPercent(consumidos, disponiveis)} dos créditos do ciclo. Restam{" "}
            {fmtCreditos(restante)}.
          </p>
        </div>
      ) : null}

      {temFiltro ? (
        <p className="mb-4 rounded-md border border-info-line bg-info-soft px-4 py-2 text-sm text-info">
          Filtro aplicado: {fmtCreditos(consumoDoRecorte)} crédito(s) no recorte, de{" "}
          {fmtCreditos(consumidos)} consumidos no ciclo.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <TabelaResumo titulo="Por painel" linhas={porPainel} total={totalDasTabelas} rotularPainel />
        <TabelaResumo titulo="Por perfil" linhas={porPerfil} total={totalDasTabelas} />
        <TabelaResumo titulo="Por usuário" linhas={porUsuario} total={totalDasTabelas} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TabelaResumo titulo="Por empresa" linhas={porEmpresa} total={totalDasTabelas} />
        <TabelaResumo titulo="Por matrícula" linhas={porMatricula} total={totalDasTabelas} />
      </div>

      {creditosNaoAtribuidos > 0 ? (
        <Bloco
          titulo="Consumo não atribuído"
          descricao="Conversas em que o painel, o perfil ou o usuário não vieram identificados. Contam no total, mas não podem ser imputadas a um recorte."
        >
          <p className="text-sm text-text">
            {fmtCreditos(creditosNaoAtribuidos)} crédito(s) em {fmtNumero(naoAtribuidas.length)}{" "}
            agrupamento(s).
          </p>
        </Bloco>
      ) : null}

      <Bloco
        titulo="Valor do ciclo"
        descricao="Referente aos créditos contratados e adquiridos neste ciclo."
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Por crédito</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtUsd(saldo?.usd_por_credito ?? 3.5)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Total em dólar</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtUsd(saldo?.usd_total ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Equivalente em real</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {fmtBrl(emReais(saldo?.usd_total ?? 0, cotacao))}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {cotacao ? `Referência: R$ ${cotacao.usdBrl.toFixed(4)}` : "Cotação indisponível"}
            </p>
          </div>
        </dl>

        {/*
          O disclaimer fica junto do número, não no rodapé: o valor em real muda
          todo dia, e a fatura usa a cotação do fechamento. Quem lê "R$ 1.750,00"
          sem esta linha planeja o orçamento com um número que não vai ser cobrado.
        */}
        <p className="mt-4 rounded-md border border-info-line bg-info-soft px-3 py-2 text-xs text-info">
          O valor em real é apenas uma <strong>referência</strong>, convertido pela cotação do dia.
          A cobrança usa a cotação vigente na data de fechamento da fatura e pode ser diferente da
          exibida aqui.
        </p>
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
        <Vazio>Nenhum consumo no período.</Vazio>
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
