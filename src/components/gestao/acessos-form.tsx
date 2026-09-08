"use client";

import { useMemo, useState, useTransition } from "react";
import { salvarRegraAcesso, removerRegraAcesso } from "@/app/gestao/actions";
import { nomeDoPainel, fmtDataHora } from "@/lib/gestao/formato";
import type { DadosAcessos, RegraListada } from "@/lib/gestao/acessos-dados";

type Sessao = { key: string; kbt: string };

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
 * "[bloquear] para [o perfil X] no [painel do gestor] o [módulo SESMT]".
 * Formulário que pede as coisas fora dessa ordem obriga a pessoa a traduzir.
 */
export function RegrasDeAcesso({ sessao, dados }: { sessao: Sessao; dados: DadosAcessos }) {
  const [efeito, setEfeito] = useState<"negar" | "permitir">("negar");
  const [alvoTipo, setAlvoTipo] = useState<"base" | "perfil" | "usuario">("perfil");
  const [alvo, setAlvo] = useState("");
  const [painel, setPainel] = useState("*");
  const [escopoTipo, setEscopoTipo] = useState<"modulo" | "submodulo" | "tool">("modulo");
  const [modulo, setModulo] = useState("");
  const [submodulo, setSubmodulo] = useState("");
  const [toolKey, setToolKey] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const submodulos = useMemo(
    () => dados.taxonomia.find((t) => t.modulo === modulo)?.submodulos ?? [],
    [dados.taxonomia, modulo],
  );

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarRegraAcesso({
        ...sessao,
        efeito,
        alvo_tipo: alvoTipo,
        alvo: alvoTipo === "base" ? null : alvo,
        painel: painel === "*" ? null : painel,
        escopo_tipo: escopoTipo,
        tool_key: escopoTipo === "tool" ? toolKey : null,
        modulo: escopoTipo === "tool" ? null : modulo,
        submodulo: escopoTipo === "submodulo" ? submodulo : null,
      });
      if (r.ok) {
        setAlvo("");
        setSubmodulo("");
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
      <div className="grid gap-3 lg:grid-cols-6 lg:items-end">
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
            <option value="perfil">Um perfil</option>
            <option value="usuario">Um usuário</option>
            <option value="base">Todos</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="r-alvo">
            {alvoTipo === "base" ? "—" : alvoTipo === "perfil" ? "Perfil" : "Usuário"}
          </label>
          <input
            id="r-alvo"
            className={campo}
            value={alvo}
            disabled={alvoTipo === "base"}
            onChange={(e) => setAlvo(e.target.value)}
            placeholder={alvoTipo === "perfil" ? "Ex.: GESTOR_FINANCEIRO" : "Ex.: ADIAS"}
          />
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
            <option value="modulo">Um módulo</option>
            <option value="submodulo">Um submódulo</option>
            <option value="tool">Uma consulta</option>
          </select>
        </div>

        <button type="button" className={primario} onClick={salvar} disabled={pendente}>
          {pendente ? "Salvando…" : "Adicionar regra"}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {escopoTipo === "tool" ? (
          <div className="lg:col-span-2">
            <label className={rotulo} htmlFor="r-tool">Consulta</label>
            <select id="r-tool" className={campo} value={toolKey} onChange={(e) => setToolKey(e.target.value)}>
              <option value="">Selecione…</option>
              {dados.tools.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className={rotulo} htmlFor="r-modulo">Módulo</label>
              <select
                id="r-modulo"
                className={campo}
                value={modulo}
                onChange={(e) => {
                  setModulo(e.target.value);
                  setSubmodulo("");
                }}
              >
                <option value="">Selecione…</option>
                {dados.taxonomia.map((t) => (
                  <option key={t.modulo} value={t.modulo}>
                    {t.modulo}
                  </option>
                ))}
              </select>
            </div>
            {escopoTipo === "submodulo" ? (
              <div>
                <label className={rotulo} htmlFor="r-submodulo">Submódulo</label>
                <select
                  id="r-submodulo"
                  className={campo}
                  value={submodulo}
                  onChange={(e) => setSubmodulo(e.target.value)}
                  disabled={!modulo}
                >
                  <option value="">Selecione…</option>
                  {submodulos.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
        )}
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}

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
