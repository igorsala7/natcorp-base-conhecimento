import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Role = {
  id: string;
  key: string;
  name: string;
  level: number;
  description: string | null;
  is_system: boolean;
};

/** Todos os papéis, do maior nível para o menor. */
export async function listRoles(): Promise<Role[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("*")
    .order("level", { ascending: false });
  return data ?? [];
}

/** Maior nível do usuário atual no escopo (0 se nenhum). */
export async function currentMaxLevel(
  spaceId: string | null = null,
): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.rpc("max_role_level", {
    p_user_id: user.id,
    p_space_id: spaceId ?? undefined,
  });
  return data ?? 0;
}
