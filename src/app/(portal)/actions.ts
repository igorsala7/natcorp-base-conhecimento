"use server";

import { cookies } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";
import { resolvePortalSpace } from "@/lib/portal/data";
import {
  spaceCookieName,
  makeSpaceToken,
  SPACE_COOKIE_MAX_AGE,
} from "@/lib/portal/space-auth";

/** Registra feedback "Isso foi útil?" (visitante anônimo). */
export async function submitFeedback(
  nodeId: string,
  helpful: boolean,
): Promise<{ ok: boolean }> {
  const supabase = createPublicClient();
  const { error } = await supabase
    .from("article_feedback")
    .insert({ node_id: nodeId, helpful });
  return { ok: !error };
}

/**
 * Verifica a senha de um espaço protegido. Em caso de sucesso, grava um cookie
 * assinado (o conteúdo só é servido via service-role depois deste cookie).
 */
export async function verifySpacePassword(
  spaceSlug: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const space = await resolvePortalSpace(spaceSlug);
  if (!space || space.visibility !== "password") {
    return { ok: false, error: "Espaço não encontrado." };
  }
  const supabase = createPublicClient();
  const { data: valid } = await supabase.rpc("verify_space_password", {
    p_space_id: space.id,
    p_plain: password,
  });
  if (valid !== true) return { ok: false, error: "Senha incorreta." };

  const store = await cookies();
  store.set(spaceCookieName(space.id), makeSpaceToken(space.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SPACE_COOKIE_MAX_AGE,
  });
  return { ok: true };
}
