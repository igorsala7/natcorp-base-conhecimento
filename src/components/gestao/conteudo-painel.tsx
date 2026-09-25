"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, Eye, EyeOff, Info, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { avisoDeAlcance, resumoElegibilidade, type Dimensao, type Regra } from "@/lib/elegibilidade";
import {
  DIMENSOES_DA_TELA,
  GRUPOS,
  dimensaoUI,
  dimensoesDoGrupo,
  formularioParaRegra,
  regraParaFormulario,
  regraSemCliente,
  type ListaDeValores,
} from "@/lib/documentacoes/dimensoes-ui";
import { LinhaDimensao, type OpcaoDeCadastro } from "@/lib/documentacoes/dimensao-editor";
import {
  salvarAjusteDeDocumentacao,
  valoresParaDimensao,
  voltarAoPadraoDeDocumentacao,
} from "@/app/gestao/conteudo/actions";

/**
 * O QUE O ASSISTENTE SABE NESTA EMPRESA, e quem alcança cada assunto.
 *
 * ── Três estados por documentação, e nenhum é "ligado/desligado" ──────────
 * A lista mostra o que a Natcorp disponibiliza. Sobre cada item, a empresa pode
 * sobrepor uma decisão própria:
 *
 *   · padrão    → vale como a Natcorp definiu. É o estado de quem nunca mexeu;
 *   · ajustada  → a empresa escolheu quem alcança, no lugar do padrão;
 *   · oculta    → a documentação desaparece para os usuários da empresa.
 *
 * "Voltar ao padrão" não é o mesmo que "mostrar com regra vazia": o primeiro
 * devolve a decisão à Natcorp, o segundo grava "todos nesta empresa" por cima
 * dela — e a regra da Natcorp pode ser mais estreita. Os dois existem, com nomes
 * diferentes, porque a diferença é visível para quem configura.
 *
 * ── O que esta tela precisa acertar, e por que é difícil ──────────────────
 * Restringir é uma INTERSEÇÃO: marcar o portal do Gestor e o perfil FOLHA
 * alcança quem é as duas coisas, não quem é uma delas. Quem espera "gestores OU
 * pessoal da folha" só descobre quando alguém reclama de não ver o conteúdo, e
 * não há erro em lugar nenhum para investigar. Daí três decisões, as mesmas da
 * tela interna e pelos mesmos motivos:
 *
 *   · a FRASE ao vivo, em português, enquanto se edita. É a mesma regra que o
 *     banco aplica, escrita por extenso;
 *   · "sem restrição" é INTERRUPTOR, nunca campo em branco — campo em branco
 *     LIBERA para todo mundo, o contrário do que quem apagou o último valor
 *     queria;
 *   · o aviso de presença por restrição ligada: se esta empresa nunca enviou
 *     aquele dado, restringir por ali não alcança ninguém.
 *
 * ── E a consequência que o usuário NÃO vê no momento do clique ────────────
 * Ocultar uma documentação faz o assistente parar de responder sobre aquele
 * assunto para os usuários da empresa. Quem clica está pensando em organização,
 * não em capacidade — por isso o aviso aparece ANTES, nomeando o efeito, e o
 * clique vira duas etapas. Não bloqueia: a escolha é do cliente.
 */

export type ItemDeConteudo = {
  spaceId: string;
  nome: string;
  /** A regra que a Natcorp definiu, já sem a dimensão de cliente. */
  regraNatcorp: Regra;
  /** A sobreposição desta empresa, quando existe. */
  ajuste: { enabled: boolean; regra: Regra } | null;
};

type Presencas = {
  porDimensao: Partial<Record<Dimensao, { valor: string; conversas: number }[]>>;
  conversas: number;
};

type EmEdicao = {
  spaceId: string;
  restritas: Dimensao[];
  valores: Partial<Record<Dimensao, string[]>>;
};

