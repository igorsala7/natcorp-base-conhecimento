import type { NextRequest } from "next/server";
import { hasAiKey } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTrackDetalhado, type TrackFields } from "@/lib/tracking/resolve";
import { widgetLiberado } from "@/lib/widget/disponibilidade";
import { montarAbertura, publicoDaAbertura } from "@/lib/widget/abertura";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  extractKey,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * GET /api/v1/config?key=pk_... — bootstrap do widget: devolve a config visual
 * (cor, avatar, boas-vindas, sugestões, posição) do widget_keys.config.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const key = await resolveWidgetKey(extractKey(req));
  if (!key) return Response.json({ error: "Chave inválida." }, { status: 401, headers: cors });
  if (!originAllowed(key.allowed_origins, origin)) {
    return Response.json({ error: "Origem não autorizada." }, { status: 403, headers: cors });
  }
  // Widget desligado NESTA base + painel → o bootstrap avisa e o widget nem
  // desenha a bolha. Bloquear só no /chat deixaria a bolha na tela para abrir e
  // receber uma recusa, o que é pior que não existir.
  const track = req.nextUrl.searchParams.get("track");
  let liberado = true;
  // O mesmo token que decide a exibição também diz PARA QUEM estamos abrindo.
  // Decodificar uma vez e reaproveitar evita um segundo decode só para a abertura.
  let campos: TrackFields = {};
  if (track) {
    ({ campos } = await decodeTrackDetalhado(key.space_id, track));
    const baseCode = String(campos.p_base ?? "").trim();
    if (baseCode) {
      const db = createAdminClient();
      const { data: base } = await db
        .from("ai_bases")
        .select("active, widget_paineis")
        .ilike("base_code", baseCode.replace(/([\\%_])/g, "\\$1"))
        .maybeSingle();
      // Base que não existe no catálogo não é motivo para sumir com o widget:
      // instalação sem integração é um caso legítimo.
      if (base) liberado = widgetLiberado(base.widget_paineis, campos.p_portal, base.active);
    }
  }
  if (!liberado) {
    return Response.json({ desativado: true }, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  // Abertura por público (PO / PG / colaborador / candidato). Entra como
  // sobreposição da config da chave porque o widget já funde o que vem daqui
  // por cima dos padrões dele — nenhuma mudança de cliente é necessária.
  //
  // `tela` fica de fora por enquanto: no bootstrap o widget ainda não varreu a
  // página do APEX, então esse sinal só existiria num segundo momento. Melhor
  // ausente que adivinhado.
  const cfgAtual = (key.config ?? {}) as Record<string, unknown>;
  const abertura = montarAbertura({
    publico: publicoDaAbertura({
      painel: campos.p_portal,
      matricula: campos.p_matricula,
      codCandidato: campos.p_cod_candidato,
    }),
    base: campos.p_base,
    configuradas: cfgAtual.suggestions,
  });

  /**
   * NINGUÉM ABRE O WIDGET NUM VAZIO.
   *
   * Quando o público não é identificado, o catálogo de atalhos é vazio de
   * propósito: sem identidade, "Ver meu último holerite" só levaria a uma
   * recusa. O argumento vale — e ele supõe que a pessoa sabe formular e
   * escrever a pergunta que quer. Parte do público deste widget não sabe:
   * compor e digitar É a barreira, e o campo em branco é onde ela desiste.
   *
   * Então, em vez de nada, os assuntos mais LIDOS daquela documentação. Não
   * exigem identidade (é conteúdo publicado), não podem estar errados (saem do
   * que já existe e já foi lido), e ainda dizem "é sobre isto que eu sei
   * responder" — que é a pergunta real de quem abre o widget pela primeira vez.
   *
   * Só entra quando não há NADA: sugestão configurada à mão e atalho por
   * público continuam vencendo, nessa ordem.
   */
  if (!abertura.suggestions.length) {
    try {
      const db = createAdminClient();
      const { data: titulos } = await db.rpc("titulos_de_partida", {
        p_space_id: key.space_id,
        p_limit: 3,
      });
      const partida = (titulos ?? []).map((t) => t.title).filter(Boolean);
      if (partida.length) abertura.suggestions = partida;
    } catch {
      // Documentação vazia, instalação nova ou banco fora do ar: a saudação
      // sozinha volta a ser a resposta. Nunca derruba o widget por causa de
      // uma sugestão.
    }
  }

  return Response.json(
    { config: { ...cfgAtual, ...abertura }, aiEnabled: await hasAiKey() },
    // no-store: mudança de config (ícone/cor/título) reflete no próximo load,
    // sem o navegador servir uma versão cacheada da config.
    { headers: { ...cors, "Cache-Control": "no-store" } },
  );
}
