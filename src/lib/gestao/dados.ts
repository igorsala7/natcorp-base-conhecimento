import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Leitura dos dados da área de gestão.
 *
 * TUDO aqui recebe `baseCode` já resolvido pelo token verificado
 * (`resolverIdentidadeGestao`). Nenhuma função aceita base vinda do cliente —
 * é a garantia de que uma base não vê o dado da outra, e ela precisa valer em
 * cada consulta, não só na entrada da página.
 *
 * Usa service-role porque a identidade não é um usuário do Supabase: quem está
 * do outro lado é um usuário do ERP, autenticado pelo token do APEX. O
 * isolamento é o `baseCode`, não a RLS.
 */

export type LinhaConsumo = {
  painel: string;
  perfil: string;
  usuario: string;
  empresa: string;
  matricula: string;
  chamadas: number;
  conversas: number;
  tokens_entrada: number;
  tokens_saida: number;
  tokens_brutos: number;
  creditos: number;
  atribuido: boolean;
};

/** Os cinco eixos de filtro do consumo. Nulo = sem filtro naquele eixo. */
export type FiltroConsumo = {
  painel?: string | null;
  perfil?: string | null;
  usuario?: string | null;
  empresa?: string | null;
  matricula?: string | null;
};

export type Faceta = { eixo: string; valor: string; chamadas: number };

export type Saldo = {
  base_code: string;
  ciclo_inicio: string;
  ciclo_fim: string;
  creditos_contratados: number;
  creditos_extra: number;
  creditos_disponiveis: number;
  creditos_consumidos: number;
  creditos_saldo: number;
  tokens_brutos: number;
  tokens_nao_atribuidos: number;
  /** Lastro do crédito. INTERNO — nunca renderizar na área do cliente. */
  tokens_por_credito: number;
  usd_por_credito: number;
  usd_total: number;
  /** Falso quando não há plano cadastrado: nada bloqueia e a tela avisa. */
  tem_plano: boolean;
};

export type Compra = {
  id: string;
  criado_em: string;
  ciclo_inicio: string;
  creditos: number;
  usd_por_credito: number;
  usd_total: number;
  solicitado_por: string | null;
  motivo: string | null;
};

export type Alocacao = {
  id: string;
  painel: string | null;
  alvo_tipo: "perfil" | "usuario" | "painel";
  alvo: string | null;
  creditos_alocados: number;
  creditos_consumidos: number;
  creditos_saldo: number;
  ativo: boolean;
};

/**
 * Saldo do CICLO vigente do cliente.
 *
 * Não recebe mês: o ciclo sai de `ai_cliente_plano.dia_inicio_ciclo` e vira
 * sozinho na passagem do dia. Um cliente com ciclo em 14 tem "o mês" indo de
 * 14/09 a 13/10, e forçar isso num mês-calendário partiria o consumo em dois.
 */
export async function lerSaldo(baseCode: string, momento?: Date): Promise<Saldo | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_saldo", {
    p_base: baseCode,
    p_momento: momento?.toISOString(),
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const linha = Array.isArray(data) ? data[0] : data;
  return linha as unknown as Saldo;
}

/** Compras avulsas, do ciclo corrente ou do período informado. */
export async function lerCompras(
  baseCode: string,
  de?: Date,
  ate?: Date,
): Promise<Compra[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_compras", {
    p_base: baseCode,
    p_de: de?.toISOString(),
    p_ate: ate?.toISOString(),
  });
  if (error || !data) return [];
  return data as unknown as Compra[];
}

export async function lerConsumo(
  baseCode: string,
  de: Date,
  ate: Date,
  filtro: FiltroConsumo = {},
): Promise<LinhaConsumo[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_consumo", {
    p_base: baseCode,
    p_from: de.toISOString(),
    p_to: ate.toISOString(),
    // `undefined` e não `null`: o parâmetro é omitido e a função usa o DEFAULT,
    // que é "sem filtro". Mandar string vazia filtraria por vazio e devolveria
    // só as linhas SEM aquele campo — o oposto do pretendido.
    p_painel: filtro.painel || undefined,
    p_perfil: filtro.perfil || undefined,
    p_usuario: filtro.usuario || undefined,
    p_empresa: filtro.empresa || undefined,
    p_matricula: filtro.matricula || undefined,
  });
  if (error || !data) return [];
  return data as LinhaConsumo[];
}

