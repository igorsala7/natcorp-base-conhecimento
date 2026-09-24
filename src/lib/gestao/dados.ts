import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularSaldo, modoDoSaldo, precisaAvisar, type CicloFato, type ModoCredito } from "./creditos";

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
  /** Extra DISPONÍVEL: o acumulado de ciclos anteriores + o comprado neste. */
  creditos_extra: number;
  creditos_disponiveis: number;
  creditos_consumidos: number;
  creditos_saldo: number;
  /** Quanto do contratado deste ciclo ainda não foi usado. Morre na virada. */
  contratado_saldo: number;
  /** Quanto do adicional sobra. Atravessa a virada e nunca vence. */
  extra_saldo: number;
  /** 0 a 100. Abaixo de 10 a tela e o painel avisam. */
  pct_restante: number;
  /**
   * Mensalidade FUTURA já consumida, em créditos. Zerar não para o serviço:
   * o consumo passa a sair do mês seguinte, que abre reduzido, e encadeia
   * sem limite se uma mensalidade não bastar.
   */
  adiantado: number;
  /** Quanto da mensalidade DESTE mês já nasceu comprometido com o adiantamento. */
  contratado_abatido: number;
  /** O que o plano concede no ciclo, antes do abatimento. */
  contratado_plano: number;
  /**
   * Consumo sem dono: só acontece em base sem plano, onde não há mensalidade
   * futura de onde adiantar. Com contrato ativo é sempre zero.
   */
  consumo_sem_cobertura: number;
  /** `normal` ou `economico` (sem crédito: modelo mais barato, ferramentas mantidas). */
  modo: ModoCredito;
  /** Está na faixa de aviso (≤10% e ainda não zerou). */
  avisar: boolean;
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
 * Não recebe mês: o ciclo é o MÊS-CALENDÁRIO no fuso de São Paulo, do dia 1 ao
 * último, e vira sozinho na passagem do dia. Até 24/09 cada cliente podia ter
 * a própria virada (`dia_inicio_ciclo`); o dono unificou em mês fechado e a
 * coluna foi removida.
 */
