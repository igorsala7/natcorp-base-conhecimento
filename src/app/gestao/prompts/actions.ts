"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sessaoSchema,
  baseDaSessao,
  autorDa,
  type SessaoResolvida,
  type ResultadoAcao,
} from "@/lib/gestao/acao";
import {
  salvarPrompt,
  excluirPrompt,
  salvarCategoria,
  excluirCategoria,
  type Escopo,
} from "@/lib/prompts/sugeridos";

/**
 * Ações da tela de prompts sugeridos.
 *
 * ── Quem pode escrever em qual gaveta ─────────────────────────────────
 * `escopo: "base"`   → o catálogo do cliente. Cliente e suporte escrevem.
 * `escopo: "global"` → o catálogo da Natcorp, que vale para TODOS. Só o modo
 *                      suporte, que exige sessão do Supabase com a permissão
 *                      `gestao.suporte` (nível técnico).
 *
 * O escopo chega do formulário, mas quem AUTORIZA é a sessão revalidada aqui:
 * um POST forjado com `escopo=global` a partir do iFrame de um cliente para no
 * `escopoPermitido` abaixo. O mesmo cuidado que a base já tinha — ela nunca
 * vem do payload — aplicado à segunda dimensão que esta tela introduz.
 */

const escopoSchema = z.enum(["base", "global"]);

function escopoPermitido(
  sessao: SessaoResolvida,
  escopo: z.infer<typeof escopoSchema>,
): { ok: true; escopo: Escopo } | { ok: false; erro: string } {
  if (escopo === "global") {
    if (sessao.modo !== "suporte") {
      return { ok: false, erro: "Só a equipe Natcorp edita o catálogo global." };
    }
    return { ok: true, escopo: null };
  }
  return { ok: true, escopo: sessao.base };
}

/** Registro da ação. O autor é o do ERP ou o interno, como no resto da área. */
async function registrar(
  sessao: SessaoResolvida,
  acao: string,
  entidade: string,
  id: string | null,
  depois: Record<string, unknown>,
) {
  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: sessao.operadorId,
      action: acao,
      entity_type: entidade,
      entity_id: id,
      after: { ...depois, por: autorDa(sessao), via_suporte: sessao.modo === "suporte" },
    });
}

function revalidar() {
  revalidatePath("/gestao/prompts");
}

// ── Prompts ─────────────────────────────────────────────────────────────

const promptSchema = sessaoSchema.extend({
  escopo: escopoSchema,
  id: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(80),
  texto: z.string().min(1).max(8000),
  bases: z.array(z.string().max(200)).max(100).optional(),
  portais: z.array(z.string().max(200)).max(100).optional(),
  perfis: z.array(z.string().max(200)).max(100).optional(),
  empresas: z.array(z.string().max(200)).max(100).optional(),
  usuarios: z.array(z.string().max(200)).max(100).optional(),
  matriculas: z.array(z.string().max(200)).max(100).optional(),
  categoriaIds: z.array(z.string().uuid()).max(50).optional(),
  ativo: z.boolean().optional(),
  ordem: z.coerce.number().min(-9999).max(9999).optional(),
});

export async function salvarPromptSugerido(input: unknown): Promise<ResultadoAcao> {
  const parsed = promptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };
  const esc = escopoPermitido(sessao, parsed.data.escopo);
  if (!esc.ok) return { ok: false, erro: esc.erro };

  const r = await salvarPrompt(esc.escopo, {
    id: parsed.data.id ?? null,
    label: parsed.data.label,
    texto: parsed.data.texto,
    bases: parsed.data.bases,
    portais: parsed.data.portais,
    perfis: parsed.data.perfis,
    empresas: parsed.data.empresas,
    usuarios: parsed.data.usuarios,
    matriculas: parsed.data.matriculas,
    categoriaIds: parsed.data.categoriaIds,
    ativo: parsed.data.ativo,
    ordem: parsed.data.ordem,
    // Duas origens de autoria e nenhuma serve para as duas: o admin da Natcorp
    // é usuário do Supabase, o do cliente é login do ERP.
    autor: { id: sessao.operadorId, ref: sessao.modo === "cliente" ? sessao.usuario : null },
  });
  if (!r.ok) return { ok: false, erro: r.error };

  await registrar(sessao, "gestao.prompt.salvar", "prompt_sugerido", r.id ?? null, {
    escopo: parsed.data.escopo,
    base_code: esc.escopo,
    label: parsed.data.label,
    bases: parsed.data.bases ?? [],
    portais: parsed.data.portais ?? [],
    perfis: parsed.data.perfis ?? [],
    empresas: parsed.data.empresas ?? [],
    usuarios: parsed.data.usuarios ?? [],
    matriculas: parsed.data.matriculas ?? [],
    novo: !parsed.data.id,
  });
  revalidar();
  return { ok: true };
}

const idSchema = sessaoSchema.extend({ escopo: escopoSchema, id: z.string().uuid() });

export async function excluirPromptSugerido(input: unknown): Promise<ResultadoAcao> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };
  const esc = escopoPermitido(sessao, parsed.data.escopo);
  if (!esc.ok) return { ok: false, erro: esc.erro };

  const r = await excluirPrompt(esc.escopo, parsed.data.id);
  if (!r.ok) return { ok: false, erro: r.error };

  await registrar(sessao, "gestao.prompt.excluir", "prompt_sugerido", parsed.data.id, {
    escopo: parsed.data.escopo,
    base_code: esc.escopo,
  });
  revalidar();
  return { ok: true };
}

// ── Categorias ──────────────────────────────────────────────────────────

const categoriaSchema = sessaoSchema.extend({
  escopo: escopoSchema,
  id: z.string().uuid().nullable().optional(),
  nome: z.string().min(1).max(60),
  ordem: z.coerce.number().min(-9999).max(9999).optional(),
  ativo: z.boolean().optional(),
});

export async function salvarCategoriaPrompt(input: unknown): Promise<ResultadoAcao> {
  const parsed = categoriaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };
  const esc = escopoPermitido(sessao, parsed.data.escopo);
  if (!esc.ok) return { ok: false, erro: esc.erro };

  const r = await salvarCategoria(esc.escopo, {
    id: parsed.data.id ?? null,
    nome: parsed.data.nome,
    ordem: parsed.data.ordem,
    ativo: parsed.data.ativo,
  });
  if (!r.ok) return { ok: false, erro: r.error };

  await registrar(sessao, "gestao.prompt.categoria.salvar", "prompt_categoria", r.id ?? null, {
    escopo: parsed.data.escopo,
    base_code: esc.escopo,
    nome: parsed.data.nome,
  });
  revalidar();
  return { ok: true };
}

export async function excluirCategoriaPrompt(input: unknown): Promise<ResultadoAcao> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };
  const esc = escopoPermitido(sessao, parsed.data.escopo);
  if (!esc.ok) return { ok: false, erro: esc.erro };

  const r = await excluirCategoria(esc.escopo, parsed.data.id);
  if (!r.ok) return { ok: false, erro: r.error };

  await registrar(sessao, "gestao.prompt.categoria.excluir", "prompt_categoria", parsed.data.id, {
    escopo: parsed.data.escopo,
    base_code: esc.escopo,
  });
  revalidar();
  return { ok: true };
}
