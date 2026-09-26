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
 * Esta documentação está na oferta da Natcorp, ATIVA? Devolve a REGRA dela.
 *
 * Consulta apontada, e não um `pocoUniversal().some(...)`: é a checagem do
 * caminho de GRAVAÇÃO (ver `documentacaoOferecidaPelaNatcorp` em
 * `/gestao/conteudo/actions.ts`, que explica o que ela impede), e ela precisa
 * responder sobre o banco de agora, não sobre uma lista que a tela carregou
 * minutos antes.
 *
 * Devolve a regra, e não um booleano, porque a gravação precisa das DUAS regras:
 * a combinação é E (`public.escopo_documentacao`), então uma escolha da base que
 * não tem valor em comum com a da Natcorp produz documentação que ninguém
 * alcança — e isso se recusa, não se grava.
 */
export async function daOfertaUniversal(spaceId: string): Promise<{ regra: Regra } | null> {
  const { data } = await createAdminClient()
    .from("documentacoes_universais")
    .select("space_id, regra")
    .eq("space_id", spaceId)
    .eq("enabled", true)
    .maybeSingle();
  return data ? { regra: (data.regra ?? {}) as Regra } : null;
}

/**
 * Esta REGRA da Natcorp alcança a base informada, pela dimensão `base`?
 *
 * Lista ausente ou vazia LIBERA — é o caso comum, documentação sem restrição de
 * cliente — pela mesma convenção do motor de elegibilidade. Comparação sem
 * caixa e sem espaço nas pontas, porque o cadastro não garante que `base_code`
 * chegue sempre no mesmo formato.
 *
 * Mora aqui, e não repetida em cada chamador, porque os DOIS lados que decidem
 * "esta documentação vale para esta empresa" precisam da MESMA resposta:
 *
 *   · a LEITURA (`/gestao/conteudo/page.tsx`, que monta a lista que a tela
 *     mostra);
 *   · a GRAVAÇÃO (`documentacaoOferecidaPelaNatcorp`, em
 *     `/gestao/conteudo/actions.ts`, que decide o que o cliente pode ajustar).
 *
 * Duas implementações divergentes É o defeito que a tarefa 14 encontrou: a
 * tela filtrava por aqui, a gravação só conferia `enabled`, e uma universal
 * restrita a OUTROS clientes passava — salvava com sucesso e não abria acesso
 * a nada (a proteção real ficava só em `public.escopo_documentacao`, que
 * reavalia a identidade a cada turno).
 */
export function regraAlcancaBase(regra: Regra, baseCode: string): boolean {
  const lista = (regra.base ?? []).filter((b) => b && b.trim());
  if (lista.length === 0) return true;
  return lista.some((b) => b.trim().toLowerCase() === baseCode.trim().toLowerCase());
}
