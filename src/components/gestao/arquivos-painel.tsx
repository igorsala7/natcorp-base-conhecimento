"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  FileUp,
  Info,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACCEPT_ATTR_MIDIA,
  extensaoAceita,
  extDe,
  MAX_ANEXO_CLIENTE_BYTES,
  MAX_ANEXO_CLIENTE_MB,
} from "@/lib/importer/file-guard";
import { avisoDeAlcance, resumoElegibilidade, type Dimensao, type Regra } from "@/lib/elegibilidade";
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
  anexarArquivoDoCliente,
  excluirArquivoDoCliente,
  valoresParaDimensao,
} from "@/app/gestao/conteudo/actions";

/**
 * OS ARQUIVOS DA PRÓPRIA EMPRESA — subir, ver, e tirar de circulação.
 *
 * A outra metade da aba Conteúdo. Acima, o cliente escolhe sobre quais
 * documentações da Natcorp o assistente responde; aqui ele traz o conteúdo
 * DELE. O pedido do dono, verbatim: *"ele pode anexar qualquer tipo de mídia
 * para ficar disponível para download, e se for word, pdf, ppt, txt ou md, o
 * usuário decidir se quer que o conteúdo seja incluído na base de conhecimento
 * e/ou disponível para download pelo usuário no chatbot, e inclusive definir
 * quem terá acesso"*.
 *
 * ── A COPY É PARA O OPERADOR DO CLIENTE ──────────────────────────────────
 * Um analista de implantação, não um engenheiro. Nada de "chunk", "RAG",
 * "vetorização", "jsonb" ou "elegibilidade" nesta tela: o que o produto chama
 * de "entrar na base de conhecimento" aparece como *o assistente pode responder
 * com o conteúdo deste arquivo*, que é a consequência que a pessoa percebe.
 *
 * ── AS DUAS ESCOLHAS SÃO INDEPENDENTES, e é isso que a tela precisa ensinar ─
 * "Responder com o conteúdo" e "deixar baixar" são coisas diferentes: um
 * contrato em PDF pode ser lido pelo assistente sem ficar disponível para
 * download, e um vídeo de treinamento pode ser baixado sem que o assistente
 * tenha uma linha de texto dele. Por isso são duas caixas e não um seletor de
 * três posições — a combinação das duas é o caso comum, não a exceção.
 *
 * ── A TERCEIRA CAIXA: o vocabulário da empresa ──────────────────────────
 * "Ensinar ao assistente os termos da sua empresa" é a ontologia por base
 * (tarefa 19), e ela é DESMARCADA por padrão pelo mesmo motivo que a tela do
 * admin usa: a varredura é uma chamada de IA por lote de texto, e nem todo
 * documento tem jargão que valha virar termo. Ela só aparece ligável junto da
 * primeira caixa, porque o vocabulário é lido do TEXTO do arquivo — sem texto
 * não há o que varrer, e o servidor recusa a combinação.
 *
 * O termo que sai daqui é DO CLIENTE: ele soma ao vocabulário da Natcorp na
 * busca daquela empresa e nunca entra no global (CHECK `ontology_terms_um_dono`).
 *
 * ── A EXCLUSÃO DIZ O QUE ACONTECE ───────────────────────────────────────
 * Pedido do dono de 24/09: *"Quando for adicionado um arquivo que vai para o
 * RAG, se for deletado precisa apagar do RAG também"*. O código faz isso (os
 * trechos somem por cascade); a confirmação é onde isso fica VISÍVEL para quem
 * está clicando — senão a pessoa acha que só tirou o arquivo da lista e o
 * assistente continuaria respondendo por ele.
 *
 * ── O TETO DE TAMANHO É UM NÚMERO SÓ, E ELE VEM DO CÓDIGO ────────────────
 * Esta tela dizia "Até 60 MB por arquivo" — o `MAX_UPLOAD_BYTES` do file-guard,
 * digitado à mão no JSX. Só que o arquivo sobe por Server Action, e o corpo dela
 * é cortado em 8 MB (`MAX_ANEXO_CLIENTE_BYTES`); acima disso o Next não devolve
 * erro de validação, devolve uma resposta ilegível, e o cliente via
 * "An unexpected response was received from the server" sem nenhuma pista de
 * que o problema era TAMANHO. Em produção o teto real é provavelmente menor
 * ainda: o nginx sem `client_max_body_size` corta em 1 MB com 413.
 *
 * Agora: a tela anuncia a constante compartilhada, recusa o arquivo grande ANTES
 * de enviar (o tamanho é conhecido no navegador) e, quando o envio morre sem
 * resposta legível, lê isso como "arquivo grande demais" em vez de repassar a
 * frase do framework. Ver o comentário de `MAX_UPLOAD_BYTES` no file-guard, que
 * é onde está escrito o que subir o teto exigiria.
 *
 * ── LISTA VAZIA ≠ LEITURA QUEBRADA ──────────────────────────────────────
 * `falhaDeLeitura` existe porque as duas coisas mostravam a MESMA tela: o estado
 * vazio, com um botão convidando a anexar. Defeito nosso apresentado como
 * convite — e com o risco de o cliente anexar de novo o que já está lá.
 */

