import { fmtNumero } from "@/lib/gestao/formato";

/**
 * Filtros do consumo — formulário GET, sem JavaScript.
 *
 * O estado mora na URL, não em `useState`. É o mesmo padrão da tela de
 * auditoria do admin, e vale por três motivos concretos aqui: o link filtrado
 * pode ser colado num chamado de suporte, o botão "voltar" do navegador
 * desfaz o filtro, e a página continua sendo um Server Component — o filtro
 * roda no banco, não no navegador, então não há o caso de filtrar só as
 * primeiras N linhas que vieram.
 *
 * Os campos de sessão viajam como hidden porque o GET reescreve a querystring
 * inteira: sem eles, filtrar derrubaria o token e a pessoa cairia na tela de
 * "abra pelo painel".
 */

export type OpcoesFiltro = Record<string, { valor: string; chamadas: number }[]>;

const EIXOS = [
  { nome: "painel", rotulo: "Painel" },
  { nome: "perfil", rotulo: "Perfil" },
  { nome: "usuario", rotulo: "Usuário" },
  { nome: "empresa", rotulo: "Empresa" },
  { nome: "matricula", rotulo: "Matrícula" },
] as const;

const PAINEL_ROTULO: Record<string, string> = {
  PO: "Operador",
  PG: "Gestor",
  PC: "Colaborador",
};

export function ConsumoFiltros({
  acao,
  sessaoParams,
  opcoes,
  atuais,
  de,
  ate,
  placeholderDe,
  placeholderAte,
}: {
  /** Caminho para onde o form aponta (a própria página). */
  acao: string;
  /** `key`+`kbt` ou `suporte`+`base` — preservados como hidden. */
  sessaoParams: Record<string, string>;
  opcoes: OpcoesFiltro;
  atuais: Record<string, string>;
  /** Datas escolhidas (vazias = ciclo do contrato). */
  de: string;
  ate: string;
  /** O ciclo vigente, mostrado como dica quando as datas estão vazias. */
  placeholderDe: string;
  placeholderAte: string;
}) {
  const temFiltro = EIXOS.some((e) => atuais[e.nome]) || Boolean(de || ate);

  return (
    <form
      method="get"
      action={acao}
      className="mb-6 rounded-lg border border-border bg-surface p-4"
    >
      {Object.entries(sessaoParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted" htmlFor="filtro-de">
            Data inicial
          </label>
          <input
            id="filtro-de"
            type="date"
            name="de"
            defaultValue={de}
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted" htmlFor="filtro-ate">
            Data final
          </label>
          <input
            id="filtro-ate"
            type="date"
            name="ate"
            defaultValue={ate}
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <p className="self-end pb-2 text-xs text-text-muted sm:col-span-2">
          Em branco, o período é o do ciclo atual do contrato ({placeholderDe.split("-").reverse().join("/")}{" "}
          a {placeholderAte.split("-").reverse().join("/")}).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {EIXOS.map((eixo) => {
          const lista = opcoes[eixo.nome] ?? [];
          const atual = atuais[eixo.nome] ?? "";
          // Um valor que veio na URL mas não está na lista (período mudou, por
          // exemplo) continua selecionável — senão o filtro sumiria sozinho e a
          // tela mostraria outro número sem explicar por quê.
          const orfao = atual && !lista.some((o) => o.valor === atual);

          return (
            <div key={eixo.nome}>
              <label
                className="mb-1 block text-xs font-medium text-text-muted"
                htmlFor={`filtro-${eixo.nome}`}
              >
                {eixo.rotulo}
              </label>
              <select
                id={`filtro-${eixo.nome}`}
                name={eixo.nome}
                defaultValue={atual}
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos</option>
                {orfao ? <option value={atual}>{atual}</option> : null}
                {lista.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {eixo.nome === "painel"
                      ? (PAINEL_ROTULO[o.valor] ?? o.valor)
                      : o.valor}{" "}
                    ({fmtNumero(o.chamadas)})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-ui font-medium text-primary-fg transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Filtrar
        </button>
        {temFiltro ? (
          <a
            href={`${acao}?${new URLSearchParams(sessaoParams).toString()}`}
            className="inline-flex items-center rounded-md border border-border-strong px-3 py-2 text-ui text-text transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Limpar
          </a>
        ) : null}
        {temFiltro ? (
          <p className="text-xs text-text-muted">
            Os totais abaixo refletem o filtro. O saldo, não — ele é sempre do ciclo inteiro,
            porque é ele que a fatura cobra.
          </p>
        ) : null}
      </div>
    </form>
  );
}
