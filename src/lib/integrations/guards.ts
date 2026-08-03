/**
 * GUARDS — checagens no SERVIDOR que rodam ANTES de uma ferramenta chamar a API
 * e podem RECUSAR. Nomeadas em `ai_tools.guard`; o motor (tool-builder) invoca
 * por nome. Falha fechada: guard desconhecido bloqueia.
 *
 * `team_membership`: um gestor só consulta um colaborador da SUA equipe. Como o
 * endpoint de dados NÃO escopa por gestor, validamos aqui contra a lista de
 * equipe (colaboradores_resumo, essa sim escopada por usuario+gestor). A
 * matrícula-alvo nunca é confiada cega — precisa estar na equipe.
 */
import { createHash } from "node:crypto";
import { getOAuthToken } from "./oauth";
import type { RuntimeCredential } from "./executor";
import type { Identity } from "./params";
import type { EscopoPainel } from "./panel-scope";

export type GuardResult = { ok: true } | { ok: false; erro: string };

/** Linha de confirmação pendente (código guardado como HASH). */
export type PendingRow = { id: string; code_hash: string; expires_at: number; used_at: number | null };
/** Dependências injetadas do guard de confirmação (testável / server real). */
export type ConfirmDeps = {
  findPending: (subject: string, action: string) => Promise<PendingRow[]>;
  createPending: (row: { subject: string; action: string; detail: string; code_hash: string; expires_at: number }) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
  /** E-mail (canal fora-da-banda) para onde enviar o código; null = sem e-mail. */
  emailFor: () => Promise<string | null>;
  /** Entrega o código pelo canal fora-da-banda; devolve se conseguiu. */
  deliver: (to: string, code: string, detail: string) => Promise<boolean>;
  genCode: () => string;
  now: () => number;
};

