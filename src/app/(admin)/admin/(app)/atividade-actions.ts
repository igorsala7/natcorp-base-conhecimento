"use server";

import { createClient } from "@/lib/supabase/server";

export type ItemAtividade = {
  tipo: string;
  id: string;
  space_id: string | null;
  status: string;
  progresso: number;
  rotulo: string | null;
  error: string | null;
  created_at: string;
  updated_at: string | null;
};

/** Estados que ainda estão acontecendo — em qualquer uma das dez filas. */
const EM_CURSO = ["queued", "running", "extracting", "inferring", "importing", "improving", "processing", "preview"];

/**
 * O que está rodando e o que falhou, das dez filas.
 *
 * Ordem deliberada: primeiro o que está EM CURSO (é o que a pessoa quer
 * acompanhar), depois o que FALHOU (é o que ela precisa saber), e o concluído
 * fica de fora — job que terminou bem não é notícia, e enchê-la de sucessos
 * antigos faria a gaveta virar histórico, que ninguém abre.
 *
 * A RLS de cada tabela continua valendo: a view usa `security_invoker`, então
 * quem consulta só enxerga os jobs dos espaços a que tem acesso.
 */
export async function atividadeRecente(): Promise<ItemAtividade[]> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("atividade_recente")
    .select("*")
    // Em curso vem sem limite de tempo (um job travado há dois dias é
    // exatamente o que se quer ver); erro só das últimas 24h, senão a gaveta
    // vira arquivo morto.
    .or(`status.in.(${EM_CURSO.join(",")}),and(status.eq.error,created_at.gte.${desde})`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[atividadeRecente]", error.message);
    return [];
  }
  return (data ?? []) as ItemAtividade[];
}
