import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { normalizarTermo, type DonoDaOntologia } from "./ontology";

export type TermoAcumulado = {
  term: string;
  kind: string;
  description: string | null;
  aliases: Set<string>;
  /**
   * O nome que este conceito tinha ANTES de a IA expandi-lo.
   *
   * Sem isto, renomear duplica: a busca é feita pelo nome DEVOLVIDO, "Adiantamento
   * Salarial" não casa com o "Adto salarial" que já existia, e um segundo termo
   * nasce deixando o primeiro órfão. Medido em 17/08: 724 termos eram também
   * alias de outro, e cada nova rodada multiplicava.
   */
  normAnterior?: string;
};

/**
 * Mescla um conjunto de termos (com sinônimos) na ontologia de UM DONO — uma
 * documentação (espaço) ou uma base —, sem duplicar: um `term_norm` OU um
 * `alias_norm` já existente aponta para o mesmo termo. Usado pela VARREDURA por
 * IA (worker) e pela IMPORTAÇÃO por arquivo. Devolve quantos itens NOVOS
 * (termos + aliases) foram gravados.
 *
 * O dono entra como união (`DonoDaOntologia`) e não como dois parâmetros
 * opcionais: uma chamada com os dois, ou com nenhum, não compila — e é o mesmo
 * que o CHECK `ontology_terms_um_dono` recusa no banco. Termo de base e termo de
 * espaço nunca se misturam nem se enxergam: a LEITURA abaixo filtra pelo dono, e
 * a mesclagem de um cliente não tem como achar (nem renomear) termo do global.
 *
 * `db` é service-role (worker/sistema) — a RLS de ontologia exige `ai.configure`.
 */
