/**
 * Registro das gerações EM VOO, para separar duas coisas que o transporte HTTP
 * confunde num sinal só.
 *
 * Até aqui o `streamText` recebia `req.signal`, e ele dispara igual nos dois
 * casos:
 *
 *   • a pessoa clicou **Parar**        → cancelar é o certo (economiza tokens)
 *   • a pessoa **saiu do painel**      → cancelar é o ERRADO
 *
 * O segundo caso é o que doía: bastava fechar a aba com o agente no meio de uma
 * resposta para o trabalho ser jogado fora — sem resposta gravada, sem registro
 * do que aconteceu, e uma ação de escrita (criar evento, enviar e-mail) podendo
 * ficar pela metade. Como o cliente não volta para ver, ninguém percebia.
 *
 * Agora o cancelamento é EXPLÍCITO: o widget manda `runId` junto da pergunta e,
 * ao clicar Parar, chama `/api/v1/chat/stop` com esse mesmo id. Desconexão não
 * cancela mais nada — só arma um teto para o trabalho órfão não rodar sem fim.
 *
 * ── Limite conhecido ────────────────────────────────────────────────────────
 * O registro é EM MEMÓRIA do processo. Com mais de uma instância atrás de um
 * balanceador, o `stop` pode cair noutra e não achar a run — o efeito é o Parar
 * não surtir efeito, nunca um cancelamento indevido. Hoje o deploy é um
 * contêiner só; ao escalar horizontalmente, isto vira Redis (a interface deste
 * módulo não muda).
 */

/** Teto do trabalho órfão: decidido com o responsável pelo produto (09/08/2026). */
export const TETO_ORFAO_MS = 10 * 60 * 1000;

/**
 * Rede contra vazamento: se algum caminho de erro não chamar `encerrarRun`, a
 * entrada some sozinha. Bem acima do teto, para nunca competir com ele.
 */
const FAXINA_MS = TETO_ORFAO_MS + 5 * 60 * 1000;

type Run = {
  controller: AbortController;
  /** Timer do teto — só existe depois que o cliente sumiu. */
  teto?: ReturnType<typeof setTimeout>;
  /** Timer da faxina — existe sempre, desde o registro. */
  faxina?: ReturnType<typeof setTimeout>;
  /** Por que foi abortada, para o handler distinguir na hora de gravar. */
  motivo?: "parou" | "teto";
};

/** setTimeout que não segura o processo vivo (no edge, `unref` não existe). */
function agendar(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const t = setTimeout(fn, ms);
  (t as unknown as { unref?: () => void }).unref?.();
  return t;
}

const emVoo = new Map<string, Run>();

/** Id utilizável: veio do cliente, então é dado não confiável. */
export function runIdValido(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  // Só o alfabeto de um uuid/nanoid. Sem isto, um id enorme ou com lixo binário
  // vira chave permanente no Map — um vazamento de memória acionável de fora.
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

/**
 * Registra a run e devolve o sinal a passar ao `streamText`. Chamar de novo com
 * o mesmo id substitui a anterior (reenvio da mesma pergunta), abortando-a: dois
 * streams gravando a mesma conversa é pior que perder o primeiro.
 */
export function registrarRun(runId: string): AbortController {
  const anterior = emVoo.get(runId);
  if (anterior) {
    anterior.motivo = "parou";
    try { anterior.controller.abort(); } catch { }
    if (anterior.teto) clearTimeout(anterior.teto);
    if (anterior.faxina) clearTimeout(anterior.faxina);
  }
  const controller = new AbortController();
  const run: Run = { controller };
  run.faxina = agendar(() => { emVoo.delete(runId); }, FAXINA_MS);
  emVoo.set(runId, run);
  return controller;
}

/** Parar EXPLÍCITO (o usuário clicou). `false` = não havia nada em voo. */
export function pararRun(runId: string): boolean {
  const run = emVoo.get(runId);
  if (!run) return false;
  run.motivo = "parou";
  try { run.controller.abort(); } catch { }
  return true;
}

/**
 * O cliente sumiu (aba fechada, logout, rede caiu). NÃO cancela: arma o teto.
 *
 * Sem teto, uma pergunta pesada abandonada seguiria consumindo tokens sem
 * ninguém para ler — e um laço que não converge rodaria indefinidamente.
 */
export function clienteSumiu(runId: string, tetoMs = TETO_ORFAO_MS): void {
  const run = emVoo.get(runId);
  if (!run || run.teto || run.controller.signal.aborted) return;
  run.teto = agendar(() => {
    run.motivo = "teto";
    try { run.controller.abort(); } catch { }
  }, tetoMs);
}

/** Por que a run parou — para o handler gravar "interrompido" com o motivo certo. */
export function motivoDaRun(runId: string): "parou" | "teto" | null {
  return emVoo.get(runId)?.motivo ?? null;
}

/** Libera a entrada. SEMPRE em `finally` — o Map é o que vaza se esquecer. */
export function encerrarRun(runId: string): void {
  const run = emVoo.get(runId);
  if (run?.teto) clearTimeout(run.teto);
  if (run?.faxina) clearTimeout(run.faxina);
  emVoo.delete(runId);
}

/** Quantas estão em voo — só para diagnóstico e para os testes provarem que não vaza. */
export function runsEmVoo(): number {
  return emVoo.size;
}
