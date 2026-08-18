/**
 * O widget aparece nesta base, neste painel?
 *
 * Três chaves independentes decidem, e cada uma responde a uma pergunta
 * diferente — por isso nenhuma substitui a outra:
 *
 *   `widget_keys.active`   o widget daquele PAINEL está no ar (vale para todos
 *                          os clientes)
 *   `ai_bases.active`      o cliente está ativo (desliga também as integrações)
 *   `widget_paineis`       ESTE cliente liberou ESTE painel
 *
 * ── A postura mudou em 18/08: NEGAR na dúvida ───────────────────────────────
 * A versão anterior permitia quando faltava informação — sem painel
 * identificado, o widget aparecia. A intenção era boa (um turno sem painel não
 * está em painel nenhum), mas o efeito medido em produção foi outro:
 *
 *   GET /api/v1/config COM token de base inativa  → {"desativado":true}   ok
 *   GET /api/v1/config SEM token                  → {"config":{…}}        ❌
 *
 * Desativar a base não tinha efeito nenhum numa tela que não gera o token. E
 * `ai_bases.active = false` significa "este cliente está desligado" — falhar
 * ABRINDO contradiz o sentido da chave.
 *
 * Regra do Igor (18/08), literal: "Se Ativo = False, não disponibiliza. Se
 * Painel Operador = False, mesmo com Ativo = True, não disponibiliza no Painel
 * do Operador. Se não tiver token, também não disponibiliza."
 *
 * Puro e sem IO — quem lê o banco é a rota.
 */

export type PainelWidget = "PO" | "PG" | "PC";

const PAINEIS: PainelWidget[] = ["PO", "PG", "PC"];

export function ehPainel(v: unknown): v is PainelWidget {
  return typeof v === "string" && (PAINEIS as string[]).includes(v.trim().toUpperCase());
}

/**
 * Normaliza o que veio do banco/formulário: maiúsculo, sem repetido, só painel
 * válido. `null` continua significando TODOS — é o estado de quem nunca mexeu
 * na configuração, e mudar isso desligaria o widget de todo mundo de uma vez.
 *
 * Repare que `[]` NÃO é `null`: lista vazia é "nenhum painel liberado", uma
 * escolha explícita de quem desmarcou os três.
 */
export function normalizarPaineis(v: unknown): PainelWidget[] | null {
  if (v == null) return null;
  if (!Array.isArray(v)) return null;
  const set = new Set<PainelWidget>();
  for (const x of v) {
    const s = String(x ?? "").trim().toUpperCase();
    if (ehPainel(s)) set.add(s as PainelWidget);
  }
  return PAINEIS.filter((p) => set.has(p));
}

/**
 * Decide a exibição, uma vez identificados base e painel.
 *
 * Fecha em três pontos, e cada um vem de uma leitura do banco que antes passava:
 *
 *  · base inativa → nunca;
 *  · lista VAZIA (`{}`) → nunca. Antes, `[]` chegava aqui e o painel
 *    desconhecido devolvia `true` — então desmarcar os três painéis não
 *    desligava nada;
 *  · painel desconhecido com lista definida → nunca. Se o cliente escolheu
 *    quais painéis valem, "não sei em qual estou" não é um deles.
 */
export function widgetLiberado(
  paineis: unknown,
  painel: unknown,
  baseAtiva = true,
): boolean {
  if (!baseAtiva) return false;
  const lista = normalizarPaineis(paineis);
  if (lista === null) return true;    // NULL = todos os painéis
  if (lista.length === 0) return false; // {} = nenhum painel liberado
  const p = String(painel ?? "").trim().toUpperCase();
  if (!ehPainel(p)) return false;     // painel desconhecido → nega
  return lista.includes(p as PainelWidget);
}

/** Por que o widget não pode ser liberado antes mesmo de consultar a base. */
export type MotivoBloqueio = "sem_token" | "token_invalido" | "sem_base";

/**
 * O turno tem identidade suficiente para DECIDIR?
 *
 * Sem token não dá para saber de qual cliente é a tela — e, como a decisão agora
 * nega na dúvida, isso basta para bloquear. Devolve o MOTIVO em vez de um
 * booleano porque os três casos exigem instruções diferentes de quem for
 * investigar: "a tela não põe `data-token`", "o token não decodifica com a chave
 * deste espaço", "o token não traz `p_base`".
 */
export function bloqueioPorIdentidade(input: {
  temToken: boolean;
  decodificou: boolean;
  baseCode: unknown;
}): MotivoBloqueio | null {
  if (!input.temToken) return "sem_token";
  if (!input.decodificou) return "token_invalido";
  if (!String(input.baseCode ?? "").trim()) return "sem_base";
  return null;
}
