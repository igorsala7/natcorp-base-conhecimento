"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PermissionError } from "@/lib/auth/permissions";
import { currentMaxLevel } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/email/send";
import { loadEmailWrapper } from "@/lib/email/template";
import { emailButton, emailParagraph } from "@/lib/blocks/email-html";
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
    const wrap = await loadEmailWrapper();
    const corpo =
      emailParagraph(
        "Você foi convidado para acessar a Base de Conhecimento. Clique no botão abaixo para definir sua senha e entrar.",
      ) +
      emailButton("Definir senha e entrar", link) +
      emailParagraph(
        `Se o botão não funcionar, copie e cole este endereço no navegador:<br>${link}`,
        { muted: true, small: true },
      );
    const r = await sendEmail({
      to: email,
      subject: "Você foi convidado para a Base de Conhecimento",
      html: wrap(corpo),
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

/**
 * Edita a identidade INTERNA do usuário — nome, cargo e foto —, separada do
 * perfil PÚBLICO de autor. Exige user.manage e respeita a não-escalada (não
 * edita quem tem nível ≥ ao seu; a si mesmo pode).
 */
const identitySchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().max(120).nullable(),
  jobTitle: z.string().trim().max(120).nullable(),
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .refine((v) => !v || v.startsWith("https://") || v.startsWith("/"), {
      message: "Foto precisa ser https:// ou caminho local.",
    }),
});

export async function updateProfileIdentity(
  input: z.infer<typeof identitySchema>,
): Promise<ActionState> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { userId, fullName, jobTitle, avatarUrl } = parsed.data;

  let actor;
  try {
    actor = await requirePermission("user.manage");
  } catch {
    return fail("Sem permissão para editar usuários.");
  }

  const supabase = await createClient();
  const { data: targetLevel } = await supabase.rpc("max_role_level", {
    p_user_id: userId,
    p_space_id: undefined,
  });
  const actorLevel = await currentMaxLevel(null);
  if (userId !== actor.id && actorLevel <= (targetLevel ?? 0)) {
    return fail("Você não pode editar um usuário de nível igual ou superior ao seu.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      job_title: jobTitle || null,
      avatar_url: avatarUrl || null,
    })
    .eq("id", userId);
  if (error) return fail(`Falha: ${error.message}`);

  await audit({
    action: "user.identity_update",
    entityType: "user",
    entityId: userId,
    after: { full_name: fullName, job_title: jobTitle },
  });
  revalidatePath("/admin/usuarios");
  return { ok: "Identidade atualizada." };
}

/**
 * Adiciona uma REGRA de acesso ao usuário: papel + documentação (espaço) +
 * diretório opcional (subárvore). Várias regras convivem. O papel decide o
 * efeito: papel de edição restringe o que o Editor edita; papel com
 * review.approve restringe o que o aprovador aprova. Inserido pela sessão do
 * ator — RLS + trigger de não-escalada decidem de verdade.
 */
const ruleSchema = z.object({
  userId: z.string().uuid(),
  roleKey: z.string().min(1),
  spaceId: z.string().uuid(),
  nodeId: z.string().uuid().nullable().optional(),
});

export async function addMembershipRule(
  input: z.infer<typeof ruleSchema>,
): Promise<ActionState> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { userId, roleKey, spaceId, nodeId = null } = parsed.data;

  try {
    await requirePermission("user.manage", spaceId);
  } catch {
    return fail("Sem permissão para gerenciar acesso neste escopo.");
  }

  const supabase = await createClient();
  const { data: role } = await supabase.from("roles").select("id, level").eq("key", roleKey).single();
  if (!role) return fail("Papel inválido.");

  const actorLevel = await currentMaxLevel(spaceId);
  if (actorLevel <= role.level) {
    return fail("Você não pode conceder um papel de nível igual ou superior ao seu.");
  }

  const { error } = await supabase.from("memberships").insert({
    user_id: userId,
    role_id: role.id,
    space_id: spaceId,
    node_id: nodeId,
  });
  if (error) {
    return fail(
      error.message.includes("nível")
        ? "Você não pode conceder um papel de nível igual ou superior ao seu."
        : `Falha: ${error.message}`,
    );
  }

  await audit({
    action: "user.rule_add",
    entityType: "user",
    entityId: userId,
    spaceId,
    after: { role: roleKey, node_id: nodeId },
  });
  revalidatePath("/admin/usuarios");
  return { ok: "Regra de acesso adicionada." };
}

/** Remove uma regra de acesso (membership). Não remove papel ≥ ao seu; o último Owner é protegido pelo banco. */
export async function removeMembershipRule(membershipId: string): Promise<ActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(membershipId)) return fail("Inválido.");

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("memberships")
    .select("space_id, roles(level)")
    .eq("id", membershipId)
    .single();
  if (!m) return fail("Regra não encontrada.");

  try {
    await requirePermission("user.manage", m.space_id ?? null);
  } catch {
    return fail("Sem permissão para gerenciar acesso neste escopo.");
  }

  const targetLevel = (m.roles as unknown as { level: number } | null)?.level ?? 0;
  const actorLevel = await currentMaxLevel(m.space_id ?? null);
  if (actorLevel <= targetLevel) {
    return fail("Você não pode remover um papel de nível igual ou superior ao seu.");
  }

  const { error } = await supabase.from("memberships").delete().eq("id", membershipId);
  if (error) {
    return fail(
      error.message.toLowerCase().includes("owner")
        ? "Não é possível remover o último Owner."
        : `Falha: ${error.message}`,
    );
  }

  await audit({ action: "user.rule_remove", entityType: "membership", entityId: membershipId });
  revalidatePath("/admin/usuarios");
  return { ok: "Regra removida." };
}

export { PermissionError };
