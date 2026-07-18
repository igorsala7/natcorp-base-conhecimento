/**
 * Seed do primeiro admin (Fase 0).
 *
 * Convida um usuário por e-mail usando a service_role. O convidado recebe um
 * link → define a senha (/admin/definir-senha) → cadastra o TOTP (/admin/mfa).
 *
 * Uso:
 *   npm run seed -- admin@natcorp.com.br
 *   (ou defina SEED_ADMIN_EMAIL no ambiente)
 *
 * Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SITE_URL. A URL de redirecionamento precisa estar na allowlist
 * do Supabase (Auth → URL Configuration → Redirect URLs).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const email = process.argv[2] ?? process.env.SEED_ADMIN_EMAIL;

if (!url || !serviceRole) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.",
  );
  process.exit(1);
}
if (!email) {
  console.error(
    "Informe o e-mail do admin: npm run seed -- admin@natcorp.com.br",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const redirectTo = `${siteUrl}/auth/confirm?next=/admin/definir-senha`;

const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
  redirectTo,
});

if (error) {
  console.error("Falha ao convidar:", error.message);
  process.exit(1);
}

console.log(`Convite enviado para ${email} (id: ${data.user?.id}).`);
console.log(`Redirect: ${redirectTo}`);
console.log(
  "O usuário deve abrir o e-mail → definir a senha → cadastrar o TOTP.",
);
