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
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCEPT_ATTR_MIDIA, extensaoAceita, extDe } from "@/lib/importer/file-guard";
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
 * ── O QUE NÃO ESTÁ AQUI, e por que ──────────────────────────────────────
 * NÃO existe opção de varredura de ontologia (o "vocabulário" do cliente). As
 * tabelas de ontologia exigem `space_id NOT NULL` e arquivo de empresa não
 * pertence a documentação nenhuma, então a ingestão RECUSA o pedido com o
 * motivo. Um interruptor que sempre falha é pior que interruptor nenhum.
 * Quando existir ontologia POR BASE, a opção entra aqui, ao lado das duas.
 *
 * ── A EXCLUSÃO DIZ O QUE ACONTECE ───────────────────────────────────────
 * Pedido do dono de 24/09: *"Quando for adicionado um arquivo que vai para o
 * RAG, se for deletado precisa apagar do RAG também"*. O código faz isso (os
 * trechos somem por cascade); a confirmação é onde isso fica VISÍVEL para quem
 * está clicando — senão a pessoa acha que só tirou o arquivo da lista e o
 * assistente continuaria respondendo por ele.
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
}: {
  /** `key` + `kbt` (cliente) ou `suporte` + `base`. A ação revalida do zero. */
  sessao: Record<string, string>;
  modo: "cliente" | "suporte";
  baseCode: string;
  baseNome: string;
  arquivos: ArquivoNaTela[];
  presencas: Presencas;
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
        {formulario ?? (
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
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Mensagens erro={erro} ok={ok} />

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
  const [download, setDownload] = useState(true);
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

  function enviar() {
    if (!arquivo) return setErro("Escolha um arquivo.");
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
      fd.set("regra", JSON.stringify(regra));

      const r = await anexarArquivoDoCliente(fd);
      if (!r.ok) return setErro(r.erro);
      onEnviado(
        r.chunks > 0
          ? `“${arquivo.name}” foi anexado. O assistente já pode responder com o conteúdo dele.`
          : `“${arquivo.name}” foi anexado e está disponível para download.`,
      );
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Anexar um arquivo da sua empresa</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Documento, planilha, apresentação, imagem, vídeo, áudio ou pacote compactado. Até 60 MB por
          arquivo.
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
            setErro(null);
            setArquivo(e.target.files?.[0] ?? null);
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
          A OPÇÃO DE VOCABULÁRIO (ontologia) NÃO ENTRA AQUI — ver o cabeçalho
          deste arquivo. Ela é por documentação, e arquivo de empresa não
          pertence a nenhuma; a ingestão recusa o pedido com o motivo. Entra
          quando existir ontologia por base.
        */}
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
