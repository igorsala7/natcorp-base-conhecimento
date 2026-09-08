"use client";

import { useMemo, useState, useTransition } from "react";
import { salvarRegraAcesso, removerRegraAcesso } from "@/app/gestao/actions";
import { nomeDoPainel, fmtDataHora } from "@/lib/gestao/formato";
import { MultiSelecao } from "./multi-selecao";
import type { DadosAcessos, RegraListada } from "@/lib/gestao/acessos-dados";

/**
 * Parâmetros que reabrem a MESMA sessão na Server Action — vindos de
 * `paramsDaSessao`. Genérico de propósito: no modo cliente são `key` + `kbt`,
 * no suporte são `suporte` + `base`, e o formulário não precisa saber qual é.
 */
type Sessao = Record<string, string>;

const botao =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-ui font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60";
const primario = `${botao} bg-primary text-primary-fg hover:bg-primary-hover`;
const campo =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring";
const rotulo = "mb-1 block text-xs font-medium text-text-muted";

/**
 * Cadastro de regras de acesso.
 *
 * A ordem dos campos segue a frase que o usuário tem na cabeça:
 * "[bloquear] para [os perfis X e Y] no [painel do gestor] os [módulos SESMT e
 * Avaliações]". Perfis e módulos aceitam VÁRIOS de uma vez — uma regra por
 * combinação é gerada no servidor, então remover um perfil depois é apagar uma
 * linha, não editar um conjunto.
 */
