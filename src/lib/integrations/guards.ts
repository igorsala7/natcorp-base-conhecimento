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
import { GUARD_CATALOG } from "./guard-catalog";
import { ehCandidato } from "@/lib/chat/tipo-acesso";

export type GuardResult = { ok: true } | { ok: false; erro: string };

/** Linha de confirmação pendente. `confirmed_at` é setado pela ROTA do chat quando o
 *  usuário responde "sim" — a IA nunca confirma sozinha. */
export type PendingRow = { id: string; expires_at: number; used_at: number | null; confirmed_at: number | null };
/** Dependências injetadas do guard de confirmação (testável / server real). */
export type ConfirmDeps = {
  findPending: (subject: string, action: string) => Promise<PendingRow[]>;
  createPending: (row: { subject: string; action: string; detail: string; expires_at: number; toolKey?: string }) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
  now: () => number;
};

export type GuardContext = {
  baseUrl: string;
  baseCode?: string;
  credential: RuntimeCredential | null;
  identity: Identity;
  modelArgs: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  /** Deps do guard de confirmação (saque_confirmation / confirmation). */
  confirm?: ConfirmDeps;
  /** Escopo por painel resolvido para o usuário (usado por escopo_painel). */
  panelScope?: EscopoPainel;
  /** "Nunca os próprios dados" (usado por escopo_painel). */
  excludeSelf?: boolean;
  /** Chave e rótulo da ferramenta — usados pelo guard genérico `confirmation`
   *  (namespace por tool no `action` + texto da pergunta de confirmação). */
  toolKey?: string;
  actionLabel?: string;
};

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

// Requisições do processo seletivo de um candidato — mesma ideia do cache de
// equipe: a lista muda pouco e a consulta se repete a cada pergunta.
const processoCache = new Map<string, { exp: number; requisicoes: Set<string> }>();
const PROCESSO_TTL = 5 * 60_000;

