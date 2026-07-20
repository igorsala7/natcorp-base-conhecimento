"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PermissionError } from "@/lib/auth/permissions";
import { currentMaxLevel } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/email/send";
import { audit } from "@/lib/auth/audit";
import { env } from "@/lib/env";

export type ActionState = { ok?: string; error?: string } | undefined;

function fail(error: string): ActionState {
  return { error };
}

/**
 * Convida um usuário: cria (ou reaproveita) a conta no Auth e gera o link de
 * convite, depois cria o membership com o papel escolhido. O membership é
 * inserido pela SESSÃO do ator — assim a RLS e o trigger de não-escalada
 * decidem de verdade (o servidor recusa, não a UI). Sem SMTP, devolvemos o
 * link para envio manual.
 */
const inviteSchema = z.object({
  email: z.string().email("E-mail inválido."),
  roleKey: z.string().min(1),
  spaceId: z.string().uuid().nullable().optional(),
});

export async function inviteUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    roleKey: formData.get("roleKey"),
    spaceId: (formData.get("spaceId") as string) || null,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Inválido.");
  const { email, roleKey, spaceId = null } = parsed.data;

  try {
    await requirePermission("user.invite", spaceId ?? null);
  } catch {
    return fail("Você não pode convidar usuários neste escopo.");
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Papel-alvo e checagem de não-escalada (mensagem amigável; o trigger é o backstop).
  const { data: role } = await supabase
    .from("roles")
    .select("id, level, name")
    .eq("key", roleKey)
    .single();
  if (!role) return fail("Papel inválido.");

  const actorLevel = await currentMaxLevel(spaceId ?? null);
  if (actorLevel <= role.level) {
    return fail("Você não pode conceder um papel de nível igual ou superior ao seu.");
  }

  // Cria a conta e gera o link de convite (não depende de SMTP).
  const redirectTo = `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/admin/definir-senha`;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (linkErr || !linkData.user) {
    return fail(`Não foi possível criar o convite: ${linkErr?.message ?? ""}`);
  }
  const userId = linkData.user.id;

  // Cria o membership pela sessão do ator (RLS + trigger de escalada aplicam).
  const { error: memErr } = await supabase.from("memberships").insert({
    user_id: userId,
    role_id: role.id,
    space_id: spaceId ?? null,
  });
  if (memErr) {
    return fail(`Conta criada, mas falha ao atribuir papel: ${memErr.message}`);
  }

  // Registra o convite para histórico.
  await supabase.from("invitations").insert({
    email,
    role_id: role.id,
    space_id: spaceId ?? null,
    accepted_at: null,
  });

  await audit({
    action: "user.invite",
    entityType: "user",
    entityId: userId,
    spaceId: spaceId ?? null,
    after: { email, role: roleKey },
  });

  // Envia o convite por e-mail quando houver transporte configurado. O link
  // continua na resposta: se o envio falhar, o convite NÃO é perdido — quem
  // convidou copia e manda por fora, como sempre foi.
  const link = linkData.properties?.action_link ?? "";
  let envio = "";
  if (link) {
    const r = await sendEmail({
      to: email,
      subject: "Você foi convidado para a Base de Conhecimento",
      html:
        `<p>Você foi convidado para acessar a Base de Conhecimento.</p>` +
        `<p><a href="${link}">Clique aqui para definir sua senha e entrar</a>.</p>` +
        `<p style="color:#666;font-size:12px">Se o botão não funcionar, copie este endereço: ${link}</p>`,
      text: `Você foi convidado para a Base de Conhecimento. Acesse: ${link}`,
    });
    envio = r.ok ? " E-mail enviado." : ` (E-mail não enviado: ${r.reason})`;
  }

  revalidatePath("/admin/usuarios");
  return {
    ok: `Convite criado para ${email}.${envio} Link: ${link || "gerado"}`,
  };
}

/** Troca o papel de um membership. RLS + trigger de escalada decidem. */
const changeRoleSchema = z.object({
  membershipId: z.string().uuid(),
  roleKey: z.string().min(1),
});