export function RegrasDeAcesso({ sessao, dados }: { sessao: Sessao; dados: DadosAcessos }) {
  const [efeito, setEfeito] = useState<"negar" | "permitir">("negar");
  const [alvoTipo, setAlvoTipo] = useState<"base" | "perfil" | "usuario">("perfil");
  const [perfis, setPerfis] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState("");
  const [painel, setPainel] = useState("*");
  const [escopoTipo, setEscopoTipo] = useState<"modulo" | "submodulo" | "tool">("modulo");
  const [modulos, setModulos] = useState<string[]>([]);
  const [submodulo, setSubmodulo] = useState("");
  const [toolKeys, setToolKeys] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const submodulos = useMemo(
    () => (modulos.length === 1 ? (dados.taxonomia.find((t) => t.modulo === modulos[0])?.submodulos ?? []) : []),
    [dados.taxonomia, modulos],
  );

  // Nomes das consultas para o seletor, e as protegidas que não podem ser
  // bloqueadas — desabilitadas na lista quando o efeito é "bloquear".
  const nomePorKey = useMemo(
    () => new Map(dados.tools.map((t) => [t.nome, t.key] as const)),
    [dados.tools],
  );
  const nomesDasTools = useMemo(() => dados.tools.map((t) => t.nome), [dados.tools]);
  const protegidasPorNome = useMemo(
    () => new Set(dados.tools.filter((t) => t.protegida).map((t) => t.nome)),
    [dados.tools],
  );

  const listaDeUsuarios = useMemo(
    () => usuarios.split(/[,;\n]/).map((u) => u.trim()).filter(Boolean),
    [usuarios],
  );

  function salvar() {
    setErro(null);
    setOk(null);
    iniciar(async () => {
      const r = await salvarRegraAcesso({
        ...sessao,
        efeito,
        alvo_tipo: alvoTipo,
        alvos: alvoTipo === "perfil" ? perfis : alvoTipo === "usuario" ? listaDeUsuarios : [],
        painel: painel === "*" ? null : painel,
        escopo_tipo: escopoTipo,
        tool_keys: escopoTipo === "tool" ? toolKeys.map((n) => nomePorKey.get(n) ?? n) : [],
        modulos: escopoTipo === "tool" ? [] : modulos,
        submodulo: escopoTipo === "submodulo" ? submodulo : null,
      });
      if (r.ok) {
        setOk("Regra(s) salva(s).");
        setPerfis([]);
        setUsuarios("");
        setModulos([]);
        setSubmodulo("");
        setToolKeys([]);
      } else {
        setErro(r.erro);
      }
    });
  }

  function remover(id: string) {
    iniciar(async () => {
      const r = await removerRegraAcesso({ ...sessao, id });
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={rotulo} htmlFor="r-efeito">Ação</label>
          <select
            id="r-efeito"
            className={campo}
            value={efeito}
            onChange={(e) => setEfeito(e.target.value as typeof efeito)}
          >
            <option value="negar">Bloquear</option>
            <option value="permitir">Liberar</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="r-alvo-tipo">Para</label>
          <select
            id="r-alvo-tipo"
            className={campo}
            value={alvoTipo}
            onChange={(e) => setAlvoTipo(e.target.value as typeof alvoTipo)}
          >
            <option value="perfil">Perfis</option>
            <option value="usuario">Usuários</option>
            <option value="base">Todos</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="r-painel">No painel</label>
          <select id="r-painel" className={campo} value={painel} onChange={(e) => setPainel(e.target.value)}>
            <option value="*">Todos</option>
            <option value="PO">Operador</option>
            <option value="PG">Gestor</option>
            <option value="PC">Colaborador</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="r-escopo">O quê</label>
          <select
            id="r-escopo"
            className={campo}
            value={escopoTipo}
            onChange={(e) => setEscopoTipo(e.target.value as typeof escopoTipo)}
          >
            <option value="modulo">Módulos</option>
            <option value="submodulo">Um submódulo</option>
            <option value="tool">Consultas</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {alvoTipo === "perfil" ? (
          <MultiSelecao
            id="r-perfis"
            rotulo="Perfis"
            opcoes={dados.perfis}
            valor={perfis}
            onChange={setPerfis}
            placeholder="Buscar perfil…"
            vazio="Nenhum perfil disponível. Verifique a API de perfis deste cliente."
          />
        ) : alvoTipo === "usuario" ? (
          <div>
            <label className={rotulo} htmlFor="r-usuarios">
              Usuários
            </label>
            <textarea
              id="r-usuarios"
              className={`${campo} min-h-[7rem]`}
              value={usuarios}
              onChange={(e) => setUsuarios(e.target.value)}
              placeholder="Um por linha, ou separados por vírgula. Ex.: ADIAS, FGOMES"
            />
            {listaDeUsuarios.length > 0 ? (
              <p className="mt-1 text-xs text-text-muted">
                {listaDeUsuarios.length} usuário(s): {listaDeUsuarios.join(", ")}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="self-start rounded-md border border-dashed border-border px-4 py-6 text-sm text-text-muted">
            A regra vale para todos os usuários deste cliente.
          </p>
        )}

        {escopoTipo === "tool" ? (
          <MultiSelecao
            id="r-tools"
            rotulo="Consultas"
            opcoes={nomesDasTools}
            valor={toolKeys}
            onChange={setToolKeys}
            placeholder="Buscar consulta…"
            desabilitadas={efeito === "negar" ? protegidasPorNome : undefined}
            dicaDesabilitada="Esta consulta é usada por outras para traduzir códigos em nomes e não pode ser bloqueada."
          />
        ) : (
          <div className="space-y-3">
            <MultiSelecao
              id="r-modulos"
              rotulo={escopoTipo === "submodulo" ? "Módulo (escolha um)" : "Módulos"}
              opcoes={dados.taxonomia.map((t) => t.modulo)}
              valor={modulos}
              onChange={(v) => {
                setModulos(escopoTipo === "submodulo" ? v.slice(-1) : v);
                setSubmodulo("");
              }}
              placeholder="Buscar módulo…"
              vazio="Nenhum módulo sincronizado para este cliente."
            />
            {escopoTipo === "submodulo" ? (
              <div>
                <label className={rotulo} htmlFor="r-submodulo">Submódulo</label>
                <select
                  id="r-submodulo"
                  className={campo}
                  value={submodulo}
                  onChange={(e) => setSubmodulo(e.target.value)}
                  disabled={modulos.length !== 1}
                >
                  <option value="">
                    {modulos.length === 1 ? "Selecione…" : "Escolha um módulo primeiro"}
                  </option>
                  {submodulos.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primario} onClick={salvar} disabled={pendente}>
          {pendente ? "Salvando…" : "Adicionar regra"}
        </button>
        {erro ? (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        ) : null}
        {ok ? <p className="text-sm text-success">{ok}</p> : null}
      </div>

      <ListaDeRegras regras={dados.regras} pendente={pendente} onRemover={remover} />
    </div>
  );
}

function ListaDeRegras({
  regras,
  pendente,
  onRemover,
}: {
  regras: RegraListada[];
  pendente: boolean;
  onRemover: (id: string) => void;
}) {
  if (regras.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
        Nenhuma regra cadastrada. O acesso segue apenas as permissões que cada usuário já tem no
        sistema.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Regras de acesso cadastradas</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="py-2 pr-2 font-medium">Ação</th>
            <th scope="col" className="py-2 pr-2 font-medium">Para</th>
            <th scope="col" className="py-2 pr-2 font-medium">Painel</th>
            <th scope="col" className="py-2 pr-2 font-medium">Escopo</th>
            <th scope="col" className="py-2 pr-2 font-medium">Criada</th>
            <th scope="col" className="py-2 font-medium"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {regras.map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-2">
                <span
                  className={
                    r.efeito === "negar"
                      ? "rounded bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger"
                      : "rounded bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
                  }
                >
                  {r.efeito === "negar" ? "Bloqueia" : "Libera"}
                </span>
              </td>
              <td className="py-2 pr-2">
                {r.alvo_tipo === "base" ? (
                  "Todos"
                ) : (
                  <>
                    <span className="text-text-muted">
                      {r.alvo_tipo === "perfil" ? "Perfil " : "Usuário "}
                    </span>
                    <span className="font-medium">{r.alvo}</span>
                  </>
                )}
              </td>
              <td className="py-2 pr-2">{nomeDoPainel(r.painel)}</td>
              <td className="py-2 pr-2">
                {r.escopo_tipo === "tool" ? (
                  <span className="font-mono text-xs">{r.tool_key}</span>
                ) : (
                  <>
                    {r.modulo}
                    {r.submodulo ? (
                      <span className="text-text-muted"> › {r.submodulo}</span>
                    ) : null}
                  </>
                )}
              </td>
              <td className="py-2 pr-2 text-xs text-text-muted">
                {fmtDataHora(r.criado_em)}
                {r.criado_por ? ` · ${r.criado_por}` : ""}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onRemover(r.id)}
                  disabled={pendente}
                >
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
