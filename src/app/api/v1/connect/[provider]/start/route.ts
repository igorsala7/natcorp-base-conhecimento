import type { NextRequest } from "next/server";
import { resolveWidgetKey, extractKey } from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { urlDeConsentimento, type ProviderConnect } from "@/lib/integrations/oauth-user";
import { abrirEstado, credencialDelegada, redirectUri } from "@/lib/integrations/connect-store";
import { chavePessoal } from "@/lib/integrations/user-key";
import { emailFuncionalDaPessoa } from "@/lib/integrations/email-funcional";
import { identityFromTrack } from "@/lib/integrations/params";
import { paginaDeErro } from "../pagina";

export const runtime = "nodejs";

/**
 * Início do consentimento: o widget abre ESTA url num popup e o usuário sai
 * daqui para a tela da Microsoft/Google.
 *
 * É `GET` com redirect, e não `POST` devolvendo a URL, por causa do popup:
 * `window.open` seguido de um `fetch` para descobrir o destino é bloqueado como
 * pop-up em navegador com política estrita, porque a abertura deixa de ser
 * consequência direta do clique.
 *
 * A identidade NÃO vem da querystring em texto: `p_base` e `p_usuario` saem do
 * token cifrado de rastreio, a mesma máquina do chat. Quem chamar esta rota com
 * um `p_usuario` inventado não consegue nada — o token não decifra sem a chave
 * do espaço.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider: bruto } = await ctx.params;
  if (bruto !== "microsoft" && bruto !== "google") {
    return paginaDeErro("Provedor desconhecido.");
  }
  const provider = bruto as ProviderConnect;

  const url = req.nextUrl;
  const key = await resolveWidgetKey(extractKey(req, url.searchParams.get("key")));
  if (!key) return paginaDeErro("Chave do widget inválida ou inativa.");

  const track = await decodeTrackForSpace(key.space_id, url.searchParams.get("track"));
  const pBase = String(track.p_base ?? "").trim();
  // A PESSOA, pela mesma regra do chat (`chavePessoal`). Era `p_usuario ??
  // p_matricula`: o `??` mandava a conta para 'PORTAL' — usuário da aplicação,
  // compartilhado por todos os colaboradores — e o chat, que só olhava
  // `p_usuario`, nem achava a conexão gravada com a matrícula.
  const pessoa = chavePessoal({ base: pBase, empresa: track.p_empresa, matricula: track.p_matricula });
  if (!pBase || !pessoa) {
    // Sem identidade não há a quem amarrar a conta — e amarrar a "ninguém"
    // criaria uma conexão que o próximo usuário herdaria.
    return paginaDeErro(
      "Não foi possível identificar o usuário. O sistema precisa enviar a empresa e a matrícula nos parâmetros de rastreio para conectar uma conta.",
    );
  }

  const cred = await credencialDelegada(pBase, provider);
  if (!cred) {
    return paginaDeErro(
      `Nenhuma credencial ${provider === "microsoft" ? "Microsoft" : "Google"} configurada para este cliente. ` +
        "Cadastre em Integrações → Credenciais.",
    );
  }

  // QUAL caixa esta pessoa deveria conectar. Sai do cadastro do RH
  // (`meus_dados.email_funcional`), a mesma fonte que o chat usa — não de nada
  // que o navegador afirme. Vira `login_hint` na tela do provedor e o alvo da
  // checagem no callback. `null` (cadastro sem e-mail, ORDS fora) segue o fluxo
  // sem pré-seleção e sem checagem: não saber nunca vira bloqueio.
  const emailEsperado = await emailFuncionalDaPessoa(pBase, identityFromTrack(track));

  let nonce: string;
  try {
    nonce = await abrirEstado({
      credentialId: cred.credentialId,
      pessoa,
      origin: req.headers.get("origin"),
      // A base do CLIENTE — a credencial pode ser a global, compartilhada.
      baseId: cred.baseId,
      emailEsperado,
    });
  } catch (e) {
    return paginaDeErro(e instanceof Error ? e.message : "Falha ao iniciar o consentimento.");
  }

  const destino = urlDeConsentimento({
    provider,
    cfg: cred.cfg,
    redirectUri: redirectUri(provider),
    nonce,
    loginHint: emailEsperado,
  });
  return Response.redirect(destino, 302);
}
