import type { NextRequest } from "next/server";
import { exigeEmailFuncional, lerPerfil, trocarCodigo, type ProviderConnect } from "@/lib/integrations/oauth-user";
import {
  consumirEstado,
  credencialPorId,
  redirectUri,
  salvarConexao,
} from "@/lib/integrations/connect-store";
import { mesmoEmail } from "@/lib/chat/meus-dados";
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
    // Trilha de auditoria do vínculo: o critério é a matrícula afirmada pelo
    // anfitrião (decisão do produto), mas guardar quem de fato consentiu é o
    // que permite descobrir depois uma ligação errada.
    const perfil = await lerPerfil(provider, tokens.accessToken);

    // A CAIXA TEM DE SER A DA PESSOA — quando o administrador exige isso.
    //
    // Qual conta autorizar é escolha de quem está no navegador, e navegador
    // logado no e-mail pessoal é o caso comum: sem checagem, conectar a caixa
    // errada é um erro silencioso (o envio funciona, saindo do endereço
    // errado, e só se descobre pelo destinatário).
    //
    // DESLIGADA por padrão (decisão do Igor, 11/08/2026): nem todo cliente tem
    // SSO com o provedor, e onde não tem, o e-mail funcional do RH não
    // corresponde a conta nenhuma — exigir travaria quem não tem como cumprir.
    //
    // Ligada, recusa SEM gravar nada (conexão meio feita é pior que nenhuma) e
    // só quando sabemos o alvo: `expected_email` nulo passa direto, porque
    // bloquear por ignorância deixaria a pessoa sem saída.
    if (exigeEmailFuncional(cred.cfg) && estado.emailEsperado && !mesmoEmail(perfil.email, estado.emailEsperado)) {
      return paginaDeErro(
        `A conta autorizada (${perfil.email ?? "sem e-mail"}) não é a do seu cadastro. ` +
          `Conecte a conta ${estado.emailEsperado} — na tela da ${provider === "microsoft" ? "Microsoft" : "Google"}, ` +
          'escolha "Usar outra conta". Se o e-mail do seu cadastro estiver desatualizado, fale com o RH.',
      );
    }

    await salvarConexao({
      credentialId: cred.credentialId,
      // A base vem do ESTADO, não da credencial: com credencial global, a
      // `base_id` dela é a da base onde foi cadastrada, não a de quem conectou.
      // Gravar a errada esconderia a conexão do corte de disponibilidade, que
      // procura por (base, pessoa).
      baseId: estado.baseId ?? cred.baseId,
      provider,
      pessoa: estado.pessoa,
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
