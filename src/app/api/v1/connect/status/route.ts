import type { NextRequest } from "next/server";
import { resolveWidgetKey, originAllowed, corsHeaders, clientIp, extractKey, rateLimitOk } from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { chavePessoal, NOME_PROVEDOR } from "@/lib/integrations/user-key";
import { contasDaPessoa, credencialDelegada, revogarConexao } from "@/lib/integrations/connect-store";
import { exigeEmailFuncional } from "@/lib/integrations/oauth-user";
import { emailFuncionalDaPessoa } from "@/lib/integrations/email-funcional";
import { identityFromTrack } from "@/lib/integrations/params";

/**
 * POST /api/v1/connect/status — quais contas pessoais esta pessoa pode conectar
 * nesta base, e quais já estão conectadas. É o que permite ao widget mostrar um
 * botão "Conectar Microsoft" ANTES de o assunto aparecer no chat.
 *
 * Ações: "list" (padrão) e "disconnect" ({ provider }).
 *
 * Só devolve provedores que a base tem CADASTRADOS. Uma base sem credencial
 * `oauth2_user` não mostra botão nenhum — oferecer conexão que não existe é a
 * mesma promessa vazia que esta rodada veio consertar, só que na outra ponta.
 *
 * A identidade é a do token cifrado (`chavePessoal`), nunca o que o navegador
 * afirma: a lista diz se VOCÊ conectou, e desconectar só alcança a sua conexão.
 */
export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

  let p: { key?: unknown; track?: unknown; action?: unknown; provider?: unknown };
  try { p = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }

  const key = await resolveWidgetKey(extractKey(req, p.key));
  if (!key) return json({ ok: false, erro: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ ok: false, erro: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ ok: false, erro: "Muitas requisições. Tente em instantes." }, 429);
  }

  const track = await decodeTrackForSpace(key.space_id, p.track);
  const baseCode = String(track.p_base ?? "").trim();
  const pessoa = chavePessoal({ base: baseCode, empresa: track.p_empresa, matricula: track.p_matricula });
  // Sem base ou sem pessoa não há o que listar — e não é erro: é uma conversa
  // anônima, onde o botão simplesmente não aparece.
  if (!baseCode || !pessoa) return json({ ok: true, contas: [] }, 200);

  const contas = await contasDaPessoa(baseCode, pessoa);

  if (String(p.action ?? "") === "disconnect") {
    const provider = String(p.provider ?? "").trim();
    const alvo = contas.find((c) => c.provider === provider);
    if (!alvo) return json({ ok: false, erro: "Provedor não configurado para esta empresa." }, 400);
    await revogarConexao(alvo.credentialId, pessoa);
    return json({ ok: true, contas: await contasDaPessoa(baseCode, pessoa) }, 200);
  }

  // Qual caixa a pessoa DEVE conectar (cadastro do RH) — só quando o
  // administrador declarou que o e-mail do cadastro É a conta do provedor. Sem
  // essa declaração, anunciar um endereço no botão manda a pessoa procurar uma
  // conta que pode nem existir no diretório. De quebra, poupa uma ida à ORDS
  // por carregamento de widget.
  const exigeAlguma = (
    await Promise.all(
      contas.map(async (c) => {
        if (c.provider !== "microsoft" && c.provider !== "google") return false;
        const cred = await credencialDelegada(baseCode, c.provider);
        return cred ? exigeEmailFuncional(cred.cfg) : false;
      }),
    )
  ).some(Boolean);
  const esperado = exigeAlguma ? await emailFuncionalDaPessoa(baseCode, identityFromTrack(track)) : null;

  return json(
    {
      ok: true,
      contas: contas.map((c) => ({
        provider: c.provider,
        label: NOME_PROVEDOR[c.provider] ?? c.provider,
        conectada: c.conectada,
        // Só o e-mail da conta conectada — é o que confirma à pessoa QUAL conta
        // está ligada ali (ela pode ter mais de uma).
        conta: c.email,
        // O e-mail do cadastro, para o botão dizer QUAL conta conectar antes de
        // a pessoa abrir a tela do provedor e escolher a errada.
        esperado,
      })),
    },
    200,
  );
}
