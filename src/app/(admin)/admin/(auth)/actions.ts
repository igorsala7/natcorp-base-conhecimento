"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MFA_DISABLED } from "@/lib/auth/mfa-flag";

export type AuthState = { error?: string } | undefined;

const credentialsSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

/** Login com e-mail + senha (primeiro fator). O TOTP é exigido pelo middleware. */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "E-mail ou senha incorretos." };
  }

  // Sessão em AAL1. O middleware encaminha para /admin/mfa (enroll ou challenge).
  redirect("/admin");
}

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use ao menos 10 caracteres.")
      .regex(/[a-z]/, "Inclua uma letra minúscula.")
      .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
      .regex(/[0-9]/, "Inclua um número."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

/**
 * Define a senha no primeiro acesso. Exige uma sessão já estabelecida pelo
 * link do convite (rota /auth/confirm). Sem sessão, não há o que atualizar.
 */
export async function setPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Link inválido ou expirado. Peça um novo convite." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: "Não foi possível definir a senha. Tente novamente." };
  }

  // Senha definida → segue para cadastrar o TOTP (ou direto ao painel, se o
  // 2FA estiver temporariamente desligado por MFA_DISABLED).
  redirect(MFA_DISABLED ? "/admin" : "/admin/mfa");
}

/** Encerra a sessão e volta ao login. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
