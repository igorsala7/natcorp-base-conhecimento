"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Check,
  Globe2,
  Info,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, eyebrow, eyebrowLabel } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import {
  avisoDeAlcance,
  resumoElegibilidade,
  type Dimensao,
  type Regra,
} from "@/lib/elegibilidade";
import {
  DIMENSOES_DA_TELA,
  GRUPOS,
  dimensaoUI,
  dimensoesDoGrupo,
  formularioParaRegra,
  regraParaFormulario,
  type ListaDeValores,
} from "@/lib/documentacoes/dimensoes-ui";
// A linha de uma dimensão é IDÊNTICA aqui e na tela do cliente
// (`/gestao/conteudo`), e o que ela carrega — interruptor em vez de campo vazio,
// aviso de presença, procedência da lista — não pode divergir entre as duas.
import { LinhaDimensao, type OpcaoDeCadastro } from "@/lib/documentacoes/dimensao-editor";
import type { Vocabulario } from "@/lib/documentacoes/vocabulario";
import {
  removerDocumentacao,
  salvarRegraDocumentacao,
  valoresDaDimensao,
  vocabularioDaBase,
  type Escopo,
} from "./documentacoes-actions";

/**
 * DOCUMENTAÇÕES ANEXÁVEIS — onde uma documentação passa a ser recurso de uma
 * base, e onde se decide quem dentro daquele cliente a alcança.
 *
 * Duas seções e não uma lista só, porque a fronteira é explícita por desenho:
 * `documentacoes_universais` é o que TODA base alcança sem configuração;
 * `ai_base_documentacoes` é o que é de um cliente e só dele. Misturá-las numa
 * tabela com uma coluna "escopo" recriaria a confusão de herança que as duas
 * tabelas existem para evitar — e nesta tela errar o escopo não dá erro, dá
 * documentação que alcança o cliente errado ou ninguém.
 *
 * ── O que esta tela precisa acertar, e por que é difícil ─────────────────────
 * A regra são doze allowlists combinadas com E. Marcar o portal do Gestor E o
 * perfil FOLHA restringe à INTERSEÇÃO, não à união, e quem cadastrou esperando
 * "gestores OU pessoal da folha" só descobre quando alguém reclama de não ver o
 * conteúdo — sem erro em lugar nenhum para investigar. Daí três decisões:
 *
 *   · a FRASE de `resumoElegibilidade` ao vivo, sempre visível enquanto se
 *     edita. É a mesma regra do predicado escrita por extenso;
 *   · "sem restrição" é INTERRUPTOR, nunca campo em branco. Campo em branco é
 *     estado inválido, e a tela recusa salvar uma dimensão marcada como restrita
 *     e sem valor — em vez de gravar `[]`, que LIBERA, ou `[""]`, que o banco
 *     recusa com mensagem de banco;
 *   · ao lado de cada dimensão restringida, o AVISO DE PRESENÇA: se esta base
 *     nunca enviou valor naquela dimensão, restringir por ali não alcança
 *     ninguém. Substitui o contador de alcance, que foi medido e não funciona
 *     (natcorp tem 317 conversas e 4 valores distintos de `p_usuario`: um
 *     contador mostraria 0 ou 1 para qualquer regra).
 */

export type DocumentacaoOption = {
  id: string;
  name: string;
  slug: string;
  /** 'global' | 'client' — só para a tela dizer de onde a documentação vem. */
  tipo: string;
  /** Arquivos de conhecimento no espaço, para diferenciar doc vazia de cheia. */
  documentos: number;
};

export type AnexoRow = {
  spaceId: string;
  /** null = universal. */
  baseId: string | null;
  enabled: boolean;
  regra: Regra;
};

export type BaseOption = { id: string; base_code: string; name: string; active: boolean };

type EmEdicao = {
  escopo: Escopo;
  /** null = anexando uma documentação nova. */
  spaceId: string | null;
  enabled: boolean;
  restritas: Dimensao[];
  valores: Partial<Record<Dimensao, string[]>>;
};

/** Chave do cache de listas: a base entra junto, senão a lista de A vale para B. */
const chaveDaLista = (baseRef: string, d: Dimensao) => `${baseRef}\u0000${d}`;

