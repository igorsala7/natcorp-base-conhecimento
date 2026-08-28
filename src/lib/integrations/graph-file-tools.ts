import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { enviarParaOneDrive, PASTA } from "./graph-upload";
import { runGuard } from "./guards";
import { buildConfirmDeps } from "./confirmations";
import type { Identity } from "./params";
import type { OutFile } from "./documents";
import type { ArquivoGerado } from "@/lib/chat/arquivos-conversa-parse";

/**
 * As duas ferramentas de ARQUIVO que não cabem no cadastro.
 *
 * Todas as outras dez da Microsoft são linhas em `ai_tools`: o motor monta a
 * URL, injeta o token e devolve JSON. Estas duas não cabem ali por motivos
 * opostos e igualmente estruturais:
 *
 *  · SALVAR — o conteúdo não é parâmetro que o modelo preenche. São bytes que
 *    só existem na memória do turno (`outFiles`, alimentado por quem gera o
 *    relatório/planilha). E o corpo vai CRU: o executor sempre serializa JSON.
 *
 *  · ANEXAR — a resposta do Graph são bytes, não JSON. O arquivo passa pela
 *    máquina de anexos do chat (allowlist, magic-bytes, extração), mas o TEXTO
 *    volta no retorno da ferramenta: o contexto do turno já foi montado antes
 *    de qualquer ferramenta rodar, então registrar o anexo e devolver "deu
 *    certo" faria o modelo dizer que leu um arquivo que nunca recebeu.
 *
 * Ficam aqui, fora do `tool-builder`, para ele continuar sendo só a montagem
 * genérica — e para estas duas serem lidas por quem procurar "arquivo", não por
 * quem procurar "integração".
 */

export type CtxArquivos = {
  /** Arquivos gerados NESTE turno (relatório, planilha, gráfico), com bytes. */
  gerados: OutFile[];
  /**
   * Arquivos gerados em turnos ANTERIORES da mesma conversa — METADADO só, os
   * bytes vêm por `baixar` depois que o modelo escolher.
   *
   * Sem isto, estas ferramentas só existiam no turno em que o arquivo nasceu. E
   * "faça um PPT" e "manda por e-mail" são sempre turnos diferentes: sobrava a
   * ferramenta de e-mail COMUM, que não tem campo de arquivo, e o e-mail saía
   * sem anexo relatando sucesso.
   */
  anteriores?: ArquivoGerado[];
  /** Busca os bytes de um arquivo anterior pelo `path` do Storage. */
  baixar?: (path: string) => Promise<Buffer | null>;
  /** Token pessoal da Microsoft, já resolvido e renovado. */
  token: string;
  /** Traz o conteúdo baixado para o turno e devolve o TEXTO extraído — não um
   *  "deu certo": o contexto do turno já foi montado antes das ferramentas
   *  rodarem, então só o retorno chega ao modelo. */
  anexar?: (arq: { filename: string; mimeType: string; bytes: Buffer }) => Promise<string>;
  fetchImpl?: typeof fetch;
  graphBase?: string;
  /** Identidade e base — só para a CONFIRMAÇÃO do envio de e-mail. */
  identity?: Identity;
  baseCode?: string;
};

/**
 * Anexo dentro do `sendMail` cabe em ~3 MB. Acima disso o Graph exige criar
 * rascunho e subir em sessão, que é outro fluxo — e o e-mail com anexo enorme
 * costuma ser recusado no destino de qualquer forma. Passando daqui, a
 * ferramenta troca o anexo por um LINK, em vez de falhar.
 */
const MAX_ANEXO_EMAIL = 3 * 1024 * 1024;

const GRAPH = "https://graph.microsoft.com/v1.0";

/** Teto do que faz sentido trazer para dentro de um turno de chat. */
const MAX_ANEXO = 8 * 1024 * 1024;

/** Um arquivo pronto para enviar: nome, tipo e bytes já resolvidos. */
type ArquivoPronto = { filename: string; mimeType: string; bytes: Buffer };

