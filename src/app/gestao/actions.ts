"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { abrirSessaoGestao } from "@/lib/gestao/sessao";
import { lerSaldo } from "@/lib/gestao/dados";
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

  // O ciclo e o PREÇO vêm do plano vigente, não de constantes: o cliente pode
  // ter ciclo em 14 e crédito a outro valor por negociação. Gravar o preço na
  // linha faz a compra continuar valendo o que valia se o plano mudar depois.
  const saldo = await lerSaldo(sessao.base);
  if (!saldo) return { ok: false, erro: "Não foi possível apurar o ciclo atual. Tente de novo." };
  const cicloInicio = saldo.ciclo_inicio.slice(0, 10);

  const { error } = await db.from("ai_creditos_extra").insert({
    base_code: sessao.base,
    ciclo_inicio: cicloInicio,
    creditos: parsed.data.creditos,
    usd_por_credito: saldo.usd_por_credito,
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
      ciclo_inicio: cicloInicio,
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

/**
 * Regra de acesso — aceita VÁRIOS perfis e VÁRIOS módulos de uma vez.
 *
 * O schema continua sendo uma regra por linha; a multiplicação acontece aqui,
 * gerando o produto (alvos × escopos). Guardar "vários perfis" numa linha só
 * exigiria array na tabela, e aí remover UM perfil viraria edição de array em
 * vez de exclusão de linha — mais código para o mesmo resultado, e um índice
 * único que não protege mais nada.
 */
const regraSchema = sessaoSchema
  .extend({
    painel: z.enum(["PO", "PG", "PC"]).nullable().optional(),
    alvo_tipo: z.enum(["base", "perfil", "usuario"]),
    /** Um ou vários perfis/usuários. Vazio quando alvo_tipo = 'base'. */
    alvos: z.array(z.string().max(120)).max(200).default([]),
    escopo_tipo: z.enum(["tool", "modulo", "submodulo"]),
    /** Chaves de ferramenta, quando escopo_tipo = 'tool'. */
    tool_keys: z.array(z.string().max(120)).max(200).default([]),
    /** Módulos, quando 'modulo'. Com 'submodulo', é sempre um só. */
    modulos: z.array(z.string().max(200)).max(200).default([]),
    submodulo: z.string().max(300).nullable().optional(),
    efeito: z.enum(["permitir", "negar"]),
    observacao: z.string().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    const limpos = (a: string[]) => a.map((x) => x.trim()).filter(Boolean);
    if (v.alvo_tipo !== "base" && limpos(v.alvos).length === 0) {
      ctx.addIssue({ code: "custom", message: "Escolha ao menos um perfil ou usuário.", path: ["alvos"] });
    }
    if (v.escopo_tipo === "tool" && limpos(v.tool_keys).length === 0) {
      ctx.addIssue({ code: "custom", message: "Escolha ao menos uma consulta.", path: ["tool_keys"] });
    }
    if (v.escopo_tipo !== "tool" && limpos(v.modulos).length === 0) {
      ctx.addIssue({ code: "custom", message: "Escolha ao menos um módulo.", path: ["modulos"] });
    }
    if (v.escopo_tipo === "submodulo") {
      if (!(v.submodulo ?? "").trim()) {
        ctx.addIssue({ code: "custom", message: "Escolha o submódulo.", path: ["submodulo"] });
      }
      if (limpos(v.modulos).length !== 1) {
        ctx.addIssue({
          code: "custom",
          message: "Ao escolher um submódulo, selecione exatamente um módulo.",
          path: ["modulos"],
        });
      }
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
  const limpos = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))];

  const alvos = v.alvo_tipo === "base" ? [null] : limpos(v.alvos);
  const escopos =
    v.escopo_tipo === "tool"
      ? limpos(v.tool_keys).map((k) => ({ tool_key: k, modulo: null as string | null }))
      : limpos(v.modulos).map((m) => ({ tool_key: null as string | null, modulo: m }));

  /**
   * BLOQUEIO em ferramenta protegida é recusado no SERVIDOR, não só escondido
   * na tela. A UI desabilita o que não dá para bloquear, mas a ação é um
   * endpoint — e a regra que protege as consultas de estrutura não pode
   * depender de o botão estar cinza.
   */
  if (v.efeito === "negar" && v.escopo_tipo === "tool") {
    const { data: protegidas } = await db
      .from("ai_tools")
      .select("key, name")
      .in("key", escopos.map((e) => e.tool_key!).filter(Boolean))
      .eq("protegida_de_bloqueio", true);
    if (protegidas && protegidas.length > 0) {
      const nomes = protegidas.map((p) => p.name).join(", ");
      return {
        ok: false,
        erro: `Estas consultas não podem ser bloqueadas porque outras dependem delas: ${nomes}.`,
      };
    }
  }

  const linhas = alvos.flatMap((alvo) =>
    escopos.map((e) => ({
      base_code: sessao.base,
      painel: v.painel ?? null,
      alvo_tipo: v.alvo_tipo,
      alvo,
      escopo_tipo: v.escopo_tipo,
      tool_key: e.tool_key,
      modulo: e.modulo,
      submodulo: v.escopo_tipo === "submodulo" ? (v.submodulo ?? "").trim() : null,
      efeito: v.efeito,
      ativo: true,
      observacao: v.observacao ?? null,
      criado_por: autorDa(sessao),
      atualizado_em: new Date().toISOString(),
    })),
  );

  if (linhas.length === 0) return { ok: false, erro: "Nada a salvar." };

  const { error } = await db.from("ai_acesso_regras").upsert(linhas, {
    onConflict: "base_code,painel,alvo_tipo,alvo,escopo_tipo,tool_key,modulo,submodulo",
  });
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
      painel: v.painel ?? null,
      alvo_tipo: v.alvo_tipo,
      alvos,
      escopo_tipo: v.escopo_tipo,
      escopos: escopos.map((e) => e.tool_key ?? e.modulo),
      submodulo: v.submodulo ?? null,
      efeito: v.efeito,
      regras_criadas: linhas.length,
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
