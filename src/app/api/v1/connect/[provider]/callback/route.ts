import type { NextRequest } from "next/server";
import { lerPerfil, trocarCodigo, type ProviderConnect } from "@/lib/integrations/oauth-user";
import {
  consumirEstado,
  credencialPorId,
  redirectUri,
  salvarConexao,
} from "@/lib/integrations/connect-store";
import { paginaDeErro, paginaDeSucesso } from "../pagina";

export const runtime = "nodejs";

/**
 * Retorno do consentimento. É a URL registrada no Entra/Google Cloud e precisa
 * bater byte a byte com `redirectUri()` — divergência devolve `AADSTS50011`
 * antes mesmo de chegar aqui.
 *
 * O `code` é de uso único e curto, mas a URL inteira passa pelo histórico do
 * navegador e por qualquer proxy no caminho. A defesa é o `state`: um nonce
 * gravado no servidor, gasto atomicamente na primeira troca. Quem repetir a URL
 * encontra o estado já consumido e não conecta nada.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider: bruto } = await ctx.params;
  if (bruto !== "microsoft" && bruto !== "google") return paginaDeErro("Provedor desconhecido.");
  const provider = bruto as ProviderConnect;

  const q = req.nextUrl.searchParams;

  // O usuário pode ter clicado em "Cancelar", e isso não é falha do sistema —
  // dizer "erro" aqui faria a pessoa procurar problema onde não há.
  const erroProvedor = q.get("error");
  if (erroProvedor) {
    const desc = q.get("error_description") ?? "";
    return paginaDeErro(
      erroProvedor === "access_denied"
        ? "Você recusou a autorização. Nada foi conectado."
        : `${erroProvedor}${desc ? `: ${desc}` : ""}`,
    );
  }

  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return paginaDeErro("Retorno incompleto do provedor.");

  const estado = await consumirEstado(state);
  if (!estado) {
    return paginaDeErro(
      "Este link de autorização expirou ou já foi usado. Clique em conectar novamente.",
    );
  }

  const cred = await credencialPorId(estado.credentialId);
  if (!cred) return paginaDeErro("A credencial deste cliente não está mais disponível.");
  if (cred.provider !== provider) {
    // O nonce nasce amarrado à credencial; chegar aqui significa `state` de um
    // fluxo trocado pelo de outro provedor.
    return paginaDeErro("Autorização não confere com o provedor solicitado.");
  }

  try {
    const tokens = await trocarCodigo({
      provider,
      cfg: cred.cfg,
      code,
      redirectUri: redirectUri(provider),
    });
    // Trilha de auditoria do vínculo: o critério é o `p_usuario` do anfitrião
    // (decisão do produto), mas guardar quem de fato consentiu é o que permite
    // descobrir depois uma ligação errada.
    const perfil = await lerPerfil(provider, tokens.accessToken);
    await salvarConexao({
      credentialId: cred.credentialId,
      baseId: cred.baseId,
      provider,
      pUsuario: estado.pUsuario,
      tokens,
      email: perfil.email,
      nome: perfil.nome,
    });
    return paginaDeSucesso(perfil.email);
  } catch (e) {
    // A mensagem do provedor é a única pista útil de registro mal configurado
    // (redirect divergente, escopo sem consentimento de admin). Some-la aqui
    // transformaria cada erro de setup numa investigação às cegas.
    return paginaDeErro(e instanceof Error ? e.message : "Falha ao concluir a conexão.");
  }
}
