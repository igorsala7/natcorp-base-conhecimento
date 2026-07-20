import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MFA_DISABLED } from "@/lib/auth/mfa-flag";

/**
 * Confirma links de e-mail (convite de primeiro acesso, recuperação de senha).
 * Suporta os dois fluxos do Supabase: `code` (PKCE) e `token_hash` (verifyOtp),
 * para funcionar independentemente do template de e-mail configurado.
 * Ao final, estabelece a sessão e encaminha para `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/admin/definir-senha";

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  let established = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    established = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    established = !error;
  }

  if (!established) {
    return NextResponse.redirect(
      new URL("/admin/login?erro=link-invalido", origin),
    );
  }

  // Se o usuário tem TOTP cadastrado, precisa elevar a sessão a AAL2 ANTES de
  // qualquer ação sensível (ex.: trocar senha). Manda ao desafio primeiro,
  // preservando o destino em `next`.
  if (!MFA_DISABLED) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      return NextResponse.redirect(
        new URL(`/admin/mfa?next=${encodeURIComponent(next)}`, origin),
      );
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
