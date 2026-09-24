import Link from "next/link";
import {
  abrirSessaoGestao,
  linkGestao,
  paramsDaSessao,
  registrarAcessoSuporte,
} from "@/lib/gestao/sessao";
import { lerConversas, lerFacetasConversas, lerMensagens } from "@/lib/gestao/dados";
import { ShellGestao, RecusaGestao, Bloco, Vazio } from "@/components/gestao/shell";
import { ConsumoFiltros } from "@/components/gestao/consumo-filtros";
import { fmtDataHora, fmtNumero, nomeDoPainel, soData } from "@/lib/gestao/formato";

const POR_PAGINA = 40;

/**
 * Histórico de conversas dos usuários da base.
 *
 * O escopo é travado no `p_base` do token — inclusive na leitura das mensagens,
 * onde a base é conferida DE NOVO contra a conversa. O id vem da URL, e sem
 * essa segunda conferência bastaria trocá-lo para ler a conversa de outro
 * cliente com um token perfeitamente válido do seu.
 */
export default async function GestaoConversasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;
  await registrarAcessoSuporte(sessao, "conversas");

  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const conversaId = um(sp.c);
  const pagina = Math.max(0, Number(um(sp.p) ?? 0) || 0);

  /*
    O PADRÃO É O DIA DE HOJE, e isso é decisão do dono (23/09).
    A tela listava a base inteira desde sempre, o que para um cliente com
    milhares de conversas significa rolar para achar a de hoje de manhã. O
    padrão vira o dia corrente, e as datas aparecem PREENCHIDAS no formulário
    em vez de vazias: campo vazio que na verdade filtra é a forma mais rápida
    de alguém concluir que o histórico sumiu.
  */
  const hoje = soData(new Date());
  const deTxt = um(sp.de) || hoje;
  const ateTxt = um(sp.ate) || hoje;
  const de = new Date(`${deTxt}T00:00:00`);
  // Fim EXCLUSIVO no dia seguinte: `<= 23:59:59` perderia o último segundo, e
  // com `created_at` em timestamptz essa fresta aparece de vez em quando.
  const ate = new Date(new Date(`${ateTxt}T00:00:00`).getTime() + 86400000);

  const filtros = {
    painel: um(sp.painel) ?? "",
    perfil: um(sp.perfil) ?? "",
    // `u` é o nome antigo do parâmetro; links já colados em chamado continuam
    // funcionando, e o formulário passa a escrever `usuario`.
    usuario: um(sp.usuario) ?? um(sp.u) ?? "",
    empresa: um(sp.empresa) ?? "",
    matricula: um(sp.matricula) ?? "",
  };

  const base = sessao.identidade.baseCode;
  const [{ linhas, total }, facetas] = await Promise.all([
    lerConversas(base, {
      pagina,
      porPagina: POR_PAGINA,
      de,
      ate,
      painel: filtros.painel || undefined,
      perfil: filtros.perfil || undefined,
      usuario: filtros.usuario || undefined,
      empresa: filtros.empresa || undefined,
      matricula: filtros.matricula || undefined,
    }),
    lerFacetasConversas(base, de, ate),
  ]);

  const mensagens = conversaId ? await lerMensagens(base, conversaId) : null;
  const paginas = Math.ceil(total / POR_PAGINA);

  /*
    Os links de paginação e de "voltar à lista" precisam CARREGAR o filtro.
    Sem isto, avançar uma página descarta o recorte e a tela passa a mostrar
    outro conjunto sem nenhum aviso — o usuário conclui que o filtro "não
    funciona na página 2".
  */
  const qsFiltro = new URLSearchParams();
  qsFiltro.set("de", deTxt);
  qsFiltro.set("ate", ateTxt);
  for (const [k, v] of Object.entries(filtros)) if (v) qsFiltro.set(k, v);
  const comFiltro = (extra?: string) =>
    `${linkGestao(sessao, "/gestao/conversas")}&${qsFiltro.toString()}${extra ?? ""}`;

  return (
    <ShellGestao
      sessao={sessao}
      atual="conversas"
      titulo="Conversas"
      descricao="Quem conversou com o assistente, quando e sobre o quê."
    >
      {conversaId ? (
        <Bloco
          titulo="Conversa"
          acoes={
            <Link
              href={comFiltro()}
              className="rounded-md px-3 py-1.5 text-ui font-medium text-primary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Voltar à lista
            </Link>
          }
        >
          {mensagens === null ? (
            <Vazio>Conversa não encontrada nesta base.</Vazio>
          ) : mensagens.length === 0 ? (
            <Vazio>Esta conversa não tem mensagens registradas.</Vazio>
          ) : (
            <ol className="space-y-3">
              {mensagens.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "rounded-lg border border-border bg-surface-2 p-3"
                      : "rounded-lg border border-border bg-surface p-3"
                  }
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span className="font-medium text-text">
                      {m.role === "user" ? "Usuário" : "Assistente"}
                    </span>
                    <span>{fmtDataHora(m.created_at)}</span>
                    {m.latency_ms != null ? <span>{fmtNumero(m.latency_ms)} ms</span> : null}
                    {m.feedback === 1 ? (
                      <span className="text-success">útil</span>
                    ) : m.feedback === -1 ? (
                      <span className="text-danger">não útil</span>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-text">{m.content}</p>
                </li>
              ))}
            </ol>
          )}
        </Bloco>
      ) : null}

      {/* O form é nu (ver `ConsumoFiltros`); a superfície é desta tela, onde
          o filtro é conteúdo de primeira linha e não uma gaveta. */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-1">
      <ConsumoFiltros
        acao="/gestao/conversas"
        sessaoParams={paramsDaSessao(sessao)}
        opcoes={facetas}
        atuais={filtros}
        de={deTxt}
        ate={ateTxt}
        placeholderDe={hoje}
        placeholderAte={hoje}
        dicaPeriodo={
          <>
            O padrão é o dia de hoje. Amplie as datas para ver o histórico; as listas abaixo
            mostram só quem aparece no período escolhido.
          </>
        }
        nota={<>A contagem do histórico já considera o período e os filtros escolhidos.</>}
      />
      </div>

      <Bloco
        titulo="Histórico"
        descricao={`${fmtNumero(total)} conversa(s) no período e filtros atuais, da mais recente para a mais antiga.`}
      >
        {linhas.length === 0 ? (
          <Vazio>Nenhuma conversa registrada com os filtros atuais.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Conversas da base</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th scope="col" className="py-2 pr-2 font-medium">Quando</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Assunto</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Usuário</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Matrícula</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Empresa</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Perfil</th>
                  <th scope="col" className="py-2 font-medium">Painel</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap text-xs text-text-muted">
                      {fmtDataHora(c.created_at)}
                    </td>
                    <td className="py-2 pr-2">
                      <Link
                        href={comFiltro(`&c=${encodeURIComponent(c.id)}`)}
                        className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {c.title?.trim() || "Sem título"}
                      </Link>
                    </td>
                    <td className="py-2 pr-2">{c.p_usuario ?? "—"}</td>
                    <td className="py-2 pr-2 tabular-nums">{c.p_matricula ?? "—"}</td>
                    <td className="py-2 pr-2 tabular-nums">{c.p_empresa ?? "—"}</td>
                    <td className="py-2 pr-2">{c.p_perfil ?? "—"}</td>
                    <td className="py-2">{c.p_portal ? nomeDoPainel(c.p_portal) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 ? (
          <nav className="mt-4 flex items-center justify-between" aria-label="Paginação">
            <span className="text-xs text-text-muted">
              Página {pagina + 1} de {paginas}
            </span>
            <div className="flex gap-2">
              {pagina > 0 ? (
                <Link
                  href={comFiltro(`&p=${pagina - 1}`)}
                  className="rounded-md border border-border-strong px-3 py-1.5 text-ui hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Anterior
                </Link>
              ) : null}
              {pagina + 1 < paginas ? (
                <Link
                  href={comFiltro(`&p=${pagina + 1}`)}
                  className="rounded-md border border-border-strong px-3 py-1.5 text-ui hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Próxima
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </Bloco>
    </ShellGestao>
  );
}
