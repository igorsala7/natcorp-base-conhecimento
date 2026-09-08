"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { abrirSessaoGestao } from "@/lib/gestao/sessao";
import { mesCorrente } from "@/lib/gestao/dados";
import { invalidarRegrasAcesso } from "@/lib/integrations/acesso-contexto";
import { invalidarPortao } from "@/lib/gestao/portao";

/**
 * Ações da área de gestão.
 *
 * ── Toda ação REVALIDA o token ─────────────────────────────────────────
 *
 * Server Action é um endpoint. Quem chama pode não ser a nossa página: basta
 * um POST com o id certo. Como aqui não existe sessão do Supabase para o
 * `requirePermission` conferir, a identidade tem de ser reconstruída do token a
 * cada chamada — e a base sai DELE, nunca do payload.
 *
 * Se a base viesse do formulário, um cliente compraria crédito no nome de
 * outro, ou bloquearia ferramenta na base do vizinho. É o mesmo cuidado que a
 * página tem na entrada, aplicado onde o dado é ESCRITO.
 */

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

/**
 * Campos de sessão que acompanham todo formulário da área.
 *
 * Os quatro são opcionais porque existem DOIS modos: o cliente manda
 * `key` + `kbt` (token do APEX), o suporte manda `suporte` + `base` (e a
 * autorização vem do cookie de sessão do admin). `abrirSessaoGestao` recusa
 * qualquer combinação que não feche.
 */
const sessaoSchema = z.object({
  key: z.string().optional(),
  kbt: z.string().optional(),
  suporte: z.string().optional(),
  base: z.string().optional(),
});

type CamposSessao = z.infer<typeof sessaoSchema>;

type SessaoResolvida = {
  ok: true;
  base: string;
  /** Login do cliente, ou null no suporte — que não se passa por ninguém. */
  usuario: string | null;
  modo: "cliente" | "suporte";
  /** Usuário interno, só no suporte. Vai para `audit_log.actor_id`. */
  operadorId: string | null;
  operadorEmail: string | null;
};

/**
 * Revalida a sessão e devolve a base — ou o erro que a tela mostra.
 *
 * A base NUNCA vem do formulário: no modo cliente sai do token verificado, no
 * modo suporte é conferida contra a permissão `gestao.suporte` do usuário
 * logado. Um POST forjado com outra base não passa por aqui.
 */
async function baseDaSessao(
  input: CamposSessao,
): Promise<SessaoResolvida | { ok: false; erro: string }> {
  const s = await abrirSessaoGestao({
    key: input.key,
    kbt: input.kbt,
    suporte: input.suporte,
    base: input.base,
  });
  if (!s.ok) return { ok: false, erro: s.mensagem };
  return {
    ok: true,
    base: s.identidade.baseCode,
    usuario: s.identidade.usuario,
    modo: s.modo,
    operadorId: s.operador?.id ?? null,
    operadorEmail: s.operador?.email ?? null,
  };
}

/**
 * Quem assina a ação, para o registro.
 *
 * No suporte, `criado_por` recebe o e-mail interno com um prefixo — quem ler a
 * linha meses depois precisa saber que aquilo não foi o cliente que fez.
 */
function autorDa(s: SessaoResolvida): string | null {
  return s.modo === "suporte"
    ? `suporte:${s.operadorEmail ?? s.operadorId ?? "natcorp"}`
    : s.usuario;
}

// ── Créditos adicionais ─────────────────────────────────────────────────

const comprarSchema = sessaoSchema.extend({
  creditos: z.coerce.number().int().positive().max(100_000),
  motivo: z.string().max(300).optional(),
});

/**
 * Compra de créditos adicionais.
 *
 * Grava e pronto — não há aprovação nossa no meio, por decisão de produto: o
 * cliente que esgotou está com o assistente bloqueado, e esperar aprovação
 * manual deixaria o atendimento parado. O disclaimer da tela é o que informa
 * que a cobrança vem na próxima fatura, e `solicitado_por` guarda quem pediu.
 */
