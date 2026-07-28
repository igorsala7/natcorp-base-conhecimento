import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Prompts salvos do VISITANTE (portal/widget). Sem sessão verificada: a
 * identidade é o par (p_base, p_usuario) que o cliente informa — strings NÃO
 * confiáveis. Por isso a tabela `prompts_usuario_cliente` tem a RLS revogada de
 * anon/authenticated e só é tocada aqui, via service-role, sempre chaveada por
 * (space_id, p_base, p_usuario). Espelha o contrato do módulo logado
 * (`prompt-library-actions.ts`) para reusar o mesmo componente de UI.
 */
export type SavedPrompt = { id: string; label: string | null; texto: string };
export type SavePromptResult = { ok: true; id: string } | { ok: false; error: string };

/** Identidade do visitante — as duas chaves obrigatórias para ter biblioteca. */
export type ClienteIdentity = { p_base: string; p_usuario: string };

function idOk(id: unknown): id is ClienteIdentity {
  return (
    !!id &&
    typeof id === "object" &&
    typeof (id as ClienteIdentity).p_base === "string" &&
    typeof (id as ClienteIdentity).p_usuario === "string" &&
    !!(id as ClienteIdentity).p_base.trim() &&
    !!(id as ClienteIdentity).p_usuario.trim()
  );
}

/** Lista os prompts salvos daquele visitante naquela documentação. */
export async function listClientePrompts(
  spaceId: string,
  identity: ClienteIdentity,
): Promise<SavedPrompt[]> {
  if (!spaceId || !idOk(identity)) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("prompts_usuario_cliente")
    .select("id, label, texto")
    .eq("space_id", spaceId)
    .eq("p_base", identity.p_base)
    .eq("p_usuario", identity.p_usuario)
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data ?? []) as SavedPrompt[];
}

/** Cria ou atualiza (por id, dentro do escopo do visitante) um prompt. */
export async function saveClientePrompt(
  spaceId: string,
  identity: ClienteIdentity,
  input: { id?: string | null; label?: string | null; texto: string },
): Promise<SavePromptResult> {
  if (!spaceId || !idOk(identity)) return { ok: false, error: "Identidade ausente." };
  const texto = (input.texto ?? "").trim().slice(0, 8000);
  if (!texto) return { ok: false, error: "O texto do prompt é obrigatório." };
  const label = input.label?.trim().slice(0, 80) || null;
  const supabase = createAdminClient();

  if (input.id) {
    // Só atualiza se a linha for MESMO deste visitante nesta documentação —
    // um id de outra pessoa não pode ser sobrescrito.
    const { data, error } = await supabase
      .from("prompts_usuario_cliente")
      .update({ label, texto })
      .eq("id", input.id)
      .eq("space_id", spaceId)
      .eq("p_base", identity.p_base)
      .eq("p_usuario", identity.p_usuario)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Prompt não encontrado." };
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("prompts_usuario_cliente")
    .insert({ space_id: spaceId, p_base: identity.p_base, p_usuario: identity.p_usuario, label, texto })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao salvar." };
  return { ok: true, id: data.id };
}

/** Exclui um prompt do visitante (checado por escopo). */
export async function deleteClientePrompt(
  spaceId: string,
  identity: ClienteIdentity,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!spaceId || !idOk(identity) || !id) return { ok: false, error: "Dados inválidos." };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("prompts_usuario_cliente")
    .delete()
    .eq("id", id)
    .eq("space_id", spaceId)
    .eq("p_base", identity.p_base)
    .eq("p_usuario", identity.p_usuario);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
