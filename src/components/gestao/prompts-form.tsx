"use client";

import { useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  salvarPromptSugerido,
  excluirPromptSugerido,
  salvarCategoriaPrompt,
  excluirCategoriaPrompt,
} from "@/app/gestao/prompts/actions";
import { resumoElegibilidade, avisoDeAlcance } from "@/lib/prompts/elegibilidade";
import { Segmented } from "@/components/ui/segmented";
import { MultiSelecao } from "./multi-selecao";

type Sessao = Record<string, string>;

type PromptAdmin = {
  id: string;
  label: string;
  texto: string;
  bases: string[];
  portais: string[];
  perfis: string[];
  empresas: string[];
  usuarios: string[];
  matriculas: string[];
  ativo: boolean;
  ordem: number;
  global: boolean;
  categoriaIds: string[];
};

type Categoria = { id: string; nome: string; ordem: number; ativo: boolean; global: boolean };

type Vocabulario = {
  portais: { id: string; nome: string }[];
  perfis: string[];
  empresas: string[];
  bases: { code: string; nome: string }[];
};

const campo =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring";
const rotulo = "mb-1 block text-xs font-medium text-text-muted";

type Escopo = "base" | "global";

const VAZIO: PromptAdmin = {
  id: "",
  label: "",
  texto: "",
  bases: [],
  portais: [],
  perfis: [],
  empresas: [],
  usuarios: [],
  matriculas: [],
  ativo: true,
  ordem: 0,
  global: false,
  categoriaIds: [],
};

/**
 * Rótulos únicos para um par código/nome.
 *
 * Dois clientes podem se chamar "Transportes" — se o seletor mostrasse só o
 * nome, marcar um marcaria o outro, e a tela não teria como mostrar o engano.
 * Quando há repetição, TODOS ganham o código entre parênteses: manter só o
 * repetido decorado faria a lista parecer inconsistente.
 */
function rotulosUnicos(itens: { code: string; nome: string }[]) {
  const contagem = new Map<string, number>();
  for (const i of itens) contagem.set(i.nome, (contagem.get(i.nome) ?? 0) + 1);
  const repetido = [...contagem.values()].some((n) => n > 1);
  const paraCode = new Map<string, string>();
  const paraRotulo = new Map<string, string>();
  for (const i of itens) {
    const r = repetido || !i.nome ? `${i.nome || i.code} (${i.code})` : i.nome;
    paraCode.set(r, i.code);
    paraRotulo.set(i.code, r);
  }
  return { rotulos: [...paraCode.keys()], paraCode, paraRotulo };
}

/**
 * Cadastro dos prompts prontos.
 *
 * ── A tela responde a UMA pergunta ────────────────────────────────────
 * "Quem vai ver isto?" — e ela é difícil justamente porque as seis listas se
 * combinam com E. Por isso a frase em português fica embaixo dos campos, viva,
 * e é a mesma regra que o SQL aplica. Sem ela, a conferência viraria abrir o
 * widget com o login de outra pessoa.
 *
 * ── Dois catálogos, um lugar ──────────────────────────────────────────
 * A aba "Da Natcorp" mostra o que já vem pronto para todos os clientes. O
 * cliente a VÊ (para não recadastrar o que já existe) e não a edita; o botão
 * de editar só existe no modo suporte, e o servidor recusa de novo — a UI
 * esconde, o servidor é quem nega.
 */