export async function comprarCreditos(input: unknown): Promise<ResultadoAcao> {
  const parsed = comprarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const db = createAdminClient();
  const mes = mesCorrente();

  const { error } = await db.from("ai_creditos_extra").insert({
    base_code: sessao.base,
    mes_ref: mes,
    creditos: parsed.data.creditos,
    solicitado_por: autorDa(sessao),
    motivo: parsed.data.motivo ?? null,
  });
  if (error) return { ok: false, erro: "Não foi possível registrar a compra. Tente de novo." };

  // O portão cacheia o veredito por 30s. Sem isto, quem acabou de comprar
  // continuaria bloqueado por meio minuto — e a compra pareceria não ter valido.
  invalidarPortao(sessao.base);

  // Auditoria: quem comprou, quanto e em nome de qual base. `audit_log` não tem
  // actor_id aqui porque o autor é um usuário do ERP, não do nosso Supabase —
  // o login vai no `after`, que é o que permite conferir depois.
  await db.from("audit_log").insert({
    // No suporte o autor é um usuário REAL do nosso Supabase, e é ele que fica
    // registrado. No modo cliente não há actor_id — quem agiu é um usuário do
    // ERP, e o login dele vai no `after`.
    actor_id: sessao.operadorId,
    action: "gestao.creditos.comprar",
    entity_type: "ai_creditos_extra",
    entity_id: null,
    after: {
      base_code: sessao.base,
      mes_ref: mes,
      creditos: parsed.data.creditos,
      solicitado_por: autorDa(sessao),
      via_suporte: sessao.modo === "suporte",
    },
  });

  revalidatePath("/gestao/creditos");
  revalidatePath("/gestao");
  return { ok: true };
}

// ── Alocação ────────────────────────────────────────────────────────────

const alocarSchema = sessaoSchema.extend({
  painel: z.enum(["PO", "PG", "PC"]).nullable().optional(),
  alvo_tipo: z.enum(["perfil", "usuario", "painel"]),
  alvo: z.string().max(120).nullable().optional(),
  creditos: z.coerce.number().nonnegative().max(1_000_000),
});

