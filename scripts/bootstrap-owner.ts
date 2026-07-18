/**
 * Bootstrap do primeiro Owner (Fase 0.5).
 *
 * Cria o profile e um membership global de Owner para um usuário já existente.
 * Roda com service_role (ignora RLS e o trigger de não-escalada) — é a única
 * forma de nascer o primeiro Owner, já que a regra proíbe conceder papel >= ao seu.
 *
 * Uso: npm run bootstrap:owner -- igor@natcorp.com.br
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] ?? process.env.BOOTSTRAP_OWNER_EMAIL;

if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email) {
  console.error("Informe o e-mail: npm run bootstrap:owner -- voce@natcorp.com.br");
  process.exit(1);
}

const db = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Localiza o usuário no Auth.
const { data: list, error: listErr } = await db.auth.admin.listUsers();
if (listErr) {
  console.error("Erro ao listar usuários:", listErr.message);
  process.exit(1);
}
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`Usuário ${email} não encontrado no Auth. Crie-o primeiro.`);
  process.exit(1);
}

// 2. Garante o profile (o trigger cobre signups novos; este já existia).
const { error: profErr } = await db.from("profiles").upsert(
  { id: user.id, email: user.email, status: "active" },
  { onConflict: "id" },
);
if (profErr) {
  console.error("Erro ao criar profile:", profErr.message);
  process.exit(1);
}

// 3. Busca o papel Owner.
const { data: owner, error: roleErr } = await db
  .from("roles")
  .select("id")
  .eq("key", "owner")
  .single();
if (roleErr || !owner) {
  console.error("Papel 'owner' não encontrado (migration aplicada?).");
  process.exit(1);
}

// 4. Cria o membership global de Owner (se ainda não existir).
const { data: existing } = await db
  .from("memberships")
  .select("id")
  .eq("user_id", user.id)
  .eq("role_id", owner.id)
  .is("space_id", null)
  .maybeSingle();

if (existing) {
  console.log(`${email} já é Owner global (membership ${existing.id}).`);
  process.exit(0);
}

const { data: created, error: memErr } = await db
  .from("memberships")
  .insert({ user_id: user.id, role_id: owner.id, space_id: null })
  .select("id")
  .single();
if (memErr) {
  console.error("Erro ao criar membership:", memErr.message);
  process.exit(1);
}

console.log(`✓ ${email} promovido a Owner global (membership ${created.id}).`);
