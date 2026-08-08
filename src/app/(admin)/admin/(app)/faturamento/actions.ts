"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/permissions";
import type { BaseCobranca, LinhaFaturamento } from "@/lib/billing/pricing";

/**
 * Leitura e configuração do faturamento.
 *
 * Tudo aqui passa por `ai.configure` — o mesmo portão da tela de IA. Consumo e
 * preço de cliente não são dado de editor.
 *
 * A leitura usa service-role de propósito: `ai_usage` tem policy só de leitura
 * para quem administra IA, e a RPC precisa cruzar com `ai_model_prices`. O
 * portão está aqui, antes da consulta, não na policy.
 */

export type Config = {
  usdPorMtok: number;
  base: BaseCobranca;
  cobrarOverhead: boolean;
};

const CONFIG_PADRAO: Config = { usdPorMtok: 5, base: "bruto", cobrarOverhead: true };

export async function getConfig(): Promise<Config> {
  if (!(await hasPermission("ai.configure", null))) return CONFIG_PADRAO;
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_settings")
    .select("usd_por_mtok, base_cobranca, cobrar_overhead_interno")
    .eq("id", true)
    .maybeSingle();
  if (!data) return CONFIG_PADRAO;
  return {
    usdPorMtok: Number(data.usd_por_mtok),
    base: data.base_cobranca === "ponderado" ? "ponderado" : "bruto",
    cobrarOverhead: data.cobrar_overhead_interno,
  };
}

export async function salvarConfig(
  form: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await hasPermission("ai.configure", null))) {
    return { ok: false, error: "Sem permissão." };
  }
  const usd = Number(String(form.get("usd_por_mtok") ?? "").replace(",", "."));
  const base = String(form.get("base_cobranca") ?? "bruto");
  if (!Number.isFinite(usd) || usd < 0) return { ok: false, error: "Tarifa inválida." };
  if (base !== "bruto" && base !== "ponderado") return { ok: false, error: "Base inválida." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_settings")
    .update({
      usd_por_mtok: usd,
      base_cobranca: base,
      cobrar_overhead_interno: form.get("cobrar_overhead") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/faturamento");
  return { ok: true };
}

/** Dia seguinte, em UTC — o limite superior da RPC é EXCLUSIVO. */
function proximoDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type Consumo = {
  /** Linhas COBRÁVEIS (origem widget). */
  cobravel: LinhaFaturamento[];
  /** O resto, para a tela mostrar sem somar: portal, admin e jobs de sistema. */
  naoCobravel: LinhaFaturamento[];
};

/**
 * Consumo do período. Traz cobrável e não-cobrável na mesma consulta e separa
 * aqui, para a tela poder mostrar "o portal consumiu X" sem risco de esse X
 * escorregar para dentro de um total.
 */
export async function getConsumo(input: {
  de: string;
  ate: string;
  cliente?: string;
}): Promise<{ ok: true; dados: Consumo } | { ok: false; error: string }> {
  if (!(await hasPermission("ai.configure", null))) {
    return { ok: false, error: "Sem permissão." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("faturamento_detalhe", {
    p_from: `${input.de}T00:00:00Z`,
    p_to: `${proximoDia(input.ate)}T00:00:00Z`,
    p_origens: ["widget", "portal", "admin", "sistema"],
    pf_cliente: input.cliente?.trim() ? input.cliente.trim() : null,
  });
  if (error) return { ok: false, error: error.message };
  // O Postgres devolve `numeric` como string no driver — normalizar aqui, uma
  // vez, evita `"764934" + 1 = "7649341"` espalhado pela tela.
  const linhas: LinhaFaturamento[] = (data ?? []).map((r) => ({
    cliente: r.cliente,
    origem: r.origem,
    kind: r.kind,
    provider: r.provider,
    model: r.model,
    purpose: r.purpose,
    chamadas: Number(r.chamadas),
    entrada_total: Number(r.entrada_total),
    entrada_nova: Number(r.entrada_nova),
    cache_read: Number(r.cache_read),
    cache_write: Number(r.cache_write),
    saida: Number(r.saida),
    tokens_brutos: Number(r.tokens_brutos),
    tokens_ponderados: Number(r.tokens_ponderados),
    cache_read_mult: r.cache_read_mult == null ? null : Number(r.cache_read_mult),
    cache_write_mult: r.cache_write_mult == null ? null : Number(r.cache_write_mult),
    preco_confirmado: !!r.preco_confirmado,
    custo_usd: r.custo_usd == null ? null : Number(r.custo_usd),
  }));
  return {
    ok: true,
    dados: {
      cobravel: linhas.filter((l) => l.origem === "widget"),
      naoCobravel: linhas.filter((l) => l.origem !== "widget"),
    },
  };
}

