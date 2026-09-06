import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { languageModel, aiTimeout, hasAiKey } from "@/lib/ai/config";
import { vocabularioProximo } from "@/lib/ai/ontology";
import { limparConsulta } from "@/lib/ai/query-clean";
import { vocabularioDeModulos, filtrarContraVocab, pareceComposta, type ModuleTag } from "@/lib/integrations/module-match";
import { RX_VISUAL } from "@/lib/chat/report-tools";

/**
 * PLANO ÚNICO DE INTENÇÃO — o §B do plano externo, na versão que a dependência
 * de dados permite. **Não está ligado à produção.** Existe para ser medido por
 * `scripts/eval-plano.ts` contra o que os classificadores de hoje decidiram.
 *
 * ── O QUE DÁ PARA JUNTAR, E O QUE NÃO DÁ ────────────────────────────────────
 * O plano pede um `IntentPlan` só, absorvendo reescrita, módulo, facetas e
 * cobertura. Fui conferir o preparo antes de acreditar, e ele não é o que o
 * documento supõe:
 *
 *   query_rewrite          745 ms   ida ao MODELO   (interpretarConsulta)
 *   integracoes:analise  1.648 ms   ida ao MODELO   (analisarPedido)
 *   integracoes:cobertura  723 ms   ida ao MODELO   (catalogoCobre)
 *   facetas                981 ms   EMBEDDING       (dividirFacetas é pura)
 *   rag                    511 ms   EMBEDDING + busca
 *
 * São TRÊS idas ao modelo, não quatro — `facetas` é `simToolsMulti`, um
 * embedding por intenção, e nenhum planner unificado o elimina.
 *
 * E das três, só duas são juntáveis. `catalogoCobre` recebe `candidatas`, que
 * saem do embedding, que precisa da consulta reescrita: existe uma dependência
 * real de dados entre reescrita → embedding → candidatas → cobertura. Juntar a
 * cobertura obrigaria a mandar o catálogo inteiro no lugar das candidatas — que
 * é exatamente o custo que aquele passo existe para não pagar.
 *
 * Então isto funde DUAS: reescrita + análise. As duas só olham a mensagem, o
 * histórico e a tela, e hoje são serializadas por acidente de construção — a
 * análise recebe `consultaClassificador`, derivado da reescrita (route.ts:839).
 *
 * ── O QUE ISTO PODE GANHAR, E O QUE PODE PERDER ─────────────────────────────
 * Ganho: uma ida ao modelo a menos no caminho crítico (~745 ms) e o fim de uma
 * contradição possível — hoje a reescrita pode substituir a pergunta e a análise
 * classifica o texto substituído.
 * Risco: fundir dois classificadores especializados num prompt só costuma piorar
 * os dois. É exatamente por isso que isto nasce medido e desligado.
 *
 * ── O VEREDITO DA PRIMEIRA MEDIÇÃO: AINDA NÃO ───────────────────────────────
 * `npm run eval:plano -- --n 30`, contra turno real de 20 dias:
 *
 *   precisaDados igual        24/30   80%
 *   recorte de módulos igual   9/30   30%
 *   recorte com sobreposição  15/30   50%
 *   consulta equivalente       6/30   20%   (jaccard ≥ 0,60)
 *   latência                1.242 ms  contra 2.393 ms das duas idas de hoje
 *
 * Metade do tempo, e decisão diferente em 70% dos turnos — **sem gabarito que
 * diga qual das duas está certa**. `eval/cenarios.jsonl` rotula FERRAMENTA
 * esperada, não módulo esperado nem consulta esperada, então não há como
 * promover isto sem estar trocando prompt e classificador ao mesmo tempo, às
 * cegas. É precisamente o que a lista de proibições do próprio plano externo
 * veda ("não alterar simultaneamente modelo, prompt, dataset de eval e
 * limiares, pois isso destrói causalidade").
 *
 * O que destrava: gabarito de INTENÇÃO (módulo e consulta esperados por caso),
 * que é rotulação do dono. Até lá isto fica aqui, medido e desligado.
 *
 * ── FALHA ABERTA, IGUAL AOS DOIS QUE ELE SUBSTITUIRIA ───────────────────────
 * Qualquer erro devolve o conservador de hoje: consulta = pergunta original,
 * `precisaDados: true`, `modulos: []` (carrega tudo). Um planner que derruba o
 * turno seria pior que o problema que resolve.
 */

export type PlanoIntencao = {
  /** Consulta normalizada para o RAG e para o embedding de ferramentas. */
  consulta: string;
  /** A resposta EXIGE consultar as APIs de dados? (o `precisaDados` de hoje) */
  precisaDados: boolean;
  /** Recorte por assunto. `[]` = todos (conservador). */
  modulos: ModuleTag[];
  /** Pedido com mais de uma intenção — hoje isto é heurística léxica separada. */
  composto: boolean;
  /** 0 quando o plano veio do fallback; nunca use o fallback como se fosse juízo. */
  confianca: number;
  /** De onde veio: `modelo` ou o motivo do fallback. Vai ao trace e ao eval. */
  origem: "modelo" | "sem_chave" | "curta" | "erro";
};

/** O conservador. Idêntico ao que `interpretarConsulta` e `analisarPedido` devolvem ao falhar. */
function fallback(pergunta: string, origem: PlanoIntencao["origem"]): PlanoIntencao {
  return { consulta: pergunta, precisaDados: true, modulos: [], composto: false, confianca: 0, origem };
}

