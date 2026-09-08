"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { invalidarPortao } from "@/lib/gestao/portao";

/**
 * Plano contratado do cliente — SÓ no admin, nunca na página do iFrame.
 *
 * Quantos créditos, quanto custa cada um, quantos tokens lastreiam um crédito e
 * em que dia o ciclo vira são termos de contrato. O cliente lê o efeito deles
 * na área de gestão; alterá-los é da Natcorp.
 */

export type ResultadoPlano = { ok: true } | { ok: false; erro: string };

const planoSchema = z.object({
  base_code: z.string().min(1).max(80),
  creditos_por_ciclo: z.coerce.number().nonnegative().max(10_000_000),
  usd_por_credito: z.coerce.number().nonnegative().max(10_000),
  // Lastro em tokens. Teto alto de propósito: nada impede um contrato de 50
  // milhões por crédito, e um limite apertado viraria obstáculo comercial.
  tokens_por_credito: z.coerce.number().int().positive().max(1_000_000_000),
  dia_inicio_ciclo: z.coerce.number().int().min(1).max(31),
  vigente_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacao: z.string().max(300).optional(),
});

export async function salvarPlano(input: unknown): Promise<ResultadoPlano> {
  const parsed = planoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await requirePermission("gestao.suporte");
  } catch {
    return { ok: false, erro: "Sem permissão para alterar o plano de clientes." };
  }

  const v = parsed.data;
  const base = v.base_code.trim().toLowerCase();
  const db = createAdminClient();

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();

  // Uma linha por (base, vigência). Reeditar a MESMA data sobrescreve; uma data
  // nova cria versão e preserva a anterior — que é o que faz a fatura de um
  // ciclo passado continuar batendo depois de um reajuste.
  const { error } = await db.from("ai_cliente_plano").upsert(
    {
      base_code: base,
      creditos_por_ciclo: v.creditos_por_ciclo,
      usd_por_credito: v.usd_por_credito,
      tokens_por_credito: v.tokens_por_credito,
      dia_inicio_ciclo: v.dia_inicio_ciclo,
      vigente_desde: v.vigente_desde,
      observacao: v.observacao ?? null,
      criado_por: user?.id ?? null,
    },
    { onConflict: "base_code,vigente_desde" },
  );
  if (error) return { ok: false, erro: `Não foi possível salvar: ${error.message}` };

  // O portão cacheia o veredito por 30s, e mudar o plano muda quem pode falar.
  invalidarPortao(base);

  await db.from("audit_log").insert({
    actor_id: user?.id ?? null,
    action: "gestao.plano.salvar",
    entity_type: "ai_cliente_plano",
    entity_id: null,
    after: { ...v, base_code: base },
  });

  revalidatePath("/admin/gestao");
  return { ok: true };
}

const removerSchema = z.object({ id: z.string().uuid() });

export async function removerPlano(input: unknown): Promise<ResultadoPlano> {
  const parsed = removerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  try {
    await requirePermission("gestao.suporte");
  } catch {
    return { ok: false, erro: "Sem permissão." };
  }

  const db = createAdminClient();
  const { data: antes } = await db
    .from("ai_cliente_plano")
    .select("base_code")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const { error } = await db.from("ai_cliente_plano").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, erro: "Não foi possível remover." };

  if (antes?.base_code) invalidarPortao(antes.base_code);
  revalidatePath("/admin/gestao");
  return { ok: true };
}