export function PromptsSugeridos({
  sessao,
  modo,
  baseNome,
  doCliente,
  daNatcorp,
  categoriasBase,
  categoriasGlobais,
  vocabBase,
  vocabGlobal,
}: {
  sessao: Sessao;
  modo: "cliente" | "suporte";
  baseNome: string;
  doCliente: PromptAdmin[];
  daNatcorp: PromptAdmin[];
  categoriasBase: Categoria[];
  categoriasGlobais: Categoria[];
  vocabBase: Vocabulario;
  vocabGlobal: Vocabulario;
}) {
  const [escopo, setEscopo] = useState<Escopo>("base");
  const [edicao, setEdicao] = useState<PromptAdmin | null>(null);
  const [gerindoCategorias, setGerindoCategorias] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const podeEditar = escopo === "base" || modo === "suporte";
  const lista = escopo === "base" ? doCliente : daNatcorp;
  const vocab = escopo === "base" ? vocabBase : vocabGlobal;

  // Um prompt do CLIENTE pode ser arquivado numa gaveta global — o servidor
  // aceita as duas —, então a lista de opções soma. No escopo global só há as
  // globais, senão um prompt de todos apontaria para a gaveta de um cliente.
  const categorias = useMemo(
    () => (escopo === "base" ? categoriasBase : categoriasGlobais.filter((c) => c.global)),
    [escopo, categoriasBase, categoriasGlobais],
  );
  const nomeDaCategoria = useMemo(
    () => new Map([...categoriasBase, ...categoriasGlobais].map((c) => [c.id, c.nome] as const)),
    [categoriasBase, categoriasGlobais],
  );
  // A allowlist guarda o CÓDIGO da base; o admin conhece o nome.
  const nomeDaBase = useMemo(() => {
    const m = new Map(vocabGlobal.bases.map((b) => [b.code, b.nome] as const));
    return (code: string) => m.get(code) ?? code;
  }, [vocabGlobal.bases]);

  function avisar(r: { ok: true } | { ok: false; erro: string }, sucesso: string) {
    if (r.ok) {
      setOk(sucesso);
      setErro(null);
    } else {
      setErro(r.erro);
      setOk(null);
    }
    return r.ok;
  }

  function excluir(p: PromptAdmin) {
    iniciar(async () => {
      const r = await excluirPromptSugerido({ ...sessao, escopo, id: p.id });
      if (avisar(r, "Prompt excluído.") && edicao?.id === p.id) setEdicao(null);
    });
  }

  function alternarAtivo(p: PromptAdmin) {
    iniciar(async () => {
      const r = await salvarPromptSugerido({
        ...sessao,
        escopo,
        id: p.id,
        label: p.label,
        texto: p.texto,
        bases: p.bases,
        portais: p.portais,
        perfis: p.perfis,
        empresas: p.empresas,
        usuarios: p.usuarios,
        matriculas: p.matriculas,
        categoriaIds: p.categoriaIds,
        ordem: p.ordem,
        ativo: !p.ativo,
      });
      avisar(r, p.ativo ? "Prompt desativado." : "Prompt ativado.");
    });
  }

  return (
    <div className="space-y-5">
      {/* Escopo: de quem é o catálogo que estou vendo. */}
      <Segmented
        value={escopo}
        onChange={(v) => {
          setEscopo(v);
          setEdicao(null);
          setGerindoCategorias(false);
        }}
        options={[
          { value: "base" as Escopo, label: `De ${baseNome} · ${doCliente.length}` },
          { value: "global" as Escopo, label: `Da Natcorp · ${daNatcorp.length}` },
        ]}
        className="w-fit"
      />

      {escopo === "global" ? (
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
          {podeEditar
            ? "Estes prompts valem para TODOS os clientes — a menos que você restrinja a base. Uma alteração aqui aparece em todas as bases liberadas."
            : "Estes prompts são mantidos pela Natcorp. Eles já aparecem para os seus usuários — não é preciso cadastrá-los de novo."}
        </p>
      ) : null}

      {erro ? (
        <p
          role="alert"
          className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {erro}
        </p>
      ) : null}
      {ok ? (
        <p
          role="status"
          className="rounded-md border border-success-line bg-success-soft px-3 py-2 text-sm text-success"
        >
          {ok}
        </p>
      ) : null}

      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setEdicao({ ...VAZIO })} disabled={pendente}>
            Novo prompt
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setGerindoCategorias((v) => !v)}
            aria-expanded={gerindoCategorias}
          >
            Categorias ({categorias.length})
          </Button>
        </div>
      ) : null}

      {gerindoCategorias && podeEditar ? (
        <GerenciarCategorias
          sessao={sessao}
          escopo={escopo}
          categorias={categorias.filter((c) => (escopo === "base" ? !c.global : true))}
          globaisHerdadas={escopo === "base" ? categoriasGlobais.filter((c) => c.global) : []}
          onErro={setErro}
          onOk={setOk}
        />
      ) : null}

      {edicao && podeEditar ? (
        <FormularioPrompt
          key={edicao.id || "novo"}
          sessao={sessao}
          escopo={escopo}
          inicial={edicao}
          categorias={categorias}
          vocab={vocab}
          onFechar={() => setEdicao(null)}
          onErro={setErro}
          onOk={setOk}
        />
      ) : null}

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum prompt pronto aqui"
          description={
            podeEditar
              ? "Cadastre a primeira pergunta pronta. Ela aparece no assistente, no mesmo lugar onde o usuário salva as dele."
              : "A Natcorp ainda não publicou prompts prontos."
          }
        />
      ) : (
        <ul className="space-y-2">
          {lista.map((p) => (
            <li
              key={p.id}
              className={[
                "rounded-lg border border-border bg-surface p-3",
                p.ativo ? "" : "opacity-60",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">
                    {p.label}
                    {p.ativo ? null : (
                      <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-text-muted">
                        desativado
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">{p.texto}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {resumoElegibilidade(p, nomeDaBase)}
                  </p>
                  {p.categoriaIds.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1">
                      {p.categoriaIds.map((id) => (
                        <li
                          key={id}
                          className="rounded bg-brand-purple-100 px-1.5 py-0.5 text-2xs font-medium text-brand-purple-800"
                        >
                          {nomeDaCategoria.get(id) ?? "categoria removida"}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-2xs text-text-muted">Aparece em “Geral”.</p>
                  )}
                </div>
                {podeEditar ? (
                  <div className="flex flex-none gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEdicao(p)}
                      disabled={pendente}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => alternarAtivo(p)}
                      disabled={pendente}
                    >
                      {p.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => excluir(p)}
                      disabled={pendente}
                    >
                      Excluir
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Formulário de um prompt. Os campos seguem a frase que o admin tem na cabeça. */
function FormularioPrompt({
  sessao,
  escopo,
  inicial,
  categorias,
  vocab,
  onFechar,
  onErro,
  onOk,
}: {
  sessao: Sessao;
  escopo: Escopo;
  inicial: PromptAdmin;
  categorias: Categoria[];
  vocab: Vocabulario;
  onFechar: () => void;
  onErro: (s: string | null) => void;
  onOk: (s: string | null) => void;
}) {
  const bases = useMemo(() => rotulosUnicos(vocab.bases), [vocab.bases]);
  const portais = useMemo(
    () => rotulosUnicos(vocab.portais.map((p) => ({ code: p.id, nome: p.nome }))),
    [vocab.portais],
  );

  const [label, setLabel] = useState(inicial.label);
  const [texto, setTexto] = useState(inicial.texto);
  const [basesSel, setBasesSel] = useState<string[]>(
    inicial.bases.map((c) => bases.paraRotulo.get(c) ?? c),
  );
  const [portaisSel, setPortaisSel] = useState<string[]>(
    inicial.portais.map((c) => portais.paraRotulo.get(c) ?? c),
  );
  const [perfisSel, setPerfisSel] = useState<string[]>(inicial.perfis);
  const [empresasSel, setEmpresasSel] = useState<string[]>(inicial.empresas);
  const [usuariosTxt, setUsuariosTxt] = useState(inicial.usuarios.join(", "));
  const [matriculasTxt, setMatriculasTxt] = useState(inicial.matriculas.join(", "));
  const [cats, setCats] = useState<string[]>(inicial.categoriaIds);
  const [ordem, setOrdem] = useState(String(inicial.ordem ?? 0));
  const [pendente, iniciar] = useTransition();

  const separar = (s: string) =>
    s
      .split(/[,;\n]/)
      .map((u) => u.trim())
      .filter(Boolean);

  const eleg = useMemo(
    () => ({
      bases: basesSel.map((r) => bases.paraCode.get(r) ?? r),
      portais: portaisSel.map((r) => portais.paraCode.get(r) ?? r),
      perfis: perfisSel,
      empresas: empresasSel,
      usuarios: separar(usuariosTxt),
      matriculas: separar(matriculasTxt),
    }),
    [basesSel, portaisSel, perfisSel, empresasSel, usuariosTxt, matriculasTxt, bases, portais],
  );

  // Só avisa quando HÁ vocabulário: numa base sem conversa nenhuma, todo valor
  // seria "desconhecido" e o aviso viraria ruído garantido.
  const aviso =
    vocab.perfis.length || vocab.empresas.length
      ? avisoDeAlcance(eleg, { perfis: vocab.perfis, empresas: vocab.empresas })
      : null;

  const nomeDaBase = useMemo(() => {
    const m = new Map(vocab.bases.map((b) => [b.code, b.nome] as const));
    return (code: string) => m.get(code) ?? code;
  }, [vocab.bases]);

  function salvar() {
    onErro(null);
    onOk(null);
    iniciar(async () => {
      const r = await salvarPromptSugerido({
        ...sessao,
        escopo,
        id: inicial.id || null,
        label: label.trim(),
        texto: texto.trim(),
        ...eleg,
        categoriaIds: cats,
        ordem: Number(ordem) || 0,
        ativo: inicial.ativo,
      });
      if (r.ok) {
        onOk(inicial.id ? "Prompt atualizado." : "Prompt criado.");
        onFechar();
      } else {
        onErro(r.erro);
      }
    });
  }

  const valido = label.trim().length > 0 && texto.trim().length > 0;

  return (
    <div className="rounded-lg border border-border-strong bg-surface-2 p-4">
      <h3 className="mb-3 text-sm font-semibold">
        {inicial.id ? "Editar prompt" : "Novo prompt"}
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={rotulo} htmlFor="p-label">
            Título — é o que a pessoa lê na lista
          </label>
          <input
            id="p-label"
            className={campo}
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Dados do centro de custo"
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="p-ordem">
            Ordem na lista (menor aparece antes)
          </label>
          <input
            id="p-ordem"
            type="number"
            className={campo}
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className={rotulo} htmlFor="p-texto">
          Pergunta — vai para o campo de mensagem exatamente assim
        </label>
        <textarea
          id="p-texto"
          className={`${campo} min-h-24`}
          value={texto}
          maxLength={8000}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: Me retorne os dados deste centro de custo, com o total de colaboradores e o custo mensal."
        />
      </div>

      {/*
        Seis dimensões em dois grupos, não em seis campos soltos: ONDE a pessoa
        está (cliente, tela, empresa) e QUEM ela é (perfil, login, matrícula).
        É como o filtro é pensado, e separar assim evita a lista de seis caixas
        idênticas em que ninguém acha o que quer.
      */}
      <fieldset className="mt-4 rounded-md border border-border bg-surface p-3">
        <legend className="px-1 text-xs font-semibold text-text">Onde o prompt aparece</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {escopo === "global" ? (
            <MultiSelecao
              id="p-bases"
              rotulo="Clientes (bases)"
              opcoes={bases.rotulos}
              valor={basesSel}
              onChange={setBasesSel}
              vazio="Nenhuma base ativa."
            />
          ) : (
            <p className="text-xs text-text-muted sm:col-span-1">
              Este prompt é só desta base — não há o que escolher aqui.
            </p>
          )}
          <MultiSelecao
            id="p-portais"
            rotulo="Portais"
            opcoes={portais.rotulos}
            valor={portaisSel}
            onChange={setPortaisSel}
            vazio="Nenhum portal."
          />
          <MultiSelecao
            id="p-empresas"
            rotulo="Empresas (código)"
            opcoes={vocab.empresas}
            valor={empresasSel}
            onChange={setEmpresasSel}
            vazio="Nenhuma empresa vista nas conversas ainda."
          />
        </div>
      </fieldset>

      <fieldset className="mt-3 rounded-md border border-border bg-surface p-3">
        <legend className="px-1 text-xs font-semibold text-text">Para quem</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <MultiSelecao
            id="p-perfis"
            rotulo="Perfis"
            opcoes={vocab.perfis}
            valor={perfisSel}
            onChange={setPerfisSel}
            vazio="Nenhum perfil visto nas conversas ainda."
          />
          <div className="min-w-0">
            <label className={rotulo} htmlFor="p-usuarios">
              Usuários (logins, separados por vírgula)
            </label>
            <textarea
              id="p-usuarios"
              className={`${campo} min-h-20`}
              value={usuariosTxt}
              onChange={(e) => setUsuariosTxt(e.target.value)}
              placeholder="ana.silva, joao.souza"
            />
          </div>
          <div className="min-w-0">
            <label className={rotulo} htmlFor="p-matriculas">
              Matrículas (separadas por vírgula)
            </label>
            <textarea
              id="p-matriculas"
              className={`${campo} min-h-20`}
              value={matriculasTxt}
              onChange={(e) => setMatriculasTxt(e.target.value)}
              placeholder="1024, 1187"
            />
          </div>
        </div>
      </fieldset>

      {/*
        A FRASE. Deixar tudo em branco é o caso comum e significa "todo mundo" —
        escrito assim, e não deduzido de seis campos vazios.
      */}
      <p className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text">
        {resumoElegibilidade(eleg, nomeDaBase)}
      </p>
      {aviso ? <p className="mt-2 text-xs text-warning">{aviso}</p> : null}

      {categorias.length ? (
        <fieldset className="mt-4">
          <legend className={rotulo}>Categorias (o prompt pode estar em várias)</legend>
          <ul className="flex flex-wrap gap-2">
            {categorias.map((c) => {
              const marcada = cats.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={marcada}
                    onClick={() =>
                      setCats(marcada ? cats.filter((x) => x !== c.id) : [...cats, c.id])
                    }
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      marcada
                        ? "border-primary bg-brand-purple-100 text-brand-purple-800"
                        : "border-border bg-surface text-text-muted hover:text-text",
                    ].join(" ")}
                  >
                    {c.nome}
                    {c.global ? <span className="ml-1 opacity-60">(Natcorp)</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {cats.length === 0 ? (
            <p className="mt-2 text-xs text-text-muted">
              Sem categoria, o prompt aparece em “Geral”.
            </p>
          ) : null}
        </fieldset>
      ) : (
        <p className="mt-4 text-xs text-text-muted">
          Nenhuma categoria criada — o prompt vai aparecer em “Geral”.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={salvar} disabled={!valido || pendente}>
          {pendente ? "Salvando…" : inicial.id ? "Atualizar" : "Criar"}
        </Button>
        <Button type="button" variant="ghost" onClick={onFechar} disabled={pendente}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Gavetas. Curto de propósito: nome e pronto. */
function GerenciarCategorias({
  sessao,
  escopo,
  categorias,
  globaisHerdadas,
  onErro,
  onOk,
}: {
  sessao: Sessao;
  escopo: Escopo;
  categorias: Categoria[];
  globaisHerdadas: Categoria[];
  onErro: (s: string | null) => void;
  onOk: (s: string | null) => void;
}) {
  const [nome, setNome] = useState("");
  const [pendente, iniciar] = useTransition();

  function criar() {
    const n = nome.trim();
    if (!n) return;
    onErro(null);
    iniciar(async () => {
      const r = await salvarCategoriaPrompt({ ...sessao, escopo, nome: n });
      if (r.ok) {
        setNome("");
        onOk("Categoria criada.");
      } else {
        onErro(r.erro);
      }
    });
  }

  function remover(c: Categoria) {
    onErro(null);
    iniciar(async () => {
      const r = await excluirCategoriaPrompt({ ...sessao, escopo, id: c.id });
      if (r.ok) onOk(`Categoria “${c.nome}” removida. Os prompts dela voltaram para “Geral”.`);
      else onErro(r.erro);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label className={rotulo} htmlFor="c-nome">
            Nova categoria
          </label>
          <input
            id="c-nome"
            className={campo}
            value={nome}
            maxLength={60}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                criar();
              }
            }}
            placeholder="Ex.: Férias"
          />
        </div>
        <Button type="button" onClick={criar} disabled={!nome.trim() || pendente}>
          Criar
        </Button>
      </div>

      {categorias.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {categorias.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs"
            >
              <span>{c.nome}</span>
              {/* `Button` e não botão cru: herda foco visível, estado
                  desabilitado e anel de foco sem repintar nada à mão. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remover(c)}
                disabled={pendente}
                aria-label={`Remover categoria ${c.nome}`}
                className="h-auto px-1 py-0 text-text-muted hover:text-danger"
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-muted">
          Nenhuma categoria própria. Prompts sem categoria aparecem em “Geral”.
        </p>
      )}

      {globaisHerdadas.length ? (
        <p className="mt-3 text-xs text-text-muted">
          Você também pode usar as categorias da Natcorp:{" "}
          <span className="text-text">{globaisHerdadas.map((c) => c.nome).join(", ")}</span>.
        </p>
      ) : null}
    </div>
  );
}
