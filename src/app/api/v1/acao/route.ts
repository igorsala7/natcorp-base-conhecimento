/**
 * Executa a AÇÃO escolhida num cartão de lista (ver acao-lista.ts).
 *
 * O cartão é oferta; autorização é aqui. Um id que chega do navegador é
 * intenção, nunca permissão: cada um passa pela MESMA cadeia da ferramenta
 * quando o modelo a chama — acesso por portal/perfil, escopo por painel e o
 * guard cadastrado (que, em férias, é quem confere a ordem de alçada).
 *
 * ── Por que não reaproveitar o turno do chat ─────────────────────────────────
 * Seria mais barato mandar "aprove a 57463 e a 57465" de volta ao modelo. Mas aí
 * os ids passariam por uma reinterpretação em linguagem natural entre o clique e
 * a gravação — e o dia em que o modelo trocar um dígito ninguém vai descobrir
 * por que a requisição errada foi aprovada. Clique vira chamada direta.
 *
 * ── Falha parcial é a regra ──────────────────────────────────────────────────
 * Selecionar quatro e falhar em duas é normal (a vez virou, outro aprovou
 * antes). A resposta é POR ITEM. Um "erro" único esconderia quais passaram, e a
 * pessoa não teria como saber o que refazer.
 */
import type { NextRequest } from "next/server";
import { corsHeaders, originAllowed, resolveWidgetKey, extractKey, clientIp, rateLimitOk } from "@/lib/widget/auth";
import { decodeTrackDetalhado } from "@/lib/tracking/resolve";
import { loadBaseContext, loadCredentialSecret } from "@/lib/integrations/resolve";
import { identityFromTrack } from "@/lib/integrations/tool-builder";
import { executeTool } from "@/lib/integrations/executor";
import { runGuard } from "@/lib/integrations/guards";
import { escopoDoPainel, aplicarEscopoParams } from "@/lib/integrations/panel-scope";
import { ehAcaoEmLista } from "@/lib/integrations/acao-lista";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Teto de itens por clique. Acima disto não é decisão, é atropelo. */
const MAX_ITENS = 25;

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  let payload: {
    key?: string;
    track?: unknown;
    /** Ferramenta de AÇÃO (a que o cartão declarou). */
    tool?: unknown;
    /** Ferramenta de LEITURA que originou o cartão — é ela que autoriza a ação. */
    origem?: unknown;
    ids?: unknown;
    variante?: unknown;
    campos?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ error: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const { campos: track, motivo } = await decodeTrackDetalhado(key.space_id, payload.track);
  if (motivo === "expirado") {
    return json({ error: "Sua sessão no painel expirou. Atualize a página para continuar.", code: "sessao_expirada" }, 401);
  }
  const baseCode = String(track.p_base ?? "").trim();
  // Ação escreve. Sem identidade validada não há de quem cobrar o ato — e sem
  // isso o `usuario` que o ERP grava na auditoria seria vazio.
  if (!baseCode || !String(track.p_usuario ?? "").trim()) {
    return json({ error: "Ação indisponível sem identificação. Entre no painel de novo." }, 401);
  }

  const toolKey = String(payload.tool ?? "").trim();
  const origemKey = String(payload.origem ?? "").trim();
  const ids = Array.isArray(payload.ids) ? payload.ids.map((x) => String(x).trim()).filter(Boolean) : [];
  const variante = payload.variante == null ? null : String(payload.variante);
  const campos =
    payload.campos && typeof payload.campos === "object" && !Array.isArray(payload.campos)
      ? (payload.campos as Record<string, unknown>)
      : {};

  if (!toolKey || !origemKey) return json({ error: "Ação incompleta." }, 400);
  if (ids.length === 0) return json({ error: "Nenhum item selecionado." }, 400);
  if (ids.length > MAX_ITENS) return json({ error: `No máximo ${MAX_ITENS} itens por vez.` }, 400);

  const ctx = await loadBaseContext(baseCode);
  if (!ctx) return json({ error: "Base não encontrada." }, 404);

  const btOrigem = ctx.tools.find((t) => t.tool.key === origemKey);
  const btAcao = ctx.tools.find((t) => t.tool.key === toolKey);
  if (!btOrigem || !btAcao) return json({ error: "Ação indisponível." }, 404);

  // O VÍNCULO é o que autoriza: a ação tem de ser a que a ferramenta de leitura
  // declarou. Sem isto, quem forjasse o corpo escolheria qualquer ferramenta de
  // escrita da base e usaria esta rota como atalho para sair do chat.
  const decl = btOrigem.tool.acao_em_lista;
  if (!ehAcaoEmLista(decl) || decl.tool !== toolKey) {
    return json({ error: "Ação não corresponde à lista." }, 403);
  }
  if (variante !== null && !decl.variantes.some((v) => v.valor === variante)) {
    return json({ error: "Opção inválida." }, 400);
  }
  for (const c of decl.campos ?? []) {
    if (c.obrigatorio && !String(campos[c.nome] ?? "").trim()) {
      return json({ error: `${c.rotulo} é obrigatório.` }, 400);
    }
  }

  // Acesso por portal/perfil — a mesma allowlist que o chat aplica.
  const portal = String(track.p_portal ?? "").trim().toUpperCase();
  const perfil = String(track.p_perfil ?? "").trim().toUpperCase();
  const liberado = (lista: string[], valor: string) =>
    lista.length === 0 || lista.map((x) => x.trim().toUpperCase()).includes(valor);
  if (!liberado(btAcao.portais, portal) || !liberado(btAcao.perfis, perfil)) {
    return json({ error: "Sem permissão para esta ação." }, 403);
  }

  const identity = identityFromTrack(track);
  const escopo = escopoDoPainel(btAcao.tool.panel_scope, portal);
  if (escopo === "nenhum") return json({ error: "Sem permissão para esta ação." }, 403);

  const credential = btAcao.credentialId ? await loadCredentialSecret(btAcao.credentialId) : null;
  const baseUrl = btAcao.baseUrl;
  if (!baseUrl) return json({ error: "Integração sem endereço configurado." }, 500);

  const paramItem = decl.param_item ?? decl.chave_item;
  const resultados: { id: string; ok: boolean; mensagem?: string; dados?: unknown }[] = [];

  // SEQUENCIAL, de propósito: são escritas no mesmo ERP, e a segunda costuma
  // depender do efeito da primeira (a conclusão de uma requisição muda a fila da
  // outra). Paralelizar economizaria segundos e compraria corrida.
  for (const id of ids) {
    const modelArgs: Record<string, unknown> = { ...campos, [paramItem]: id };
    if (decl.param_variante && variante !== null) modelArgs[decl.param_variante] = variante;

    if (btAcao.tool.guard) {
      const g = await runGuard(btAcao.tool.guard, {
        baseUrl,
        baseCode,
        credential,
        identity,
        modelArgs,
        panelScope: escopo,
        excludeSelf: !!btAcao.tool.exclude_self,
        toolKey: btAcao.tool.key,
        actionLabel: btAcao.tool.name,
      });
      // O clique JÁ é a confirmação: a pessoa marcou o item, escolheu a ação e
      // preencheu o que faltava numa tela que mostra o que vai acontecer. Um
      // guard de confirmação por texto aqui pediria "sim" para o que ela acabou
      // de confirmar clicando. Os demais guards (escopo, alçada) valem inteiros.
      const ehConfirmacao = /confirm/i.test(btAcao.tool.guard);
      if (!g.ok && !ehConfirmacao) {
        resultados.push({ id, ok: false, mensagem: g.erro });
        continue;
      }
    }

    try {
      const params = aplicarEscopoParams(btAcao.tool.params, escopo);
      const r = await executeTool({
        tool: { ...btAcao.tool, params },
        baseUrl,
        credential,
        modelArgs,
        identity,
      });
      resultados.push({
        id,
        ok: r.ok,
        mensagem: r.ok ? undefined : `Não foi possível concluir (HTTP ${r.status}).`,
        dados: r.ok ? r.data : undefined,
      });
    } catch (e) {
      resultados.push({ id, ok: false, mensagem: e instanceof Error ? e.message : String(e) });
    }
  }

  return json(
    {
      ok: resultados.every((r) => r.ok),
      total: resultados.length,
      sucesso: resultados.filter((r) => r.ok).length,
      resultados,
    },
    200,
  );
}
