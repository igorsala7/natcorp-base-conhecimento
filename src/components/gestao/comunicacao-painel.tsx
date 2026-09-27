"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  Info,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, eyebrowLabel } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  avisoDeAlcance,
  nomeDoPortal,
  resumoElegibilidade,
  type Dimensao,
} from "@/lib/elegibilidade";
import {
  DIMENSOES_DA_TELA,
  GRUPOS,
  dimensaoUI,
  dimensoesDoGrupo,
  formularioParaRegra,
  regraSemCliente,
  type ListaDeValores,
} from "@/lib/documentacoes/dimensoes-ui";
import { LinhaDimensao, type OpcaoDeCadastro } from "@/lib/documentacoes/dimensao-editor";
import {
  MAX_CORPO,
  MAX_TITULO,
  ROTULO_DO_ESTADO,
  campanhaParaFormulario,
  estadoDaCampanha,
  localParaIso,
  mensagemDeAutoExclusao,
  problemasDaCampanha,
  regraExcluiAPropriaBase,
  type Campanha,
  type EstadoDaCampanha,
  type FormularioDeCampanha,
} from "@/lib/campanhas/campanha";
import {
  definirEnvio,
  excluirCampanha,
  listarVisualizacoes,
  salvarCampanha,
} from "@/app/gestao/comunicacao/actions";
/*
  A lista de valores do ERP vem da action da aba Conteúdo, e de propósito: é a
  MESMA pergunta ("quais empresas/filiais/centros de custo existem neste
  cliente?"), respondida com o login da MESMA sessão, inclusive na parte que mais
  importa — no modo suporte não há login do ERP, e ela devolve o MOTIVO em vez de
  uma lista vazia. Uma terceira cópia dessa decisão é o que faz duas telas
  passarem a descrever o mesmo cadastro de formas diferentes.
*/
import { valoresParaDimensao } from "@/app/gestao/conteudo/actions";

/**
 * OS AVISOS DO ASSISTENTE, e quem visualizou cada um.
 *
 * ── O que esta tela é ─────────────────────────────────────────────────────
 * O cliente escreve um aviso, marca quando ele começa (e opcionalmente quando
 * para), escolhe quem alcança nas mesmas doze dimensões da aba Conteúdo, e vê
 * quem visualizou. O aviso aparece como primeira mensagem para quem estiver
 * dentro do alcance: no computador o assistente pode abrir sozinho e levar o
 * aviso até a pessoa; no celular, só quem abrir o chat recebe.
 *
 * ── E O QUE ELA ATIVAMENTE NÃO FAZ ────────────────────────────────────────
 * Nenhum percentual, nenhuma taxa de leitura, nenhum gráfico de lidos contra não
 * lidos. O motivo é aritmético e não de gosto: não existe cadastro de usuários em
 * tabela nenhuma deste banco, e o único universo disponível é "quem já usou o
 * chatbot". Um denominador tirado dali mediria adoção do chatbot parecendo medir
 * alcance do aviso — completo na aparência e falso no conteúdo, que é o pior tipo
 * de número.
 *
 * Então o painel mostra a contagem de quem visualizou, a lista de quem
 * visualizou, e UMA FRASE dizendo por que não existe o outro lado
 * (`SEM_QUEM_NAO_VIU`, mais abaixo). A frase é para o operador de RH que abre
 * esta tela, não para quem escreveu o banco: ela não fala de tabela, de cadastro
 * de sistema nem de denominador.
 *
 * A CATRACA DESTE ARQUIVO é a sentinela de `campanha.test.ts`, que olha este
 * fonte e falha se aparecer conta de porcentagem. Ela roda em `npm test`, e
 * `npm test` está na CI — é o único dos dois portões que barra um PR.
 *
 * A assertiva D da migration de campanhas cobre o lado do BANCO (coluna ou função
 * de denominador) e dispara quando ALGUÉM aplica aquele arquivo: `ci.yml` não
 * aplica migration nenhuma, e `scripts/apply-migrations.ts` só aplica o que
 * recebe como argumento. Ou seja: a tela tem portão automático, o banco tem
 * revisão mais uma assertiva que espera a próxima aplicação.
 *
 * ── Três decisões de formulário que vêm da aba Conteúdo, e por quê ────────
 *   · "sem restrição" é INTERRUPTOR, nunca campo em branco. Campo em branco
 *     LIBERA neste motor, o contrário do que quem apagou o último valor queria;
 *   · a FRASE ao vivo, em português, enquanto se edita: restringir é uma
 *     INTERSEÇÃO (portal do Gestor E perfil FOLHA alcança quem é as duas coisas),
 *     e isso se confere lendo, não olhando etiquetas;
 *   · o aviso de presença por dimensão: se esta empresa nunca enviou aquele dado,
 *     restringir por ali não alcança ninguém.
 *
 * A dimensão de CLIENTE não é desenhada, pelas duas razões da aba Conteúdo: o
 * aviso já é da empresa de quem está olhando (restringir por cliente aqui é
 * redundante na melhor hipótese e não alcança ninguém na pior), e oferecer a lista
 * significaria imprimir o código de outras empresas nesta tela. Ela continua no
 * ESTADO do formulário quando já vem gravada — ver `campanhaParaFormulario` —,
 * então editar um aviso nunca a descarta em silêncio, que transformaria uma regra
 * que fecha numa que abre.
 */