/**
 * Valores que EXISTEM em cada eixo no período, para alimentar os seletores.
 *
 * Sai do que foi realmente usado, e não de uma lista de cadastro: oferecer um
 * perfil que nunca conversou produz um filtro que devolve tela vazia e parece
 * defeito do sistema.
 */
export async function lerFacetas(
  baseCode: string,
  de: Date,
  ate: Date,
): Promise<Record<string, { valor: string; chamadas: number }[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_consumo_facetas", {
    p_base: baseCode,
    p_from: de.toISOString(),
    p_to: ate.toISOString(),
  });
  if (error || !data) return {};

  const out: Record<string, { valor: string; chamadas: number }[]> = {};
  for (const f of data as Faceta[]) {
    (out[f.eixo] ??= []).push({ valor: f.valor, chamadas: Number(f.chamadas) });
  }
  return out;
}

export async function lerAlocacoes(baseCode: string, momento?: Date): Promise<Alocacao[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_alocacoes", {
    p_base: baseCode,
    p_momento: momento?.toISOString(),
  });
  if (error || !data) return [];
  return data as unknown as Alocacao[];
}

/**
 * Conversas da base, paginadas.
 *
 * `range()` obrigatório: o PostgREST corta em 1.000 linhas em silêncio, e uma
 * varredura ingênua leria 1.014 de 5.569 achando que leu tudo. Aqui o teto é
 * explícito e a paginação é do chamador.
 */
export async function lerConversas(
  baseCode: string,
  opts: { pagina?: number; porPagina?: number; painel?: string; usuario?: string } = {},
): Promise<{ linhas: ConversaResumo[]; total: number }> {
  const supabase = createAdminClient();
  const porPagina = Math.min(opts.porPagina ?? 50, 200);
  const pagina = Math.max(opts.pagina ?? 0, 0);

  let q = supabase
    .from("conversations")
    .select("id, created_at, title, p_usuario, p_perfil, p_portal, p_empresa", { count: "exact" })
    .ilike("p_base", baseCode.replace(/([\\%_])/g, "\\$1"))
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  if (opts.painel) q = q.eq("p_portal", opts.painel);
  if (opts.usuario) q = q.ilike("p_usuario", opts.usuario.replace(/([\\%_])/g, "\\$1"));

  const { data, count, error } = await q;
  if (error || !data) return { linhas: [], total: 0 };
  return { linhas: data as ConversaResumo[], total: count ?? 0 };
}

export type ConversaResumo = {
  id: string;
  created_at: string;
  title: string | null;
  p_usuario: string | null;
  p_perfil: string | null;
  p_portal: string | null;
  p_empresa: string | null;
};

export type MensagemGestao = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  input_tokens: number | null;
  output_tokens: number | null;
  feedback: number | null;
  latency_ms: number | null;
};

/**
 * Mensagens de UMA conversa, com a base conferida antes de devolver qualquer
 * conteúdo.
 *
 * A conferência não é redundante: o `conversationId` chega da URL, e sem ela
 * bastaria trocar o id para ler a conversa de outro cliente com um token
 * perfeitamente válido do seu.
 */
export async function lerMensagens(
  baseCode: string,
  conversationId: string,
): Promise<MensagemGestao[] | null> {
  const supabase = createAdminClient();

  const { data: conversa } = await supabase
    .from("conversations")
    .select("id, p_base")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversa) return null;
  if ((conversa.p_base ?? "").trim().toLowerCase() !== baseCode.trim().toLowerCase()) {
    return null;
  }

  const { data } = await supabase
    .from("messages")
    .select("id, role, content, created_at, input_tokens, output_tokens, feedback, latency_ms")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .range(0, 499);

  return (data ?? []) as MensagemGestao[];
}