export async function lerSaldo(baseCode: string, momento?: Date): Promise<Saldo | null> {
  const supabase = createAdminClient();
  /**
   * Duas leituras e a conta fora do banco.
   *
   * `gestao_saldo` fazia tudo numa função só e somava `contratado + extra −
   * consumo` num balde único — sem ordem de consumo, e filtrando o extra pelo
   * ciclo corrente, que era o que matava a compra na virada. A regra nova é um
   * fold com teto a cada passo; em SQL isso vira `with recursive` que ninguém
   * relê. Aqui o banco entrega FATO por ciclo e `calcularSaldo` aplica a regra,
   * que tem teste com o exemplo que o dono ditou.
   */
  const [ciclos, plano] = await Promise.all([
    supabase.rpc("gestao_ciclos", { p_base: baseCode, p_ate: momento?.toISOString() }),
    supabase.rpc("gestao_plano", { p_base: baseCode, p_momento: momento?.toISOString() }),
  ]);
  if (ciclos.error || !ciclos.data) return null;

  const linhas = (Array.isArray(ciclos.data) ? ciclos.data : [ciclos.data]) as unknown as CicloFato[];
  const s = calcularSaldo(linhas);
  if (!s) return null;

  const pl = (Array.isArray(plano.data) ? plano.data[0] : plano.data) as
    | { tokens_por_credito: number; usd_por_credito: number; tem_plano: boolean }
    | undefined;

  const tokensBrutos = linhas.reduce(
    (acc, c) => (c.ciclo_inicio === s.cicloInicio ? Number((c as unknown as { tokens?: number }).tokens ?? 0) : acc),
    0,
  );

  return {
    base_code: baseCode,
    ciclo_inicio: s.cicloInicio,
    ciclo_fim: s.cicloFim,
    creditos_contratados: s.contratadoTotal,
    creditos_extra: s.extraDisponivel,
    creditos_disponiveis: s.disponivel,
    creditos_consumidos: s.consumido,
    creditos_saldo: s.saldo,
    contratado_saldo: s.contratadoSaldo,
    extra_saldo: s.extraSaldo,
    pct_restante: s.pctRestante,
    adiantado: s.adiantado,
    contratado_abatido: s.contratadoAbatido,
    contratado_plano: s.contratadoPlano,
    consumo_sem_cobertura: s.consumoSemCobertura,
    modo: modoDoSaldo(s, pl?.tem_plano ?? false),
    avisar: precisaAvisar(s, pl?.tem_plano ?? false),
    tokens_brutos: tokensBrutos,
    // Sem atribuição por perfil/usuário: veio do trace sem `p_*` completo.
    tokens_nao_atribuidos: 0,
    tokens_por_credito: Number(pl?.tokens_por_credito ?? 10000),
    usd_por_credito: Number(pl?.usd_por_credito ?? 0.05),
    usd_total: Math.round(s.disponivel * Number(pl?.usd_por_credito ?? 0.05) * 100) / 100,
    tem_plano: pl?.tem_plano ?? false,
  };
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
export type FiltroConversas = {
  pagina?: number;
  porPagina?: number;
  /** Início do período, inclusivo. */
  de?: Date;
  /** Fim do período, EXCLUSIVO (passe o dia seguinte para incluir o dia todo). */
  ate?: Date;
  painel?: string;
  perfil?: string;
  usuario?: string;
  empresa?: string;
  matricula?: string;
};

export async function lerConversas(
  baseCode: string,
  opts: FiltroConversas = {},
): Promise<{ linhas: ConversaResumo[]; total: number }> {
  const supabase = createAdminClient();
  const porPagina = Math.min(opts.porPagina ?? 50, 200);
  const pagina = Math.max(opts.pagina ?? 0, 0);

  let q = supabase
    .from("conversations")
    .select("id, created_at, title, p_usuario, p_perfil, p_portal, p_empresa, p_matricula", {
      count: "exact",
    })
    .ilike("p_base", baseCode.replace(/([\\%_])/g, "\\$1"))
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  if (opts.de) q = q.gte("created_at", opts.de.toISOString());
  if (opts.ate) q = q.lt("created_at", opts.ate.toISOString());

  /*
    IGUALDADE, não `ilike`, nos eixos que vêm de uma LISTA.
    O valor sai do próprio relatório (ver `lerFacetasConversas`), então é
    exato por construção. `ilike` com o valor cru abriria curinga: uma
    matrícula "100%" filtraria tudo que começa com 100, e o número na tela
    não bateria com o filtro escolhido.
  */
  if (opts.painel) q = q.eq("p_portal", opts.painel);
  if (opts.perfil) q = q.eq("p_perfil", opts.perfil);
  if (opts.usuario) q = q.eq("p_usuario", opts.usuario);
  if (opts.empresa) q = q.eq("p_empresa", opts.empresa);
  if (opts.matricula) q = q.eq("p_matricula", opts.matricula);

  const { data, count, error } = await q;
  if (error || !data) return { linhas: [], total: 0 };
  return { linhas: data as ConversaResumo[], total: count ?? 0 };
}

/**
 * As opções dos filtros de Conversas, tiradas das CONVERSAS do período.
 *
 * Separada de `lerFacetas` (que lê `ai_usage`) porque os dois conjuntos não
 * coincidem: há conversa sem consumo de token registrado. Oferecer no filtro
 * um valor que não existe no relatório produz o pior tipo de filtro, o que
 * aparece na lista e devolve zero linha.
 */
export async function lerFacetasConversas(
  baseCode: string,
  de: Date,
  ate: Date,
): Promise<Record<string, { valor: string; chamadas: number }[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("gestao_conversas_facetas", {
    p_base: baseCode,
    p_from: de.toISOString(),
    p_to: ate.toISOString(),
  });
  if (error || !data) return {};

  const out: Record<string, { valor: string; chamadas: number }[]> = {};
  for (const f of data) {
    (out[f.eixo] ??= []).push({ valor: f.valor, chamadas: Number(f.conversas) });
  }
  return out;
}

export type ConversaResumo = {
  id: string;
  created_at: string;
  title: string | null;
  p_usuario: string | null;
  p_perfil: string | null;
  p_portal: string | null;
  p_empresa: string | null;
  p_matricula: string | null;
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