const Schema = z.object({
  consulta: z.string(),
  precisaDados: z.boolean(),
  modulos: z
    .array(z.object({ modulo: z.string(), submodulo: z.string().nullable().optional() }))
    .optional(),
  composto: z.boolean().optional(),
  confianca: z.number().min(0).max(1).optional(),
});

export async function planejarIntencao(args: {
  spaceIds: string | string[];
  pergunta: string;
  historico?: { role: string; content: string }[];
  contextoTela?: string;
  tags: ModuleTag[];
  /** Máximo de módulos no recorte. Espelha `analisarPedido`. */
  max?: number;
  /** Só para medição, como em `interpretarConsulta`. Em produção nunca é passado. */
  modeloMedicao?: Parameters<typeof generateObject>[0]["model"];
}): Promise<PlanoIntencao> {
  const p = (args.pergunta ?? "").trim();
  if (p.length < 3) return fallback(args.pergunta, "curta");
  if (!args.modeloMedicao && !(await hasAiKey("query_rewrite"))) return fallback(args.pergunta, "sem_chave");

  const ids = Array.isArray(args.spaceIds) ? args.spaceIds : [args.spaceIds];
  const max = args.max ?? 4;
  try {
    const recentes = (args.historico ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-6, -1)
      .map((m) => `${m.role === "user" ? "USUÁRIO" : "ASSISTENTE"}: ${m.content}`)
      .join("\n");

    const supabase = createAdminClient();
    const vocab = await vocabularioProximo(supabase, ids, `${p}\n${recentes}`).catch(() => "");
    const modulos = vocabularioDeModulos(args.tags);
    const lista = modulos.length
      ? modulos.map((v, i) => `${i + 1}. ${v.modulo}` + (v.submodulos.length ? ` — submódulos: ${v.submodulos.join(" | ")}` : "")).join("\n")
      : "(não especificados)";

    const { object } = await generateObject({
      model: args.modeloMedicao ?? (await languageModel("query_rewrite")),
      abortSignal: aiTimeout("query_rewrite"),
      schema: Schema,
      prompt: `Você prepara o turno de um assistente DENTRO de um sistema de RH, em português do Brasil. Numa única passada, produza QUATRO coisas sobre a MENSAGEM abaixo.

1) consulta: UMA consulta de busca curta e clara, no vocabulário da documentação.
   - Resolva referências do histórico ("e como cancelo?" → retome o assunto anterior).
   - Se a mensagem for VAGA ou apontar para "isto/isso/aqui" e houver TELA ATUAL, use o nome da tela. Se a mensagem já tiver assunto próprio, IGNORE a tela.
   - Corrija digitação e troque gíria pelo TERMO do produto quando o VOCABULÁRIO casar.
   - NÃO responda a pergunta e NÃO invente assunto que não está na mensagem. Se já estiver clara, devolva-a essencialmente como está.

2) precisaDados: a resposta EXIGE consultar os DADOS/APIs do sistema (valores reais: saldo de horas, holerite, cadastro, histórico) OU EXECUTAR uma ação em nome do usuário?
   - false quando ele só quer OPERAR A TELA (clicar, preencher/marcar campo com valor que ele mesmo deu ou que já está na tela, filtrar/ordenar/destacar) ou tirar dúvida de COMO fazer.
   - true quando pede um dado do sistema — inclusive para preencher um campo com esse dado.
   - Na dúvida, true.

3) modulos: até ${max} do vocabulário abaixo, os que a mensagem realmente toca. Vazio quando não der para decidir — vazio significa "carregue todos", e é o lado seguro.

4) composto: a mensagem pede mais de uma coisa distinta (duas perguntas, ou pergunta + ação)?

Devolva também confianca (0 a 1): o quanto você tem certeza de precisaDados e modulos juntos. Abaixo de 0,5 quando a mensagem for ambígua ou depender de contexto que não está aqui.

MÓDULOS DISPONÍVEIS:
${lista}

VOCABULÁRIO DA DOCUMENTAÇÃO (termos canônicos e sinônimos): ${vocab || "(indisponível)"}

TELA ATUAL DO USUÁRIO: ${(args.contextoTela ?? "").trim() || "(desconhecida)"}

HISTÓRICO RECENTE:
${recentes || "(início)"}

MENSAGEM DO USUÁRIO:
${p}`,
    });

    // `RX_VISUAL` manda: pedido de relatório/PDF/gráfico precisa das ferramentas
    // aconteça o que acontecer com o classificador. Mesma regra de `analisarPedido`.
    const precisaDados = RX_VISUAL.test(p) || object.precisaDados !== false;
    const sel = (object.modulos ?? []).map((m) => ({ modulo: String(m.modulo), submodulo: m.submodulo ?? null }));
    // O MESMO pós-processamento de `analisarPedido`, de propósito: se o eval
    // comparasse um planner cru contra um classificador com rede, mediria a
    // rede, não o planner. Ver `filtrarContraVocab` e a rede de composta.
    let recorte = precisaDados ? filtrarContraVocab(sel, args.tags).slice(0, max) : [];
    const composto = object.composto === true || pareceComposta(p);
    if (precisaDados && recorte.length <= 1 && composto) recorte = [];

    return {
      consulta: limparConsulta(object.consulta ?? "", args.pergunta),
      precisaDados,
      modulos: recorte,
      composto,
      confianca: typeof object.confianca === "number" ? object.confianca : 0.5,
      origem: "modelo",
    };
  } catch {
    return fallback(args.pergunta, "erro");
  }
}