/** Uma campanha como a tela precisa dela. Espelho de `CampanhaComContagem`. */
export type CampanhaNaTela = Campanha & {
  /** Visualizações registradas. NULO não é zero: nulo é "não deu para contar". */
  visualizacoes: number | null;
};

type Presencas = {
  porDimensao: Partial<Record<Dimensao, { valor: string; conversas: number }[]>>;
  conversas: number;
};

/* O tipo do drilldown sai do RETORNO da action, e não de um `import` do módulo de
   leitura: aquele arquivo é `server-only`, e um espelho escrito à mão aqui seria
   um segundo lugar para a forma do painel divergir. */
type ResultadoDeVisualizacoes = Awaited<ReturnType<typeof listarVisualizacoes>>;
type PainelDeVisualizacoes = Extract<ResultadoDeVisualizacoes, { ok: true }>["painel"];

/**
 * O QUE O NÚMERO SIGNIFICA, E A AUSÊNCIA DO OUTRO LADO.
 *
 * Escrita para quem opera a tela: sem "cadastro de usuários", sem "denominador",
 * sem "tabela". Ela precisa entregar duas coisas — o que uma visualização é, e a
 * razão pela qual pedir "quem não viu" não vai ser atendido.
 *
 * ── A PRIMEIRA METADE MUDOU DE VERDADE, E A FRASE TINHA FICADO ATRÁS ─────────
 * Até a tarefa 21 a visualização só nascia de um gesto: a pessoa abria o
 * assistente e rolava até o aviso. A tela dizia isso, e estava certa. Desde a
 * tarefa 21 o assistente ABRE SOZINHO no computador quando a pessoa entra numa
 * tela do sistema, e leva o aviso até a vista — a decisão é do dono, e o número
 * passou a subir sem ninguém clicar em nada. A frase antiga continuaria
 * verdadeira na letra ("entrou na área visível") e falsa no que o operador
 * conclui dela ("então alguém abriu o chat para ler").
 *
 * Por isso a frase diz agora, nesta ordem: o que conta, que o aviso pode aparecer
 * por conta própria no computador, que no celular não, e só então por que o outro
 * lado não existe.
 *
 * Fica numa constante, e não solta no JSX, porque é a peça que a restrição do dono
 * exige na tela: uma constante com nome é o que a torna fácil de achar e difícil
 * de apagar sem perceber. A frase "Não há como mostrar quem não visualizou" é
 * vigiada pela sentinela de `campanha.test.ts` — reescrever este texto sem ela
 * derruba o teste, de propósito.
 */
const SEM_QUEM_NAO_VIU =
  "Cada visualização é um aviso que ficou na área visível do assistente. No computador o assistente " +
  "pode abrir sozinho e trazer o aviso à vista quando a pessoa entra numa tela do sistema, então a " +
  "visualização não quer dizer que ela abriu o chat de propósito; no celular ele não abre sozinho, e " +
  "lá só conta se a pessoa abrir e chegar até o aviso. Não há como mostrar quem não visualizou: o " +
  "assistente só conhece as pessoas que já conversaram com ele, e não a lista de todo mundo da sua " +
  "empresa. Um número de “não visualizaram” contaria quem ainda nem abriu o chat, e pareceria falar " +
  "do alcance do seu aviso.";

/**
 * O QUE O INTERRUPTOR DE REPETIÇÃO NÃO CONSEGUE FAZER, DITO NA TELA.
 *
 * Texto fixado pela medição: parte dos acessos chega sem identificar a pessoa, e
 * para esses não existe sujeito para "uma vez por pessoa" — o aviso reaparece. É
 * limitação medida, e o cliente não pode descobri-la por uma reclamação.
 *
 * O NÚMERO exato não entra na tela de propósito: ele foi medido somando TODAS as
 * bases, e um cliente cujo bloco de rastreio está instalado direito não tem
 * nenhum acesso assim. Dizer "um quarto" a este cliente seria afirmar sobre a
 * empresa dele um número que é de outra.
 */
const REPETICAO_AJUDA =
  'Cerca de um quarto dos acessos ao chat chega sem identificar quem é a pessoa, e nesses casos não há como saber que ela já viu o aviso: para quem entra assim, o aviso vai reaparecer a cada abertura mesmo com "mostrar uma vez" ligado.';

/* A dimensão de cliente não é desenhada. Ver o cabeçalho. */
const SEM_CLIENTE = (ui: { dimensao: Dimensao }) => ui.dimensao !== "base";
/* Constante de módulo: um `[]` novo a cada render invalidaria o `useMemo` de
   opções dentro da linha de dimensão. Vazia porque a única dimensão que a consome
   (cliente) não é desenhada aqui. */
const SEM_CADASTRO: OpcaoDeCadastro[] = [];