export function graphFileTools(ctx: CtxArquivos): ToolSet {
  const fetchImpl = ctx.fetchImpl ?? fetch;
  const base = (ctx.graphBase ?? GRAPH).replace(/\/+$/, "");
  const tools: ToolSet = {};

  // ── CATÁLOGO DO QUE DÁ PARA ENVIAR ──────────────────────────────────────
  // Deste turno (bytes em memória) MAIS os da conversa (bytes no Storage). O
  // turno vem primeiro: se o mesmo nome existe nos dois, o recém-gerado é o que
  // a pessoa está olhando na tela.
  const anteriores = ctx.anteriores ?? [];
  const nomesDisponiveis = [
    ...ctx.gerados.map((a) => a.filename),
    ...anteriores.map((a) => a.filename).filter((n) => !ctx.gerados.some((g) => g.filename === n)),
  ];
  const temArquivo = nomesDisponiveis.length > 0;

  /**
   * Acha os bytes do arquivo que o modelo pediu.
   *
   * Casamento em três degraus, do mais estrito ao mais tolerante — o modelo
   * escreve o nome de memória e erra a extensão ou o sufixo com frequência, e
   * recusar por isso obrigaria a pessoa a repetir o pedido inteiro.
   */
  async function resolverArquivo(pedido: string): Promise<ArquivoPronto | null> {
    const alvo = String(pedido ?? "").toLowerCase().trim();
    const casa = (nome: string) =>
      nome.toLowerCase() === alvo ||
      nome.toLowerCase().includes(alvo.slice(0, 20)) ||
      alvo.includes(nome.toLowerCase().replace(/\.[a-z0-9]+$/, ""));

    const doTurno = ctx.gerados.find((a) => a.filename === pedido) ?? ctx.gerados.find((a) => casa(a.filename));
    if (doTurno) {
      return { filename: doTurno.filename, mimeType: doTurno.mimeType, bytes: Buffer.from(doTurno.base64, "base64") };
    }
    const anterior = anteriores.find((a) => a.filename === pedido) ?? anteriores.find((a) => casa(a.filename));
    if (anterior && ctx.baixar) {
      const bytes = await ctx.baixar(anterior.path);
      if (bytes) return { filename: anterior.filename, mimeType: anterior.mimeType, bytes };
    }
    return null;
  }

  // ── SALVAR ────────────────────────────────────────────────────────────
  // Existe quando há arquivo gerado na CONVERSA — não só no turno. "Gera o
  // relatório" e "salva no meu drive" são turnos diferentes pelo mesmo motivo
  // que o e-mail: quem acabou de ver o arquivo pede a ação depois.
  if (temArquivo) {
    const nomes = nomesDisponiveis;
    tools.ms_arquivo_salvar = tool({
      description:
        `Salva no OneDrive da própria pessoa (pasta ${PASTA}) um arquivo que VOCÊ gerou nesta ` +
        `conversa — relatório, planilha ou gráfico. Use quando ela pedir para 'salvar na nuvem', 'guardar no ` +
        `OneDrive', 'manda pro meu drive'. Arquivos disponíveis: ${nomes.join(", ")}. Não serve para ` +
        `arquivos que já estão na nuvem nem para os que a pessoa anexou.`,
      inputSchema: z.object({
        arquivo: z
          .string()
          .describe(`Nome exato do arquivo gerado a salvar. Um destes: ${nomes.join(" | ")}`),
      }),
      execute: async ({ arquivo }) => {
        const alvo = await resolverArquivo(arquivo);
        if (!alvo) {
          return {
            erro: `Não há arquivo chamado "${arquivo}" nesta conversa. Disponíveis: ${nomes.join(", ")}.`,
          };
        }
        const r = await enviarParaOneDrive({
          token: ctx.token,
          nome: alvo.filename,
          mimeType: alvo.mimeType,
          base64: alvo.bytes.toString("base64"),
          fetchImpl,
          graphBase: base,
        });
        if (!r.ok) return { erro: r.erro };
        return {
          salvo: true,
          pasta: PASTA,
          // O nome DE VOLTA: com renomeação por conflito, pode diferir do pedido.
          nome: r.nome,
          link: r.webUrl,
          nota:
            `Confirme dizendo em que pasta ficou e com que nome — se o nome mudou (havia outro igual), ` +
            `diga isso explicitamente. Ofereça o link.`,
        };
      },
    });
  }

  // ── ANEXAR ────────────────────────────────────────────────────────────
  if (ctx.anexar) {
    tools.ms_arquivo_anexar = tool({
      description:
        "Traz para ESTA conversa o conteúdo de um arquivo que está no OneDrive/SharePoint da pessoa, para " +
        "você poder LER e analisar. Use quando ela pedir para 'analisar', 'resumir', 'ler' ou 'conferir' um " +
        "arquivo da nuvem. Exige o id do arquivo — busque antes com a ferramenta de busca de arquivo. " +
        "O conteúdo vem no retorno desta chamada; responda com base nele.",
      inputSchema: z.object({
        arquivo_id: z.string().describe("Id do arquivo, obtido na busca de arquivos."),
        nome: z.string().optional().describe("Nome do arquivo, para a resposta ficar legível."),
      }),
      execute: async ({ arquivo_id, nome }) => {
        const res = await fetchImpl(`${base}/me/drive/items/${encodeURIComponent(arquivo_id)}/content`, {
          headers: { Authorization: `Bearer ${ctx.token}` },
          // O Graph responde 302 para uma URL assinada; o fetch segue sozinho.
          redirect: "follow",
        });
        if (!res.ok) {
          return {
            erro:
              res.status === 404
                ? "Arquivo não encontrado. Busque de novo — o id pode ter mudado."
                : `Não consegui baixar o arquivo (HTTP ${res.status}).`,
          };
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) return { erro: "O arquivo está vazio." };
        if (buf.length > MAX_ANEXO) {
          return {
            erro:
              `O arquivo tem ${(buf.length / 1024 / 1024).toFixed(1)} MB e o limite para análise é 8 MB. ` +
              "Peça à pessoa um trecho ou uma versão menor.",
          };
        }
        try {
          const resumo = await ctx.anexar!({
            filename: nome?.trim() || arquivo_id,
            mimeType: res.headers.get("content-type") ?? "application/octet-stream",
            bytes: buf,
          });
          // O conteúdo vai no retorno porque é a única via que alcança o
          // modelo neste turno.
          return {
            arquivo: nome?.trim() || arquivo_id,
            conteudo: resumo,
            nota: "Responda com base NESTE conteúdo. Se ele estiver cortado, diga que leu só uma parte.",
          };
        } catch (e) {
          // Tipo não suportado cai aqui: a mensagem do guardião de arquivos diz
          // qual é o problema, e ela é mais útil que "falhou".
          return { erro: e instanceof Error ? e.message : "Não consegui ler este arquivo." };
        }
      },
    });
  }

  // ── ENVIAR E-MAIL COM O ARQUIVO GERADO ────────────────────────────────
  // Duas estratégias, escolhidas pelo TAMANHO e não pelo modelo: anexo de
  // verdade quando cabe, link do OneDrive quando não. Deixar o modelo escolher
  // produziria "não consegui, o arquivo é grande" — que é uma desculpa, não uma
  // entrega.
  if (temArquivo && ctx.identity && ctx.baseCode) {
    const nomes = nomesDisponiveis;
    tools.ms_email_enviar_arquivo = tool({
      description:
        `Envia um e-mail COM UM ARQUIVO que você gerou nesta conversa — relatório, planilha ou gráfico. ` +
        `Use quando a pessoa pedir para "mandar por e-mail", "enviar para fulano", "encaminhar o relatório". ` +
        `Vale para arquivos gerados AGORA e para os gerados ANTES nesta mesma conversa. ` +
        `Arquivos disponíveis: ${nomes.join(", ")}. Se o arquivo for grande demais para anexar, o ` +
        `sistema salva no OneDrive e manda o link automaticamente — não recuse por tamanho. Use a ferramenta ` +
        `de e-mail comum SOMENTE quando não houver arquivo a enviar.`,
      inputSchema: z.object({
        para: z.string().describe("E-mails dos destinatários, separados por vírgula."),
        assunto: z.string().describe("Assunto, curto e específico."),
        corpo: z.string().describe("Texto do e-mail, já redigido e pronto para enviar."),
        arquivo: z.string().describe(`Nome do arquivo a enviar. Um destes: ${nomes.join(" | ")}`),
      }),
      execute: async ({ para, assunto, corpo, arquivo }) => {
        const alvo = await resolverArquivo(arquivo);
        if (!alvo) {
          return { erro: `Não há arquivo chamado "${arquivo}" nesta conversa. Disponíveis: ${nomes.join(", ")}.` };
        }

        // CONFIRMAÇÃO — mesma do envio sem anexo. Reusa `runGuard` em vez de
        // reimplementar: dois caminhos de confirmação divergem com o tempo, e é
        // sempre o menos usado que fica para trás.
        const g = await runGuard("confirmation_detalhada", {
          baseUrl: base,
          baseCode: ctx.baseCode!,
          credential: null,
          identity: ctx.identity!,
          modelArgs: { para, assunto, corpo, arquivo: alvo.filename },
          confirm: buildConfirmDeps(ctx.baseCode!),
          toolKey: "ms_email_enviar_arquivo",
          actionLabel: "enviar e-mail com anexo",
        });
        if (!g.ok) return { erro: g.erro };

        const bytes = alvo.bytes;
        const destinatarios = String(para)
          .split(/[;,]/)
          .map((x) => x.trim())
          .filter(Boolean)
          .map((address) => ({ emailAddress: { address } }));
        if (destinatarios.length === 0) return { erro: "Nenhum destinatário válido." };

        let corpoFinal = corpo;
        let anexos: unknown[] = [];
        let via: "anexo" | "link" = "anexo";
        let link: string | null = null;

        if (bytes.length <= MAX_ANEXO_EMAIL) {
          anexos = [{
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: alvo.filename,
            contentType: alvo.mimeType,
            contentBytes: bytes.toString("base64"),
          }];
        } else {
          // Grande demais para anexar: sobe e manda o link. O destinatário
          // recebe algo que funciona, em vez de um erro.
          via = "link";
          const up = await enviarParaOneDrive({
            token: ctx.token, nome: alvo.filename, mimeType: alvo.mimeType,
            base64: bytes.toString("base64"), fetchImpl, graphBase: base,
          });
          if (!up.ok) return { erro: `O arquivo é grande demais para anexar e não consegui salvá-lo: ${up.erro}` };
          link = up.webUrl;
          corpoFinal = `${corpo}\n\n---\nArquivo: ${up.nome}\n${up.webUrl ?? "(link indisponível)"}`;
        }

        const res = await fetchImpl(`${base}/me/sendMail`, {
          method: "POST",
          headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: assunto,
              body: { contentType: "Text", content: corpoFinal },
              toRecipients: destinatarios,
              ...(anexos.length ? { attachments: anexos } : {}),
            },
            saveToSentItems: true,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          return { erro: j?.error?.message || `Falha ao enviar (HTTP ${res.status}).` };
        }
        return {
          enviado: true,
          para: destinatarios.map((d) => d.emailAddress.address),
          assunto,
          arquivo: alvo.filename,
          via,
          link,
          nota:
            via === "link"
              ? "Diga que o arquivo era grande demais para anexar, então foi enviado o LINK do OneDrive — e que o link ficou salvo lá."
              : "Confirme para quem foi e que o arquivo seguiu ANEXADO.",
        };
      },
    });
  }

  return tools;
}
