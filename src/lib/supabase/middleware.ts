import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { MFA_DISABLED } from "@/lib/auth/mfa-flag";

/**
 * Rotas do Admin que NÃO exigem sessão completa (são o caminho para obtê-la):
 *  - /admin/login          → e-mail + senha
 *  - /admin/definir-senha  → primeiro acesso (link do e-mail)
 *  - /admin/mfa            → enrollment e challenge do TOTP
 */
const ADMIN_PUBLIC_PATHS = [
  "/admin/login",
  "/admin/definir-senha",
  "/admin/mfa",
];

function isAdminPublic(pathname: string) {
  return ADMIN_PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Atualiza a sessão (refresh dos cookies) e aplica a proteção do Admin.
 * Deve rodar em todas as requests via middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANTE: getUser() revalida o token no servidor Supabase (não confia
  // apenas no cookie). Não colocar lógica entre createServerClient e getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isAdminRoute) return response;

  // Sem sessão → só pode acessar as rotas públicas do admin.
  if (!user) {
    if (isAdminPublic(pathname)) return response;
    return redirectTo(request, "/admin/login");
  }

  // Com sessão: verifica o nível de garantia (AAL). TOTP é obrigatório —
  // exceto com MFA_DISABLED=true (interruptor temporário, ver lib/auth/mfa-flag).
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const fullyAuthed = MFA_DISABLED || aal?.currentLevel === "aal2";
  const onPublic = isAdminPublic(pathname);

  if (!fullyAuthed) {
    // Sessão parcial (aal1): pode acessar as telas de auth em progresso
    // (login, definir-senha, mfa), mas qualquer rota protegida vai ao TOTP.
    if (onPublic) return response;
    return redirectTo(request, "/admin/mfa");
  }

  // Sessão completa (aal2): não faz sentido ficar no login ou no TOTP.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/mfa")) {
    return redirectTo(request, "/admin");
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
