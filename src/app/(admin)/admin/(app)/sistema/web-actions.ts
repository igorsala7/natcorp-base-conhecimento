"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { invalidateWebFetchPolicy } from "@/lib/ai/web-fetch-policy";

export type WebFetchResult = { ok: true; msg?: string } | { ok: false; error: string };

const schema = z.object({
  authoring: z.boolean(),
  reader: z.boolean(),
  /** Lista de domínios (um por linha ou por vírgula); normalizada aqui. */
  allowlist: z.string().max(4000),
});

/** Normaliza domínios: minúsculo, sem esquema/caminho, sem '*.'/pontos nas pontas. */
function normalizarDominios(txt: string): string[] {
  const brutos = txt.split(/[\n,;]+/);
  const limpos = brutos
    .map((d) =>
      d
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/^\*?\.?/, "")
        .replace(/\.$/, ""),
    )
    .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  return [...new Set(limpos)];
}

export async function salvarWebFetch(input: z.infer<typeof schema>): Promise<WebFetchResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  try {
    await requirePermission("ai.configure", null);
    const allowlist = normalizarDominios(parsed.data.allowlist);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("web_fetch_settings").upsert({
      id: true,
      authoring_enabled: parsed.data.authoring,
      reader_enabled: parsed.data.reader,
      allowlist,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    });
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
    invalidateWebFetchPolicy();
    await audit({ action: "space.update", entityType: "web_fetch_settings", entityId: "web", spaceId: null });
    revalidatePath("/admin/sistema");
    return {
      ok: true,
      msg:
        parsed.data.reader && allowlist.length === 0
          ? "Salvo. O assistente do leitor está ligado, mas sem domínios permitidos — adicione ao menos um para ele acessar sites."
          : "Acesso à web salvo.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}