export async function mesclarTermos(
  db: SupabaseClient<Database>,
  dono: DonoDaOntologia,
  acumulado: Map<string, TermoAcumulado>,
  opts: { source: string; createdBy: string | null },
): Promise<number> {
  const { source, createdBy } = opts;
  if (acumulado.size === 0) return 0;

  /*
    O DONO, numa coluna e num valor — usado na leitura e na escrita.

    `.filter()` em vez de `.eq()` porque `src/lib/database.types.ts` ainda não
    conhece `ontology_terms.base_id` (conferido contra o banco em 26/09), e
    `filter` aceita nome de coluna fora do tipo gerado sem `as never`. Mesma
    fronteira declarada de `arquivos-da-base.ts`.
  */
  const coluna: "space_id" | "base_id" = dono.spaceId ? "space_id" : "base_id";
  const valorDoDono: string = dono.spaceId ?? dono.baseId!;

  /*
    ── O ERRO SE LÊ, E O LOG NUNCA LEVA O TERMO ─────────────────────────────────

    O que estava aqui era `if (!novo) continue;`: sem ler o `error`, sem log, sem
    contador. Um termo perdido era indistinguível de um termo que já existia, e o
    `found` que a tela mostra ao cliente ficava MENOR que a extração — ele marca a
    caixa, paga a chamada de IA e recebe menos vocabulário do que foi extraído, com
    nada em lugar nenhum dizendo isso.

    O log leva o DONO e o `term_norm`, nunca o termo nem a descrição: o conteúdo é
    dado do cliente e o log do servidor é lido por quem opera a plataforma. O
    `term_norm` basta para achar a linha depois (é ele que a chave única usa) e não
    carrega a frase que o documento do cliente escreveu.
  */
  const ondeEstamos = `${coluna}=${valorDoDono}`;
  const aviso = (oQue: string, norm: string, detalhe: string) =>
    console.error(`[ontology-merge] ${oQue} (${ondeEstamos}, term_norm="${norm}"): ${detalhe}`);

  /*
    A LEITURA PAGINA — o teto de 1.000 linhas do PostgREST é silencioso.

    Este `select` é o índice que impede a duplicata, e sem paginar ele via 1.000
    de 4.424 termos (medido em `natcorp`): para todo termo além do milésimo, a
    mesclagem achava que não existia, tentava inserir, tomava `unique_violation`,
    e o `if (!novo) continue` engolia — o sinônimo novo não era gravado e o
    contador `found` não contava, sem uma linha de log em lugar nenhum. É a mesma
    armadilha que `carregarOntologia` documenta acima do `fetchAllPaged` dela,
    e a ordem TOTAL por `id` é o que faz as fatias não pularem linha.

    A paginação matou a CAUSA mais comum; o engolimento continuou até esta rodada,
    e agora tem tratamento (ver o `insert` abaixo). As duas coisas são separadas de
    propósito: paginar tira a colisão previsível, e a colisão que RESTA — duas
    varreduras do mesmo arquivo ao mesmo tempo, reingestão durante varredura — não
    tem como ser evitada por leitura nenhuma, porque esta lista já é passado no
    instante seguinte.
  */
  const exTerms = await fetchAllPaged<{ id: string; term_norm: string; description: string | null }>(
    (de, ate) =>
      db
        .from("ontology_terms")
        .select("id, term_norm, description")
        .filter(coluna, "eq", valorDoDono)
        .order("id")
        .range(de, ate),
  );
  const normToTermId = new Map<string, string>();
  const descById = new Map<string, string | null>();
  for (const t of exTerms) {
    normToTermId.set(t.term_norm, t.id);
    descById.set(t.id, t.description);
  }
  const exTermIds = exTerms.map((t) => t.id);
  for (let i = 0; i < exTermIds.length; i += 200) {
    /*
      PAGINADO — a fatia de 200 termos limita quantos TERMOS entram na consulta,
      nunca quantos ALIASES ela devolve. Medido em produção (27/09): a maior
      fatia de 200 termos do dono com 4.424 termos devolve 900 linhas de
      sinônimo, a segunda maior 820 — a cem linhas do teto de 1.000 do
      PostgREST. Sem `range()`, o dia em que uma fatia passar de mil aliases
      corta em silêncio: o índice fica incompleto, o `insert` abaixo acha que o
      sinônimo não existe, colide com `unique_violation`, e só não perde o
      termo porque o tratamento de colisão (ver mais abaixo) relê o id — mas o
      alias que a colisão carregava já foi descartado antes de chegar lá. Mesmo
      par (`.order("id")` + `.range()`) que `copyOntologyBetweenSpaces` usa para
      este mesmo `ontology_aliases`.
    */
    const exAliases = await fetchAllPaged<{ term_id: string; alias_norm: string }>((de, ate) =>
      db
        .from("ontology_aliases")
        .select("term_id, alias_norm")
        .in("term_id", exTermIds.slice(i, i + 200))
        .order("id")
        .range(de, ate),
    );
    for (const a of exAliases) if (!normToTermId.has(a.alias_norm)) normToTermId.set(a.alias_norm, a.term_id);
  }

  let found = 0;
  for (const [norm, t] of acumulado) {
    /**
     * Procura pelo nome NOVO e, se não achar, pelo ANTIGO — e aí RENOMEIA.
     *
     * É o que transforma "expandir a abreviação" em melhoria do termo existente
     * em vez de um segundo termo competindo com ele.
     */
    let existenteId = normToTermId.get(norm);
    if (!existenteId && t.normAnterior) {
      const antigoId = normToTermId.get(t.normAnterior);
      if (antigoId) {
        const { error } = await db
          .from("ontology_terms")
          .update({ term: t.term, term_norm: norm, updated_at: new Date().toISOString() })
          .eq("id", antigoId);
        if (error) {
          // O RENOMEAR falhou: seguir como se tivesse dado certo criaria o segundo
          // termo que `normAnterior` existe para evitar. Melhor tratar o antigo
          // como o termo deste conceito (os sinônimos novos vão para ele) e deixar
          // o nome para a próxima varredura.
          aviso("não deu para renomear o termo", norm, error.message);
        }
        normToTermId.set(norm, antigoId);
        existenteId = antigoId;
      }
    }
    let termId: string;
    if (existenteId) {
      termId = existenteId;
      if (t.description && !descById.get(termId)) {
        const { error } = await db
          .from("ontology_terms")
          .update({ description: t.description, updated_at: new Date().toISOString() })
          .eq("id", termId);
        if (error) aviso("não deu para gravar a descrição do termo", norm, error.message);
        else descById.set(termId, t.description);
      }
    } else {
      const { data: novo, error } = await db
        .from("ontology_terms")
        // O dono vai numa chave só, e é o MESMO da leitura acima. `as never`
        // porque o tipo gerado não conhece `base_id` — ver o comentário do
        // `coluna`/`valorDoDono`.
        .insert({
          [coluna]: valorDoDono,
          term: t.term,
          term_norm: norm,
          kind: t.kind,
          description: t.description,
          source,
          created_by: createdBy,
        } as never)
        .select("id")
        .single();
      if (!novo) {
        /*
          ── `unique_violation` NÃO É "PULE ESTE TERMO" ─────────────────────────

          O índice `ontology_terms_base_id_term_norm_key` (desta rodada) e o par
          equivalente de espaço tornam a colisão ROTINA, não acidente: duas
          varreduras concorrentes do mesmo arquivo do cliente, ou uma reingestão
          durante uma varredura, e a leitura paginada lá em cima já está velha
          quando este `insert` roda.

          Colidir quer dizer que o conceito EXISTE. Então relemos o id e seguimos
          COM ele — o `continue` antigo descartava também os sinônimos novos que
          vinham atrelados, que são a razão de a varredura ter sido pedida.
        */
        const codigo = (error as { code?: string } | null)?.code ?? "";
        if (codigo !== "23505") {
          aviso("termo NÃO gravado", norm, error?.message ?? "o banco não devolveu a linha nem erro");
          continue;
        }
        const { data: jaExistia } = await db
          .from("ontology_terms")
          .select("id, description")
          .filter(coluna, "eq", valorDoDono)
          .eq("term_norm", norm)
          .maybeSingle();
        if (!jaExistia) {
          // Colidiu e não está lá: é outro dono, outro índice, ou a linha saiu no
          // meio. Sem id não há onde pendurar os sinônimos.
          aviso("termo colidiu e não foi encontrado depois", norm, error?.message ?? "");
          continue;
        }
        termId = jaExistia.id;
        normToTermId.set(norm, termId);
        descById.set(termId, jaExistia.description);
      } else {
        termId = novo.id;
        normToTermId.set(norm, termId);
        descById.set(termId, t.description);
        found += 1;
      }
    }
    for (const alias of t.aliases) {
      const an = normalizarTermo(alias);
      if (!an || an === norm) continue;
      if (normToTermId.has(an)) continue;
      const { error } = await db
        .from("ontology_aliases")
        .upsert({ term_id: termId, alias, alias_norm: an, source }, { onConflict: "term_id,alias_norm", ignoreDuplicates: true });
      if (error) {
        // Sinônimo perdido não entra no `found`: o número que a tela mostra ao
        // cliente tem de ser o que foi GRAVADO, e o `normToTermId` também não
        // recebe o alias — senão a próxima iteração o trataria como existente.
        aviso(`sinônimo NÃO gravado (alias_norm="${an}")`, norm, error.message);
        continue;
      }
      normToTermId.set(an, termId);
      found += 1;
    }
  }
  return found;
}
