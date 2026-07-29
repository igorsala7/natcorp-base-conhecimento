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

const GUARDS: Record<string, (ctx: GuardContext) => Promise<GuardResult>> = {
  team_membership: teamMembership,
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
