/**
 * Instrumentação UNIVERSAL das ferramentas do turno de chat.
 *
 * O problema que este módulo resolve: o log de `/admin/logs` só enxergava as
 * ferramentas de INTEGRAÇÃO, e mesmo essas só no caminho feliz. Uma chamada
 * barrada por guard, um `baseUrl` ausente, um timeout de rede, ou qualquer
 * ferramenta LOCAL (consultar_registros, montar_grafico, preencher_campo…)
 * não deixavam rastro nenhum — o motivo real ficava num `console.warn` do
 * servidor, ao qual quem opera em produção não tem acesso.
 *
 * A solução é decorar o `execute` de TODAS as tools num ponto só, em vez de
 * instrumentar builder por builder. Com isso:
 *   - toda chamada registra QUAL ferramenta e QUAIS parâmetros, sempre;
 *   - todo desfecho registra ok/erro, inclusive os `return { erro }` que hoje
 *     saem silenciosos (teto de chamadas, guard recusado, endpoint ausente);
 *   - exceção é registrada E re-lançada — o comportamento do chat não muda.
 *
 * NÃO inventa cURL. Ferramenta local não faz HTTP; o cURL continua vindo
 * pronto de `executeTool` no passo `integracoes:curl`. Um comando falso num
 * log de auditoria é pior que a ausência dele.
 *
 * Puro (sem IO, sem `server-only`): testável isolado.
 */

/** Assinatura mínima de uma tool do AI SDK — só o que precisamos decorar. */
type ToolLike = {
  execute?: (args: never, options: never) => unknown;
  [k: string]: unknown;
};
export type ToolsRecord = Record<string, ToolLike>;

export type EmitirPasso = (passo: string, info?: Record<string, unknown>) => void;

/**
 * FAMÍLIA de cada ferramenta local. Serve para a UI decidir o que mostrar: numa
 * família sem HTTP a seção de cURL fica AUSENTE (não vazia) — o leitor não fica
 * procurando um comando que nunca existiu.
 *
 * Chave desconhecida ⇒ "integracao": as tools de integração vêm do banco
 * (`ai_tools.key`, dezenas por base) e não cabem numa lista estática.
 */
export const FAMILIA_POR_TOOL: Record<string, string> = {
  // Consulta/cálculo sobre datasets já coletados
  consultar_registros: "consulta",
  agregar_valores: "consulta",
  estatisticas: "consulta",
  agrupar: "consulta",
  calcular: "consulta",
  derivar_coluna: "consulta",
  classificar_faixa: "consulta",
  projetar: "consulta",
  // Saídas visuais
  montar_grafico: "visual",
  gerar_relatorio: "visual",
  // Operação da tela do host (executadas pelo widget)
  preencher_campo: "tela",
  marcar_opcao: "tela",
  clicar_elemento: "tela",
  destacar_tela: "tela",
  tutorial_tela: "tela",
  // Coleta multi-página do relatório
  coletar_relatorio: "coleta",
  // Convite .ics
  gerar_convite: "convite",
  // Pedido de troca de fonte
  buscar_no_sistema: "fonte",
};

export function familiaDaTool(chave: string): string {
  return FAMILIA_POR_TOOL[chave] ?? "integracao";
}

/** Teto do texto de parâmetros no trace. Corta ANTES de sanitizar (custo por chamada). */
export const MAX_PARAMS_CHARS = 800;
/** Teto da mensagem de erro: o suficiente para diagnosticar, sem inflar o jsonb. */
const MAX_ERRO_CHARS = 300;

/**
 * Chaves de resumo do RETORNO que valem no log. Sem isto o `tool_fim` seria só
 * "ok:true" — e "ok" não distingue "trouxe 3.412 linhas" de "trouxe zero".
 */
const CHAVES_RESUMO = ["total", "dataset", "dados_de", "linhas", "tipo", "formato", "ref", "campo", "arquivo"];

/**
 * Redação de segredos nos args do modelo. Os args vêm do LLM (origem='modelo'),
 * então não carregam credencial por construção — mas um usuário pode ter DITADO
 * uma senha no chat e o modelo repassado num campo. Rede de segurança barata.
 */
