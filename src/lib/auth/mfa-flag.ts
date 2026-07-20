/**
 * ⚠️  INTERRUPTOR TEMPORÁRIO DE 2FA (TOTP) ⚠️
 *
 * Com `MFA_DISABLED=true` no ambiente, o admin para de exigir a elevação da
 * sessão para AAL2 — ou seja, entra só com e-mail + senha.
 *
 * Por que existe como flag (e não removendo o código):
 *  - a checagem continua no lugar, então voltar ao normal é apagar 1 linha
 *    do .env.local (que é gitignored e não vai para produção);
 *  - o padrão é SEGURO: sem a variável, o TOTP continua obrigatório.
 *
 * NUNCA definir esta variável no ambiente de produção. O 2FA é a única barreira
 * caso a senha de um admin vaze; sem ele, senha vazada = painel inteiro aberto.
 */
export const MFA_DISABLED = process.env.MFA_DISABLED === "true";

/** Só para deixar rastro no log do servidor enquanto estiver desligado. */
export function warnIfMfaDisabled(origem: string): void {
  if (MFA_DISABLED) {
    console.warn(`[SEGURANÇA] 2FA desativado por MFA_DISABLED=true (${origem}).`);
  }
}