export async function changeUserRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = changeRoleSchema.safeParse({
    membershipId: formData.get("membershipId"),
    roleKey: formData.get("roleKey"),
  });
  if (!parsed.success) return fail("Dados inválidos.");
  const { membershipId, roleKey } = parsed.data;

  const supabase = await createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("id, level")
    .eq("key", roleKey)
    .single();
  if (!role) return fail("Papel inválido.");

  const { data: current } = await supabase
    .from("memberships")
    .select("space_id")
    .eq("id", membershipId)
    .single();

  try {
    await requirePermission("user.manage", current?.space_id ?? null);
  } catch {
    return fail("Sem permissão para gerenciar usuários neste escopo.");
  }

  const { error } = await supabase
    .from("memberships")
    .update({ role_id: role.id })
    .eq("id", membershipId);
  if (error) {
    return fail(
      error.message.includes("nível")
        ? "Você não pode atribuir um papel de nível igual ou superior ao seu."
        : `Falha: ${error.message}`,
    );
  }

  await audit({
    action: "user.role_change",
    entityType: "membership",
    entityId: membershipId,
    after: { role: roleKey },
  });
  revalidatePath("/admin/usuarios");
  return { ok: "Papel atualizado." };
}

/** Suspende ou reativa um usuário (bloqueia login via ban no Auth). */
export async function setUserSuspended(
  userId: string,
  suspended: boolean,
): Promise<ActionState> {
  try {
    await requirePermission("user.suspend");
  } catch {
    return fail("Sem permissão para suspender usuários.");
  }

  // Não deixa suspender alguém de nível >= ao seu.
  const supabase = await createClient();
  const { data: targetLevel } = await supabase.rpc("max_role_level", {
    p_user_id: userId,
    p_space_id: undefined,
  });
  const actorLevel = await currentMaxLevel(null);
  if (actorLevel <= (targetLevel ?? 0)) {
    return fail("Você não pode suspender um usuário de nível igual ou superior ao seu.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: suspended ? "876000h" : "none", // ~100 anos ou remove o ban
  });
  if (error) return fail(`Falha: ${error.message}`);

  await supabase
    .from("profiles")
    .update({ status: suspended ? "suspended" : "active" })
    .eq("id", userId);

  await audit({
    action: suspended ? "user.suspend" : "user.reactivate",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/admin/usuarios");
  return { ok: suspended ? "Usuário suspenso." : "Usuário reativado." };
}

/** Remove um usuário. O trigger protege o último Owner. */
export async function removeUser(userId: string): Promise<ActionState> {
  const user = await (async () => {
    try {
      return await requirePermission("user.manage");
    } catch {
      return null;
    }
  })();
  if (!user) return fail("Sem permissão para remover usuários.");
  if (user.id === userId) return fail("Você não pode remover a si mesmo.");

  const supabase = await createClient();
  const { data: targetLevel } = await supabase.rpc("max_role_level", {
    p_user_id: userId,
    p_space_id: undefined,
  });
  const actorLevel = await currentMaxLevel(null);
  if (actorLevel <= (targetLevel ?? 0)) {
    return fail("Você não pode remover um usuário de nível igual ou superior ao seu.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return fail(
      error.message.toLowerCase().includes("owner")
        ? "Não é possível remover o último Owner."
        : `Falha: ${error.message}`,
    );
  }

  await audit({ action: "user.remove", entityType: "user", entityId: userId });
  revalidatePath("/admin/usuarios");
  return { ok: "Usuário removido." };
}

/** Revoga todas as sessões de um usuário (logout global). */
export async function revokeSessions(userId: string): Promise<ActionState> {
  try {
    await requirePermission("user.manage");
  } catch {
    return fail("Sem permissão.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.signOut(userId, "global");
  if (error) return fail(`Falha: ${error.message}`);
  await audit({
    action: "user.revoke_sessions",
    entityType: "user",
    entityId: userId,
  });
  return { ok: "Sessões revogadas." };
}

export { PermissionError };
