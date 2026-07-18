import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SpaceInfo = {
  id: string;
  slug: string;
  name: string;
  type: "global" | "client";
  parent_space_id: string | null;
  visibility: "public" | "private" | "password";
  custom_domain: string | null;
};

/** Todos os espaços visíveis ao usuário (global primeiro, depois clientes). */
export async function listSpaces(): Promise<SpaceInfo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, slug, name, type, parent_space_id, visibility, custom_domain")
    .order("type", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as SpaceInfo[];
}
