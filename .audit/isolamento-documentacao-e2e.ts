/**
 * Prova de ISOLAMENTO ENTRE BASES para documentação e arquivo anexáveis
 * (tarefa 6), e da CERCA DE PROPRIEDADE dentro de `hybrid_search_scoped` e
 * `knowledge_list_chunks` (tarefa 7), contra o banco real de PRODUÇÃO.
 *
 * ── Por que este script existe ───────────────────────────────────────
 * O widget entra como `service_role`, que tem `rolbypassrls` — RLS nunca
 * protege esse caminho. O isolamento entre `ai_bases` depende INTEIRAMENTE
 * de `escopo_documentacao` e `documentos_da_base` montarem a lista certa de
 * ids, e de ninguém, em nenhuma migration futura, anexar a documentação de
 * um cliente à base de outro. Não há cerca de RLS aqui porque não pode
 * haver: este script É a cerca.
 *
 * Quatro provas, uma atrás da outra:
 *
 *   1) ISOLAMENTO ENTRE BASES — cria duas bases e duas documentações de
 *      teste, anexa cada uma à sua base, cria um arquivo de base em cada, e
 *      falha se o escopo de uma contiver qualquer id da outra. Inclui o
 *      caso do passo 6 do brief: uma terceira documentação, restrita por
 *      `regra` a um portal, prova que a identidade ERRADA não a alcança.
 *
 *   2) A CERCA DE PROPRIEDADE dentro de `hybrid_search_scoped` e
 *      `knowledge_list_chunks` (tarefa 7) — cria um CHUNK pesquisável para
 *      o arquivo de cada base e chama as duas funções com `p_document_ids`
 *      contendo os DOIS arquivos (A e B) mas `p_base` só da base A: é
 *      exatamente o erro que a aplicação poderia cometer (montar a lista
 *      errada), e a prova é que o arquivo de B desaparece do resultado
 *      MESMO estando explicitamente pedido. Sem `p_base`, os dois
 *      aparecem — prova que a cerca não muda nada para quem não a usa.
 *
 *   3) A CERCA DO `anon`, agora REPETÍVEL — a tarefa 2 deixou uma assertiva
 *      de comportamento em `20260925116000_assertiva_de_comportamento_do_anon.sql`
 *      que roda UMA VEZ, no `migrate:apply`. Não há ledger de migrations
 *      neste projeto, não há reaplicação automática e não há pgTAP: se uma
 *      migration futura reescrever `chunks_public_read` para vazar, nada
 *      roda aquela assertiva de novo. Este script repete o MESMO invariante
 *      (`anon` não alcança nenhum `chunk` com `node_id is null`) toda vez
 *      que é chamado — pela CI (job `superficie-medida`, que agora aponta
 *      para cá) e pelo portão de commit (`npm run verificar:isolamento`).
 *
 *      Honestidade sobre o que isso cobre e o que não cobre: a cerca do
 *      `anon` está protegida por TRÊS mecanismos, em ordem — a assertiva de
 *      migration de uma vez só, este script rodado do portão de commit, e o
 *      aviso da CI dizendo QUANDO rodar. O que falta, e que não é decisão
 *      minha nem de quem escreveu o brief, é uma credencial de produção nos
 *      secrets do GitHub Actions: sem ela, a CI avisa mas não verifica
 *      sozinha. Essa decisão é do dono.
 *
 * ── Segurança: nunca escreve de verdade ──────────────────────────────
 * Tudo roda dentro de `BEGIN` ... `ROLLBACK`, o `ROLLBACK` está em `finally`
 * (roda mesmo se uma asserção lançar), e não há confirmação de transação
 * alguma neste arquivo. Depois do rollback, o script reconsulta o banco (fora de
 * qualquer transação) e IMPRIME quantas linhas com o prefixo `zz-isolamento-
 * teste-` sobreviveram — tem de ser zero, e se não for, o script se declara
 * em falha por sujar produção, que é pior do que o defeito que ele testa.
 *
 * `SET LOCAL ROLE` fora de transação é no-op (daria falso positivo aqui);
 * dentro da transação plana deste script — nunca dentro de um bloco
 * `BEGIN ... EXCEPTION` do PL/pgSQL, que reverte a troca de papel pelo
 * savepoint implícito — ele persiste normalmente entre um `client.query()`
 * e o próximo.
 *
 * ── Sabotagem embutida, para provar que a cerca falha quando deve ───────
 * Uma prova que nunca falhou não é prova. Em vez de exigir editar o arquivo
 * a cada demonstração, as duas sabotagens do brief (passo 2 e passo 2b)
 * ficam atrás de uma variável de ambiente, sempre dentro da MESMA transação
 * que sempre reverte — nenhuma das duas deixa rastro em produção:
 *
 *   npx tsx --env-file=.env.local .audit/isolamento-documentacao-e2e.ts
 *   SABOTAR=isolamento npx tsx --env-file=.env.local .audit/isolamento-documentacao-e2e.ts
 *   SABOTAR=anon        npx tsx --env-file=.env.local .audit/isolamento-documentacao-e2e.ts
 *
 * `SABOTAR=isolamento` reproduz o cenário do brief: anexa a documentação de
 * teste de B também à base de teste A. `SABOTAR=anon` reescreve
 * `chunks_public_read` (via `ALTER POLICY`, revertido pelo `ROLLBACK` como
 * qualquer outro DDL transacional) para o mesmo formato vazador que a
 * migration da tarefa 2 documentou por extenso.
 *
 *   4) A SOBREPOSIÇÃO POR BASE, e que ela só ESTREITA (tarefa 9) — quatro
 *      documentações UNIVERSAIS e sobreposições só na base A. Prova que
 *      `enabled = false` esconde na base A e NÃO esconde na base B, que uma
 *      regra mais estreita na base A não estreita na base B, e que uma
 *      sobreposição ABERTA não ALARGA uma universal restrita por portal (a
 *      interseção das duas regras). A migration
 *      `20260925140000_escopo_com_sobreposicao_por_base.sql` tem as mesmas
 *      assertivas, e elas rodam uma vez só; estas rodam a cada portão.
 *
 *      RESSALVA OPERACIONAL de `SABOTAR=anon`: `ALTER POLICY` toma lock
 *      `ACCESS EXCLUSIVE` na tabela `chunks` até o `ROLLBACK`. Enquanto o
 *      lock existe, qualquer sessão que tente LER `chunks` — portal público,
 *      RAG do chat — fica bloqueada esperando. Não deixa rastro nos dados,
 *      mas não é sem efeito em produção: rode essa variante fora de horário
 *      de pico.
 *
 *   npm run verificar:isolamento
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const PREFIXO = "zz-isolamento-teste-";
const SABOTAR = process.env.SABOTAR; // "isolamento" | "anon" | undefined

type LinhaEscopo = { space_id: string; origem: string };
type LinhaArquivo = { document_id: string };

function registra(
  casos: { nome: string; passou: boolean }[],
  nome: string,
  passou: boolean,
  detalhe: string,
): void {
  casos.push({ nome, passou });
  console.log(`  ${passou ? "OK  " : "FALHA"}  ${nome}\n          → ${detalhe}`);
}

async function main() {
  const client = new pg.Client(parseDbConfig());
  await client.connect();

  const casos: { nome: string; passou: boolean }[] = [];
  let falhas = 0;

  console.log(`\nProva de isolamento — documentação e arquivo anexáveis${SABOTAR ? `  [SABOTAR=${SABOTAR}]` : ""}\n`);

  // `client.end()` no `finally` DESTE `try`, não só no fim feliz da função:
  // uma exceção inesperada depois do ROLLBACK (por exemplo na consulta de
  // "restos" abaixo) não pode deixar a conexão pendurada. A transação já
  // foi revertida antes disto rodar, então não há risco para os dados — é
  // só a conexão de rede que precisa fechar de qualquer jeito.
  try {
    await client.query("BEGIN");
    try {
      // ── 1. Duas bases de teste ───────────────────────────────────────
      const baseA = (
        await client.query<{ id: string }>(
          `insert into public.ai_bases (base_code, name) values ($1, $1) returning id`,
          [`${PREFIXO}base-a`],
        )
      ).rows[0]!.id;
      const baseB = (
        await client.query<{ id: string }>(
          `insert into public.ai_bases (base_code, name) values ($1, $1) returning id`,
          [`${PREFIXO}base-b`],
        )
      ).rows[0]!.id;

      // ── 2. Três documentações de teste (espaços) ─────────────────────
      // A e B: uma para cada base, regra aberta. C: exclusiva de A e
      // restrita por portal — é o caso do passo 6 do brief.
      const spaceA = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'client', 'private') returning id`,
          [`${PREFIXO}space-a`],
        )
      ).rows[0]!.id;
      const spaceB = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'client', 'private') returning id`,
          [`${PREFIXO}space-b`],
        )
      ).rows[0]!.id;
      const spaceC = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'client', 'private') returning id`,
          [`${PREFIXO}space-c-portal`],
        )
      ).rows[0]!.id;

      // ── 3. Anexar: A → base A, B → base B, C → base A (só portal PG) ─
      await client.query(
        `insert into public.ai_base_documentacoes (base_id, space_id, regra) values ($1, $2, '{}'::jsonb)`,
        [baseA, spaceA],
      );
      await client.query(
        `insert into public.ai_base_documentacoes (base_id, space_id, regra) values ($1, $2, '{}'::jsonb)`,
        [baseB, spaceB],
      );
      await client.query(
        `insert into public.ai_base_documentacoes (base_id, space_id, regra) values ($1, $2, $3::jsonb)`,
        [baseA, spaceC, JSON.stringify({ portal: ["PG"] })],
      );

      if (SABOTAR === "isolamento") {
        // SABOTAGEM (passo 2 do brief): anexa a documentação de B TAMBÉM à
        // base A. Some com o ROLLBACK do `finally`, como todo o resto.
        await client.query(
          `insert into public.ai_base_documentacoes (base_id, space_id, regra) values ($1, $2, '{}'::jsonb)`,
          [baseA, spaceB],
        );
        console.log("  [SABOTAGEM ATIVA] documentação de teste B também anexada à base de teste A\n");
      }

      // ── 4. Um arquivo de base em cada ─────────────────────────────────
      const docA = (
        await client.query<{ id: string }>(
          `insert into public.knowledge_documents (base_id, storage_path, original_name, regra)
           values ($1, $2, $3, '{}'::jsonb) returning id`,
          [baseA, `${PREFIXO}base-a/arquivo.txt`, `${PREFIXO}arquivo-a.txt`],
        )
      ).rows[0]!.id;
      const docB = (
        await client.query<{ id: string }>(
          `insert into public.knowledge_documents (base_id, storage_path, original_name, regra)
           values ($1, $2, $3, '{}'::jsonb) returning id`,
          [baseB, `${PREFIXO}base-b/arquivo.txt`, `${PREFIXO}arquivo-b.txt`],
        )
      ).rows[0]!.id;

      // Um CHUNK pesquisável para cada arquivo, com o MESMO marcador nos
      // dois — para uma única consulta casar os dois documentos igualmente
      // quando a cerca (tarefa 7) não estiver ativa. `tsv` é coluna GERADA
      // (generated always as to_tsvector(...) stored): não entra no insert.
      await client.query(
        `insert into public.chunks (document_id, content) values ($1, $2)`,
        [docA, `${PREFIXO}conteudo zzmarcadorisolamento7 do arquivo da base A`],
      );
      await client.query(
        `insert into public.chunks (document_id, content) values ($1, $2)`,
        [docB, `${PREFIXO}conteudo zzmarcadorisolamento7 do arquivo da base B`],
      );

      const codigoBaseA = `${PREFIXO}base-a`;
      const codigoBaseB = `${PREFIXO}base-b`;

      // ── 5. escopo_documentacao para A e para B ────────────────────────
      const escopoA = (
        await client.query<LinhaEscopo>(`select space_id, origem from public.escopo_documentacao($1, '{}'::jsonb)`, [
          codigoBaseA,
        ])
      ).rows.map((r) => r.space_id);
      const escopoB = (
        await client.query<LinhaEscopo>(`select space_id, origem from public.escopo_documentacao($1, '{}'::jsonb)`, [
          codigoBaseB,
        ])
      ).rows.map((r) => r.space_id);

      registra(
        casos,
        "escopo de A não contém a documentação de B",
        !escopoA.includes(spaceB),
        `escopo(A) = [${escopoA.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "escopo de B não contém a documentação de A",
        !escopoB.includes(spaceA),
        `escopo(B) = [${escopoB.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "escopo de B não contém a documentação C (exclusiva de A)",
        !escopoB.includes(spaceC),
        `escopo(B) = [${escopoB.join(", ") || "vazio"}]`,
      );

      // ── 6. documentos_da_base para A e para B ─────────────────────────
      const arquivosA = (
        await client.query<LinhaArquivo>(`select document_id from public.documentos_da_base($1, '{}'::jsonb)`, [
          codigoBaseA,
        ])
      ).rows.map((r) => r.document_id);
      const arquivosB = (
        await client.query<LinhaArquivo>(`select document_id from public.documentos_da_base($1, '{}'::jsonb)`, [
          codigoBaseB,
        ])
      ).rows.map((r) => r.document_id);

      registra(
        casos,
        "arquivos de A não contêm o arquivo de B",
        !arquivosA.includes(docB),
        `documentos(A) = [${arquivosA.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "arquivos de B não contêm o arquivo de A",
        !arquivosB.includes(docA),
        `documentos(B) = [${arquivosB.join(", ") || "vazio"}]`,
      );

      // ── 7. Tarefa 7: a cerca de PROPRIEDADE em hybrid_search_scoped e
      //      knowledge_list_chunks ─────────────────────────────────────
      // A prova do passo 5 do brief da tarefa 7: chama as duas RPCs com
      // `p_document_ids` contendo os DOIS arquivos (A e B) — a aplicação
      // ERRANDO a lista, de propósito — e `p_base` só da base A. O arquivo
      // de B tem de desaparecer do resultado MESMO pedido explicitamente.
      // Sem `p_base`, os dois aparecem: prova que a cerca não muda nada
      // para quem não a usa (todo chamador hoje: portal, Cmd+K, editor).
      const hssSemBase = (
        await client.query<{ document_id: string }>(
          `select document_id from public.hybrid_search_scoped(
             p_query := 'zzmarcadorisolamento7', p_document_ids := $1::uuid[], p_limit := 10, p_group_limit := 10)`,
          [[docA, docB]],
        )
      ).rows.map((r) => r.document_id);
      const hssComBaseA = (
        await client.query<{ document_id: string }>(
          `select document_id from public.hybrid_search_scoped(
             p_query := 'zzmarcadorisolamento7', p_document_ids := $1::uuid[], p_limit := 10,
             p_group_limit := 10, p_base := $2)`,
          [[docA, docB], codigoBaseA],
        )
      ).rows.map((r) => r.document_id);

      registra(
        casos,
        "hybrid_search_scoped SEM p_base: os dois arquivos aparecem (comportamento inalterado)",
        hssSemBase.includes(docA) && hssSemBase.includes(docB),
        `document_ids = [${hssSemBase.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "hybrid_search_scoped COM p_base da base A: o arquivo de B desaparece MESMO pedido em p_document_ids",
        hssComBaseA.includes(docA) && !hssComBaseA.includes(docB),
        `document_ids = [${hssComBaseA.join(", ") || "vazio"}]`,
      );

      const klcSemBase = (
        await client.query<{ document_id: string }>(
          `select document_id from public.knowledge_list_chunks(
             p_query := 'zzmarcadorisolamento7', p_document_ids := $1::uuid[], p_limit := 40)`,
          [[docA, docB]],
        )
      ).rows.map((r) => r.document_id);
      const klcComBaseA = (
        await client.query<{ document_id: string }>(
          `select document_id from public.knowledge_list_chunks(
             p_query := 'zzmarcadorisolamento7', p_document_ids := $1::uuid[], p_limit := 40, p_base := $2)`,
          [[docA, docB], codigoBaseA],
        )
      ).rows.map((r) => r.document_id);

      registra(
        casos,
        "knowledge_list_chunks SEM p_base: os dois arquivos aparecem (comportamento inalterado)",
        klcSemBase.includes(docA) && klcSemBase.includes(docB),
        `document_ids = [${klcSemBase.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "knowledge_list_chunks COM p_base da base A: o arquivo de B desaparece MESMO pedido em p_document_ids",
        klcComBaseA.includes(docA) && !klcComBaseA.includes(docB),
        `document_ids = [${klcComBaseA.join(", ") || "vazio"}]`,
      );

      // ── 8. Passo 6 do brief: regra restrita por portal ────────────────
      // C está anexada a A com regra {"portal": ["PG"]}. Identidade com
      // portal ERRADO não pode alcançar; com o portal CERTO, alcança.
      const escopoA_portalErrado = (
        await client.query<LinhaEscopo>(`select space_id from public.escopo_documentacao($1, $2::jsonb)`, [
          codigoBaseA,
          JSON.stringify({ portal: "PO" }),
        ])
      ).rows.map((r) => r.space_id);
      const escopoA_portalCerto = (
        await client.query<LinhaEscopo>(`select space_id from public.escopo_documentacao($1, $2::jsonb)`, [
          codigoBaseA,
          JSON.stringify({ portal: "PG" }),
        ])
      ).rows.map((r) => r.space_id);

      registra(
        casos,
        "regra restrita a portal PG: identidade PO (errada) NÃO alcança a documentação C",
        !escopoA_portalErrado.includes(spaceC),
        `escopo(A, identidade portal=PO) = [${escopoA_portalErrado.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "regra restrita a portal PG: identidade PG (certa) alcança a documentação C",
        escopoA_portalCerto.includes(spaceC),
        `escopo(A, identidade portal=PG) = [${escopoA_portalCerto.join(", ") || "vazio"}]`,
      );

      // ── 9. Tarefa 9: a SOBREPOSIÇÃO por base, e que ela só ESTREITA ───
      // Quatro documentações UNIVERSAIS (a oferta da Natcorp) e sobreposições
      // só na base A. O que cada uma prova:
      //
      //   u-aberta   → universal sem sobreposição alcança as DUAS bases;
      //   u-oculta   → `enabled = false` na base A esconde na base A e NÃO
      //                esconde na base B (a prova que o brief pediu por
      //                extenso: sobreposição é por base, nunca global);
      //   u-estreita → regra da base ESTREITA na base A e não na base B;
      //   u-teto     → universal restrita a PG + sobreposição ABERTA: a
      //                identidade PO CONTINUA sem alcançar. É a prova da
      //                INTERSEÇÃO, e o caso que quebraria se alguém trocasse
      //                interseção por substituição.
      //
      // As inserções vêm DEPOIS das seções 5 a 8 de propósito: antes delas,
      // `documentacoes_universais` está vazia, e as contagens daquelas seções
      // continuam medindo exatamente o que mediam.
      const spaceUAberta = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'client', 'private') returning id`,
          [`${PREFIXO}u-aberta`],
        )
      ).rows[0]!.id;
      const spaceUOculta = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'client', 'private') returning id`,
          [`${PREFIXO}u-oculta`],
        )
      ).rows[0]!.id;
      const spaceUEstreita = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'client', 'private') returning id`,
          [`${PREFIXO}u-estreita`],
        )
      ).rows[0]!.id;
      const spaceUTeto = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'client', 'private') returning id`,
          [`${PREFIXO}u-teto`],
        )
      ).rows[0]!.id;

      await client.query(
        `insert into public.documentacoes_universais (space_id, enabled, regra) values
           ($1, true, '{}'::jsonb),
           ($2, true, '{}'::jsonb),
           ($3, true, '{}'::jsonb),
           ($4, true, $5::jsonb)`,
        [spaceUAberta, spaceUOculta, spaceUEstreita, spaceUTeto, JSON.stringify({ portal: ["PG"] })],
      );
      await client.query(
        `insert into public.ai_base_documentacoes (base_id, space_id, enabled, regra) values
           ($1, $2, false, '{}'::jsonb),
           ($1, $3, true,  $5::jsonb),
           ($1, $4, true,  '{}'::jsonb)`,
        [baseA, spaceUOculta, spaceUEstreita, spaceUTeto, JSON.stringify({ portal: ["PG"] })],
      );

      /** Espaços que esta identidade alcança nesta base, pela função de verdade. */
      const escopoDe = async (codigo: string, identidade: Record<string, string>) =>
        (
          await client.query<LinhaEscopo>(`select space_id from public.escopo_documentacao($1, $2::jsonb)`, [
            codigo,
            JSON.stringify(identidade),
          ])
        ).rows.map((r) => r.space_id);

      const aPG = await escopoDe(codigoBaseA, { portal: "PG" });
      const bPG = await escopoDe(codigoBaseB, { portal: "PG" });
      const aPO = await escopoDe(codigoBaseA, { portal: "PO" });
      const bPO = await escopoDe(codigoBaseB, { portal: "PO" });

      registra(
        casos,
        "universal SEM sobreposição alcança as duas bases",
        aPG.includes(spaceUAberta) && bPG.includes(spaceUAberta),
        `A tem u-aberta = ${aPG.includes(spaceUAberta)} · B tem u-aberta = ${bPG.includes(spaceUAberta)}`,
      );
      registra(
        casos,
        "sobreposição enabled=false ESCONDE a universal na base A",
        !aPG.includes(spaceUOculta),
        `escopo(A, PG) tem u-oculta = ${aPG.includes(spaceUOculta)}`,
      );
      registra(
        casos,
        "esconder na base A NÃO esconde na base B",
        bPG.includes(spaceUOculta),
        `escopo(B, PG) tem u-oculta = ${bPG.includes(spaceUOculta)}`,
      );
      registra(
        casos,
        "sobreposição com regra ESTREITA: identidade PO não alcança na base A",
        !aPO.includes(spaceUEstreita) && aPG.includes(spaceUEstreita),
        `A: PO tem u-estreita = ${aPO.includes(spaceUEstreita)} · PG tem = ${aPG.includes(spaceUEstreita)}`,
      );
      registra(
        casos,
        "estreitar na base A NÃO estreita na base B (PO continua alcançando lá)",
        bPO.includes(spaceUEstreita),
        `escopo(B, PO) tem u-estreita = ${bPO.includes(spaceUEstreita)}`,
      );
      registra(
        casos,
        "sobreposição ABERTA não ALARGA universal restrita a PG: identidade PO continua fora (INTERSEÇÃO)",
        !aPO.includes(spaceUTeto) && aPG.includes(spaceUTeto),
        `A: PO tem u-teto = ${aPO.includes(spaceUTeto)} · PG tem = ${aPG.includes(spaceUTeto)}`,
      );

      // ── 10. A cerca do anon, agora repetível (passo 2b) ───────────────
      if (SABOTAR === "anon") {
        // SABOTAGEM: mesmo formato vazador que a migration
        // 20260925116000 documentou — acrescenta `OR chunks.node_id IS NULL`
        // à policy. `ALTER POLICY` é DDL transacional: o `ROLLBACK` do
        // `finally` desfaz isto como desfaz qualquer INSERT deste script.
        // Ver a ressalva operacional no cabeçalho: isto toma lock
        // `ACCESS EXCLUSIVE` em `chunks` até o rollback.
        await client.query(`
          alter policy chunks_public_read on public.chunks
          using (
            exists (
              select 1 from public.nodes n join public.spaces s on s.id = n.space_id
              where n.id = chunks.node_id
                and n.status = 'published'
                and n.deleted_at is null
                and s.visibility = 'public'
            )
            or chunks.node_id is null
          )
        `);
        console.log("  [SABOTAGEM ATIVA] chunks_public_read reescrita para vazar chunk com node_id nulo\n");
      }

      await client.query("SET LOCAL ROLE anon");
      const anonAlcancados = Number(
        (await client.query<{ n: string }>(`select count(*)::text as n from public.chunks where node_id is null`))
          .rows[0]!.n,
      );
      await client.query("RESET ROLE");

      registra(
        casos,
        "anon não alcança nenhum chunk de arquivo (node_id nulo)",
        anonAlcancados === 0,
        `contagem alcançável por anon = ${anonAlcancados}`,
      );
    } finally {
      await client.query("ROLLBACK");
    }

    // ── Prova de que nada sujou produção ────────────────────────────────
    // Fora de qualquer transação: se o rollback falhou silenciosamente por
    // algum motivo, isto pega. Conta por prefixo nas SEIS tabelas tocadas
    // (a quinta, `chunks`, entrou com a tarefa 7; a sexta,
    // `documentacoes_universais`, com a tarefa 9).
    const restos = Number(
      (
        await client.query<{ n: string }>(
          `select (
             (select count(*) from public.ai_bases where base_code like $1) +
             (select count(*) from public.spaces where slug like $1) +
             (select count(*) from public.ai_base_documentacoes d
                join public.spaces s on s.id = d.space_id where s.slug like $1) +
             (select count(*) from public.documentacoes_universais u
                join public.spaces s on s.id = u.space_id where s.slug like $1) +
             (select count(*) from public.knowledge_documents where original_name like $1) +
             (select count(*) from public.chunks where content like $1)
           )::text as n`,
          [`${PREFIXO}%`],
        )
      ).rows[0]!.n,
    );

    console.log(`\n  Linhas de teste remanescentes após o rollback: ${restos}`);
    falhas = casos.filter((c) => !c.passou).length;
    if (restos !== 0) {
      console.error(
        `  FALHA CRÍTICA: o script sujou produção — ${restos} linha(s) com prefixo "${PREFIXO}" sobreviveram ao rollback.`,
      );
      falhas++;
    }

    console.log(
      `\n  ${
        falhas === 0
          ? "PASSOU — nenhuma base alcança a documentação da outra, a busca recusa documento de outra base mesmo pedido explicitamente, a regra por portal fecha a identidade errada, a sobreposição por base só ESTREITA (esconder e estreitar na base A não mexem na base B, e sobreposição aberta não alarga universal restrita), e a cerca do anon segue de pé"
          : `FALHOU em ${falhas} caso(s)`
      }\n`,
    );
  } finally {
    await client.end();
  }

  if (falhas > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