export type GuardContext = {
  baseUrl: string;
  baseCode?: string;
  credential: RuntimeCredential | null;
  identity: Identity;
  modelArgs: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  /** Deps do guard de confirmação (só usadas por saque_confirmation). */
  confirm?: ConfirmDeps;
  /** Escopo por painel resolvido para o usuário (usado por escopo_painel). */
  panelScope?: EscopoPainel;
  /** "Nunca os próprios dados" (usado por escopo_painel). */
  excludeSelf?: boolean;
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// Cache da equipe por (credencial, gestor) — evita rebuscar a cada consulta.
const teamCache = new Map<string, { exp: number; matriculas: Set<string> }>();
const TEAM_TTL = 5 * 60_000;

async function fetchGestorTeam(ctx: GuardContext): Promise<Set<string>> {
  const cred = ctx.credential!;
  const sessionKey = cred.secret.session_key ?? "";
  const usuario = ctx.identity.usuario ?? "";
  const cacheKey = `${cred.id}:${usuario}`;
  const hit = teamCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return hit.matriculas;

  const fetchImpl = ctx.fetchImpl ?? fetch;
  const token = await getOAuthToken(cred.id, cred.secret, fetchImpl);
  const base = ctx.baseUrl.replace(/\/+$/, "");
  const q = new URLSearchParams({ key: sessionKey, gestor: "SIM", usuario });
  const res = await fetchImpl(`${base}/chatbot/consultas/v1/colaboradores_resumo?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = res.ok ? ((await res.json().catch(() => null)) as unknown) : null;
  const items =
    data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  const set = new Set<string>(
    items.map((i) => String((i as { matricula?: unknown })?.matricula ?? "").trim()).filter(Boolean),
  );
  teamCache.set(cacheKey, { exp: Date.now() + TEAM_TTL, matriculas: set });
  return set;
}

/** Só passa se a `matricula` pedida estiver na equipe do gestor logado. */
async function teamMembership(ctx: GuardContext): Promise<GuardResult> {
  if (!ctx.credential?.secret.session_key || !ctx.identity.usuario) {
    return { ok: false, erro: "Não foi possível validar sua equipe agora. Tente mais tarde." };
  }
  const alvo = String(ctx.modelArgs.matricula ?? "").trim();
  if (!alvo) return { ok: false, erro: "Informe a matrícula do colaborador da sua equipe." };
  let team: Set<string>;
  try {
    team = await fetchGestorTeam(ctx);
  } catch {
    return { ok: false, erro: "Não foi possível validar sua equipe agora. Tente mais tarde." };
  }
  if (!team.has(alvo)) {
    return { ok: false, erro: "Você só pode consultar colaboradores da sua própria equipe." };
  }
  return { ok: true };
}

/**
 * Confirmação FORA-DA-BANDA para uma ação sensível (efetivar saque). Sem código
 * no `modelArgs`: gera um código, guarda o HASH, envia por e-mail (o MODELO não
 * vê) e RECUSA pedindo que o usuário informe o código. Com código: valida contra
 * a pendência (não usada, não expirada). Assim a IA não consegue efetivar sozinha.
 */
async function saqueConfirmation(ctx: GuardContext): Promise<GuardResult> {
  const d = ctx.confirm;
  if (!d) return { ok: false, erro: "Confirmação indisponível no momento." };
  const subject = `${ctx.identity.usuario ?? ""}:${ctx.identity.matricula ?? ""}`;
  const codigo = String(ctx.modelArgs.codigo ?? "").trim();
  const detail = String(ctx.modelArgs.valor ?? "").trim();
  const abertas = (await d.findPending(subject, "saque")).filter((p) => !p.used_at && p.expires_at > d.now());

  if (codigo) {
    const match = abertas.find((p) => p.code_hash === sha(codigo));
    if (!match) return { ok: false, erro: "Código de confirmação inválido ou expirado. Peça um novo." };
    await d.markUsed(match.id);
    return { ok: true };
  }

  // Sem código → emite, envia fora-da-banda e recusa (a IA nunca vê o código).
  const email = await d.emailFor();
  if (!email) return { ok: false, erro: "Não há e-mail cadastrado para enviar a confirmação. Procure o RH." };
  const code = d.genCode();
  await d.createPending({ subject, action: "saque", detail, code_hash: sha(code), expires_at: d.now() + 10 * 60_000 });
  const enviado = await d.deliver(email, code, detail);
  if (!enviado) return { ok: false, erro: "Não consegui enviar o código de confirmação agora. Tente mais tarde." };
  return {
    ok: false,
    erro: "Enviei um código de confirmação para o seu e-mail cadastrado. Informe esse código para confirmar o saque.",
  };
}

/**
 * ESCOPO POR PAINEL para consultas de PESSOA (matrícula-alvo do modelo): o Operador (PO)
 * consulta qualquer um; o Gestor (PG), só a sua equipe; o Colaborador (PC), só a si. Sem
 * alvo (ou alvo = o próprio) sempre passa (consulta os próprios dados). Painel desconhecido
 * → seguro: só os próprios dados. A matrícula-alvo já foi normalizada em `modelArgs.matricula`.
 */
/**
 * Decisão PURA do escopo por painel (testável): "ok" libera; "nega" recusa; "equipe" exige
 * a checagem de equipe (só o Gestor). Sem alvo, ou alvo = o próprio → sempre "ok".
 * PO=ok (Operador vê todos), PG=equipe, PC/desconhecido="nega" (só os próprios).
 */
export function decisaoEscopoPessoa(portal: string, own: string, alvo: string): "ok" | "nega" | "equipe" {
  const a = String(alvo ?? "").trim();
  const o = String(own ?? "").trim();
  if (!a || a === o) return "ok";
  const p = String(portal ?? "").trim().toUpperCase();
  if (p === "PO") return "ok";
  if (p === "PG") return "equipe";
  return "nega"; // PC ou painel desconhecido → só os próprios dados
}

async function escopoPessoa(ctx: GuardContext): Promise<GuardResult> {
  const own = String(ctx.identity.matricula ?? "");
  const alvo = String(ctx.modelArgs.matricula ?? "");
  const d = decisaoEscopoPessoa(String(ctx.identity.portal ?? ""), own, alvo);
  if (d === "ok") return { ok: true };
  if (d === "nega") {
    const portal = String(ctx.identity.portal ?? "").trim().toUpperCase();
    return {
      ok: false,
      erro: portal === "PC"
        ? "No Painel do Colaborador você só pode consultar os SEUS próprios dados."
        : "No seu painel só é possível consultar os seus próprios dados.",
    };
  }
  // "equipe" (Gestor): só passa se o alvo estiver na equipe do gestor logado.
  if (!ctx.credential?.secret.session_key || !ctx.identity.usuario) {
    return { ok: false, erro: "Não foi possível validar sua equipe agora. Tente mais tarde." };
  }
  let team: Set<string>;
  try {
    team = await fetchGestorTeam(ctx);
  } catch {
    return { ok: false, erro: "Não foi possível validar sua equipe agora. Tente mais tarde." };
  }
  return team.has(String(alvo).trim())
    ? { ok: true }
    : { ok: false, erro: "Você só pode consultar colaboradores da SUA equipe (Painel do Gestor)." };
}

/**
 * ESCOPO POR PAINEL configurável (ai_tools.panel_scope) — roda por chamada. Diferente
 * de `escopo_pessoa` (que fixa PO=todos/PG=equipe/PC=próprios), aqui o alcance vem da
 * configuração da tool para o painel do usuário, já resolvido em `ctx.panelScope`:
 *   - "proprios": a matrícula/empresa já foram forçadas à identidade; aqui é só a rede
 *     (recusa se, por algum motivo, vier uma matrícula diferente da própria).
 *   - "equipe": a matrícula-alvo precisa estar na equipe do gestor.
 *   - "todos": libera (o sistema aplica o acesso já parametrizado).
 * `excludeSelf` (ex.: requisição de desligamento) recusa mirar a PRÓPRIA matrícula em
 * qualquer escopo — o filtro dos RESULTADOS (linhas próprias) é feito no motor.
 */
async function escopoPainel(ctx: GuardContext): Promise<GuardResult> {
  const scope: EscopoPainel = ctx.panelScope ?? "todos";
  const own = String(ctx.identity.matricula ?? "").trim();
  const alvo = String(ctx.modelArgs.matricula ?? "").trim();

  if (ctx.excludeSelf && alvo && alvo === own)
    return { ok: false, erro: "Você não pode consultar os SEUS próprios dados nesta ferramenta." };

  if (scope === "proprios") {
    if (!alvo || alvo === own) return { ok: true };
    return { ok: false, erro: "No seu painel você só pode consultar os SEUS próprios dados." };
  }
  if (scope === "equipe") {
    if (!alvo || alvo === own) return { ok: true }; // sem alvo = os próprios
    if (!ctx.credential?.secret.session_key || !ctx.identity.usuario)
      return { ok: false, erro: "Não foi possível validar sua equipe agora. Tente mais tarde." };
    let team: Set<string>;
    try {
      team = await fetchGestorTeam(ctx);
    } catch {
      return { ok: false, erro: "Não foi possível validar sua equipe agora. Tente mais tarde." };
    }
    return team.has(alvo)
      ? { ok: true }
      : { ok: false, erro: "Você só pode consultar colaboradores da SUA equipe." };
  }
  return { ok: true }; // "todos"
}

const GUARDS: Record<string, (ctx: GuardContext) => Promise<GuardResult>> = {
  team_membership: teamMembership,
  escopo_pessoa: escopoPessoa,
  escopo_painel: escopoPainel,
  saque_confirmation: saqueConfirmation,
};

/** Roda o guard nomeado. Falha FECHADA: nome desconhecido bloqueia. */
export async function runGuard(name: string, ctx: GuardContext): Promise<GuardResult> {
  const g = GUARDS[name];
  if (!g) {
    console.warn(`[guards] guard desconhecido: ${name} — bloqueando por segurança.`);
    return { ok: false, erro: "Ação indisponível no momento." };
  }
  return g(ctx);
}