const RX_SEGREDO = /(key|token|secret|senha|password|auth|cookie|session|credential)/i;

/** Nomes cujo valor é mascarado nos parâmetros gravados no trace. */
export function sanitizarArgs(args: unknown): unknown {
  const redigir = (v: unknown, nome?: string): unknown => {
    if (nome && RX_SEGREDO.test(nome) && typeof v !== "object") return "***";
    if (Array.isArray(v)) return v.map((x) => redigir(x));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = redigir(val, k);
      return out;
    }
    return v;
  };
  return redigir(args);
}

/** Texto dos parâmetros para o passo, já cortado e sanitizado. */
export function paramsParaTrace(args: unknown): unknown {
  const limpo = sanitizarArgs(args);
  let s: string;
  try {
    s = JSON.stringify(limpo) ?? "";
  } catch {
    return { _nao_serializavel: true };
  }
  if (s.length <= MAX_PARAMS_CHARS) return limpo;
  // Grande demais: guarda o texto cortado (legível) em vez do objeto — a UI
  // mostra como está, e as chaves continuam visíveis no começo da string.
  return { _cortado: true, texto: s.slice(0, MAX_PARAMS_CHARS) + "…" };
}

/** Extrai um resumo curto do retorno da tool (o que ela produziu). */
export function resumoDoRetorno(r: unknown): Record<string, unknown> | undefined {
  if (!r || typeof r !== "object" || Array.isArray(r)) return undefined;
  const obj = r as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of CHAVES_RESUMO) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "object") continue;
    out[k] = typeof v === "string" && v.length > 60 ? v.slice(0, 60) + "…" : v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A FORMA do retorno — a rede que fecha o ponto cego.
 *
 * `resumoDoRetorno` só fala quando o retorno traz uma das chaves conhecidas
 * (`total`, `dataset`, `linhas`…), e `tool_result` só é gravado quando o
 * resultado vira dataset. Um retorno fora desses dois moldes não deixava
 * NENHUM rastro do que voltou: em 10 dias foram 576 `tool_fim` para 241
 * `tool_result` (18/08/2026) — na maioria das chamadas não dava para saber se a
 * ferramenta devolveu vazio, demais, ou num formato que o modelo não relaciona
 * ao pedido.
 *
 * Foi esse cego que impediu de explicar um caso real: seis chamadas seguidas de
 * `relatorio_recibo_pagamento`, todas `ok:true` e `ms:0`, sem `curl` e sem
 * `tool_result` — o agente repetindo a mesma chamada até bater o teto de passos,
 * e nada no trace dizendo o que ele recebeu.
 *
 * Guarda o BARATO e o diagnóstico: tamanho, tipo e as chaves de topo. Nunca o
 * conteúdo — o retorno carrega dado de pessoa, e o trace é lido no admin.
 */
export function formaDoRetorno(r: unknown): Record<string, unknown> | undefined {
  if (r === undefined) return { tipo: "undefined" };
  if (r === null) return { tipo: "null" };
  if (typeof r !== "object") return { tipo: typeof r, bytes: String(r).length };
  let bytes = 0;
  try {
    bytes = JSON.stringify(r)?.length ?? 0;
  } catch {
    bytes = -1; // cíclico: registra que não deu para medir, em vez de omitir
  }
  if (Array.isArray(r)) return { tipo: "array", itens: r.length, bytes };
  // Só os NOMES das chaves de topo. "vazio" é a informação mais acionável:
  // um `{}` de volta é indistinguível de sucesso para quem lê "ok:true".
  const chaves = Object.keys(r as Record<string, unknown>);
  return {
    tipo: "objeto",
    bytes,
    ...(chaves.length ? { chaves: chaves.slice(0, 12) } : { vazio: true }),
  };
}

/**
 * Erro DECLARADO no retorno. Várias saídas do motor devolvem `{ erro }` em vez
 * de lançar (guard recusado, teto de chamadas, endpoint não configurado) — para
 * o modelo é dado, para o log é falha, e é justamente o que hoje some.
 */
