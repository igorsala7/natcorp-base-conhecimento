import type { NextRequest } from "next/server";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import {
  listClientePrompts,
  saveClientePrompt,
  deleteClientePrompt,
  type ClienteIdentity,
} from "@/lib/portal/prompt-store";
import { listarSugeridos, favoritarSugerido } from "@/lib/prompts/sugeridos";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

type Payload = {
  action?: "list" | "save" | "delete" | "favoritar";
  key?: string;
  track?: unknown;
  id?: string | null;
  label?: string | null;
  texto?: string;
  marcar?: boolean;
};

/**
 * POST /api/v1/prompts — a gaveta de prompts do VISITANTE do widget.
 * Auth: chave pública (pk_...) + allowlist de origem + rate limit — o mesmo
 * portão do chat. `action`: 'list' | 'save' | 'delete' | 'favoritar'.
 *
 * ── Duas origens, uma gaveta ──────────────────────────────────────────
 * `prompts` são os que a PESSOA salvou (tabela `prompts_usuario_cliente`,
 * chaveada por space + p_base + p_usuario). `sugeridos` são os que o
 * ADMINISTRADOR escreveu, já filtrados pela RPC conforme base, portal, perfil,
 * empresa, usuário e matrícula. O widget mostra os dois no mesmo lugar, que foi
 * o pedido.
 *
 * ── Por que `prompts` continua sendo `prompts` ────────────────────────
 * O widget.js vive em cache no navegador dentro do ERP do cliente, e a versão
 * velha lê exatamente esta chave. Renomear para `meus` deixaria a biblioteca
 * pessoal VAZIA para quem ainda não recarregou — um recurso que some sem erro.
 * A chave nova entra ao lado; a antiga não muda de nome.
 *
 * ── O corte de elegibilidade NÃO acontece aqui ────────────────────────
 * Quem decide o que cada um vê é a função `prompts_sugeridos` no banco. Este
 * arquivo só repassa os seis campos que vêm do token — nada de `filter` em
 * JavaScript sobre uma lista completa que já teria trafegado.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const t = await decodeTrackForSpace(key.space_id, payload.track);
  const vazio = { prompts: [], sugeridos: [], categorias: [] };
  // Sem BASE não há nem escopo de cliente nem identidade: devolve gaveta vazia
  // (o widget nunca solicita login).
  if (!t.p_base) return json(vazio, 200);

  // A biblioteca PESSOAL exige o par completo; os SUGERIDOS não — eles são do
  // administrador, e um visitante sem usuário identificado simplesmente não
  // casa com nenhuma regra por usuário. Separar os dois casos é o que faz o
  // Painel do Candidato (sem matrícula) enxergar os prompts prontos.
  const identity: ClienteIdentity | null = t.p_usuario
    ? { p_base: t.p_base, p_usuario: t.p_usuario }
    : null;

  if (payload.action === "save") {
    if (!identity) return json({ ok: false, error: "Sem identidade para salvar." }, 400);
    const r = await saveClientePrompt(key.space_id, identity, {
      id: payload.id,
      label: payload.label,
      texto: payload.texto ?? "",
    });
    return json(r, r.ok ? 200 : 400);
  }
  if (payload.action === "delete") {
    if (!identity) return json({ ok: false, error: "Sem identidade." }, 400);
    if (!payload.id) return json({ ok: false, error: "id ausente." }, 400);
    const r = await deleteClientePrompt(key.space_id, identity, payload.id);
    return json(r, r.ok ? 200 : 400);
  }
  if (payload.action === "favoritar") {
    if (!identity) return json({ ok: false, error: "Sem identidade." }, 400);
    if (!payload.id) return json({ ok: false, error: "id ausente." }, 400);
    const ok = await favoritarSugerido(
      identity.p_base,
      identity.p_usuario,
      payload.id,
      payload.marcar !== false,
    );
    return json({ ok }, ok ? 200 : 400);
  }

  // Padrão: listar. As duas consultas são independentes — vão juntas.
  const [prompts, sugeridos] = await Promise.all([
    identity ? listClientePrompts(key.space_id, identity) : Promise.resolve([]),
    // As seis dimensões saem do TOKEN, nunca do payload: o `track` é
    // assinado, e é isso que impede alguém de pedir a lista se dizendo do
    // portal do gestor ou da empresa 700.
    listarSugeridos({
      base: t.p_base,
      portal: t.p_portal,
      perfil: t.p_perfil,
      usuario: t.p_usuario,
      empresa: t.p_empresa,
      matricula: t.p_matricula,
    }),
  ]);

  // As categorias que REALMENTE têm prompt visível para esta pessoa — e só
  // elas. Mandar o catálogo inteiro de gavetas contaria, pelo nome delas, o
  // que existe do outro lado da regra de elegibilidade.
  const categorias = [...new Set(sugeridos.flatMap((p) => p.categorias))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  return json({ prompts, sugeridos, categorias }, 200);
}
