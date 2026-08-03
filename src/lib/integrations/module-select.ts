import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { vocabularioDeModulos, filtrarContraVocab, pareceComposta, type ModuleTag } from "./module-match";
import { RX_VISUAL } from "@/lib/chat/report-tools";

// Re-exporta a lógica pura para os consumidores (tool-builder) sem duplicar import.
export { toolNoRecorte, vocabularioDeModulos, filtrarContraVocab, pareceComposta, type ModuleTag } from "./module-match";

export type AnalisePedido = {
  /** A resposta EXIGE consultar as APIs de dados do sistema? (false = operar a
   *  tela / how-to → dá para pular as ferramentas de dados e economizar). */
  precisaDados: boolean;
  /** Recorte por assunto (Opção A): módulos/submódulos relevantes. [] = todos. */
  modulos: ModuleTag[];
};

/**
 * ANÁLISE DO PEDIDO (Opção A + gate de dados) — um classificador RÁPIDO (mesma
 * finalidade `query_rewrite`) decide, por mensagem:
 *  1) `precisaDados`: se precisa das ferramentas de DADOS (integração) ou se é só
 *     operação de tela / dúvida de how-to (aí pula as tools → menos tokens/latência).
 *  2) `modulos`: quando precisa, o RECORTE por assunto (só as tags que as tools
 *     realmente usam — vocabulário pequeno, custo constante conforme as APIs crescem).
 *
 * Sempre CONSERVADOR: qualquer falha/dúvida → `precisaDados: true` e `modulos: []`
 * (carrega tudo), para nunca deixar o agente sem a ferramenta que precisava.
 */
export async function analisarPedido(
  pergunta: string,
  tags: ModuleTag[],
  opts?: { max?: number },
): Promise<AnalisePedido> {
  const p = (pergunta ?? "").trim();
  const forcaDados = RX_VISUAL.test(p); // relatório/PDF/gráfico/exportar → precisa das tools
  if (p.length < 3) return { precisaDados: true, modulos: [] };
  if (!(await hasAiKey("query_rewrite"))) return { precisaDados: true, modulos: [] };
  const vocab = vocabularioDeModulos(tags);
  const max = opts?.max ?? 4;
  try {
    const lista = vocab.length
      ? vocab.map((v, i) => `${i + 1}. ${v.modulo}` + (v.submodulos.length ? ` — submódulos: ${v.submodulos.join(" | ")}` : "")).join("\n")
      : "(não especificados)";
    const { object } = await generateObject({
      model: await languageModel("query_rewrite"),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({
        precisaDados: z.boolean(),
        modulos: z
          .array(z.object({ modulo: z.string(), submodulo: z.string().nullable().optional() }))
          .max(Math.max(1, max * 3))
          .optional(),
      }),
      prompt: `Você analisa a mensagem do usuário de um assistente DENTRO de um sistema de RH, em português do Brasil, e decide DUAS coisas.

1) precisaDados (boolean): a resposta EXIGE consultar os DADOS/APIs do sistema (valores reais do usuário: saldo de horas, holerite, cadastro, histórico, etc.)?
   - NÃO precisa (false) quando o usuário só quer OPERAR A TELA — clicar botão, preencher/marcar um campo com um valor que ele mesmo deu ou que já está na tela, filtrar/ordenar/destacar um relatório — ou tirar dúvida de COMO fazer (how-to/documentação).
   - PRECISA (true) quando pede um dado/valor do sistema — INCLUSIVE para preencher um campo com esse dado (ex.: "preencha o campo com o MEU salário" → precisa buscar o salário).
   - Gerar RELATÓRIO/PDF/documento, montar GRÁFICO ou EXPORTAR (planilha/CSV) os dados → precisaDados=true (precisa obter os dados e montar a visualização).
   - Selecionar/preencher um campo de ESTRUTURA organizacional (empresa, filial, centro de custo, departamento, cargo) pelo NOME costuma exigir buscar o código na estrutura → precisaDados=true.
   - Na DÚVIDA, responda true (é mais seguro carregar as ferramentas).

2) modulos: se precisaDados, TODOS os módulos da lista abaixo necessários para responder — use EXATAMENTE os nomes (no máximo ${max}). IMPORTANTE: se a mensagem tem MAIS DE UM assunto (ex.: "férias E cargos", "saldo, faltas E horas", duas ou mais perguntas), retorne UM módulo para CADA assunto — NÃO escolha só o primeiro. Se não precisaDados, vazio. Se precisaDados mas nenhum módulo casar com clareza, deixe vazio (o sistema carrega todas as ferramentas).

MÓDULOS DE DADOS DISPONÍVEIS (com submódulos):
${lista}

MENSAGEM DO USUÁRIO:
${p}`,
    });
    const precisaDados = forcaDados || object?.precisaDados !== false; // default: true (conservador)
    const sel = (object?.modulos ?? []).map((m) => ({ modulo: m.modulo, submodulo: m.submodulo ?? null }));
    let modulos = precisaDados ? filtrarContraVocab(sel, tags).slice(0, max) : [];
    // Rede p/ pergunta COMPOSTA (vários assuntos): se o classificador trouxe ≤ 1 módulo,
    // provavelmente perdeu um tópico → carrega TODAS as ferramentas (recorte vazio) para
    // não faltar a tool de um dos assuntos (ex.: "férias E cargos" cortava linha_tempo).
    if (precisaDados && modulos.length <= 1 && pareceComposta(p)) modulos = [];
    return { precisaDados, modulos };
  } catch {
    return { precisaDados: true, modulos: [] };
  }
}
