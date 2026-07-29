import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCredentialSecret } from "./resolve";
import { executeTool, type RuntimeTool } from "./executor";
import type { AuthType } from "./credentials";

/**
 * Lista os PERFIS do cliente (para o admin popular a allowlist da ferramenta),
 * chamando a API configurada na base (`perfis_endpoint` + `perfis_campo`), com a
 * credencial da base. Sem endpoint configurado → lista vazia (o admin digita à
 * mão). Ver [[widget-and-api]] / gating.acessoFerramenta (#4).
 */

/** Coleta os valores do campo `campo` (ou os primitivos, se `campo` vazio). */
function extrairPerfis(data: unknown, campo: string): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (s) out.add(s.slice(0, 80));
  };
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      if (campo && campo in o) add(o[campo]);
      else Object.values(o).forEach(walk);
      return;
    }
    if (!campo) add(n); // resposta é uma lista simples de strings/números
  };
  walk(data);
  return [...out].slice(0, 300).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function listarPerfis(baseId: string): Promise<string[]> {
  const db = createAdminClient();
  const { data: base } = await db
    .from("ai_bases")
    .select("base_url, credential_id, perfis_endpoint, perfis_campo")
    .eq("id", baseId)
    .maybeSingle();
  if (!base?.base_url || !base.perfis_endpoint?.trim()) return [];
  const credential = base.credential_id ? await loadCredentialSecret(base.credential_id) : null;
  const tool: RuntimeTool = {
    key: "listar_perfis",
    name: "Perfis do cliente",
    method: "GET",
    path_template: base.perfis_endpoint.trim(),
    auth_type: (credential?.auth_type ?? "none") as AuthType,
    params: [],
  };
  const res = await executeTool({ tool, baseUrl: base.base_url, credential, modelArgs: {}, identity: {} });
  if (!res.ok) return [];
  return extrairPerfis(res.data, (base.perfis_campo || "").trim());
}
