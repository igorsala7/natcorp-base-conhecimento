import type { ToolSet } from "ai";

/**
 * O PORTÃO DE ACEITE DO CONSTRUTOR IA.
 *
 * Este era o único ponto do produto onde a IA escrevia em produção sem prévia.
 * O editor de blocos tem modal antes/depois para toda proposta; o Estúdio
 * materializa por um botão; aqui, a IA criava ferramentas, agentes e vínculos
 * enquanto o texto ainda estava sendo transmitido — quando a frase "criei a
 * ferramenta X" aparecia na tela, X já existia.
 *
 * O incômodo não é teórico: uma ferramenta criada com o `path_template` errado
 * fica ATIVA e passa a ser oferecida ao modelo em todas as conversas daquela
 * base até alguém notar.
 *
 * ── Por que simular e depois aplicar, e não perguntar antes ─────────────────
 * Pedir confirmação ao LLM ("resuma e pergunte") é o que o prompt já faz, e não
 * funciona: ele às vezes resume DEPOIS de executar, porque nada o impede de
 * chamar a ferramenta. A garantia tem que estar fora do modelo.
 *
 * Em simulação, cada ferramenta de ESCRITA devolve o que faria e registra a
 * operação; as de LEITURA seguem reais, porque o plano precisa ser feito com o
 * estado verdadeiro. Depois, "Aplicar" executa as operações registradas
 * DIRETAMENTE, sem passar pelo modelo de novo — reexecutar o LLM seria pedir
 * outra resposta, possivelmente diferente da que a pessoa aprovou.
 *
 * Puro em relação ao banco: só embrulha o `ToolSet` que já existe.
 */

export type Operacao = { ferramenta: string; args: Record<string, unknown> };

/** Ferramentas que só LEEM — seguem reais mesmo em simulação. */
const SO_LEITURA = new Set(["estado_atual"]);

/**
 * Embrulha o conjunto para que as escritas apenas REGISTREM.
 *
 * O retorno que a ferramenta simulada dá ao modelo diz explicitamente que nada
 * foi gravado. Sem isso o modelo assume sucesso e escreve "pronto, criei" —
 * e a pessoa lê uma afirmação falsa antes de ver o plano.
 */
export function emSimulacao(tools: ToolSet, registro: Operacao[]): ToolSet {
  const out: ToolSet = {};
  for (const [nome, def] of Object.entries(tools)) {
    if (SO_LEITURA.has(nome)) {
      out[nome] = def;
      continue;
    }
    out[nome] = {
      ...def,
      execute: async (args: unknown) => {
        registro.push({ ferramenta: nome, args: (args ?? {}) as Record<string, unknown> });
        return {
          simulado: true,
          aviso:
            "PLANEJADO, não gravado. Nada foi alterado ainda — a pessoa vai revisar e aprovar. " +
            "Não diga que já criou ou já alterou; diga o que VAI acontecer quando ela aprovar.",
        };
      },
    } as ToolSet[string];
  }
  return out;
}

/** Rótulos em português para o plano — o nome interno não é para o leitor. */
const ROTULO: Record<string, string> = {
  salvar_ferramenta: "Criar ou editar a ferramenta",
  salvar_agente: "Criar ou editar o agente",
  vincular: "Vincular ferramenta ao agente",
  desvincular: "Desvincular ferramenta do agente",
};

/**
 * O plano em texto, uma linha por operação.
 *
 * Mostra a CHAVE junto do rótulo porque é ela que identifica o objeto — "criar
 * a ferramenta consultar_ferias" e "criar a ferramenta consultar_feriass" são
 * indistinguíveis sem ver a chave, e essa é exatamente a diferença que faz uma
 * tool nascer duplicada.
 */
export function descreverPlano(ops: Operacao[]): string[] {
  return ops.map((o) => {
    const a = o.args as { key?: string; nome?: string; name?: string; tool?: string; agente?: string };
    const alvo = a.key ?? a.name ?? a.nome ?? [a.agente, a.tool].filter(Boolean).join(" ← ");
    return `${ROTULO[o.ferramenta] ?? o.ferramenta}${alvo ? `: ${alvo}` : ""}`;
  });
}