export function DocumentacoesPanel({
  bases,
  documentacoes,
  anexos,
  podeConfigurar,
}: {
  bases: BaseOption[];
  documentacoes: DocumentacaoOption[];
  /** Universais (baseId null) e por base, na mesma lista. */
  anexos: AnexoRow[];
  /** `ai.configure`. A RLS das duas tabelas exige a mesma. */
  podeConfigurar: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pendente, iniciar] = useTransition();

  /* Base inativa continua na lista, marcada: a configuração dela precisa poder
     ser lida e corrigida, e esconder a base faria a documentação anexada a ela
     desaparecer da tela sem desaparecer do banco. As ativas vêm primeiro. */
  const opcoesDeBase = useMemo(
    () => [...bases].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR")),
    [bases],
  );
  const [baseId, setBaseId] = useState(opcoesDeBase[0]?.id ?? "");
  const [editando, setEditando] = useState<EmEdicao | null>(null);

  const baseAtual = opcoesDeBase.find((b) => b.id === baseId) ?? null;
  const universais = anexos.filter((a) => a.baseId === null);
  const daBase = anexos.filter((a) => a.baseId === baseId);

  const nomeDaDoc = (id: string) => documentacoes.find((d) => d.id === id)?.name ?? "(documentação removida)";
  const nomeDaBase = useMemo(() => {
    const m = new Map(bases.map((b) => [b.base_code, b.name] as const));
    return (code: string) => m.get(code) ?? code;
  }, [bases]);

  /**
   * A RLS das duas tabelas exige `ai.configure`; a PÁGINA exige
   * `integrations.manage`. Hoje as duas pertencem aos mesmos dois papéis, então
   * este ramo não é alcançável — mas se um dia for, a lista voltaria VAZIA e o
   * estado vazio diria "nada configurado" sobre um cliente configurado. Recusar
   * com o nome da permissão é a diferença entre um aviso e uma mentira.
   */
  if (!podeConfigurar) {
    return (
      <SemPermissao
        titulo="Documentações anexáveis"
        oQue="anexar documentação a uma base e definir quem a alcança"
        permissao="ai.configure"
        papel="Admin técnico"
        voltarHref="/admin/integracoes"
      />
    );
  }

  function abrirNovo(escopo: Escopo) {
    setEditando({ escopo, spaceId: null, enabled: true, restritas: [], valores: {} });
  }

  function abrirEdicao(a: AnexoRow) {
    setEditando({
      escopo: a.baseId ? { tipo: "base", baseId: a.baseId } : { tipo: "universal" },
      spaceId: a.spaceId,
      enabled: a.enabled,
      ...regraParaFormulario(a.regra),
    });
  }

  function alternarPausa(a: AnexoRow) {
    iniciar(async () => {
      const r = await salvarRegraDocumentacao({
        escopo: a.baseId ? { tipo: "base", baseId: a.baseId } : { tipo: "universal" },
        spaceId: a.spaceId,
        regra: a.regra,
        enabled: !a.enabled,
      });
      if (!r.ok) return toast.error(r.erro);
      toast.success(a.enabled ? "Documentação pausada." : "Documentação ativada.");
      router.refresh();
    });
  }

  async function remover(a: AnexoRow) {
    const ok = await confirmar({
      title: `Desanexar “${nomeDaDoc(a.spaceId)}”?`,
      description: a.baseId
        ? `A base ${baseAtual?.name ?? ""} deixa de alcançar esta documentação na próxima pergunta. A restrição configurada é descartada — se você só quer suspender, use Pausar.`
        : "Todas as bases deixam de alcançar esta documentação pelo caminho universal, na próxima pergunta — só continuam alcançando as que a tiverem anexada individualmente. A restrição configurada é descartada; se você só quer suspender, use Pausar.",
      confirmLabel: "Desanexar",
      tone: "danger",
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await removerDocumentacao({
        escopo: a.baseId ? { tipo: "base", baseId: a.baseId } : { tipo: "universal" },
        spaceId: a.spaceId,
      });
      if (!r.ok) return toast.error(r.erro);
      toast.success("Documentação desanexada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/*
        O aviso de rodada ADITIVA vem primeiro porque muda a leitura de tudo o
        que está embaixo: com nenhuma linha nas duas tabelas, cliente nenhum
        mudou de comportamento — cada base continua vendo o que a chave de widget
        dela já apontava. Sem esta frase, o estado vazio parece defeito.
      */}
      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Enquanto uma base não tiver nenhuma documentação anexada aqui, ela continua enxergando
          exatamente o que a chave do widget dela já aponta. Anexar é o que passa a valer no lugar
          disso — um cliente por vez, sem mexer nos outros.
        </span>
      </p>

      <SecaoAnexos
        icone={Globe2}
        titulo="Universais"
        descricao="Toda base alcança estas documentações, sem configuração. É aqui que mora a restrição por portal ou perfil de uma documentação que não é de cliente nenhum."
        vazioTitulo="Nenhuma documentação universal"
        vazioDescricao="Anexe aqui o que vale para todos os clientes — o manual do produto, por exemplo. Nada é aplicado a ninguém enquanto você não anexar."
        anexos={universais}
        nomeDaDoc={nomeDaDoc}
        nomeDaBase={nomeDaBase}
        documentacoes={documentacoes}
        pendente={pendente}
        onNovo={() => abrirNovo({ tipo: "universal" })}
        onEditar={abrirEdicao}
        onPausar={alternarPausa}
        onRemover={remover}
      />

      <section className="space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <Building2 className="size-4 text-text-muted" aria-hidden="true" />
              Deste cliente
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-muted">
              Só a base escolhida alcança. É acréscimo ao conjunto universal, nunca substituição: o
              assistente une os dois.
            </p>
          </div>
          <div className="w-56 shrink-0">
            <Field label="Cliente / base" htmlFor="doc_base">
              <Select id="doc_base" value={baseId} onChange={setBaseId}>
                {opcoesDeBase.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.active ? b.name : `${b.name} (inativa)`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </header>

        {opcoesDeBase.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum cliente cadastrado"
            description="Cadastre a base do cliente antes de anexar documentação a ela."
            action={
              <Button variant="secondary" onClick={() => router.push("?aba=bases")}>
                Ir para Bases / Clientes
              </Button>
            }
          />
        ) : (
          <SecaoAnexos
            anexos={daBase}
            vazioTitulo={`${baseAtual?.name ?? "Este cliente"} não tem documentação própria`}
            vazioDescricao={
              universais.length
                ? `Esta base já alcança ${universais.length} documentação(ões) universal(is). Anexe aqui o que é só dela.`
                : "Anexe aqui a documentação que é só deste cliente. Nada mais alcança esta base enquanto isto estiver vazio."
            }
            nomeDaDoc={nomeDaDoc}
            nomeDaBase={nomeDaBase}
            documentacoes={documentacoes}
            pendente={pendente}
            onNovo={() => baseId && abrirNovo({ tipo: "base", baseId })}
            onEditar={abrirEdicao}
            onPausar={alternarPausa}
            onRemover={remover}
          />
        )}
      </section>

      {editando && (
        <DialogoRegra
          key={`${editando.escopo.tipo}-${editando.spaceId ?? "novo"}`}
          edicao={editando}
          bases={opcoesDeBase}
          baseDoEscopo={
            editando.escopo.tipo === "base"
              ? (opcoesDeBase.find((b) => b.id === (editando.escopo as { baseId: string }).baseId)?.base_code ?? null)
              : null
          }
          baseDeReferenciaInicial={baseAtual?.base_code ?? null}
          documentacoes={documentacoes}
          jaAnexadas={(editando.escopo.tipo === "universal" ? universais : daBase).map((a) => a.spaceId)}
          nomeDaDoc={nomeDaDoc}
          nomeDaBase={nomeDaBase}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Uma seção (Universais ou Deste cliente) ─────────────────────────────────

function SecaoAnexos({
  icone: Icone,
  titulo,
  descricao,
  vazioTitulo,
  vazioDescricao,
  anexos,
  documentacoes,
  nomeDaDoc,
  nomeDaBase,
  pendente,
  onNovo,
  onEditar,
  onPausar,
  onRemover,
}: {
  icone?: React.ComponentType<{ className?: string }>;
  titulo?: string;
  descricao?: string;
  vazioTitulo: string;
  vazioDescricao: string;
  anexos: AnexoRow[];
  documentacoes: DocumentacaoOption[];
  nomeDaDoc: (id: string) => string;
  nomeDaBase: (code: string) => string;
  pendente: boolean;
  onNovo: () => void;
  onEditar: (a: AnexoRow) => void;
  onPausar: (a: AnexoRow) => void;
  onRemover: (a: AnexoRow) => void;
}) {
  /*
    Duas razões diferentes para não haver o que anexar, e um botão desabilitado
    sem motivo é um beco sem saída: "nenhuma documentação existe" manda criar
    uma, "todas já estão anexadas" é o estado final e correto.
  */
  const anexadas = new Set(anexos.map((a) => a.spaceId));
  const restam = documentacoes.filter((d) => !anexadas.has(d.id)).length;
  const porqueNaoAnexar =
    documentacoes.length === 0
      ? "Nenhuma documentação existe ainda para anexar — crie uma em Conteúdo."
      : restam === 0
        ? "Todas as documentações que existem já estão nesta lista."
        : null;

  return (
    <section className="space-y-3">
      {titulo && (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              {Icone && <Icone className="size-4 text-text-muted" aria-hidden="true" />}
              {titulo}
            </h3>
            {descricao && (
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-muted">{descricao}</p>
            )}
          </div>
        </header>
      )}

      {anexos.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={vazioTitulo}
          description={porqueNaoAnexar ?? vazioDescricao}
          action={
            <Button onClick={onNovo} disabled={!!porqueNaoAnexar}>
              <Plus aria-hidden="true" />
              Anexar documentação
            </Button>
          }
        />
      ) : (
        <>
          <ul className="overflow-hidden rounded-lg border border-border">
            {anexos.map((a, i) => (
              <li
                key={`${a.baseId ?? "u"}-${a.spaceId}`}
                className={cn("flex flex-wrap items-start gap-3 p-3", i > 0 && "border-t border-border")}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text">{nomeDaDoc(a.spaceId)}</span>
                    {a.enabled ? (
                      <Badge tone="success">Ativa</Badge>
                    ) : (
                      <Badge tone="warning">Pausada</Badge>
                    )}
                  </p>
                  {/*
                    A frase, e não uma lista de chips: doze allowlists com E se
                    conferem lendo, não contando etiquetas. `resumoElegibilidade`
                    é a mesma função que o formulário usa ao vivo — se a linha e
                    o diálogo discordassem, a tela teria duas descrições da mesma
                    regra, que é o defeito que essa função existe para impedir.
                  */}
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {/* Pausada, a frase descreveria um alcance que não existe.
                        Dizer as duas coisas é mais curto que fazer quem lê
                        cruzar a etiqueta com a frase. */}
                    {a.enabled
                      ? resumoElegibilidade(a.regra, nomeDaBase, "esta documentação")
                      : `Ninguém alcança enquanto estiver pausada. Se ativada: ${resumoElegibilidade(a.regra, nomeDaBase, "esta documentação")}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="secondary" size="sm" onClick={() => onEditar(a)} disabled={pendente}>
                    Quem alcança
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onPausar(a)} disabled={pendente}>
                    {a.enabled ? (
                      <>
                        <Pause aria-hidden="true" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play aria-hidden="true" />
                        Ativar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="danger"
                    size="icon"
                    aria-label={`Desanexar ${nomeDaDoc(a.spaceId)}`}
                    onClick={() => onRemover(a)}
                    disabled={pendente}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {porqueNaoAnexar ? (
            <p className="text-xs text-text-muted">{porqueNaoAnexar}</p>
          ) : (
            <Button variant="secondary" size="sm" onClick={onNovo} disabled={pendente}>
              <Plus aria-hidden="true" />
              Anexar outra documentação
            </Button>
          )}
        </>
      )}
    </section>
  );
}

// ── O diálogo: a documentação, o interruptor por dimensão, e a frase ────────

function DialogoRegra({
  edicao,
  bases,
  baseDoEscopo,
  baseDeReferenciaInicial,
  documentacoes,
  jaAnexadas,
  nomeDaDoc,
  nomeDaBase,
  onFechar,
  onSalvo,
}: {
  edicao: EmEdicao;
  bases: BaseOption[];
  /** `base_code` da base do anexo (null quando universal). */
  baseDoEscopo: string | null;
  baseDeReferenciaInicial: string | null;
  documentacoes: DocumentacaoOption[];
  jaAnexadas: string[];
  nomeDaDoc: (id: string) => string;
  nomeDaBase: (code: string) => string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const toast = useToast();
  const [salvando, iniciar] = useTransition();

  const [spaceId, setSpaceId] = useState(edicao.spaceId ?? "");
  const [enabled, setEnabled] = useState(edicao.enabled);
  const [restritas, setRestritas] = useState<Dimensao[]>(edicao.restritas);
  const [valores, setValores] = useState(edicao.valores);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * A base de referência do CADASTRO, e por que ela existe.
   *
   * As listas de valor (empresa, filial, centro de custo…) vêm do ERP de UMA
   * base. Numa documentação de cliente, é a base do próprio anexo. Numa
   * universal não há base — e sem este seletor seis das doze dimensões ficariam
   * sem lista nenhuma na seção Universais, o que é um beco sem saída e não uma
   * decisão. O padrão é a base já escolhida na seção de baixo, então no caso
   * comum não há escolha nova a fazer.
   */
  const [baseRef, setBaseRef] = useState(baseDoEscopo ?? baseDeReferenciaInicial ?? "");

  const [vocab, setVocab] = useState<Vocabulario | null>(null);
  const [vocabErro, setVocabErro] = useState<string | null>(null);
  /**
   * Listas de cadastro por `base + dimensão`, e a chave composta é o ponto.
   *
   * Guardando só por dimensão, trocar a base de referência exigiria um efeito de
   * LIMPEZA — e um efeito que zera estado ofereceria, na janela entre o render e
   * a limpeza, o centro de custo do cliente A no cadastro do cliente B. Com a
   * base na chave, a troca invalida sozinha: a entrada da outra base continua
   * guardada e simplesmente não é consultada.
   */
  const [listas, setListas] = useState<Record<string, ListaDeValores>>({});
  /**
   * Requisições em voo, em `ref` e não em estado.
   *
   * O efeito que busca as listas depende de `listas` (é o que faz a guarda "já
   * tenho esta" funcionar), então ele roda de novo a cada resposta. Sem uma marca
   * de "já pedi", a segunda passada pediria de novo a mesma lista. A marca não
   * pode ser estado: escrever estado dentro do corpo do efeito é justamente o que
   * cascateia render, e o esqueleto na tela já sai de `lista === undefined`.
   */
  const emVoo = useRef<Set<string>>(new Set());

  /**
   * O vocabulário é do ESCOPO: da base do anexo, ou de todas as bases quando a
   * documentação é universal (`base_ref` nulo devolve o vocabulário de todos os
   * clientes, que é o alcance real de uma universal).
   *
   * Sem reset síncrono no corpo do efeito: o diálogo é remontado por `key` a cada
   * abertura, então `baseDoEscopo` não muda durante a vida deste componente e o
   * estado inicial já é o "carregando" desta tela.
   */
  useEffect(() => {
    let vivo = true;
    void vocabularioDaBase(baseDoEscopo).then((r) => {
      if (!vivo) return;
      if (r.ok) setVocab(r.vocab);
      else setVocabErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, [baseDoEscopo]);

  /* A dimensão `base` é a única cujas opções saem do cadastro do próprio
     sistema. Memoizado porque a lista vai para dentro de um `useMemo` da linha
     de dimensão — um array novo a cada render o invalidaria. */
  const opcoesDeCadastro: OpcaoDeCadastro[] = useMemo(
    () => bases.map((b) => ({ valor: b.base_code, rotulo: b.name, dica: b.base_code })),
    [bases],
  );

  const regra = useMemo(() => formularioParaRegra({ restritas, valores }), [restritas, valores]);
  const frase = resumoElegibilidade(regra, nomeDaBase, "esta documentação");
  const aviso = vocab
    ? avisoDeAlcance(regra, {
        perfis: (vocab.porDimensao.perfil ?? []).map((v) => v.valor),
        empresas: (vocab.porDimensao.empresa ?? []).map((v) => v.valor),
      })
    : null;

  /** Dimensões marcadas como restritas e ainda sem valor: estado inválido. */
  const emBranco = restritas.filter((d) => !(valores[d] ?? []).some((v) => v.trim()));

  function alternar(d: Dimensao, restrita: boolean) {
    setErro(null);
    setRestritas((prev) => (restrita ? [...new Set([...prev, d])] : prev.filter((x) => x !== d)));
    // Desligar NÃO apaga os valores: quem alterna para conferir a frase e volta
    // atrás não deveria redigitar oito códigos. O que vai ao banco é `paraRegra`,
    // que só olha as dimensões ligadas.
  }

  function definirValores(d: Dimensao, lista: string[]) {
    setErro(null);
    setValores((prev) => ({ ...prev, [d]: lista }));
  }

  /*
    Busca a lista do ERP só das dimensões LIGADAS, e uma vez cada. Buscar as seis
    ao abrir seriam seis requisições ao ERP do cliente — uma delas de 2.847
    linhas — numa tela onde o caso comum restringe uma ou duas dimensões.
  */
  useEffect(() => {
    if (!baseRef) return;
    let vivo = true;
    for (const d of restritas) {
      if (dimensaoUI(d).origem.tipo !== "tool") continue;
      const k = chaveDaLista(baseRef, d);
      if (listas[k] !== undefined || emVoo.current.has(k)) continue;
      emVoo.current.add(k);
      void valoresDaDimensao(baseRef, d).then((r) => {
        emVoo.current.delete(k);
        if (vivo) setListas((prev) => ({ ...prev, [k]: r }));
      });
    }
    return () => {
      vivo = false;
    };
  }, [baseRef, restritas, listas]);

  function salvar() {
    if (!spaceId) return setErro("Escolha a documentação a anexar.");
    if (emBranco.length) {
      const nomes = emBranco.map((d) => DIMENSOES_DA_TELA.find((x) => x.dimensao === d)!.rotulo);
      return setErro(
        `${nomes.join(", ")}: você marcou "Restringir" e não escolheu nenhum valor. ` +
          `Salvar assim gravaria uma lista vazia, que LIBERA para todo mundo — o contrário do que você pediu. ` +
          `Escolha um valor ou volte para "Todos".`,
      );
    }
    setErro(null);
    iniciar(async () => {
      const r = await salvarRegraDocumentacao({ escopo: edicao.escopo, spaceId, regra, enabled });
      if (!r.ok) return setErro(r.erro);
      toast.success(
        edicao.spaceId ? "Restrição salva. Vale na próxima pergunta." : "Documentação anexada.",
      );
      onSalvo();
    });
  }

  const opcoesDeDoc: SelectOption[] = documentacoes
    .filter((d) => d.id === edicao.spaceId || !jaAnexadas.includes(d.id))
    .map((d) => ({
      value: d.id,
      label: d.name,
      hint: `${d.documentos} arquivo(s) · ${d.tipo === "client" ? "cliente" : "global"}`,
    }));

  return (
    <Dialog
      open
      onClose={onFechar}
      resizable
      title={edicao.spaceId ? `${nomeDaDoc(edicao.spaceId)} — quem alcança` : "Anexar documentação"}
      description={
        edicao.escopo.tipo === "universal"
          ? "Universal: toda base alcança, filtrada pela regra abaixo."
          : `Só a base ${baseDoEscopo ?? ""} alcança, filtrada pela regra abaixo.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onFechar} disabled={salvando}>
            <X aria-hidden="true" />
            Cancelar
          </Button>
          <Button onClick={salvar} loading={salvando} loadingLabel="Salvando…">
            <Check aria-hidden="true" />
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Documentação"
            htmlFor="doc_space"
            hint={edicao.spaceId ? "Para trocar de documentação, desanexe e anexe a outra." : undefined}
          >
            <Select
              id="doc_space"
              value={spaceId}
              onChange={setSpaceId}
              options={opcoesDeDoc}
              disabled={!!edicao.spaceId}
              placeholder="Escolha a documentação…"
            />
          </Field>
          {/* Sem `<Field>`: ele associa um `<label htmlFor>` a um controle com
              id, e o grupo segmentado é um `role="tablist"` de três nós — o
              rótulo apontaria para nada. */}
          <div>
            <p className={eyebrowLabel}>Situação</p>
            <Segmented
              value={enabled ? "on" : "off"}
              onChange={(v) => setEnabled(v === "on")}
              options={[
                { value: "on", label: "Ativa" },
                { value: "off", label: "Pausada" },
              ]}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
              Pausada guarda a regra e não alcança ninguém.
            </p>
          </div>
        </div>

        {/*
          A FRASE, colada no topo do corpo do diálogo. Ela é o produto desta tela,
          não um resumo: é a única coisa que impede alguém de ler a interseção de
          doze allowlists como união.
        */}
        <div className="rounded-lg border border-brand-purple-200 bg-brand-purple-50 px-3 py-2.5 dark:border-brand-purple-800 dark:bg-brand-purple-950/40">
          <p className={eyebrow}>Quem alcança, por extenso</p>
          <p className="mt-1 text-sm leading-relaxed text-text">{frase}</p>
          {!enabled && (
            <p className="mt-1 text-xs font-medium text-warning">
              Pausada: ninguém alcança enquanto estiver assim, qualquer que seja a regra.
            </p>
          )}
          {aviso && (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{aviso}</span>
            </p>
          )}
          {emBranco.length > 0 && (
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
          )}
        </div>

        {edicao.escopo.tipo === "universal" && bases.length > 0 && (
          <Field
            label="Cadastro de referência"
            htmlFor="doc_base_ref"
            hint="De qual ERP vêm as listas de empresa, filial, centro de custo e afins. Uma documentação universal não é de base nenhuma, então a lista precisa vir de alguma."
          >
            <Select id="doc_base_ref" value={baseRef} onChange={setBaseRef}>
              {bases.map((b) => (
                <option key={b.id} value={b.base_code}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {/*
          CARREGANDO, VAZIO, ERRO e SUCESSO do diagnóstico de presença, nesta
          ordem. O esqueleto não é enfeite: sem ele, nos primeiros instantes
          nenhuma dimensão mostra aviso de presença, e "ainda não sei" fica
          idêntico a "está tudo certo" — que é justamente o par que esta tela
          existe para separar.
        */}
        {vocabErro ? (
          <p className="flex items-start gap-1.5 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Não deu para ler o que esta base já enviou em cada dimensão ({vocabErro}). Os avisos de
              presença ficam de fora desta sessão — a regra em si continua valendo.
            </span>
          </p>
        ) : vocab === null ? (
          <div className="space-y-1.5" aria-busy="true">
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-3 w-52" />
          </div>
        ) : vocab.conversas === 0 ? (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {baseDoEscopo
                ? `A base ${baseDoEscopo} ainda não tem conversa registrada, então não há como conferir se um valor que você restringir chega de verdade.`
                : "Nenhuma conversa registrada ainda em base nenhuma, então não há como conferir se um valor que você restringir chega de verdade."}
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Conferido contra {vocab.conversas} conversa(s)
              {baseDoEscopo ? ` da base ${baseDoEscopo}` : " de todas as bases"}: cada dimensão avisa
              embaixo se nunca recebeu valor.
            </span>
          </p>
        )}

        {GRUPOS.map((g) => (
          <fieldset key={g.chave} className="rounded-lg border border-border bg-surface-2 p-3">
            <legend className="px-1 text-xs font-semibold text-text">{g.titulo}</legend>
            <p className="mb-2 text-xs leading-relaxed text-text-muted">{g.descricao}</p>
            <div className="space-y-2">
              {dimensoesDoGrupo(g.chave).map((ui) => (
                <LinhaDimensao
                  key={ui.dimensao}
                  ui={ui}
                  restrita={restritas.includes(ui.dimensao)}
                  valores={valores[ui.dimensao] ?? []}
                  onAlternar={(v) => alternar(ui.dimensao, v)}
                  onValores={(v) => definirValores(ui.dimensao, v)}
                  presenca={vocab ? { vistos: vocab.porDimensao[ui.dimensao], conversas: vocab.conversas } : null}
                  baseDoEscopo={baseDoEscopo}
                  baseRef={baseRef}
                  opcoesDeCadastro={opcoesDeCadastro}
                  lista={listas[chaveDaLista(baseRef, ui.dimensao)]}
                />
              ))}
            </div>
          </fieldset>
        ))}

        {erro && (
          <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-xs font-medium leading-relaxed text-danger">
            {erro}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/*
  `LinhaDimensao` e `ProcedenciaDaLista` saíram deste arquivo para
  `@/lib/documentacoes/dimensao-editor.tsx` quando a tela do cliente
  (`/gestao/conteudo`) passou a editar a MESMA regra: com duas cópias, corrigir
  o aviso de presença ou a procedência da lista numa tela e esquecer a outra não
  quebra compilação nem teste — produz duas telas que descrevem a mesma regra de
  formas diferentes. As diferenças entre as duas viraram propriedades
  (`presenca`, `opcoesDeCadastro`), e o resto é idêntico.
*/
