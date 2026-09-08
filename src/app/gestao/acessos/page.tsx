import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { carregarDadosAcessos } from "@/lib/gestao/acessos-dados";
import { ShellGestao, RecusaGestao, Bloco } from "@/components/gestao/shell";
import { RegrasDeAcesso } from "@/components/gestao/acessos-form";

export default async function GestaoAcessosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;
  await registrarAcessoSuporte(sessao, "acessos");

  const dados = await carregarDadosAcessos(sessao.identidade.baseCode);
  const semCobertura = dados.tools.filter((t) => !t.cobertaPelaTaxonomia);

  return (
    <ShellGestao
      sessao={sessao}
      atual="acessos"
      titulo="Acessos do assistente"
      descricao="Por padrão, cada pessoa só consulta pelo assistente o que já tem permissão de ver no sistema. As regras abaixo ajustam isso — e têm prioridade sobre a permissão automática."
    >
      <Bloco
        titulo="Regras de acesso"
        descricao="Bloqueie ou libere módulos, submódulos e consultas para um perfil, um usuário ou todos. Regra de usuário vence a de perfil, que vence a de todos."
      >
        <RegrasDeAcesso sessao={paramsDaSessao(sessao)} dados={dados} />
      </Bloco>

      <Bloco
        titulo="Consultas disponíveis"
        descricao={`${dados.tools.length} consulta(s) habilitada(s) para esta base.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Consultas habilitadas e seus módulos</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th scope="col" className="py-2 pr-2 font-medium">Consulta</th>
                <th scope="col" className="py-2 pr-2 font-medium">Módulos</th>
                <th scope="col" className="py-2 font-medium">Permissão automática</th>
              </tr>
            </thead>
            <tbody>
              {dados.tools.map((t) => (
                <tr key={t.key} className="border-b border-border/60 last:border-0 align-top">
                  <td className="py-2 pr-2">
                    <span className="font-medium">{t.nome}</span>
                    {t.descricaoUsuario ? (
                      <p className="mt-0.5 max-w-prose text-xs text-text-muted">
                        {t.descricaoUsuario}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-xs">
                    {t.modulos.length === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      t.modulos.map((m, i) => (
                        <span key={`${m.modulo}-${m.submodulo ?? ""}-${i}`} className="block">
                          {m.modulo}
                          {m.submodulo ? <span className="text-text-muted"> › {m.submodulo}</span> : null}
                        </span>
                      ))
                    )}
                  </td>
                  <td className="py-2 text-xs">
                    {t.cobertaPelaTaxonomia ? (
                      <span className="text-success">Aplicada</span>
                    ) : (
                      <span className="text-warning">Não alcançada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>

      {semCobertura.length > 0 ? (
        <Bloco
          titulo="Consultas fora da permissão automática"
          descricao="Estas consultas estão marcadas com módulos que não existem no cadastro de telas do sistema, então a permissão automática não as alcança. Elas continuam disponíveis — use uma regra acima se precisar restringi-las."
        >
          <div className="rounded-md border border-warning-line bg-warning-soft px-4 py-3">
            <p className="text-sm text-warning">
              {semCobertura.length} de {dados.tools.length} consultas nesta situação.
            </p>
            <p className="mt-1 text-sm text-text">
              Para que a permissão automática passe a valer para elas, os módulos precisam ser
              ajustados para os nomes usados no cadastro de telas. Fale com o suporte Natcorp.
            </p>
          </div>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {semCobertura.map((t) => (
              <li key={t.key} className="text-sm">
                <span className="font-medium">{t.nome}</span>
                <span className="text-text-muted">
                  {" "}
                  — {t.modulos.map((m) => m.modulo).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      ) : null}
    </ShellGestao>
  );
}
