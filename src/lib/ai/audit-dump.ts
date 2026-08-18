import "server-only";

/**
 * CAPTURA O PROMPT REAL DE UM TURNO, PARA A AUDITORIA MEDIR O QUE EXISTE.
 *
 * A auditoria de agentes (`.claude/skills/agent-audit`) lê o prompt do agente do
 * banco — `ai_agents.system_prompt`. Medido em 399 turnos, isso é o bloco
 * `persona`: **226 tokens de um system prompt de 13.445**. Os outros 98% são
 * montados em tempo de execução por `composeSystemPrompt` (rag 4.785 em média,
 * scan 1.341, formAssist 1.200, report 941…).
 *
 * Auditar o que está no banco mediria o bloco errado — e a própria skill avisa
 * que auditoria sobre extração errada é pior que nenhuma auditoria. Este módulo
 * grava o prompt JÁ MONTADO de um turno real, junto com as amostras de conteúdo
 * dinâmico que a skill pede (`samples:`): ontologia resolvida, trecho de RAG e
 * resultado de ferramenta.
 *
 * ── Desligado por padrão, e por quê ─────────────────────────────────────────
 * Só roda com `AUDIT_DUMP_PROMPT=1`. O prompt montado contém dado do turno —
 * nome de colaborador, valores da tela, trecho de documentação do cliente. Isso
 * é diagnóstico, não telemetria: liga-se para uma captura e desliga-se depois.
 *
 * Grava UMA vez por processo. Sem isso, cada turno sobrescreveria o anterior e a
 * captura viraria "o último turno de quem estava usando", que raramente é o que
 * se quer medir.
 *
 * Best-effort em tudo: falha de escrita não pode derrubar uma conversa. O
 * relatório sem uma amostra é ruim; o chat caído é pior.
 */

let jaGravou = false;

export type BlocosDoTurno = {
  systemPrompt: string;
  /** Conteúdo por bloco, com o mesmo nome que aparece no passo `prompt_blocks`. */
  blocos: Record<string, string | undefined>;
  /** Glossário da ontologia já resolvido para este turno. */
  ontologia?: string;
  /** Um trecho de RAG como ele chega ao prompt. */
  ragTrecho?: string;
  /** Resultado de uma ferramenta, como o modelo o recebeu. */
  toolResult?: unknown;
};

export function auditDumpLigado(): boolean {
  return process.env.AUDIT_DUMP_PROMPT === "1";
}

/**
 * Grava a captura em `.audit/`. Devolve os caminhos escritos, ou `null`.
 *
 * `fs` e `path` entram por import DINÂMICO: este módulo é importado pela rota de
 * chat, que roda em todo turno, e não faz sentido carregar o módulo de arquivo
 * quando a flag está desligada — que é o caso em 100% da produção.
 */
export async function dumpPromptDoTurno(b: BlocosDoTurno): Promise<string[] | null> {
  if (!auditDumpLigado() || jaGravou) return null;
  jaGravou = true; // antes do await: dois turnos simultâneos não podem duplicar

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), ".audit");
    const amostras = path.join(dir, "samples");
    await fs.mkdir(amostras, { recursive: true });

    const escritos: string[] = [];
    const gravar = async (rel: string, conteudo: string) => {
      const p = path.join(dir, rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, conteudo, "utf-8");
      escritos.push(p);
    };

    await gravar("system_prompt.txt", b.systemPrompt);

    /**
     * Um arquivo por bloco, além do prompt inteiro.
     *
     * O prompt inteiro responde "quanto custa o turno"; os blocos separados
     * respondem "quanto custa CADA parte", que é a pergunta que leva a uma
     * decisão. Sem eles, a conclusão possível é "o prompt é grande" — que já se
     * sabia.
     */
    for (const [nome, texto] of Object.entries(b.blocos)) {
      if (texto && texto.trim()) await gravar(`blocos/${nome}.txt`, texto);
    }

    if (b.ontologia?.trim()) await gravar("samples/ontologia_resolvida.txt", b.ontologia);
    if (b.ragTrecho?.trim()) await gravar("samples/rag_chunk.txt", b.ragTrecho);
    if (b.toolResult !== undefined) {
      await gravar("samples/tool_result.json", JSON.stringify(b.toolResult, null, 2).slice(0, 200_000));
    }

    console.log(`[audit] prompt do turno capturado em ${dir} (${escritos.length} arquivos)`);
    return escritos;
  } catch (e) {
    console.error("[audit] falha ao capturar o prompt:", e instanceof Error ? e.message : e);
    return null;
  }
}
