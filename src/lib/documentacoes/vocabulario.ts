import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { DIMENSOES, type Dimensao } from "@/lib/elegibilidade";
import { TETO_DE_VALORES } from "./dimensoes-ui";

/**
 * DIAGNÓSTICO DE PRESENÇA: o que uma base JÁ ENVIOU em cada dimensão.
 *
 * Saiu de `documentacoes-actions.ts` (aba do admin) para cá porque a tela do
 * CLIENTE, em `/gestao/conteudo`, precisa exatamente do mesmo diagnóstico — e
 * uma segunda cópia da leitura significaria uma segunda cópia das duas
 * armadilhas comentadas abaixo (a paginação por range e a contagem por
 * `head`), que é como elas voltam.
 *
 * O que ele responde: "restringir por filial alcança alguém nesta base?". A
 * resposta substitui o contador de alcance, medido e descartado — natcorp tem
 * 317 conversas e 4 valores distintos de `p_usuario`, então um contador
 * mostraria 0 ou 1 para qualquer regra.
 */

export type Vocabulario = {
  /** Dimensão → valores distintos já vistos, do mais frequente para o menos. */
  porDimensao: Partial<Record<Dimensao, { valor: string; conversas: number }[]>>;
  /** Quantas conversas a base tem. Zero explica um vocabulário vazio inteiro. */
  conversas: number;
};

/**
 * O VOCABULÁRIO VAI PELO CLIENTE ADMIN, E ISTO É MEDIDO, NÃO PREFERÊNCIA.
 *
 * `public.vocabulario_rastreio` NÃO é executável por `authenticated`: medido em
 * 25/09, `has_function_privilege('authenticated', …, 'EXECUTE') = false`. A
 * migration `20260925003000_vocabulario_sem_authenticated.sql` revogou de
 * propósito, com autorização do dono — a função é `security definer` e, com
 * `base_ref` nulo, devolve perfil, empresa, usuário e MATRÍCULA de todos os
 * clientes. Chamada pelo cliente de SESSÃO ela responde permissão negada e o
 * diagnóstico de presença simplesmente não carrega.
 *
 * NÃO reconceda EXECUTE a `authenticated`: seria reverter uma decisão de
 * segurança que o dono autorizou. O caminho é este — o cliente admin DEPOIS de
 * quem chama já ter conferido a autorização (permissão, no admin; token
 * revalidado, na área do cliente).
 *
 * ── `baseCode` nulo devolve o vocabulário de TODAS as bases ───────────────
 * É o que a aba do admin precisa para uma documentação universal. A área do
 * cliente NUNCA passa nulo: ali a base sai do token e o vocabulário de outro
 * cliente não pode aparecer na tela.
 */
export async function lerVocabulario(baseCode: string | null): Promise<Vocabulario> {
  const db = createAdminClient();
  const base = baseCode?.trim() || null;

  // Paginado por RANGE, e não numa chamada só: o teto de linhas do PostgREST
  // vale para função que devolve tabela do mesmo jeito que para SELECT, e uma
  // base grande passa de mil valores distintos somando as onze dimensões. Ler
  // 1.000 de 5.569 e achar que leu tudo é o defeito que já voltou sete vezes
  // neste projeto — e aqui ele produziria "esta base nunca enviou valor para X"
  // sobre uma dimensão que a base envia desde sempre.
  const linhas = await fetchAllPaged<{ campo: string; valor: string; conversas: number }>((de, ate) =>
    db
      .rpc("vocabulario_rastreio", { base_ref: base ?? undefined })
      .select("campo, valor, conversas")
      .range(de, ate),
  );

  const porDimensao: Vocabulario["porDimensao"] = {};
  for (const d of DIMENSOES) {
    const valores = linhas
      .filter((l) => l.campo === d && l.valor)
      .map((l) => ({ valor: l.valor, conversas: Number(l.conversas) || 0 }))
      .sort((a, b) => b.conversas - a.conversas)
      .slice(0, TETO_DE_VALORES);
    if (valores.length) porDimensao[d] = valores;
  }

  // Contagem por `head: true`: o número de conversas é o que distingue "esta
  // base nunca mandou p_filial" de "esta base nunca conversou", e as duas pedem
  // ações opostas de quem configura. O `.limit(1)` não muda o total (o `count`
  // exato vem no cabeçalho, não no corpo) e é o que declara que esta leitura não
  // depende de linha nenhuma — `conversations` passa de mil linhas há muito, e é
  // a ausência de teto que já custou sete leituras silenciosamente truncadas
  // neste projeto.
  const contagem = db.from("conversations").select("id", { count: "exact", head: true }).limit(1);
  const { count } = base ? await contagem.ilike("p_base", base.replace(/([\\%_])/g, "\\$1")) : await contagem;

  return { porDimensao, conversas: count ?? 0 };
}