/*
  A dimensão de CLIENTE não aparece nesta tela, e são duas razões:
  a configuração já é da empresa de quem está olhando (restringir por cliente
  aqui é redundante na melhor hipótese e não alcança ninguém na pior), e oferecer
  a lista significaria mostrar a um cliente os códigos dos outros. Ela continua
  no estado do formulário quando já vem gravada — ver `regraParaFormulario` —,
  então editar a regra nunca a descarta em silêncio, que transformaria uma regra
  que fecha numa que abre.
*/
const SEM_CLIENTE = (ui: { dimensao: Dimensao }) => ui.dimensao !== "base";
/* Constante de módulo: um `[]` novo a cada render invalidaria o `useMemo` de
   opções dentro da linha de dimensão. Fica vazia porque a única dimensão que a
   consome (cliente) não é desenhada aqui. */
const SEM_CADASTRO: OpcaoDeCadastro[] = [];

/**
 * A regra tem restrição de cliente que esta empresa NÃO satisfaz?
 *
 * Só a Natcorp consegue produzir isso (a tela do cliente não oferece a
 * dimensão), e o efeito é uma configuração que não alcança ninguém. Precisa
 * aparecer, porque o resto da tela diria que alcança; e precisa aparecer SEM o
 * código do outro cliente, que não é para ser lido aqui.
 */
function travadaEmOutroCliente(regra: Regra, baseCode: string): boolean {
  const lista = (regra.base ?? []).filter((b) => b && b.trim());
  if (lista.length === 0) return false;
  return !lista.some((b) => b.trim().toLowerCase() === baseCode.trim().toLowerCase());
}