export function erroDoRetorno(r: unknown): string | undefined {
  if (!r || typeof r !== "object") return undefined;
  const o = r as Record<string, unknown>;
  // `erro` E `_erro`. A recusa por PROCEDÊNCIA devolve `{_recusado, _erro}` —
  // com sublinhado, porque os campos que o modelo lê como metadado usam esse
  // prefixo. O detector olhava só `erro`, então toda recusa era gravada como
  // `ok: true`: o trace dizia que a ferramenta tinha funcionado enquanto ela
  // recusava a chamada. Visto em produção (19/08/2026) num turno em que o
  // agente foi barrado duas vezes e o log não registrou nenhuma.
  const e = typeof o.erro === "string" && o.erro.trim() ? o.erro : o._erro;
  if (typeof e !== "string" || !e.trim()) return undefined;
  return e.length > MAX_ERRO_CHARS ? e.slice(0, MAX_ERRO_CHARS) + "…" : e;
}

/**
 * Identificador da chamada, dado pelo SDK no 2º argumento do `execute`. É o que
 * permite correlacionar os passos de UMA chamada quando várias correm juntas.
 */
export function idDaChamada(options: unknown): string | undefined {
  const id = (options as { toolCallId?: unknown } | null | undefined)?.toolCallId;
  return typeof id === "string" && id ? id : undefined;
}

/**
 * Envolve o `execute` de cada tool com os passos `tool_call` e `tool_fim`.
 *
 * Preserva a assinatura COMPLETA `(args, options)`: o 2º argumento carrega
 * `toolCallId`, `abortSignal` e `messages`. Perder o `abortSignal` quebraria o
 * botão PARAR do widget em silêncio — por isso o repasse é posicional e cego,
 * sem desestruturar nada.
 *
 * Tool sem `execute` (as que o cliente executa) passa intacta.
 */
export function instrumentarTools<T extends ToolsRecord>(tools: T, onPasso?: EmitirPasso): T {
  if (!onPasso) return tools;
  const saida: ToolsRecord = {};
  for (const [chave, def] of Object.entries(tools)) {
    const original = def?.execute;
    if (typeof original !== "function") {
      saida[chave] = def;
      continue;
    }
    const familia = familiaDaTool(chave);
    saida[chave] = {
      ...def,
      execute: async (args: never, options: never) => {
        // `toolCallId` é a ÚNICA forma correta de casar os passos de uma chamada: o SDK
        // dispara as tool-calls de um mesmo passo em PARALELO, então elas terminam fora
        // da ordem em que começaram. Casar por ordem de chegada colava o cURL e o
        // veredito de uma chamada no cartão de outra — pior que não mostrar nada.
        const id = idDaChamada(options);
        onPasso("tool_call", { ...(id ? { id } : {}), tool: chave, familia, params: paramsParaTrace(args) });
        const t0 = Date.now();
        try {
          const r = await original(args, options);
          const erro = erroDoRetorno(r);
          onPasso("tool_fim", {
            ...(id ? { id } : {}),
            tool: chave,
            familia,
            ms: Date.now() - t0,
            ok: !erro,
            ...(erro ? { erro } : {}),
            ...(resumoDoRetorno(r) ? { resumo: resumoDoRetorno(r) } : {}),
            // Sempre — é o que garante que NENHUMA chamada termine sem rastro do
            // que voltou, inclusive as que não viram dataset nem trazem chave conhecida.
            forma: formaDoRetorno(r),
          });
          return r;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          onPasso("tool_fim", {
            ...(id ? { id } : {}),
            tool: chave,
            familia,
            ms: Date.now() - t0,
            ok: false,
            erro: msg.length > MAX_ERRO_CHARS ? msg.slice(0, MAX_ERRO_CHARS) + "…" : msg,
            excecao: true,
          });
          throw e; // o chat continua se comportando exatamente como antes
        }
      },
    };
  }
  return saida as T;
}