/** Um arquivo como a tela precisa dele. Espelho de `ArquivoDaBase`, sem o Storage. */
export type ArquivoNaTela = {
  id: string;
  nome: string;
  tamanhoBytes: number | null;
  mime: string | null;
  status: string;
  naBaseDeConhecimento: boolean;
  downloadLiberado: boolean;
  regra: Regra;
  criadoEm: string;
  erro: string | null;
};

type Presencas = {
  porDimensao: Partial<Record<Dimensao, { valor: string; conversas: number }[]>>;
  conversas: number;
};

/*
  A dimensão de CLIENTE não aparece: a configuração já é da empresa de quem
  está olhando, e oferecer a lista mostraria a um cliente os códigos dos
  outros. Mesma decisão (e mesmo motivo) do painel de documentações ao lado.
*/
const SEM_CLIENTE = (ui: { dimensao: Dimensao }) => ui.dimensao !== "base";
/* Constante de módulo: um `[]` novo a cada render invalidaria o `useMemo` de
   opções dentro da linha de dimensão. */
const SEM_CADASTRO: OpcaoDeCadastro[] = [];

export function ArquivosPainel({
  sessao,
  modo,
  baseCode,
  baseNome,
  arquivos,
  presencas,
  falhaDeLeitura = false,
}: {
  /** `key` + `kbt` (cliente) ou `suporte` + `base`. A ação revalida do zero. */
  sessao: Record<string, string>;
  modo: "cliente" | "suporte";
  baseCode: string;
  baseNome: string;
  arquivos: ArquivoNaTela[];
  presencas: Presencas;
  /** A leitura da lista caiu: `arquivos` pode estar vazia OU parcial. */
  falhaDeLeitura?: boolean;
}) {
  const [abrindoEnvio, setAbrindoEnvio] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const nomeDaBase = useMemo(() => {
    const meu = baseCode.trim().toLowerCase();
    return (code: string) => (code.trim().toLowerCase() === meu ? baseNome : code);
  }, [baseCode, baseNome]);

  function excluir(a: ArquivoNaTela) {
    setConfirmandoExclusao(null);
    iniciar(async () => {
      const r = await excluirArquivoDoCliente({ ...sessao, documentId: a.id });
      if (!r.ok) {
        setErro(r.erro);
        setOk(null);
        return;
      }
      setOk(`“${a.nome}” foi excluído.`);
      setErro(null);
      router.refresh();
    });
  }

  const formulario = abrindoEnvio ? (
    <FormularioDeEnvio
      sessao={sessao}
      modo={modo}
      baseCode={baseCode}
      nomeDaBase={nomeDaBase}
      presencas={presencas}
      onCancelar={() => setAbrindoEnvio(false)}
      onEnviado={(mensagem) => {
        setAbrindoEnvio(false);
        setOk(mensagem);
        setErro(null);
        router.refresh();
      }}
    />
  ) : null;

  if (arquivos.length === 0) {
    return (
      <div className="space-y-4">
        <Mensagens erro={erro} ok={ok} />
        {formulario ??
          (falhaDeLeitura ? (
            /* NÃO é o estado vazio: a lista pode ter arquivos que não foram
               lidos. Ver `LeituraQuebrada`. */
            <LeituraQuebrada
              vazia
              pendente={pendente}
              onTentarDeNovo={() => {
                setErro(null);
                setOk(null);
                router.refresh();
              }}
            />
          ) : (
            <EmptyState
              icon={Paperclip}
              title="Nenhum arquivo da sua empresa ainda"
              description="Anexe os documentos, manuais e mídias da sua empresa. Você escolhe, arquivo por arquivo, se o assistente pode responder com o conteúdo dele, se ele fica disponível para download no chat, e quem dentro da empresa alcança cada um."
              action={
                /* Estado vazio COM ação de verdade, diferente do das documentações
                   ao lado: ali não há nada que o cliente possa fazer até a Natcorp
                   disponibilizar algo, aqui ele sempre pode anexar o primeiro. */
                <Button type="button" onClick={() => setAbrindoEnvio(true)}>
                  <FileUp aria-hidden="true" />
                  Anexar o primeiro arquivo
                </Button>
              }
            />
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Mensagens erro={erro} ok={ok} />

      {/* A lista veio, mas incompleta: o aviso vem ANTES dela, senão a pessoa lê
          a lista como se fosse tudo o que existe. */}
      {falhaDeLeitura ? (
        <LeituraQuebrada
          pendente={pendente}
          onTentarDeNovo={() => {
            setErro(null);
            setOk(null);
            router.refresh();
          }}
        />
      ) : null}

      {formulario ?? (
        <Button type="button" onClick={() => setAbrindoEnvio(true)} disabled={pendente}>
          <FileUp aria-hidden="true" />
          Anexar arquivo
        </Button>
      )}

      <ul className="space-y-2">
        {arquivos.map((a) => (
          <li key={a.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                  <span className="break-all">{a.nome}</span>
                  <Situacao status={a.status} />
                </p>

                <p className="mt-1 text-xs text-text-muted">
                  {[
                    (extDe(a.nome) || "arquivo").toUpperCase(),
                    tamanhoLegivel(a.tamanhoBytes),
                    `enviado em ${dataLegivel(a.criadoEm)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {/* O QUE ESTE ARQUIVO FAZ, em duas linhas com ícone — e a linha
                    negativa também aparece: "o assistente não responde com o
                    conteúdo" é informação, e escondê-la deixaria o leitor
                    achando que as duas coisas sempre valem. */}
                <div className="mt-1.5 space-y-0.5">
                  <Uso
                    icone={MessageSquareText}
                    ligado={a.naBaseDeConhecimento}
                    sim="O assistente responde com o conteúdo deste arquivo."
                    nao="O assistente não lê o conteúdo deste arquivo."
                  />
                  <Uso
                    icone={Download}
                    ligado={a.downloadLiberado}
                    sim="Seus usuários podem baixar este arquivo pelo chat."
                    nao="Não fica disponível para download no chat."
                  />
                </div>

                {/* A FRASE, a mesma que o formulário mostra ao vivo. Se a linha e
                    o formulário discordassem, a tela teria duas descrições da
                    mesma escolha. */}
                <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
                  {resumoElegibilidade(regraSemCliente(a.regra), nomeDaBase, "este arquivo")}
                </p>

                {/* O MOTIVO DA FALHA — e ele é alcançável desde a tarefa 18.
                    Até ali, nada escrevia `error` numa linha de base: a ingestão
                    APAGAVA a linha quando dava errado, e este parágrafo (com o
                    distintivo "Falhou") era peça morta. Foi mantido e LIGADO em
                    vez de removido, porque existe um caso em que a linha tem de
                    ficar: quando o próprio desfazer não consegue apagá-la. Ela
                    então é marcada como `error` com o motivo, e é esta linha que
                    o cliente lê para saber que aquele resíduo é para excluir —
                    antes disso ele ficava em "Processando" para sempre. */}
                {a.erro ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-warning">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>{a.erro}</span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-none items-center gap-2">
                <Button
                  type="button"
                  variant="warning"
                  onClick={() => {
                    setErro(null);
                    setOk(null);
                    setConfirmandoExclusao(a.id);
                  }}
                  disabled={pendente}
                >
                  <Trash2 aria-hidden="true" />
                  Excluir
                </Button>
              </div>
            </div>

            {confirmandoExclusao === a.id ? (
              <div className="mt-3 rounded-md border border-warning-line bg-warning-soft p-3">
                {/*
                  A CONFIRMAÇÃO DIZ O QUE ACONTECE, e as duas consequências têm
                  de estar escritas: o arquivo sai do armazenamento E sai da base
                  de conhecimento. Quem exclui está pensando em "limpar a lista";
                  o efeito é o assistente parar de responder por aquele conteúdo,
                  e isso não é visível no botão.
                */}
                <p className="text-xs leading-relaxed text-warning">
                  <strong>Excluir “{a.nome}”?</strong> O arquivo é apagado definitivamente e sai da
                  base de conhecimento: o assistente para de responder com o conteúdo dele, e ele
                  deixa de ficar disponível para download. Não dá para desfazer — para voltar atrás,
                  só anexando o arquivo de novo.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="warning" onClick={() => excluir(a)} disabled={pendente}>
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
          </li>
        ))}
      </ul>
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
 * "NÃO DEU PARA LER OS SEUS ARQUIVOS" — e por que não é o estado vazio.
 *
 * `arquivosDaBase` interrompia a paginação em silêncio e devolvia o que tinha
 * acumulado, às vezes nada. A tela então mostrava "Nenhum arquivo da sua empresa
 * ainda" com o botão "Anexar o primeiro arquivo": um defeito nosso lido como
 * convite, e um convite perigoso — o cliente anexaria de novo o que já está lá.
 *
 * As duas diferenças que importam:
 *
 *   · a AÇÃO é "Tentar de novo", não "Anexar". Anexar continua possível pela
 *     lista quando há lista, mas não é o que a tela oferece primeiro enquanto
 *     não se sabe o que já existe;
 *   · o TEXTO diz que a falha é nossa e o que fazer. "Nenhum arquivo ainda" é
 *     uma afirmação sobre os dados do cliente, e neste caso ela é falsa.
 */
function LeituraQuebrada({
  vazia = false,
  pendente,
  onTentarDeNovo,
}: {
  /** Nada foi lido (contra: leu parte, e a lista está na tela). */
  vazia?: boolean;
  pendente: boolean;
  onTentarDeNovo: () => void;
}) {
  return (
    <div className="rounded-lg border border-warning-line bg-warning-soft p-4">
      <p className="flex items-start gap-1.5 text-sm leading-relaxed text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Não foi possível ler os arquivos da sua empresa.</strong>{" "}
          {vazia
            ? "Isto é uma falha nossa, e não uma lista vazia: você pode ter arquivos anexados que não estão aparecendo aqui agora."
            : "A lista abaixo pode estar incompleta: alguns arquivos da sua empresa podem não ter sido lidos."}{" "}
          Tente de novo em alguns instantes. Enquanto a lista não carregar, evite
          anexar um arquivo que você já tenha enviado — ele pode já estar aí.
          Se continuar, fale com o suporte.
        </span>
      </p>
      <div className="mt-3">
        <Button type="button" variant="warning" onClick={onTentarDeNovo} disabled={pendente}>
          <RefreshCw aria-hidden="true" />
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}

function Uso({
  icone: Icone,
  ligado,
  sim,
  nao,
}: {
  icone: LucideIcon;
  ligado: boolean;
  sim: string;
  nao: string;
}) {
  return (
    <p
      className={[
        "flex items-start gap-1.5 text-xs leading-relaxed",
        ligado ? "text-text" : "text-text-muted",
      ].join(" ")}
    >
      <Icone className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
      <span>{ligado ? sim : nao}</span>
    </p>
  );
}

/**
 * A situação do arquivo, em palavra de produto.
 *
 * `status` é a coluna crua (`ready`, `extracting`, `queued`, `error`), e ela não
 * é para ser lida por quem está deste lado da tela. Valor desconhecido cai em
 * "Processando" em vez de imprimir o texto cru: um estado novo no banco não
 * deve vazar nome de coluna para a tela do cliente.
 *
 * "Falhou" ERA INALCANÇÁVEL, e agora não é. A ingestão apaga a linha quando algo
 * dá errado, então nenhuma linha de base chegava aqui com `error` — o distintivo
 * vermelho e o parágrafo de motivo eram UI morta. A tarefa 18 preferiu ligá-los a
 * removê-los, porque descobriu o caso em que a linha PRECISA ficar: quando o
 * desfazer não consegue apagá-la, ela é marcada como `error` em vez de ficar
 * presa em `extracting` mostrando "Processando" indefinidamente. Ver `desfazer`,
 * em `arquivos-da-base.ts`.
 */
function Situacao({ status }: { status: string }) {
  const pronto = status === "ready";
  const falhou = status === "error";
  const texto = pronto ? "Pronto" : falhou ? "Falhou" : "Processando";
  const cor = pronto
    ? "border-success-line bg-success-soft text-success"
    : falhou
      ? "border-danger-line bg-danger-soft text-danger"
      : "border-border bg-surface-2 text-text-muted";
  return <span className={`rounded-full border px-2 py-0.5 text-2xs font-medium ${cor}`}>{texto}</span>;
}

function tamanhoLegivel(bytes: number | null): string {
  if (bytes === null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

function dataLegivel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── O formulário de envio ───────────────────────────────────────────────────

function FormularioDeEnvio({
  sessao,
  modo,
  baseCode,
  nomeDaBase,
  presencas,
  onCancelar,
  onEnviado,
}: {
  sessao: Record<string, string>;
  modo: "cliente" | "suporte";
  baseCode: string;
  nomeDaBase: (code: string) => string;
  presencas: Presencas;
  onCancelar: () => void;
  onEnviado: (mensagem: string) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [naBase, setNaBase] = useState(true);
  /*
    DOWNLOAD NASCE DESLIGADO, e isto é uma decisão, não um descuido.

    Nascia `true`, e a consequência é que todo arquivo anexado ficava, por
    padrão, baixável por todo mundo da empresa que a regra alcança — uma
    distribuição que ninguém pediu. O pedido do dono diz *"e SE for [...]
    disponível para download"*, sem declarar padrão.

    Duas razões para o desligado:

      · a coluna `download_liberado` tem DEFAULT `false` no banco (conferido).
        Tela e banco discordando sobre o padrão é como um caminho de escrita
        passa a produzir resultado diferente do outro;
      · as duas direções não custam o mesmo. Arquivo que DEVERIA ser baixável e
        não está fica a um clique de distância, e quem anexou está olhando a
        tela; arquivo que NÃO deveria e está é uma distribuição que só se
        descobre quando alguém já baixou.

    Ligar de volta é uma linha (`useState(true)`), se o dono preferir o outro
    padrão. A opção continua visível e explicada na própria caixa — o que não
    existe mais é a escolha feita no lugar dele.
  */
  const [download, setDownload] = useState(false);
  /*
    VOCABULÁRIO DA EMPRESA (ontologia por base) nasce DESLIGADO — ver a caixa,
    onde o motivo está escrito na própria copy: é chamada de IA por lote de texto,
    e nem todo documento tem jargão que valha virar termo.
  */
  const [vocabulario, setVocabulario] = useState(false);
  const [restritas, setRestritas] = useState<Dimensao[]>([]);
  const [valores, setValores] = useState<Partial<Record<Dimensao, string[]>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  /**
   * Este tipo pode virar conteúdo que o assistente lê?
   *
   * `extensaoAceita` é LITERALMENTE a função que o servidor usa
   * (`podeVirarConhecimento` a chama e nada mais), e é ela aqui e não uma cópia
   * porque duas listas divergem. Não dá para importar `podeVirarConhecimento`:
   * o módulo dela é `server-only`, e arrastá-lo para um componente de cliente
   * quebraria o build.
   */
  const podeLer = arquivo ? extensaoAceita(arquivo.name) : true;

  /*
    DERIVADO, e não um `setNaBase(false)` dentro de efeito.

    Tipo sem texto desliga a escolha — uma caixa marcada e cinza deixaria a
    dúvida de se o valor vai junto, e o servidor recusaria. Derivar em vez de
    sincronizar tem um ganho que o efeito não teria: quem escolhe um vídeo por
    engano e depois troca por um PDF recupera a intenção original, em vez de
    ter de remarcar a caixa que a tela desmarcou sozinha.
  */
  const naBaseEfetivo = podeLer && naBase;

  /** Listas de valor por dimensão (só as restrições LIGADAS, uma vez cada). */
  const [listas, setListas] = useState<Partial<Record<Dimensao, ListaDeValores>>>({});
  /* Em `ref` e não em estado: o efeito depende de `listas`, então roda de novo
     a cada resposta, e sem a marca a segunda passada pediria a mesma lista. */
  const emVoo = useRef<Set<string>>(new Set());

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

  const regra = useMemo(() => formularioParaRegra({ restritas, valores }), [restritas, valores]);
  const frase = resumoElegibilidade(regraSemCliente(regra), nomeDaBase, "este arquivo");
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

  /**
   * Nenhuma das duas escolhas marcada: o arquivo não serviria para nada.
   *
   * Sai como AVISO na hora, e não só como erro no clique. Com o download nascendo
   * desligado (ver acima), quem escolhe um vídeo ou uma imagem — tipo que não vira
   * conteúdo — cai neste estado sem ter desmarcado nada, e descobrir isso só
   * depois de clicar "Anexar" seria trocar um padrão perigoso por um beco.
   */
  const semUso = !naBaseEfetivo && !download;

  /**
   * O ARQUIVO GRANDE É RECUSADO NO NAVEGADOR, antes de a requisição sair.
   *
   * O tamanho é conhecido aqui, e é o único lugar em que a recusa consegue DIZER
   * "tamanho": passado o teto do corpo da Server Action, o Next devolve uma
   * resposta que o cliente não sabe ler e o console mostra "An unexpected
   * response was received from the server" — sem nenhuma pista da causa.
   *
   * O arquivo nem fica selecionado: deixá-lo escolhido com uma mensagem de erro
   * convidaria a clicar "Anexar" de novo e bater no mesmo muro.
   */
  function escolherArquivo(f: File | null) {
    if (!f) {
      setErro(null);
      return setArquivo(null);
    }
    if (f.size > MAX_ANEXO_CLIENTE_BYTES) {
      setArquivo(null);
      return setErro(
        `“${f.name}” tem ${tamanhoLegivel(f.size)}, e o limite é ${MAX_ANEXO_CLIENTE_MB} MB por arquivo. ` +
          `Envie uma versão menor (um PDF salvo com imagens comprimidas, por exemplo) ou divida o conteúdo ` +
          `em mais de um arquivo. Se precisar anexar algo maior, fale com o suporte.`,
      );
    }
    setErro(null);
    setArquivo(f);
  }

  function enviar() {
    if (!arquivo) return setErro("Escolha um arquivo.");
    // Segunda conferência do tamanho: `escolherArquivo` já recusa, e esta existe
    // para o caso de o estado ter sido montado por outro caminho.
    if (arquivo.size > MAX_ANEXO_CLIENTE_BYTES) {
      return setErro(
        `“${arquivo.name}” tem ${tamanhoLegivel(arquivo.size)}, acima do limite de ${MAX_ANEXO_CLIENTE_MB} MB por arquivo.`,
      );
    }
    if (!naBaseEfetivo && !download) {
      return setErro(
        "Escolha ao menos uma coisa para o arquivo fazer: o assistente responder com o conteúdo " +
          "dele, ficar disponível para download, ou as duas.",
      );
    }
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
      /*
        `FormData` porque o arquivo tem de ATRAVESSAR, e é o transporte que o
        navegador e o Next já combinam para bytes. A regra viaja como JSON num
        campo: espalhá-la em campos soltos obrigaria a action a remontá-la, que
        é uma segunda implementação da regra.
      */
      const fd = new FormData();
      for (const [k, v] of Object.entries(sessao)) fd.set(k, v);
      fd.set("arquivo", arquivo);
      fd.set("naBaseDeConhecimento", naBaseEfetivo ? "1" : "0");
      fd.set("downloadLiberado", download ? "1" : "0");
      // `&& naBaseEfetivo` pela mesma razão do `naBaseEfetivo`: derivar em vez de
      // sincronizar por efeito preserva a intenção de quem trocou um vídeo por um
      // PDF depois de marcar a caixa, e nunca manda um pedido que o servidor
      // recusaria.
      fd.set("varrerOntologia", vocabulario && naBaseEfetivo ? "1" : "0");
      fd.set("regra", JSON.stringify(regra));

      /*
        O ENVIO PODE MORRER SEM VIRAR RESPOSTA — e a causa provável é TAMANHO.

        Dois caminhos levam aqui, e nenhum devolve `{ ok: false, erro }`:

          · o corpo passou do `bodySizeLimit` da Server Action, e o Next devolveu
            uma resposta que o cliente não sabe ler (a chamada REJEITA, e o
            console mostra "An unexpected response was received from the
            server");
          · o nginx cortou com 413 antes de a aplicação ser chamada — o padrão de
            `client_max_body_size` é 1 MB, menor que o teto que esta tela já
            confere, e o DEPLOY.md não declara outro valor.

        Nos dois a mensagem do framework é o pior diagnóstico possível: ela não
        menciona tamanho, que é justamente o que aconteceu. Então a frase daqui
        LIDERA com tamanho, mostra o tamanho do arquivo, e ainda dá saída para o
        caso de não ser isso — em vez de afirmar uma causa que não dá para provar
        daqui.
      */
      let r: Awaited<ReturnType<typeof anexarArquivoDoCliente>>;
      try {
        r = await anexarArquivoDoCliente(fd);
      } catch {
        return setErro(
          `Não foi possível enviar “${arquivo.name}” (${tamanhoLegivel(arquivo.size)}): o servidor ` +
            `interrompeu o envio antes de responder. A causa mais comum é o TAMANHO — o limite do ` +
            `servidor pode ser menor que os ${MAX_ANEXO_CLIENTE_MB} MB aceitos nesta tela. Tente um ` +
            `arquivo menor; se ele já for pequeno, fale com o suporte informando o nome e o tamanho.`,
        );
      }
      if (!r.ok) return setErro(r.erro);
      /*
        A VARREDURA DE VOCABULÁRIO É ASSÍNCRONA, e a mensagem diz isso.

        O arquivo já está no ar quando esta linha roda; os termos, não — eles
        saem de um job no worker. Sem a frase, quem marcou a caixa perguntaria
        no mesmo minuto por que o apelido interno ainda não é entendido.
      */
      const vocab = vocabulario && naBaseEfetivo ? " Os termos da sua empresa estão sendo aprendidos e passam a valer nas respostas em alguns minutos." : "";
      onEnviado(
        r.chunks > 0
          ? `“${arquivo.name}” foi anexado. O assistente já pode responder com o conteúdo dele.${vocab}`
          : `“${arquivo.name}” foi anexado e está disponível para download.`,
      );
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Anexar um arquivo da sua empresa</h3>
        {/* O NÚMERO VEM DA CONSTANTE, e é o MENOR teto que se aplica de fato —
            ver o cabeçalho deste arquivo. Escrito à mão no JSX, ele dizia 60 MB
            e o envio quebrava em 8. */}
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Documento, planilha, apresentação, imagem, vídeo, áudio ou pacote compactado. Até{" "}
          {MAX_ANEXO_CLIENTE_MB} MB por arquivo.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-6 text-center transition-colors hover:border-brand-purple-300">
        <FileUp className="size-5 text-text-muted" aria-hidden="true" />
        <span className="text-sm font-medium text-text">
          {arquivo ? arquivo.name : "Clique para escolher o arquivo"}
        </span>
        <span className="text-xs text-text-muted">
          {arquivo
            ? `${(extDe(arquivo.name) || "arquivo").toUpperCase()} · ${tamanhoLegivel(arquivo.size)} — clique para trocar`
            : "PDF, Word, PowerPoint, Excel, texto, Markdown, imagem, vídeo, áudio ou ZIP"}
        </span>
        <input
          type="file"
          accept={ACCEPT_ATTR_MIDIA}
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            escolherArquivo(e.target.files?.[0] ?? null);
            // Zera para que escolher o MESMO arquivo de novo dispare o evento.
            e.target.value = "";
          }}
        />
      </label>

      <fieldset className="space-y-2.5 rounded-lg border border-border bg-surface p-3">
        <legend className="px-1 text-xs font-semibold text-text">O que este arquivo faz</legend>
        <Checkbox
          checked={naBaseEfetivo}
          onChange={setNaBase}
          disabled={!podeLer}
          label="O assistente pode responder com o conteúdo deste arquivo"
          description={
            podeLer
              ? "O texto do arquivo passa a valer nas respostas do chat, com a fonte citada."
              : `Não vale para .${extDe(arquivo?.name ?? "") || "este tipo"}: não há texto para o assistente ler. Deixe só o download.`
          }
        />
        <Checkbox
          checked={download}
          onChange={setDownload}
          label="Meus usuários podem baixar este arquivo pelo chat"
          description="Quando o assistente citar este arquivo, quem tiver acesso vê um link para baixá-lo."
        />
        {/*
          NENHUMA DAS DUAS MARCADA: avisa AGORA, e não no clique.

          O servidor recusa este caso (arquivo que não serve para nada), e o
          clique também — mas com o download nascendo desligado, escolher um
          vídeo ou uma imagem cai aqui sem a pessoa ter desmarcado nada. O aviso
          na própria caixa é o que transforma "por que não deixa anexar?" em
          "ah, tenho de marcar uma".
        */}
        {semUso ? (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Marque ao menos uma das duas. Sem nenhuma, o arquivo ficaria guardado sem o assistente
              ler o conteúdo e sem ninguém poder baixá-lo.
            </span>
          </p>
        ) : null}
        {/*
          O VOCABULÁRIO DA EMPRESA — desmarcado por padrão, e não por cautela
          genérica: a varredura é uma chamada de IA por lote de texto, e nem todo
          documento tem jargão que valha virar termo (é o mesmo motivo escrito em
          `ingestKnowledgeFile`, a porta do admin). Quem liga ganha o outro lado:
          o assistente passa a achar o conteúdo mesmo quando a pessoa pergunta com
          a palavra da casa em vez da palavra do manual.

          Fica ATRÁS da primeira caixa porque o vocabulário sai do TEXTO: sem
          conteúdo lido não há o que varrer, e o servidor recusa a combinação.
          Desmarcar a primeira desmarca esta, em vez de deixar um pedido que
          nasceria recusado.
        */}
        <Checkbox
          checked={vocabulario && naBaseEfetivo}
          onChange={setVocabulario}
          disabled={!naBaseEfetivo}
          label="Ensinar ao assistente os termos próprios da sua empresa"
          description={
            naBaseEfetivo
              ? "O assistente aprende como a sua empresa chama as coisas neste arquivo (apelidos, siglas, nomes internos) e passa a encontrar o conteúdo mesmo quando a pergunta usa a palavra da casa. Vale só para a sua empresa. Leva alguns minutos depois do envio."
              : "Disponível quando o assistente puder responder com o conteúdo do arquivo: os termos são lidos do texto dele."
          }
        />
      </fieldset>

      {/* QUEM ALCANÇA. Fechado não é opção: a escolha padrão (todo mundo da
          empresa) precisa estar visível, senão quem quer restringir não
          descobre que dá. */}
      <div className="space-y-3">
        <div className="rounded-lg border border-brand-purple-200 bg-brand-purple-50 px-3 py-2.5">
          <p className="text-2xs font-medium uppercase tracking-wide text-brand-purple-800">
            Quem pode usar este arquivo
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

        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {modo === "suporte"
              ? "Modo suporte: sem login do ERP, as listas de empresa, filial e centro de custo não carregam — digite o código à mão."
              : "As listas de empresa, filial, centro de custo e afins vêm do cadastro do seu ERP, consultadas com o seu login. Deixe tudo em “Todos” para o arquivo valer para a empresa inteira."}
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
                    onAlternar={(v) => {
                      setErro(null);
                      setRestritas((prev) =>
                        v ? [...new Set([...prev, ui.dimensao])] : prev.filter((x) => x !== ui.dimensao),
                      );
                    }}
                    onValores={(v) => {
                      setErro(null);
                      setValores((prev) => ({ ...prev, [ui.dimensao]: v }));
                    }}
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
      </div>

      {erro ? (
        <p
          role="alert"
          className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-xs font-medium leading-relaxed text-danger"
        >
          {erro}
        </p>
      ) : null}

      {/* ESTADO DE CARREGAMENTO: o envio sobe o arquivo E, quando o assistente
          vai lê-lo, extrai o texto — pode levar dezenas de segundos. O esqueleto
          ocupa o lugar da linha que vai nascer, em vez de um giro sem lugar. */}
      {enviando ? (
        <div className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-40" />
          <p className="pt-1 text-xs text-text-muted">
            {naBaseEfetivo
              ? "Enviando e lendo o conteúdo do arquivo. Isso pode levar alguns instantes."
              : "Enviando o arquivo."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={enviar}
          loading={enviando}
          loadingLabel="Enviando…"
          disabled={!arquivo}
        >
          <Paperclip aria-hidden="true" />
          Anexar arquivo
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