export function ConteudoPainel({
  sessao,
  modo,
  baseCode,
  baseNome,
  itens,
  orfas,
  presencas,
}: {
  /** `key` + `kbt` (cliente) ou `suporte` + `base`. A ação revalida do zero. */
  sessao: Record<string, string>;
  modo: "cliente" | "suporte";
  baseCode: string;
  baseNome: string;
  itens: ItemDeConteudo[];
  /** Sobreposições que apontam para documentação fora da oferta atual. */
  orfas: string[];
  presencas: Presencas;
}) {
  const [editando, setEditando] = useState<EmEdicao | null>(null);
  const [confirmandoOcultar, setConfirmandoOcultar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const nomeDaBase = useMemo(() => {
    const meu = baseCode.trim().toLowerCase();
    return (code: string) => (code.trim().toLowerCase() === meu ? baseNome : code);
  }, [baseCode, baseNome]);

  function avisar(r: { ok: true } | { ok: false; erro: string }, sucesso: string) {
    if (r.ok) {
      setOk(sucesso);
      setErro(null);
      // `revalidatePath` na ação marca a rota como suja; é este `refresh` que
      // traz a lista nova para a tela. Sem ele, ocultar uma documentação mostra
      // a mensagem de sucesso e a etiqueta continua dizendo "Padrão" — e quem
      // lê clica de novo.
      router.refresh();
    } else {
      setErro(r.erro);
      setOk(null);
    }
    return r.ok;
  }

  function ocultar(item: ItemDeConteudo) {
    setConfirmandoOcultar(null);
    iniciar(async () => {
      // A regra atual é PRESERVADA ao ocultar: quem esconde por uma semana e
      // mostra de novo não deveria redigitar a escolha de quem alcança.
      const r = await salvarAjusteDeDocumentacao({
        ...sessao,
        spaceId: item.spaceId,
        enabled: false,
        regra: item.ajuste?.regra ?? {},
      });
      avisar(r, `“${item.nome}” está oculta para os seus usuários.`);
    });
  }

  function mostrar(item: ItemDeConteudo) {
    const tinhaRegra = Object.values(item.ajuste?.regra ?? {}).some((v) => (v ?? []).length > 0);
    iniciar(async () => {
      /*
        Duas saídas, e a escolha não é detalhe: sem regra própria guardada, mostrar
        de novo tem de APAGAR a sobreposição (voltar ao padrão da Natcorp). Gravar
        `enabled = true` com regra vazia diria "todos nesta empresa alcançam" por
        cima de um padrão que pode ser mais estreito — o usuário clicou em
        "mostrar de novo", não em "liberar para todo mundo".
      */
      const r = tinhaRegra
        ? await salvarAjusteDeDocumentacao({
            ...sessao,
            spaceId: item.spaceId,
            enabled: true,
            regra: item.ajuste?.regra ?? {},
          })
        : await voltarAoPadraoDeDocumentacao({ ...sessao, spaceId: item.spaceId });
      avisar(r, `“${item.nome}” voltou a aparecer para os seus usuários.`);
    });
  }

  function voltarAoPadrao(item: ItemDeConteudo) {
    iniciar(async () => {
      const r = await voltarAoPadraoDeDocumentacao({ ...sessao, spaceId: item.spaceId });
      if (avisar(r, `“${item.nome}” voltou a valer como a Natcorp definiu.`)) {
        if (editando?.spaceId === item.spaceId) setEditando(null);
      }
    });
  }

  function limparOrfas() {
    iniciar(async () => {
      // Uma por vez, e para na primeira que falhar: a mensagem do servidor é
      // mais útil que "removemos algumas".
      for (const spaceId of orfas) {
        const r = await voltarAoPadraoDeDocumentacao({ ...sessao, spaceId });
        if (!r.ok) {
          setErro(r.erro);
          setOk(null);
          return;
        }
      }
      setOk("Configurações antigas removidas.");
      setErro(null);
      router.refresh();
    });
  }

  if (itens.length === 0) {
    return (
      <div className="space-y-4">
        <Mensagens erro={erro} ok={ok} />
        <EmptyState
          icon={BookOpen}
          title="Nenhuma documentação disponível ainda"
          description="Quando a Natcorp disponibilizar documentação para a sua empresa, ela aparece aqui e você decide quem alcança cada assunto. Até então, o assistente responde com o que foi definido na instalação."
        />
        {orfas.length > 0 ? (
          <SobrasAntigas quantidade={orfas.length} pendente={pendente} onLimpar={limparOrfas} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Mensagens erro={erro} ok={ok} />

      <ul className="space-y-2">
        {itens.map((item) => {
          const oculta = !!item.ajuste && !item.ajuste.enabled;
          const ajustada = !!item.ajuste?.enabled;
          const regraEmVigor = ajustada ? item.ajuste!.regra : item.regraNatcorp;
          const editandoEste = editando?.spaceId === item.spaceId;

          return (
            <li
              key={item.spaceId}
              className={[
                "rounded-lg border bg-surface p-3",
                oculta ? "border-warning-line" : "border-border",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                    {item.nome}
                    <Etiqueta estado={oculta ? "oculta" : ajustada ? "ajustada" : "padrao"} />
                  </p>

                  {/*
                    A frase, não uma lista de etiquetas: restrição é interseção, e
                    isso se confere lendo. É a mesma função que o formulário mostra
                    ao vivo — se a linha e o formulário discordassem, a tela teria
                    duas descrições da mesma regra.
                  */}
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {oculta
                      ? "Ninguém da sua empresa alcança. O assistente não responde sobre este assunto para os seus usuários."
                      : resumoElegibilidade(regraSemCliente(regraEmVigor), nomeDaBase, "esta documentação")}
                  </p>
                  {ajustada && !oculta ? (
                    <p className="mt-1 text-2xs text-text-muted">
                      Sua escolha, no lugar do que a Natcorp definiu.
                    </p>
                  ) : null}

                  {travadaEmOutroCliente(item.ajuste?.regra ?? {}, baseCode) ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Esta configuração tem uma restrição feita pela Natcorp que impede o alcance
                        na sua empresa. Volte ao padrão ou fale com o suporte.
                      </span>
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-none flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setErro(null);
                      setOk(null);
                      setEditando(
                        editandoEste
                          ? null
                          : { spaceId: item.spaceId, ...regraParaFormulario(regraEmVigor) },
                      );
                    }}
                    disabled={pendente}
                    aria-expanded={editandoEste}
                  >
                    <Users aria-hidden="true" />
                    Quem alcança
                  </Button>

                  {oculta ? (
                    <Button type="button" variant="ghost" onClick={() => mostrar(item)} disabled={pendente}>
                      <Eye aria-hidden="true" />
                      Mostrar de novo
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="warning"
                      onClick={() => {
                        setErro(null);
                        setOk(null);
                        setConfirmandoOcultar(item.spaceId);
                      }}
                      disabled={pendente}
                    >
                      <EyeOff aria-hidden="true" />
                      Ocultar
                    </Button>
                  )}

                  {item.ajuste ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => voltarAoPadrao(item)}
                      disabled={pendente}
                    >
                      <RotateCcw aria-hidden="true" />
                      Voltar ao padrão
                    </Button>
                  ) : null}
                </div>
              </div>

              {/*
                O AVISO ANTES DO EFEITO. Ocultar não parece grave para quem está
                organizando a tela; o que ele faz é o assistente emburrecer sobre
                um assunto, e isso não é visível no botão. Duas etapas, e a
                consequência escrita na primeira.
              */}
              {confirmandoOcultar === item.spaceId ? (
                <div className="mt-3 rounded-md border border-warning-line bg-warning-soft p-3">
                  <p className="text-xs leading-relaxed text-warning">
                    <strong>Ocultar “{item.nome}”?</strong> Os seus usuários deixam de alcançar esta
                    documentação, e o assistente passa a responder que não encontrou quando
                    perguntarem sobre esse assunto. Você pode mostrar de novo a qualquer momento.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="warning" onClick={() => ocultar(item)} disabled={pendente}>
                      Ocultar mesmo assim
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmandoOcultar(null)}
                      disabled={pendente}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}

              {editandoEste ? (
                <FormularioDeAlcance
                  key={item.spaceId}
                  sessao={sessao}
                  modo={modo}
                  baseCode={baseCode}
                  nomeDaBase={nomeDaBase}
                  item={item}
                  edicao={editando}
                  presencas={presencas}
                  onCancelar={() => setEditando(null)}
                  onSalvo={(msg) => {
                    setEditando(null);
                    setOk(msg);
                    setErro(null);
                    router.refresh();
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {orfas.length > 0 ? (
        <SobrasAntigas quantidade={orfas.length} pendente={pendente} onLimpar={limparOrfas} />
      ) : null}
    </div>
  );
}

// ── Peças de apoio ──────────────────────────────────────────────────────────

function Mensagens({ erro, ok }: { erro: string | null; ok: string | null }) {
  return (
    <>
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
    </>
  );
}

function Etiqueta({ estado }: { estado: "padrao" | "ajustada" | "oculta" }) {
  const texto = estado === "oculta" ? "Oculta" : estado === "ajustada" ? "Ajustada por você" : "Padrão";
  const cor =
    estado === "oculta"
      ? "border-warning-line bg-warning-soft text-warning"
      : estado === "ajustada"
        ? "border-brand-purple-200 bg-brand-purple-100 text-brand-purple-800"
        : "border-border bg-surface-2 text-text-muted";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-2xs font-medium ${cor}`}>{texto}</span>
  );
}

/** Sobra de configuração apontando para documentação fora da oferta atual. */
function SobrasAntigas({
  quantidade,
  pendente,
  onLimpar,
}: {
  quantidade: number;
  pendente: boolean;
  onLimpar: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {quantidade === 1
            ? "Uma configuração sua aponta para uma documentação que a Natcorp não disponibiliza mais."
            : `${quantidade} configurações suas apontam para documentações que a Natcorp não disponibiliza mais.`}{" "}
          Não tem efeito nenhum hoje e pode ser removida.
        </span>
      </p>
      <Button
        type="button"
        variant="secondary"
        className="mt-2"
        onClick={onLimpar}
        loading={pendente}
        loadingLabel="Removendo…"
      >
        Remover configurações antigas
      </Button>
    </div>
  );
}

// ── O formulário: quem, dentro da empresa, alcança esta documentação ────────

function FormularioDeAlcance({
  sessao,
  modo,
  baseCode,
  nomeDaBase,
  item,
  edicao,
  presencas,
  onCancelar,
  onSalvo,
}: {
  sessao: Record<string, string>;
  modo: "cliente" | "suporte";
  baseCode: string;
  nomeDaBase: (code: string) => string;
  item: ItemDeConteudo;
  edicao: EmEdicao;
  presencas: Presencas;
  onCancelar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const [restritas, setRestritas] = useState<Dimensao[]>(edicao.restritas);
  const [valores, setValores] = useState(edicao.valores);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  /**
   * Listas de valor por dimensão. A chave é só a dimensão, e não `base+dimensão`
   * como na tela interna: aqui a base é UMA — a da sessão —, então não existe a
   * troca de cliente que faria a lista de um valer para o outro.
   */
  const [listas, setListas] = useState<Partial<Record<Dimensao, ListaDeValores>>>({});
  /**
   * Requisições em voo, em `ref` e não em estado: o efeito depende de `listas`
   * (é o que faz a guarda "já tenho esta" funcionar), então roda de novo a cada
   * resposta, e sem a marca a segunda passada pediria a mesma lista. Estado não
   * serve — escrever estado no corpo do efeito é o que cascateia render, e o
   * esqueleto na tela já sai de `lista === undefined`.
   */
  const emVoo = useRef<Set<string>>(new Set());

  const regra = useMemo(() => formularioParaRegra({ restritas, valores }), [restritas, valores]);
  const frase = resumoElegibilidade(regraSemCliente(regra), nomeDaBase, "esta documentação");
  const aviso = useMemo(
    () =>
      avisoDeAlcance(regra, {
        perfis: (presencas.porDimensao.perfil ?? []).map((v) => v.valor),
        empresas: (presencas.porDimensao.empresa ?? []).map((v) => v.valor),
      }),
    [regra, presencas],
  );

  /** Restrições ligadas e ainda sem valor escolhido: estado inválido. */
  const emBranco = restritas.filter((d) => !(valores[d] ?? []).some((v) => v.trim()));

  /*
    Busca a lista do ERP só das restrições LIGADAS, e uma vez cada. Buscar todas
    ao abrir seriam seis consultas ao ERP — uma delas de milhares de linhas —
    numa tela em que o caso comum restringe uma ou duas coisas.
  */
  useEffect(() => {
    let vivo = true;
    for (const d of restritas) {
      if (dimensaoUI(d).origem.tipo !== "tool") continue;
      if (listas[d] !== undefined || emVoo.current.has(d)) continue;
      emVoo.current.add(d);
      void valoresParaDimensao({ ...sessao, dimensao: d }).then((r) => {
        emVoo.current.delete(d);
        if (vivo) setListas((prev) => ({ ...prev, [d]: r }));
      });
    }
    return () => {
      vivo = false;
    };
  }, [restritas, listas, sessao]);

  function alternar(d: Dimensao, restrita: boolean) {
    setErro(null);
    setRestritas((prev) => (restrita ? [...new Set([...prev, d])] : prev.filter((x) => x !== d)));
    // Desligar NÃO apaga os valores: quem alterna para conferir a frase e volta
    // atrás não deveria redigitar oito códigos. O que vai ao banco é
    // `formularioParaRegra`, que só olha o que está ligado.
  }

  function definirValores(d: Dimensao, lista: string[]) {
    setErro(null);
    setValores((prev) => ({ ...prev, [d]: lista }));
  }

  function salvar() {
    if (emBranco.length) {
      const nomes = emBranco.map((d) => DIMENSOES_DA_TELA.find((x) => x.dimensao === d)!.rotulo);
      return setErro(
        `${nomes.join(", ")}: você marcou "Restringir" e não escolheu nenhum valor. ` +
          `Salvar assim liberaria para todo mundo — o contrário do que você pediu. ` +
          `Escolha um valor ou volte para "Todos".`,
      );
    }
    setErro(null);
    iniciar(async () => {
      const r = await salvarAjusteDeDocumentacao({
        ...sessao,
        spaceId: item.spaceId,
        // Salvar quem alcança implica MOSTRAR: definir o alcance de uma
        // documentação oculta e ela continuar oculta seria configurar no vácuo.
        // O texto embaixo do botão avisa quando é este o caso.
        enabled: true,
        regra,
      });
      if (!r.ok) return setErro(r.erro);
      onSalvo(`Quem alcança “${item.nome}” foi atualizado. Vale na próxima pergunta.`);
    });
  }

  const estavaOculta = !!item.ajuste && !item.ajuste.enabled;

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Quem alcança “{item.nome}”</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          O que você definir aqui vale para a sua empresa, no lugar do que a Natcorp definiu. Deixe
          tudo em “Todos” para que qualquer pessoa da empresa alcance.
        </p>
      </div>

      {/*
        A FRASE, colada no topo. Ela é o produto desta tela, não um resumo: é a
        única coisa que impede alguém de ler uma interseção como se fosse união.
      */}
      <div className="rounded-lg border border-brand-purple-200 bg-brand-purple-50 px-3 py-2.5">
        <p className="text-2xs font-medium uppercase tracking-wide text-brand-purple-800">
          Quem alcança, por extenso
        </p>
        <p className="mt-1 text-sm leading-relaxed text-text">{frase}</p>
        {aviso ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{aviso}</span>
          </p>
        ) : null}
        {emBranco.length > 0 ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              A frase acima ignora{" "}
              {emBranco
                .map((d) => DIMENSOES_DA_TELA.find((x) => x.dimensao === d)!.rotulo.toLowerCase())
                .join(", ")}
              : está marcado como restrito e sem nenhum valor escolhido.
            </span>
          </p>
        ) : null}
      </div>

      {/*
        De onde vêm as listas oferecidas, e o que muda no modo suporte. A frase
        fica aqui, uma vez, e não repetida em cada restrição: cada uma já diz a
        própria procedência quando é ligada.
      */}
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {modo === "suporte"
            ? "Modo suporte: sem login do ERP, as listas de empresa, filial e centro de custo não carregam — digite o código à mão."
            : `As listas de empresa, filial, centro de custo e afins vêm do cadastro do seu ERP, consultadas com o seu login. ${
                presencas.conversas > 0
                  ? `Cada restrição também avisa se a sua empresa nunca enviou aquele dado — conferido contra ${presencas.conversas} conversa(s).`
                  : "Sua empresa ainda não tem conversa registrada, então não há como conferir se um valor restringido chega de verdade."
              }`}
        </span>
      </p>

      {GRUPOS.map((g) => {
        const linhas = dimensoesDoGrupo(g.chave).filter(SEM_CLIENTE);
        if (linhas.length === 0) return null;
        return (
          <fieldset key={g.chave} className="rounded-lg border border-border bg-surface p-3">
            <legend className="px-1 text-xs font-semibold text-text">{g.titulo}</legend>
            <p className="mb-2 text-xs leading-relaxed text-text-muted">{g.descricao}</p>
            <div className="space-y-2">
              {linhas.map((ui) => (
                <LinhaDimensao
                  key={ui.dimensao}
                  ui={ui}
                  restrita={restritas.includes(ui.dimensao)}
                  valores={valores[ui.dimensao] ?? []}
                  onAlternar={(v) => alternar(ui.dimensao, v)}
                  onValores={(v) => definirValores(ui.dimensao, v)}
                  presenca={{ vistos: presencas.porDimensao[ui.dimensao], conversas: presencas.conversas }}
                  baseDoEscopo={baseCode}
                  baseRef={baseCode}
                  opcoesDeCadastro={SEM_CADASTRO}
                  lista={listas[ui.dimensao]}
                />
              ))}
            </div>
          </fieldset>
        );
      })}

      {erro ? (
        <p
          role="alert"
          className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-xs font-medium leading-relaxed text-danger"
        >
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={salvar} loading={salvando} loadingLabel="Salvando…">
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        {estavaOculta ? (
          <p className="text-xs text-text-muted">
            Salvar também volta a mostrar esta documentação para os seus usuários.
          </p>
        ) : null}
      </div>
    </div>
  );
}
