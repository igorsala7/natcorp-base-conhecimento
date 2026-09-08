import Link from "next/link";
import { abrirSessaoGestao, linkGestao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { lerConversas, lerMensagens } from "@/lib/gestao/dados";
import { ShellGestao, RecusaGestao, Bloco, Vazio } from "@/components/gestao/shell";
import { fmtDataHora, fmtNumero, nomeDoPainel } from "@/lib/gestao/formato";

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
  const painel = um(sp.painel);
  const usuario = um(sp.u);
  const pagina = Math.max(0, Number(um(sp.p) ?? 0) || 0);

  const base = sessao.identidade.baseCode;
  const { linhas, total } = await lerConversas(base, {
    pagina,
    porPagina: POR_PAGINA,
    painel: painel || undefined,
    usuario: usuario || undefined,
  });

  const mensagens = conversaId ? await lerMensagens(base, conversaId) : null;
  const paginas = Math.ceil(total / POR_PAGINA);

  return (
    <ShellGestao
      sessao={sessao}
      atual="conversas"
      titulo="Conversas"
      descricao={`${fmtNumero(total)} conversa(s) registrada(s) para esta base.`}
    >
      {conversaId ? (
        <Bloco
          titulo="Conversa"
          acoes={
            <Link
              href={linkGestao(sessao, "/gestao/conversas")}
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

      <Bloco titulo="Histórico" descricao="As conversas mais recentes primeiro.">
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
                        href={`${linkGestao(sessao, "/gestao/conversas")}&c=${encodeURIComponent(c.id)}`}
                        className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {c.title?.trim() || "Sem título"}
                      </Link>
                    </td>
                    <td className="py-2 pr-2">{c.p_usuario ?? "—"}</td>
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
                  href={`${linkGestao(sessao, "/gestao/conversas")}&p=${pagina - 1}`}
                  className="rounded-md border border-border-strong px-3 py-1.5 text-ui hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Anterior
                </Link>
              ) : null}
              {pagina + 1 < paginas ? (
                <Link
                  href={`${linkGestao(sessao, "/gestao/conversas")}&p=${pagina + 1}`}
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