export async function salvarAlocacao(input: unknown): Promise<ResultadoAcao> {
  const parsed = alocarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const { painel, alvo_tipo, creditos } = parsed.data;
  const alvo = alvo_tipo === "painel" ? null : (parsed.data.alvo ?? "").trim();

  // As mesmas regras do CHECK da tabela, verificadas antes para devolver texto
  // em vez de um erro de constraint.
  if (alvo_tipo === "painel" && !painel) {
    return { ok: false, erro: "Alocação por painel precisa de um painel." };
  }
  if (alvo_tipo !== "painel" && !alvo) {
    return { ok: false, erro: "Informe o perfil ou o usuário." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const db = createAdminClient();
  const { error } = await db.from("ai_creditos_alocacao").upsert(
    {
      base_code: sessao.base,
      painel: painel ?? null,
      alvo_tipo,
      alvo,
      creditos,
      ativo: true,
      criado_por: autorDa(sessao),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "base_code,painel,alvo_tipo,alvo" },
  );
  if (error) return { ok: false, erro: "Não foi possível salvar a distribuição." };

  // Mudar o orçamento muda quem pode falar agora: invalida o veredito em cache.
  invalidarPortao(sessao.base);

  revalidatePath("/gestao/creditos");
  return { ok: true };
}

const removerAlocacaoSchema = sessaoSchema.extend({ id: z.string().uuid() });

export async function removerAlocacao(input: unknown): Promise<ResultadoAcao> {
  const parsed = removerAlocacaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const db = createAdminClient();
  // `eq(base_code)` junto do id: sem isso, o id de outra base seria apagado por
  // quem tem token válido do seu.
  const { error } = await db
    .from("ai_creditos_alocacao")
    .delete()
    .eq("id", parsed.data.id)
    .eq("base_code", sessao.base);
  if (error) return { ok: false, erro: "Não foi possível remover." };

  invalidarPortao(sessao.base);

  revalidatePath("/gestao/creditos");
  return { ok: true };
}

// ── Regras de acesso ────────────────────────────────────────────────────

const regraSchema = sessaoSchema
  .extend({
    painel: z.enum(["PO", "PG", "PC"]).nullable().optional(),
    alvo_tipo: z.enum(["base", "perfil", "usuario"]),
    alvo: z.string().max(120).nullable().optional(),
    escopo_tipo: z.enum(["tool", "modulo", "submodulo"]),
    tool_key: z.string().max(120).nullable().optional(),
    modulo: z.string().max(200).nullable().optional(),
    submodulo: z.string().max(300).nullable().optional(),
    efeito: z.enum(["permitir", "negar"]),
    observacao: z.string().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.alvo_tipo !== "base" && !(v.alvo ?? "").trim()) {
      ctx.addIssue({ code: "custom", message: "Informe o perfil ou o usuário.", path: ["alvo"] });
    }
    if (v.escopo_tipo === "tool" && !(v.tool_key ?? "").trim()) {
      ctx.addIssue({ code: "custom", message: "Escolha a ferramenta.", path: ["tool_key"] });
    }
    if (v.escopo_tipo !== "tool" && !(v.modulo ?? "").trim()) {
      ctx.addIssue({ code: "custom", message: "Escolha o módulo.", path: ["modulo"] });
    }
    if (v.escopo_tipo === "submodulo" && !(v.submodulo ?? "").trim()) {
      ctx.addIssue({ code: "custom", message: "Escolha o submódulo.", path: ["submodulo"] });
    }
  });

export async function salvarRegraAcesso(input: unknown): Promise<ResultadoAcao> {
  const parsed = regraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const v = parsed.data;
  const db = createAdminClient();

  const { error } = await db.from("ai_acesso_regras").upsert(
    {
      base_code: sessao.base,
      painel: v.painel ?? null,
      alvo_tipo: v.alvo_tipo,
      alvo: v.alvo_tipo === "base" ? null : (v.alvo ?? "").trim(),
      escopo_tipo: v.escopo_tipo,
      tool_key: v.escopo_tipo === "tool" ? (v.tool_key ?? "").trim() : null,
      modulo: v.escopo_tipo === "tool" ? null : (v.modulo ?? "").trim(),
      submodulo: v.escopo_tipo === "submodulo" ? (v.submodulo ?? "").trim() : null,
      efeito: v.efeito,
      ativo: true,
      observacao: v.observacao ?? null,
      criado_por: autorDa(sessao),
      atualizado_em: new Date().toISOString(),
    },
    {
      onConflict:
        "base_code,painel,alvo_tipo,alvo,escopo_tipo,tool_key,modulo,submodulo",
    },
  );
  if (error) return { ok: false, erro: "Não foi possível salvar a regra." };

  // O funil de ferramentas cacheia as regras por 60s; sem isto, a mudança só
  // valeria no próximo minuto e pareceria não ter sido salva.
  invalidarRegrasAcesso(sessao.base);

  await db.from("audit_log").insert({
    actor_id: sessao.operadorId,
    action: "gestao.acesso.regra",
    entity_type: "ai_acesso_regras",
    entity_id: null,
    after: {
      base_code: sessao.base,
      ...v,
      // Os campos de sessão não entram no registro: `kbt` é um token válido, e
      // guardá-lo em texto no audit_log seria deixar a chave debaixo do tapete.
      key: undefined,
      kbt: undefined,
      suporte: undefined,
      base: undefined,
      via_suporte: sessao.modo === "suporte",
    },
  });

  revalidatePath("/gestao/acessos");
  return { ok: true };
}

const removerRegraSchema = sessaoSchema.extend({ id: z.string().uuid() });

export async function removerRegraAcesso(input: unknown): Promise<ResultadoAcao> {
  const parsed = removerRegraSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const db = createAdminClient();
  const { error } = await db
    .from("ai_acesso_regras")
    .delete()
    .eq("id", parsed.data.id)
    .eq("base_code", sessao.base);
  if (error) return { ok: false, erro: "Não foi possível remover a regra." };

  invalidarRegrasAcesso(sessao.base);
  revalidatePath("/gestao/acessos");
  return { ok: true };
}
