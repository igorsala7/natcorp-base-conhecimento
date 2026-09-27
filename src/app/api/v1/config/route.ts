import type { NextRequest } from "next/server";
import { hasAiKey } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTrackDetalhado, type TrackFields } from "@/lib/tracking/resolve";
import { widgetLiberado, bloqueioPorIdentidade } from "@/lib/widget/disponibilidade";
import { montarAbertura, publicoDaAbertura } from "@/lib/widget/abertura";
import { alertasDaIdentidade } from "@/lib/widget/alertas";
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

  /*
    UM CLIENTE ADMIN POR REQUISIÇÃO, E NÃO UM POR LEITURA.

    `createAdminClient()` monta um cliente novo a cada chamada (não há cache no
    módulo), e esta rota chamava três vezes no mesmo bootstrap: a base, os títulos
    de partida e os alertas. É o caminho que o usuário SENTE — a abertura da bolha.

    Preguiçoso, e não construído aqui, porque o caminho BLOQUEADO (sem token, base
    inativa, painel bloqueado) devolve antes de ler qualquer coisa: ali o certo
    continua sendo não montar nenhum.
  */
  let clienteAdmin: ReturnType<typeof createAdminClient> | null = null;
  const admin = () => (clienteAdmin ??= createAdminClient());
  // Widget desligado NESTA base + painel → o bootstrap avisa e o widget nem
  // desenha a bolha. Bloquear só no /chat deixaria a bolha na tela para abrir e
  // receber uma recusa, o que é pior que não existir.
  const track = req.nextUrl.searchParams.get("track");
  /**
   * NEGAR na dúvida — a postura mudou em 18/08.
   *
   * Antes toda a verificação morava dentro de `if (track)`, e sem token o widget
   * aparecia. Medido em produção: com token de base inativa a rota devolvia
   * `{"desativado":true}`; SEM token devolvia a config inteira. Desativar a base
   * não tinha efeito nenhum numa tela que não gera o token.
   *
   * Regra do Igor: "Se não tiver token, também não disponibiliza."
   *
   * O motivo é registrado no corpo porque quem investiga precisa distinguir "a
   * tela não põe `data-token`" de "o token não decodifica" — são consertos em
   * lugares diferentes, e sem o motivo os dois chegam como "o widget sumiu".
   */
  let campos: TrackFields = {};
  let decodificou = false;
  if (track) {
    const r = await decodeTrackDetalhado(key.space_id, track);
    campos = r.campos;
    decodificou = r.motivo === null;
  }
  const motivoIdentidade = bloqueioPorIdentidade({
    temToken: !!track,
    decodificou,
    baseCode: campos.p_base,
  });

  let liberado = motivoIdentidade === null;
  let motivo: string | null = motivoIdentidade;
  if (liberado) {
    const baseCode = String(campos.p_base ?? "").trim();
    const { data: base } = await admin()
      .from("ai_bases")
      .select("active, widget_paineis")
      .ilike("base_code", baseCode.replace(/([\\%_])/g, "\\$1"))
      .maybeSingle();
    /**
     * Base que o token cita mas o catálogo não conhece: BLOQUEIA.
     *
     * Antes liberava, com a justificativa de que "instalação sem integração é um
     * caso legítimo". Isso deixou de valer quando o token virou obrigatório: um
     * token válido apontando para uma base que não existe é erro de cadastro, e
     * liberar por causa dele reabriria o buraco pelo lado de dentro.
     */
    if (!base) {
      liberado = false;
      motivo = "base_desconhecida";
    } else if (!widgetLiberado(base.widget_paineis, campos.p_portal, base.active)) {
      liberado = false;
      motivo = base.active ? "painel_bloqueado" : "base_inativa";
    }
  }

  if (!liberado) {
    return Response.json({ desativado: true, motivo }, { headers: { ...cors, "Cache-Control": "no-store" } });
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
      const { data: titulos } = await admin().rpc("titulos_de_partida", {
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

  /**
   * OS ALERTAS DE CAMPANHA, NA MESMA RESPOSTA — e por que aqui.
   *
   * Esta rota já decodificou o token e já tem a identidade verificada. Um
   * segundo endpoint de leitura custaria uma ida e volta a mais no caminho que
   * o usuário SENTE (a abertura da bolha), para buscar um dado que esta
   * requisição já tem tudo para responder.
   *
   * `alertas` entra como chave de TOPO, ao lado de `config` e `aiEnabled`, e
   * não dentro de `config`. Os clientes rodam o `widget.js` que a página deles
   * tem em cache: o laço de bootstrap daquele arquivo copia as chaves de
   * `data.config` para dentro de `cfg` e IGNORA qualquer outra chave de topo,
   * então uma versão antiga do widget simplesmente não vê os alertas — nada
   * quebra e nada muda de comportamento. Dentro de `config`, a mesma chave
   * viraria `cfg.alertas` num objeto que a versão antiga usa para montar cor,
   * avatar e sugestões.
   *
   * O CORTE É EM SQL. `alertas_para` decide base, janela e elegibilidade; este
   * arquivo não filtra nada — filtro em TypeScript aqui viraria a segunda
   * implementação da regra, e `widget.js` é público de todo jeito.
   *
   * Falha da RPC não derruba a abertura. Mesmo critério de `titulos_de_partida`
   * logo acima: widget sem alerta é o comportamento de sempre; widget que não
   * monta por causa de um alerta é regressão.
   */
  const alertas = await alertasDaIdentidade(admin(), campos);

  return Response.json(
    { config: { ...cfgAtual, ...abertura }, aiEnabled: await hasAiKey(), alertas },
    // no-store: mudança de config (ícone/cor/título) reflete no próximo load,
    // sem o navegador servir uma versão cacheada da config. Vale dobrado com os
    // alertas: campanha publicada tem de aparecer na próxima abertura, e não
    // quando o navegador decidir reler a config.
    { headers: { ...cors, "Cache-Control": "no-store" } },
  );
}
