import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Regra } from "@/lib/elegibilidade";

/**
 * O POÇO: a oferta da Natcorp, e a única coisa que um cliente pode ajustar.
 *
 * `documentacoes_universais` é o conjunto que toda base alcança sem
 * configuração. A tela do cliente (`/gestao/conteudo`) trabalha SOBRE ele: cada
 * linha de `ai_base_documentacoes` é uma sobreposição (esconder, ou trocar a
 * regra) de uma documentação que existe aqui. Nunca o contrário — o cliente não
 * escreve nesta tabela, e não escolhe fora dela.
 *
 * Sem paginação de propósito: é tabela de CONFIGURAÇÃO, uma linha por
 * documentação oferecida. O teto de mil linhas do PostgREST fica a três ordens
 * de grandeza daqui, e a tabela não cresce com uso.
 *
 * Cliente ADMIN, e não de sessão: quem chama é a área do cliente, que não tem
 * sessão do Supabase nenhuma — a autorização dela é o token do APEX, revalidado
 * por quem chama. A RLS das duas tabelas exige `ai.configure`, que o cliente não
 * tem e não deve ter.
 */

export type DocumentacaoUniversal = {
  spaceId: string;
  nome: string;
  /** A regra que a NATCORP configurou para esta documentação. */
  regra: Regra;
};

/** A oferta inteira, em ordem de nome. Só o que está ATIVO na Natcorp. */
export async function pocoUniversal(): Promise<DocumentacaoUniversal[]> {
  const db = createAdminClient();
  const { data: linhas } = await db
    .from("documentacoes_universais")
    .select("space_id, regra")
    .eq("enabled", true);

  const ids = (linhas ?? []).map((l) => l.space_id);
  if (ids.length === 0) return [];

  // Duas consultas em vez de um embed `spaces(name)`: o tipo gerado devolve o
  // embed como objeto ou lista dependendo de como o PostgREST enxerga a relação,
  // e a diferença aparece só em tempo de execução. Duas leituras de tabela de
  // configuração custam menos que um `as never`.
  const { data: espacos } = await db.from("spaces").select("id, name").in("id", ids);
  const nome = new Map((espacos ?? []).map((e) => [e.id, e.name] as const));

  return (linhas ?? [])
    .map((l) => ({
      spaceId: l.space_id,
      // Espaço apagado com a linha órfã sobrando não pode virar uma linha sem
      // rótulo na tela do cliente: ele não tem como investigar um item em branco.
      nome: nome.get(l.space_id) ?? "(documentação removida)",
      regra: (l.regra ?? {}) as Regra,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Esta documentação está na oferta da Natcorp, ATIVA?
 *
 * Consulta apontada, e não um `pocoUniversal().some(...)`: é a checagem do
 * caminho de GRAVAÇÃO (ver `documentacaoOferecidaPelaNatcorp` em
 * `/gestao/conteudo/actions.ts`, que explica o que ela impede), e ela precisa
 * responder sobre o banco de agora, não sobre uma lista que a tela carregou
 * minutos antes.
 */
export async function estaNoPocoUniversal(spaceId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("documentacoes_universais")
    .select("space_id")
    .eq("space_id", spaceId)
    .eq("enabled", true)
    .maybeSingle();
  return !!data;
}
