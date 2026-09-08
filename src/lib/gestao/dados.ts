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
  chamadas: number;
  conversas: number;
  tokens_entrada: number;
  tokens_saida: number;
  tokens_brutos: number;
  creditos: number;
  atribuido: boolean;
};

export type Saldo = {
  base_code: string;
  mes_ref: string;
  creditos_contratados: number;
  creditos_extra: number;
  creditos_disponiveis: number;
  creditos_consumidos: number;
  creditos_saldo: number;
  tokens_brutos: number;
  tokens_nao_atribuidos: number;
  usd_por_credito: number;
  usd_total: number;
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

/** Primeiro dia do mês corrente no fuso de São Paulo, em ISO. */
export function mesCorrente(d = new Date()): string {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return `${iso.slice(0, 7)}-01`;
}

export async function lerSaldo(baseCode: string, mes = mesCorrente()): Promise<Saldo | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_saldo", { p_base: baseCode, p_mes: mes });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const linha = Array.isArray(data) ? data[0] : data;
  return linha as Saldo;
}

export async function lerConsumo(
  baseCode: string,
  de: Date,
  ate: Date,
): Promise<LinhaConsumo[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_consumo", {
    p_base: baseCode,
    p_from: de.toISOString(),
    p_to: ate.toISOString(),
  });
  if (error || !data) return [];
  return data as LinhaConsumo[];
}

export async function lerAlocacoes(baseCode: string, mes = mesCorrente()): Promise<Alocacao[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_alocacoes", { p_base: baseCode, p_mes: mes });
  if (error || !data) return [];
  return data as Alocacao[];
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
