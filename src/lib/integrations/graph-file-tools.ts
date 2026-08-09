import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { enviarParaOneDrive, PASTA } from "./graph-upload";
import type { OutFile } from "./documents";

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
  /** Arquivos gerados NESTE turno (relatório, planilha, gráfico). */
  gerados: OutFile[];
  /** Token pessoal da Microsoft, já resolvido e renovado. */
  token: string;
  /** Traz o conteúdo baixado para o turno e devolve o TEXTO extraído — não um
   *  "deu certo": o contexto do turno já foi montado antes das ferramentas
   *  rodarem, então só o retorno chega ao modelo. */
  anexar?: (arq: { filename: string; mimeType: string; bytes: Buffer }) => Promise<string>;
  fetchImpl?: typeof fetch;
  graphBase?: string;
};

const GRAPH = "https://graph.microsoft.com/v1.0";

/** Teto do que faz sentido trazer para dentro de um turno de chat. */
const MAX_ANEXO = 8 * 1024 * 1024;

export function graphFileTools(ctx: CtxArquivos): ToolSet {
  const fetchImpl = ctx.fetchImpl ?? fetch;
  const base = (ctx.graphBase ?? GRAPH).replace(/\/+$/, "");
  const tools: ToolSet = {};

  // ── SALVAR ────────────────────────────────────────────────────────────
  // Só existe quando há arquivo gerado no turno. Oferecer "salvar" sem nada
  // para salvar faria o modelo prometer e depois se explicar.
  if (ctx.gerados.length > 0) {
    const nomes = ctx.gerados.map((a) => a.filename);
    tools.ms_arquivo_salvar = tool({
      description:
        `Salva no OneDrive da própria pessoa (pasta ${PASTA}) um arquivo que VOCÊ acabou de gerar nesta ` +
        `conversa — relatório, planilha ou gráfico. Use quando ela pedir para 'salvar na nuvem', 'guardar no ` +
        `OneDrive', 'manda pro meu drive'. Arquivos disponíveis agora: ${nomes.join(", ")}. Não serve para ` +
        `arquivos que já estão na nuvem nem para os que a pessoa anexou.`,
      inputSchema: z.object({
        arquivo: z
          .string()
          .describe(`Nome exato do arquivo gerado a salvar. Um destes: ${nomes.join(" | ")}`),
      }),
      execute: async ({ arquivo }) => {
        // Casa por nome exato e, se falhar, por conteúdo — o modelo às vezes
        // reescreve o nome ("o relatório") em vez de copiá-lo.
        const alvo =
          ctx.gerados.find((a) => a.filename === arquivo) ??
          ctx.gerados.find((a) => a.filename.toLowerCase().includes(String(arquivo).toLowerCase().slice(0, 20)));
        if (!alvo) {
          return {
            erro: `Não há arquivo chamado "${arquivo}" nesta conversa. Gerados agora: ${nomes.join(", ")}.`,
          };
        }
        const r = await enviarParaOneDrive({
          token: ctx.token,
          nome: alvo.filename,
          mimeType: alvo.mimeType,
          base64: alvo.base64,
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

  return tools;
}