export function ComunicacaoPainel({
  sessao,
  modo,
  baseCode,
  baseNome,
  campanhas,
  falhaDeLeitura = false,
  presencas,
}: {
  /** `key` + `kbt` (cliente) ou `suporte` + `base`. A ação revalida do zero. */
  sessao: Record<string, string>;
  modo: "cliente" | "suporte";
  baseCode: string;
  baseNome: string;
  campanhas: CampanhaNaTela[];
  /** A leitura da lista caiu: `campanhas` pode estar vazia OU parcial. */
  falhaDeLeitura?: boolean;
  presencas: Presencas;
}) {
  const [editando, setEditando] = useState<FormularioDeCampanha | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
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
      // `revalidatePath` na ação marca a rota como suja; é este `refresh` que traz
      // a lista nova. Sem ele, parar um aviso mostra a mensagem de sucesso e a
      // etiqueta continua dizendo "Aparecendo agora" — e quem lê clica de novo.
      router.refresh();
    } else {
      setErro(r.erro);
      setOk(null);
    }
    return r.ok;
  }

  function limparMensagens() {
    setErro(null);
    setOk(null);
  }

  function alternarEnvio(c: CampanhaNaTela) {
    iniciar(async () => {
      const r = await definirEnvio({ ...sessao, id: c.id, enabled: !c.enabled });
      avisar(
        r,
        c.enabled
          ? `“${c.titulo}” parou de aparecer no assistente.`
          : `“${c.titulo}” voltou a aparecer, dentro da janela configurada.`,
      );
    });
  }

  function excluir(c: CampanhaNaTela) {
    setConfirmandoExclusao(null);
    iniciar(async () => {
      const r = await excluirCampanha({ ...sessao, id: c.id });
      if (avisar(r, `“${c.titulo}” foi excluído.`)) {
        if (aberta === c.id) setAberta(null);
        if (editando?.id === c.id) setEditando(null);
      }
    });
  }

  const novo = () => {
    limparMensagens();
    setConfirmandoExclusao(null);
    setEditando(campanhaParaFormulario(null));
  };

  return (
    <div className="space-y-4">
      <Mensagens erro={erro} ok={ok} />

      {falhaDeLeitura ? (
        <LeituraQuebrada
          pendente={pendente}
          onTentarDeNovo={() => {
            limparMensagens();
            router.refresh();
          }}
        />
      ) : null}

      {/* O botão de criar fica ACIMA da lista e sempre visível: é a ação
          principal da tela, e procurá-la no fim de uma lista de vinte avisos é
          atrito que nada justifica. */}
      {!editando || editando.id !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" onClick={novo} disabled={pendente}>
            <Plus aria-hidden="true" />
            Novo aviso
          </Button>
          {campanhas.length > 0 ? (
            <p className="text-xs text-text-muted">
              {campanhas.length === 1 ? "1 aviso configurado" : `${campanhas.length} avisos configurados`}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* O formulário de aviso NOVO abre no topo, onde o botão está: abrir no fim
          da lista faria o clique parecer sem efeito em telas com rolagem. */}
      {editando && editando.id === null ? (
        <FormularioDeAviso
          key="novo"
          sessao={sessao}
          modo={modo}
          baseCode={baseCode}
          baseNome={baseNome}
          nomeDaBase={nomeDaBase}
          inicial={editando}
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

      {campanhas.length === 0 ? (
        falhaDeLeitura ? null : (
          <EmptyState
            icon={Megaphone}
            title="Nenhum aviso ainda"
            description="Um aviso aparece como primeira mensagem para quem estiver no alcance que você escolher: fechamento da folha, prazo para marcar férias, manutenção do sistema. No computador ele pode aparecer sozinho; no celular, quando a pessoa abrir o assistente. Você escolhe quem recebe, quando começa a aparecer e quando para."
            action={
              <Button type="button" onClick={novo} disabled={pendente}>
                <Plus aria-hidden="true" />
                Criar o primeiro aviso
              </Button>
            }
          />
        )
      ) : (
        <ul className="space-y-2">
          {campanhas.map((c) => {
            const estado = estadoDaCampanha(c);
            const editandoEste = editando?.id === c.id;
            const abertoEste = aberta === c.id;
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-lg border bg-surface p-3",
                  estado === "desligada" ? "border-warning-line" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                      {c.titulo}
                      <Etiqueta estado={estado} />
                    </p>

                    {c.corpo ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">
                        {c.corpo}
                      </p>
                    ) : null}

                    <p className="mt-1.5 text-xs leading-relaxed text-text-muted" suppressHydrationWarning>
                      <Janela c={c} estado={estado} />
                    </p>

                    {/* A FRASE, não uma lista de etiquetas: restringir é combinar
                        condições, e isso se confere lendo. É a mesma função que o
                        formulário mostra ao vivo — se a linha e o formulário
                        discordassem, a tela teria duas descrições da mesma regra. */}
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      {resumoElegibilidade(regraSemCliente(c.regra), nomeDaBase, "este aviso")}
                    </p>

                    <p className="mt-1 text-2xs text-text-muted">
                      {c.repetir
                        ? "Reaparece em toda abertura, enquanto estiver no ar."
                        : "Aparece uma vez para cada pessoa identificada."}
                    </p>

                    {regraExcluiAPropriaBase(c.regra, baseCode) ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-warning">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>{mensagemDeAutoExclusao(baseNome)}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-none flex-wrap items-center gap-2">
                    {/*
                      O RÓTULO CONTA VISUALIZAÇÃO, NUNCA PESSOA.

                      `c.visualizacoes` é o total de linhas de
                      `ai_campanha_visualizacoes` desta campanha — identificadas MAIS
                      anônimas —, e cada abertura anônima grava uma linha nova. Numa
                      base sem o bloco de rastreio instalado, o rótulo antigo dizia
                      "Quem visualizou (480)" sobre um número que não tem NENHUMA
                      pessoa dentro.

                      Filtrar a contagem para só as identificadas seria a mentira
                      contrária: visualização anônima é visualização de verdade, e
                      esconder 480 delas aqui apagaria o aviso inteiro da tela. Quem
                      separa os dois é o painel, um clique adiante — este número é o
                      que aparece SEM clique nenhum, então quem tem de mudar é o
                      rótulo.
                    */}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        limparMensagens();
                        setAberta(abertoEste ? null : c.id);
                      }}
                      disabled={pendente}
                      aria-expanded={abertoEste}
                    >
                      <Eye aria-hidden="true" />
                      Visualizações
                      {c.visualizacoes === null ? "" : ` (${c.visualizacoes})`}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        limparMensagens();
                        setConfirmandoExclusao(null);
                        setEditando(editandoEste ? null : campanhaParaFormulario(c));
                      }}
                      disabled={pendente}
                      aria-expanded={editandoEste}
                    >
                      <Pencil aria-hidden="true" />
                      Editar
                    </Button>

                    {c.enabled ? (
                      <Button
                        type="button"
                        variant="warning"
                        onClick={() => alternarEnvio(c)}
                        disabled={pendente || estado === "encerrada"}
                      >
                        <Pause aria-hidden="true" />
                        Parar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => alternarEnvio(c)}
                        disabled={pendente || estado === "encerrada"}
                      >
                        <Play aria-hidden="true" />
                        Voltar a mostrar
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        limparMensagens();
                        setConfirmandoExclusao(c.id);
                      }}
                      disabled={pendente}
                    >
                      <Trash2 aria-hidden="true" />
                      Excluir
                    </Button>
                  </div>
                </div>

                {/* O AVISO ANTES DO EFEITO. Excluir não parece grave para quem está
                    organizando a lista; o que ele faz é apagar também o registro de
                    quem visualizou, que não volta. Duas etapas, e a consequência
                    escrita na primeira. */}
                {confirmandoExclusao === c.id ? (
                  <div className="mt-3 rounded-md border border-danger-line bg-danger-soft p-3">
                    <p className="text-xs leading-relaxed text-danger">
                      <strong>Excluir “{c.titulo}”?</strong> O aviso sai do assistente e o registro de
                      quem visualizou é apagado junto. Isso não tem como ser desfeito. Se você só quer
                      que ele pare de aparecer, use <strong>Parar</strong>.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" variant="danger" onClick={() => excluir(c)} disabled={pendente}>
                        Excluir mesmo assim
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmandoExclusao(null)}
                        disabled={pendente}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {abertoEste ? (
                  <QuemVisualizou key={`vis-${c.id}`} sessao={sessao} campanha={c} />
                ) : null}

                {editandoEste && editando ? (
                  <FormularioDeAviso
                    key={c.id}
                    sessao={sessao}
                    modo={modo}
                    baseCode={baseCode}
                    baseNome={baseNome}
                    nomeDaBase={nomeDaBase}
                    inicial={editando}
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
      )}
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

/**
 * Leitura quebrada NÃO é estado vazio.
 *
 * As duas mostravam a mesma tela na aba de arquivos, e o resultado era um defeito
 * nosso apresentado como convite para criar de novo o que já existe. Aqui a
 * diferença importa dobrado: recriar um aviso que já está no ar o entregaria duas
 * vezes para as mesmas pessoas.
 */
function LeituraQuebrada({
  pendente,
  onTentarDeNovo,
}: {
  pendente: boolean;
  onTentarDeNovo: () => void;
}) {
  return (
    <div className="rounded-md border border-warning-line bg-warning-soft p-3">
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Não conseguimos ler a sua lista de avisos agora, então ela pode estar incompleta. Não crie
          um aviso de novo sem conferir: o que já estava publicado continua aparecendo no assistente.
        </span>
      </p>
      <Button
        type="button"
        variant="secondary"
        className="mt-2"
        onClick={onTentarDeNovo}
        loading={pendente}
        loadingLabel="Tentando…"
      >
        Tentar de novo
      </Button>
    </div>
  );
}

function Etiqueta({ estado }: { estado: EstadoDaCampanha }) {
  const { rotulo, tom } = ROTULO_DO_ESTADO[estado];
  const cor =
    tom === "bom"
      ? "border-success-line bg-success-soft text-success"
      : tom === "atencao"
        ? "border-warning-line bg-warning-soft text-warning"
        : "border-border bg-surface-2 text-text-muted";
  return <span className={`rounded-full border px-2 py-0.5 text-2xs font-medium ${cor}`}>{rotulo}</span>;
}

/**
 * Data e hora no fuso do NAVEGADOR, e não num fuso fixo.
 *
 * O campo de agendamento é um `datetime-local`, que o navegador interpreta no
 * fuso da máquina de quem digita. Exibir num fuso fixo faria a tela mostrar um
 * horário diferente do que a pessoa acabou de escolher, que é pior do que
 * qualquer imprecisão de fuso.
 *
 * A consequência é que o texto renderizado no servidor pode diferir do do
 * navegador (fusos diferentes), e é por isso que quem imprime estas datas leva
 * `suppressHydrationWarning`.
 */
function quandoLegivel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A janela do aviso em português, conforme o estado. */
function Janela({ c, estado }: { c: CampanhaNaTela; estado: EstadoDaCampanha }) {
  const inicio = quandoLegivel(c.publicarEm);
  const fim = quandoLegivel(c.encerrarEm);
  if (estado === "agendada") {
    return (
      <>
        Começa a aparecer em <strong>{inicio}</strong>
        {fim ? <> e para em {fim}</> : null}.
      </>
    );
  }
  if (estado === "encerrada") {
    return (
      <>
        Apareceu de {inicio} até <strong>{fim}</strong>. Já não aparece para ninguém.
      </>
    );
  }
  if (estado === "desligada") {
    return (
      <>
        Parado por você. Não aparece para ninguém, e a janela configurada continua sendo de {inicio}
        {fim ? ` até ${fim}` : " sem data de parada"}.
      </>
    );
  }
  return (
    <>
      Aparecendo desde {inicio}
      {fim ? (
        <>
          , e para em <strong>{fim}</strong>
        </>
      ) : (
        <> (sem data de parada)</>
      )}
      .
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUEM VISUALIZOU — o drilldown
   ═══════════════════════════════════════════════════════════════════════════ */

/** As colunas de identidade que a visualização carrega, e que o filtro usa. */
const COLUNAS_DE_FILTRO = [
  { chave: "portal", rotulo: "Portal" },
  { chave: "perfil", rotulo: "Perfil" },
  { chave: "empresa", rotulo: "Empresa" },
  { chave: "usuario", rotulo: "Usuário" },
  { chave: "matricula", rotulo: "Matrícula" },
] as const;

type ColunaDeFiltro = (typeof COLUNAS_DE_FILTRO)[number]["chave"];

/**
 * Quem visualizou este aviso, com a data, e o filtro pelas dimensões que a
 * identidade traz.
 *
 * ── Carrega só ao ABRIR ───────────────────────────────────────────────────
 * Buscar as visualizações de todos os avisos ao montar a página seriam N
 * consultas para uma lista que a pessoa quase sempre não abre. O esqueleto sai da
 * AUSÊNCIA do resultado, como na linha de dimensão: um segundo estado
 * "carregando" ao lado divergiria do primeiro.
 *
 * ── O filtro age sobre o que foi CARREGADO, e a tela diz isso ──────────────
 * As opções oferecidas são os valores que as linhas trazem, então filtrar por um
 * valor fora da janela carregada não teria como funcionar. Quando a janela é
 * menor que o total (o que exige milhares de visualizações identificadas numa
 * campanha só), o aviso de truncamento aparece ANTES do filtro. Fazer o filtro no
 * servidor pareceria resolver e não resolveria: as OPÇÕES continuariam saindo da
 * janela, e a lista passaria a parecer completa.
 *
 * ── Só quem visualizou. E a frase que explica a ausência do outro lado ─────
 * `SEM_QUEM_NAO_VIU` vem logo depois dos números, antes da lista, porque é onde
 * ela impede a leitura errada: quem vê "7 visualizações" sem a frase ao lado
 * inventa um total para comparar.
 */
function QuemVisualizou({
  sessao,
  campanha,
}: {
  sessao: Record<string, string>;
  campanha: CampanhaNaTela;
}) {
  const [resultado, setResultado] = useState<ResultadoDeVisualizacoes | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [filtros, setFiltros] = useState<Partial<Record<ColunaDeFiltro, string>>>({});

  /*
    O efeito só BUSCA; quem zera o resultado é o clique de "Tentar de novo".
    Chamar `setResultado(null)` aqui dentro seria escrever estado no corpo do
    efeito, que cascateia render — e o esqueleto já sai da AUSÊNCIA do resultado,
    que é o mesmo princípio da linha de dimensão (um segundo estado "carregando"
    ao lado do primeiro divergiria dele).
  */
  useEffect(() => {
    let vivo = true;
    void listarVisualizacoes({ ...sessao, id: campanha.id }).then((r) => {
      if (vivo) setResultado(r);
    });
    return () => {
      vivo = false;
    };
    // `tentativa` está nas dependências para o botão "Tentar de novo" refazer a
    // busca sem um segundo caminho de código.
  }, [sessao, campanha.id, tentativa]);

  if (resultado === null) {
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-2 p-4">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  if (!resultado.ok) {
    return (
      <div className="mt-3 rounded-lg border border-warning-line bg-warning-soft p-4">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{resultado.erro}</span>
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => {
            setResultado(null);
            setTentativa((n) => n + 1);
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const painel = resultado.painel;
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border-strong bg-surface-2 p-4">
      <Numeros painel={painel} />

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>{SEM_QUEM_NAO_VIU}</span>
      </p>

      {painel.total === 0 ? (
        <EmptyState
          icon={Users}
          title="Ninguém visualizou ainda"
          description="No computador o assistente abre sozinho e traz o aviso à vista quando a pessoa entra numa tela do sistema, então este número costuma sair do zero sem ninguém clicar em nada. Ele fica em zero enquanto ninguém entrar numa tela desde que o aviso começou, e continua em zero para quem minimizou o assistente ou está no celular, onde ele não abre sozinho."
        />
      ) : (
        <Lista painel={painel} filtros={filtros} onFiltros={setFiltros} />
      )}
    </div>
  );
}

/**
 * Os números, e por que são DOIS e não um.
 *
 * OS DOIS CONTAM VISUALIZAÇÃO — LINHA DE `ai_campanha_visualizacoes` —, e nenhum
 * dos dois conta gente. O que os separa é que só o primeiro tem nome para listar.
 *
 * `identificadas` não é o número de pessoas, e a chave única não o torna um: ela
 * é `(campanha, usuario, matricula)`, e nulo é distinto de nulo. Dois casos
 * medidos fazem a MESMA pessoa aparecer mais de uma vez na contagem e na lista,
 * com datas diferentes:
 *
 *   · o acesso que traz só usuário, sem matrícula (2 de 513 acessos, declarado na
 *     migration de campanhas): a chave não dedupe contra a linha completa;
 *   · o painel que passa a enviar matrícula no meio da implantação: a pessoa
 *     ganha uma linha `(usuario, null)` e depois outra `(usuario, matricula)`.
 *
 * Com o rótulo dizendo VISUALIZAÇÕES, o mesmo nome duas vezes deixa de ser
 * contradição — são duas visualizações, e é isso que a tela está contando. Era o
 * rótulo que prometia gente; a consulta sempre contou linha.
 *
 * Somar os dois num total só produziria um número sem nome para nada: um lado tem
 * quem, o outro não, e a soma não responde nenhuma das duas perguntas.
 */
function Numeros({ painel }: { painel: PainelDeVisualizacoes }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div>
        <p className="text-2xs font-medium uppercase tracking-wide text-text-muted">
          Visualizações identificadas
        </p>
        <p className="mt-0.5 text-2xl font-semibold leading-none tabular-nums text-primary">
          {painel.identificadas}
        </p>
      </div>
      {painel.anonimas > 0 ? (
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-text-muted">
            Visualizações sem identificação
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-text">{painel.anonimas}</p>
          <p className="mt-0.5 max-w-sm text-2xs leading-relaxed text-text-muted">
            O acesso chegou sem dizer quem era a pessoa, então o aviso foi visto mas não há nome para
            listar. Com o bloco de rastreio instalado no painel esses casos deixam de acontecer:
            peça a instalação ao suporte Natcorp.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** A lista de quem visualizou, com o filtro pelas dimensões que a linha traz. */
function Lista({
  painel,
  filtros,
  onFiltros,
}: {
  painel: PainelDeVisualizacoes;
  filtros: Partial<Record<ColunaDeFiltro, string>>;
  onFiltros: (f: Partial<Record<ColunaDeFiltro, string>>) => void;
}) {
  /*
    Só oferece filtro onde ele DISCRIMINA: uma coluna com um valor só (ou nenhum)
    produz um seletor que não muda nada, e cinco seletores inúteis é o que faz
    ninguém usar o que serve. As opções saem das linhas carregadas — é o mesmo
    princípio da linha de dimensão, que oferece primeiro o que a base já enviou.
  */
  const opcoes = useMemo(() => {
    const out: Partial<Record<ColunaDeFiltro, string[]>> = {};
    for (const { chave } of COLUNAS_DE_FILTRO) {
      const vistos = new Set<string>();
      for (const l of painel.linhas) {
        const v = l[chave];
        if (v && v.trim()) vistos.add(v.trim());
      }
      if (vistos.size > 1) out[chave] = [...vistos].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    return out;
  }, [painel.linhas]);

  const filtradas = useMemo(
    () =>
      painel.linhas.filter((l) =>
        COLUNAS_DE_FILTRO.every(({ chave }) => {
          const alvo = filtros[chave];
          if (!alvo) return true;
          return (l[chave] ?? "").trim() === alvo;
        }),
      ),
    [painel.linhas, filtros],
  );

  const algumFiltro = Object.values(filtros).some((v) => !!v);
  const colunasComFiltro = COLUNAS_DE_FILTRO.filter(({ chave }) => opcoes[chave]);

  /*
    HOUVE VISUALIZAÇÃO E NENHUMA TROUXE NOME: ISSO PRECISA DE FRASE.

    Este componente só é desenhado com `total > 0`, e a lista traz apenas as
    linhas IDENTIFICADAS. Com `identificadas = 0` o resultado era um `<ul>` com
    borda e nenhuma linha dentro, sem uma palavra explicando — e esse é justamente
    o estado provável da primeira campanha de um cliente antes de o bloco de
    rastreio estar instalado, ou seja o primeiro contato com o recurso.

    O segundo ramo é o caso torto: a contagem diz que existem identificadas e a
    janela voltou vazia (linha apagada entre a contagem e a leitura). Raro, mas
    mostrar a moldura vazia ali seria o mesmo defeito.
  */
  if (painel.linhas.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum nome para listar"
        description={
          painel.identificadas === 0
            ? "Todas as visualizações deste aviso chegaram sem identificação: o assistente registra que o aviso foi visto, mas não tem como dizer quem viu. Para passar a ver nomes aqui, peça ao suporte Natcorp a instalação do bloco de rastreio no painel."
            : "A lista de nomes voltou vazia, e a contagem acima diz que existem visualizações com identificação. Feche e abra esta lista de novo; se continuar assim, fale com o suporte Natcorp."
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {painel.truncado ? (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Mostrando as {painel.linhas.length} visualizações mais recentes, de {painel.identificadas}{" "}
            com identificação. O filtro abaixo vale sobre as que estão nesta lista.
          </span>
        </p>
      ) : null}

      {colunasComFiltro.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          {colunasComFiltro.map(({ chave, rotulo }) => (
            <div key={chave} className="min-w-40">
              <Field label={rotulo} htmlFor={`filtro-${chave}`}>
                <Select
                  id={`filtro-${chave}`}
                  value={filtros[chave] ?? ""}
                  onChange={(v) => onFiltros({ ...filtros, [chave]: v || undefined })}
                  placeholder="Todos"
                  options={[
                    { value: "", label: "Todos" },
                    ...(opcoes[chave] ?? []).map((v) => ({
                      value: v,
                      label: chave === "portal" ? `${nomeDoPortal(v)} (${v})` : v,
                    })),
                  ]}
                />
              </Field>
            </div>
          ))}
          {algumFiltro ? (
            <Button type="button" variant="ghost" onClick={() => onFiltros({})}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      ) : null}

      {algumFiltro ? (
        <p className="text-xs text-text-muted">
          {filtradas.length === 0
            ? "Nenhuma visualização com esse filtro."
            : `${filtradas.length} de ${painel.linhas.length} nesta lista.`}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {filtradas.map((l) => (
          <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-text">
                {l.usuario ?? `Matrícula ${l.matricula}`}
                {l.usuario && l.matricula ? (
                  <span className="font-normal text-text-muted"> · matrícula {l.matricula}</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-2xs text-text-muted">
                {[
                  l.empresa ? `empresa ${l.empresa}` : null,
                  l.portal ? `portal do ${nomeDoPortal(l.portal)}` : null,
                  l.perfil ? `perfil ${l.perfil}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "sem outros dados no acesso"}
              </p>
            </div>
            <p className="text-2xs tabular-nums text-text-muted" suppressHydrationWarning>
              {quandoLegivel(l.vistoEm)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   O FORMULÁRIO DE AVISO
   ═══════════════════════════════════════════════════════════════════════════ */

function FormularioDeAviso({
  sessao,
  modo,
  baseCode,
  baseNome,
  nomeDaBase,
  inicial,
  presencas,
  onCancelar,
  onSalvo,
}: {
  sessao: Record<string, string>;
  modo: "cliente" | "suporte";
  baseCode: string;
  baseNome: string;
  nomeDaBase: (code: string) => string;
  inicial: FormularioDeCampanha;
  presencas: Presencas;
  onCancelar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [corpo, setCorpo] = useState(inicial.corpo);
  const [publicarEm, setPublicarEm] = useState(inicial.publicarEm);
  const [encerrarEm, setEncerrarEm] = useState(inicial.encerrarEm);
  /**
   * NASCE `false`, e o valor vem de `campanhaParaFormulario`.
   *
   * O padrão do dono é "uma vez por pessoa". Esta linha não escreve `false` à
   * mão de propósito: com o literal aqui, o padrão passaria a existir em dois
   * lugares, e nenhum CHECK do banco pega um boolean trocado (os dois valores
   * são válidos). O esquema da action também EXIGE o campo, então um formulário
   * que o esquecesse falharia alto em vez de inverter a decisão em silêncio.
   */
  const [repetir, setRepetir] = useState(inicial.repetir);
  const [restritas, setRestritas] = useState<Dimensao[]>(inicial.alcance.restritas);
  const [valores, setValores] = useState(inicial.alcance.valores);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  /** Listas de valor por dimensão, buscadas no ERP só das restrições LIGADAS. */
  const [listas, setListas] = useState<Partial<Record<Dimensao, ListaDeValores>>>({});
  /* Requisições em voo em `ref` e não em estado: o efeito depende de `listas` (é
     o que faz a guarda "já tenho esta" funcionar), então roda de novo a cada
     resposta, e sem a marca a segunda passada pediria a mesma lista. */
  const emVoo = useRef<Set<string>>(new Set());

  const regra = useMemo(() => formularioParaRegra({ restritas, valores }), [restritas, valores]);
  const frase = resumoElegibilidade(regraSemCliente(regra), nomeDaBase, "este aviso");
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
    Os problemas de preenchimento, ao vivo e pela MESMA função que a action usa
    para recusar. A tela evita o erro, a action é quem nega — duas
    implementações da mesma decisão divergiriam, e o efeito seria a tela liberar o
    botão para uma gravação que o servidor recusa.
  */
  const problemas = useMemo(
    () => problemasDaCampanha({ titulo, publicarEm, encerrarEm: encerrarEm || null }),
    [titulo, publicarEm, encerrarEm],
  );
  const problemaDe = (campo: "titulo" | "publicarEm" | "encerrarEm") =>
    problemas.find((p) => p.campo === campo)?.mensagem ?? null;

  const travadaEmOutraEmpresa = regraExcluiAPropriaBase(regra, baseCode);

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
    if (problemas.length) return setErro(problemas[0]!.mensagem);
    if (emBranco.length) {
      const nomes = emBranco.map((d) => DIMENSOES_DA_TELA.find((x) => x.dimensao === d)!.rotulo);
      return setErro(
        `${nomes.join(", ")}: você marcou "Restringir" e não escolheu nenhum valor. ` +
          `Salvar assim liberaria para todo mundo — o contrário do que você pediu. ` +
          `Escolha um valor ou volte para "Todos".`,
      );
    }
    if (travadaEmOutraEmpresa) return setErro(mensagemDeAutoExclusao(baseNome));
    setErro(null);
    iniciar(async () => {
      const r = await salvarCampanha({
        ...sessao,
        id: inicial.id,
        titulo,
        corpo,
        // O input é `datetime-local` (fuso do navegador); o banco guarda
        // `timestamptz`. A conversão é do navegador, uma vez, aqui.
        publicarEm: localParaIso(publicarEm),
        encerrarEm: encerrarEm ? localParaIso(encerrarEm) : null,
        // Sempre explícito: ver o comentário do estado, acima.
        repetir,
        regra,
      });
      if (!r.ok) return setErro(r.erro);
      onSalvo(
        inicial.id
          ? `“${titulo.trim()}” foi atualizado. Vale na próxima vez que alguém abrir o assistente.`
          : `“${titulo.trim()}” foi criado. Ele aparece a partir da data que você marcou.`,
      );
    });
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">
          {inicial.id ? "Editar aviso" : "Novo aviso"}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          O aviso aparece como primeira mensagem para quem estiver dentro do alcance que você
          definir. Ele não é e-mail: no computador o assistente pode abrir sozinho e levar o aviso
          até a pessoa; no celular, só quem abrir o chat recebe.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Título"
          htmlFor="campanha-titulo"
          required
          hint="A primeira linha que a pessoa lê. Curto e direto funciona melhor."
          error={problemaDe("titulo")}
          className="sm:col-span-2"
        >
          <Input
            id="campanha-titulo"
            value={titulo}
            maxLength={MAX_TITULO + 1}
            placeholder="Folha de setembro fechada"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </Field>

        <Field
          label="Mensagem"
          htmlFor="campanha-corpo"
          hint="Opcional. O texto que vem abaixo do título, no mesmo balão."
          className="sm:col-span-2"
        >
          <AutoGrowTextarea
            id="campanha-corpo"
            value={corpo}
            maxLength={MAX_CORPO}
            maxLines={8}
            placeholder="O holerite já está disponível para consulta no assistente."
            className={cn(controlClass, "min-h-20")}
            onChange={(e) => setCorpo(e.target.value)}
          />
        </Field>

        <Field
          label="Começa a aparecer em"
          htmlFor="campanha-inicio"
          required
          hint="Deixe como está para começar agora. O horário é o do seu computador."
          error={problemaDe("publicarEm")}
        >
          <input
            id="campanha-inicio"
            type="datetime-local"
            value={publicarEm}
            onChange={(e) => setPublicarEm(e.target.value)}
            className={`${controlClass} h-10`}
          />
        </Field>

        <Field
          label="Para de aparecer em"
          htmlFor="campanha-fim"
          hint="Opcional. Em branco, o aviso fica até você pará-lo."
          error={problemaDe("encerrarEm")}
        >
          <input
            id="campanha-fim"
            type="datetime-local"
            value={encerrarEm}
            onChange={(e) => setEncerrarEm(e.target.value)}
            className={`${controlClass} h-10`}
          />
        </Field>

        {/*
          O INTERRUPTOR DE REPETIÇÃO, e ele é segmentado e não caixa de marcar:
          os dois lados ficam escritos na tela, e o valor selecionado é sempre
          explícito. Uma caixa desmarcada obriga a pessoa a deduzir o que o
          contrário significa, e obriga o código a ter um padrão implícito.
        */}
        <div className="sm:col-span-2">
          {/* Sem `<Field>` aqui: ele embrulha o controle num `<label>`, e um
              `<label>` em volta de um grupo de botões não associa nada. O rótulo
              é o mesmo do resto do formulário (`eyebrowLabel`), e a ajuda fica
              logo abaixo, como o `Field` faria. */}
          <p className={eyebrowLabel} id="campanha-repeticao-rotulo">
            Quantas vezes cada pessoa vê
          </p>
          <div role="group" aria-labelledby="campanha-repeticao-rotulo">
            <Segmented
              value={repetir ? "sempre" : "uma"}
              onChange={(v) => setRepetir(v === "sempre")}
              options={[
                { value: "uma", label: "Uma vez por pessoa" },
                { value: "sempre", label: "Em toda abertura" },
              ]}
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{REPETICAO_AJUDA}</p>
        </div>
      </div>

      {/* PRÉVIA: o aviso como ele chega no chat. Quem escreve um título sem ver o
          resultado escreve para o campo de formulário, não para quem lê. */}
      {titulo.trim() || corpo.trim() ? (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-2xs font-medium uppercase tracking-wide text-text-muted">
            Como aparece no assistente
          </p>
          <div className="mt-2 rounded-lg border border-brand-purple-200 bg-brand-purple-50 px-3 py-2">
            <p className="text-sm font-semibold text-brand-purple-900">{titulo || "Sem título"}</p>
            {corpo.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-text">{corpo}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/*
        A FRASE, colada acima do alcance. Ela é o produto desta parte da tela, não
        um resumo: é a única coisa que impede alguém de ler "quem se encaixa nas
        duas condições" como se fosse "quem se encaixa em qualquer uma".
      */}
      <div className="rounded-lg border border-brand-purple-200 bg-brand-purple-50 px-3 py-2.5">
        <p className="text-2xs font-medium uppercase tracking-wide text-brand-purple-800">
          Quem recebe, por extenso
        </p>
        <p className="mt-1 text-sm leading-relaxed text-text">{frase}</p>
        {travadaEmOutraEmpresa ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{mensagemDeAutoExclusao(baseNome)}</span>
          </p>
        ) : null}
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
                  presenca={{
                    vistos: presencas.porDimensao[ui.dimensao],
                    conversas: presencas.conversas,
                  }}
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
        <Button
          type="button"
          onClick={salvar}
          loading={salvando}
          loadingLabel="Salvando…"
          disabled={problemas.length > 0}
        >
          {inicial.id ? "Salvar alterações" : "Criar aviso"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
