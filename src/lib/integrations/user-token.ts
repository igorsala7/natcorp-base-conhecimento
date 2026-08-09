import "server-only";
import { conexaoAtiva, atualizarTokens, credencialPorId } from "./connect-store";
import { precisaRenovar, renovar } from "./oauth-user";

/**
 * O access_token PESSOAL para uma tool `identity_mode = 'user'`.
 *
 * Costura os dois lados: [connect-store.ts](./connect-store.ts) guarda a
 * conexão e [oauth-user.ts](./oauth-user.ts) fala o protocolo. Aqui fica a
 * decisão de quando renovar e o que dizer quando não dá.
 *
 * ── Por que o erro é um valor, e não uma exceção ────────────────────────
 * "Você ainda não conectou sua conta Microsoft" não é falha do sistema: é uma
 * resposta legítima que o agente precisa repassar ao usuário com o que fazer a
 * seguir. Lançar faria isso virar um 500 no log e uma frase genérica no chat.
 */
export type ResultadoToken =
  | { ok: true; token: string }
  | { ok: false; motivo: "sem_conexao" | "sem_credencial" | "renovacao_falhou"; mensagem: string };

const PEDIR_CONEXAO =
  "O usuário ainda não conectou a conta dele. Diga que, para responder isso, ele precisa " +
  "conectar a conta no botão de conexão do assistente — e não tente outra ferramenta para " +
  "obter o mesmo dado.";

export async function tokenDoUsuario(input: {
  credentialId: string;
  /** `p_usuario` do token de rastreio — a mesma chave usada no consentimento. */
  pUsuario: string;
  agora?: number;
}): Promise<ResultadoToken> {
  const pUsuario = input.pUsuario?.trim();
  if (!pUsuario) {
    return {
      ok: false,
      motivo: "sem_conexao",
      mensagem:
        "Não foi possível identificar o usuário nesta conversa, então não há conta pessoal a usar. " +
        PEDIR_CONEXAO,
    };
  }

  const conexao = await conexaoAtiva(input.credentialId, pUsuario);
  if (!conexao) {
    return { ok: false, motivo: "sem_conexao", mensagem: PEDIR_CONEXAO };
  }

  // Ainda válido: devolve o que está em cache. É o caminho normal — só o
  // primeiro turno depois de uma hora paga a renovação.
  if (conexao.accessToken && !precisaRenovar(conexao.expiresAt, input.agora)) {
    return { ok: true, token: conexao.accessToken };
  }

  const cred = await credencialPorId(input.credentialId);
  if (!cred) {
    return {
      ok: false,
      motivo: "sem_credencial",
      mensagem:
        "A integração desta conta não está mais configurada. Avise que o administrador precisa " +
        "revisar a credencial em Integrações.",
    };
  }

  try {
    const tokens = await renovar({
      provider: cred.provider,
      cfg: cred.cfg,
      refreshToken: conexao.refreshToken,
      agora: input.agora,
    });
    // Grava SEMPRE, inclusive o refresh novo quando veio: a Microsoft rotaciona
    // e invalida o anterior, então pular esta escrita quebraria a próxima
    // renovação — falha que só apareceria uma hora depois.
    await atualizarTokens(conexao.connectionId, tokens);
    return { ok: true, token: tokens.accessToken };
  } catch (e) {
    // Refresh token revogado, senha trocada, consentimento retirado pelo admin:
    // todos caem aqui, e todos se resolvem com o usuário conectando de novo.
    return {
      ok: false,
      motivo: "renovacao_falhou",
      mensagem:
        "A conexão com a conta do usuário expirou ou foi revogada. Peça que ele conecte a conta " +
        `novamente. (Detalhe técnico: ${e instanceof Error ? e.message : "desconhecido"})`,
    };
  }
}