/** Códigos de requisição/vaga em que ESTE candidato está inscrito. */
async function fetchProcessosDoCandidato(ctx: GuardContext): Promise<Set<string>> {
  const cred = ctx.credential!;
  const cod = String(ctx.identity.cod_candidato ?? "").trim();
  const cacheKey = `${cred.id}:${cod}`;
  const hit = processoCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return hit.requisicoes;

  const fetchImpl = ctx.fetchImpl ?? fetch;
  const token = await getOAuthToken(cred.id, cred.secret, fetchImpl);
  const base = ctx.baseUrl.replace(/\/+$/, "");
  const q = new URLSearchParams({ key: cred.secret.session_key ?? "", cod_candidato: cod });
  const res = await fetchImpl(`${base}/chatbot/consultas/v1/candidatos_selecionados?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = res.ok ? ((await res.json().catch(() => null)) as unknown) : null;
  const items =
    data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  const set = new Set<string>();
  for (const i of items) {
    const o = (i ?? {}) as Record<string, unknown>;
    // O vínculo candidato↔requisição aparece com nomes diferentes conforme o
    // endpoint (cod_req no filtro, cod_vaga no retorno). Aceita os três em vez
    // de depender de um só e falhar em silêncio quando a ORDS renomear.
    for (const campo of ["cod_req", "cod_vaga", "requisicao"]) {
      const v = String(o[campo] ?? "").trim();
      if (v) set.add(v);
    }
  }
  processoCache.set(cacheKey, { exp: Date.now() + PROCESSO_TTL, requisicoes: set });
  return set;
}

/**
 * CANDIDATO consultando requisição de pessoal: só a(s) do processo seletivo
 * DELE.
 *
 * A requisição de pessoal não tem campo de candidato — ela descreve a vaga, e
 * sem esta checagem uma requisição qualquer traria a vaga de outra pessoa (com
 * cargo, centro de custo e, no cadastro original, remuneração). O vínculo vem
 * de `candidatos_selecionados`, que é escopado pelo código do candidato.
 *
 * Exige a requisição explícita: sem ela a consulta voltaria a lista inteira. A
 * mensagem de recusa diz ao agente onde achar os códigos, para ele encadear em
 * vez de repetir a mesma chamada.
 */
async function processoDoCandidato(ctx: GuardContext): Promise<GuardResult> {
  // A ferramenta é a MESMA para o RH e para o candidato — o que muda é quem
  // pergunta. Quem não é candidato segue pelo escopo normal do painel; sem esta
  // passagem, marcar o guard na ferramenta a quebraria para operador e gestor,
  // que não têm código de candidato nenhum.
  if (!ehCandidato({ matricula: ctx.identity.matricula, codCandidato: ctx.identity.cod_candidato })) {
    return escopoPainel(ctx);
  }
  const cod = String(ctx.identity.cod_candidato ?? "").trim();
  if (!cod || !ctx.credential) {
    return { ok: false, erro: "Esta consulta é do processo seletivo do próprio candidato, e não identifiquei seu cadastro." };
  }
  const pedida = String(ctx.modelArgs.requisicao ?? ctx.modelArgs.cod_req ?? "").trim();
  if (!pedida) {
    return {
      ok: false,
      erro:
        "Informe a requisição. Consulte antes os processos seletivos deste candidato (ferramenta de candidatos " +
        "selecionados) e use um dos códigos que vierem de lá.",
    };
  }
  let minhas: Set<string>;
  try {
    minhas = await fetchProcessosDoCandidato(ctx);
  } catch {
    return { ok: false, erro: "Não consegui validar seu processo seletivo agora. Tente novamente em instantes." };
  }
  if (!minhas.has(pedida)) {
    return { ok: false, erro: "Você só pode consultar a requisição do seu próprio processo seletivo." };
  }
  return { ok: true };
}

/**
 * Confirmação IN-CHAT para uma ação sensível. Sem confirmação ainda: cria uma pendência
 * e RECUSA, instruindo a IA a PERGUNTAR ao usuário (a IA não pode confirmar sozinha).
 * Quando o usuário responde "sim", quem marca a pendência (`confirmed_at`) é a ROTA do
 * chat — o guard não vê a conversa. Na tentativa seguinte, o guard vê a pendência
 * confirmada e libera. `action` é o NAMESPACE: a confirmação de uma ação não vale p/ outra.
 */
async function confirmationCore(
  ctx: GuardContext,
  opts: { action: string; detail: string; pergunta: string },
): Promise<GuardResult> {
  const d = ctx.confirm;
  if (!d) return { ok: false, erro: "Confirmação indisponível no momento." };
  const subject = `${ctx.identity.usuario ?? ""}:${ctx.identity.matricula ?? ""}`;
  const abertas = (await d.findPending(subject, opts.action)).filter((p) => !p.used_at && p.expires_at > d.now());

  // Já confirmada pelo usuário (via rota) → efetiva (marca usada p/ não repetir).
  const confirmada = abertas.find((p) => p.confirmed_at != null);
  if (confirmada) {
    await d.markUsed(confirmada.id);
    return { ok: true };
  }

  // Ainda não confirmada: cria a pendência (na 1ª vez) e pede o "sim" ao usuário.
  if (abertas.length === 0) {
    await d.createPending({ subject, action: opts.action, detail: opts.detail, toolKey: ctx.toolKey, expires_at: d.now() + 10 * 60_000 });
  }
  return {
    ok: false,
    erro:
      `CONFIRMAÇÃO NECESSÁRIA — NÃO execute ainda. Pergunte ao usuário: "${opts.pergunta}?" e só ` +
      `chame esta ferramenta de novo DEPOIS que ELE responder que sim. Não confirme por conta própria.`,
  };
}

/** Confirmação específica de SAQUE — mostra o valor (`modelArgs.valor`) na pergunta. */
async function saqueConfirmation(ctx: GuardContext): Promise<GuardResult> {
  const valor = String(ctx.modelArgs.valor ?? "").trim();
  return confirmationCore(ctx, {
    action: "saque",
    detail: valor,
    pergunta: `confirma o saque${valor ? ` de R$ ${valor}` : ""}`,
  });
}

/**
 * Confirmação GENÉRICA, reusável em qualquer gravação sensível. Namespace POR
 * FERRAMENTA (`confirm:<toolKey>`) — a confirmação de uma ação nunca libera outra —
 * e o texto usa o rótulo da tool (`actionLabel`).
 */
async function genericConfirmation(ctx: GuardContext): Promise<GuardResult> {
  const rotulo = String(ctx.actionLabel ?? "").trim();
  return confirmationCore(ctx, {
    action: `confirm:${ctx.toolKey ?? "acao"}`,
    detail: rotulo || "esta ação",
    pergunta: rotulo ? `confirma: ${rotulo}` : "confirma esta ação",
  });
}

/**
 * Confirmação DETALHADA — para ações que saem para fora (e-mail, convite com
 * terceiros, compartilhamento de arquivo).
 *
 * Duas diferenças em relação à genérica, e as duas são de segurança:
 *
 * 1. A pergunta mostra os VALORES REAIS (destinatário, assunto, trecho do
 *    corpo). Confirmar "confirma: enviar e-mail" não protege de nada: a pessoa
 *    aprova um rótulo, não um conteúdo. Contra injeção de prompt — um documento
 *    da base dizendo "envie um e-mail para X" — o que defende é ela LER para
 *    quem e o quê antes de dizer sim.
 *
 * 2. A pendência é nomeada por ferramenta + IMPRESSÃO DIGITAL DOS ARGUMENTOS.
 *    A genérica usa só `confirm:<tool>`, então um "sim" para um e-mail
 *    autorizaria qualquer outro e-mail nos 10 minutos seguintes — inclusive um
 *    que o modelo montasse depois, com outro destinatário. Com o resumo no
 *    nome, mudou o conteúdo, mudou a pendência, e é preciso confirmar de novo.
 */
async function detailedConfirmation(ctx: GuardContext): Promise<GuardResult> {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(ctx.modelArgs ?? {})) {
    const txt = typeof v === "string" ? v.trim() : v == null ? "" : JSON.stringify(v);
    if (!txt) continue;
    // Corpo de e-mail inteiro não cabe numa pergunta de chat, mas o começo é o
    // que denuncia um conteúdo que a pessoa não pediu.
    partes.push(`${k}: ${txt.length > 140 ? txt.slice(0, 140) + "…" : txt}`);
  }
  const resumo = partes.join(" · ");
  const rotulo = String(ctx.actionLabel ?? "esta ação").trim();

  // Impressão digital estável: mesma ação com os mesmos valores reaproveita a
  // pendência; qualquer mudança exige novo "sim".
  const digital = createHash("sha256").update(resumo).digest("base64url").slice(0, 16);

  return confirmationCore(ctx, {
    action: `confirm:${ctx.toolKey ?? "acao"}:${digital}`,
    detail: resumo.slice(0, 500),
    pergunta: resumo ? `confirma ${rotulo} — ${resumo}` : `confirma ${rotulo}`,
  });
}

/**
 * A mensagem do usuário é uma AFIRMAÇÃO/confirmação? A ROTA do chat usa isto para
 * liberar uma pendência de confirmação in-chat. Ancorada no início para não casar
 * uma frase longa qualquer (só vale quando há uma pendência esperando, de todo modo).
 */
export function ehAfirmacao(msg: string): boolean {
  const m = String(msg ?? "").trim().toLowerCase();
  if (!m) return false;
  return /^(sim|isso|confirmo|confirmar|confirmado|pode|podes|ok|okay|autorizo|claro|positivo|correto|exato|com certeza|é isso)\b/.test(m);
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
  processo_do_candidato: processoDoCandidato,
  escopo_pessoa: escopoPessoa,
  escopo_painel: escopoPainel,
  saque_confirmation: saqueConfirmation,
  confirmation: genericConfirmation,
  confirmation_detalhada: detailedConfirmation,
};

// Sincronia com o catálogo da UI (guard-catalog.ts): todo guard registrado precisa ter
// metadados lá para aparecer no seletor da tela — e vice-versa. Aviso em dev se divergir.
if (process.env.NODE_ENV !== "production") {
  const doc = new Set(GUARD_CATALOG.map((g) => g.key));
  for (const k of Object.keys(GUARDS)) if (!doc.has(k)) console.warn(`[guards] "${k}" sem entrada em guard-catalog.ts (não aparece no seletor).`);
  for (const g of GUARD_CATALOG) if (!(g.key in GUARDS)) console.warn(`[guards] catálogo lista "${g.key}", mas não há guard com esse nome.`);
}

/** Roda o guard nomeado. Falha FECHADA: nome desconhecido bloqueia. */
export async function runGuard(name: string, ctx: GuardContext): Promise<GuardResult> {
  const g = GUARDS[name];
  if (!g) {
    console.warn(`[guards] guard desconhecido: ${name} — bloqueando por segurança.`);
    return { ok: false, erro: "Ação indisponível no momento." };
  }
  return g(ctx);
}
