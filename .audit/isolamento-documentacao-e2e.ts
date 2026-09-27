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
 * Seis provas, uma atrás da outra:
 *
 *   1) ISOLAMENTO ENTRE BASES — cria duas bases e duas documentações de
 *      teste, anexa cada uma à sua base, cria um arquivo de base em cada, e
 *      falha se o escopo de uma contiver qualquer id da outra. Inclui o
 *      caso do passo 6 do brief: uma terceira documentação, restrita por
 *      `regra` a um portal, prova que a identidade ERRADA não a alcança.
 *      E, do lado do ARQUIVO, os dois casos que faltavam: um arquivo da
 *      PRÓPRIA base restrito por `regra` (a trava do ativo principal do
 *      pedido, que os arquivos de `regra '{}'` nunca exercitavam) e um
 *      arquivo em EXTRAÇÃO, que não pode chegar ao RAG com chunks pela
 *      metade. Cada negativa vem com a positiva ao lado: sem ela, uma função
 *      que devolvesse lista vazia por qualquer motivo passaria por aqui.
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
 *   3) A CERCA DO `anon`, nas DUAS direções, e REPETÍVEL — a tarefa 2
 *      deixou uma assertiva de comportamento em
 *      `20260925116000_assertiva_de_comportamento_do_anon.sql` que roda UMA
 *      VEZ, no `migrate:apply`. Não há ledger de migrations neste projeto,
 *      não há reaplicação automática e não há pgTAP: se uma migration futura
 *      reescrever `chunks_public_read` para vazar, nada roda aquela
 *      assertiva de novo. Este script repete o MESMO invariante toda vez que
 *      alguém o executa.
 *
 *      O que ele é, exatamente, para ninguém confundir com prova
 *      automática: um COMANDO que uma pessoa roda
 *      (`npm run verificar:isolamento`). A CI não o executa — o job
 *      `superficie-medida` imprime um `::warning` LEMBRANDO de rodar, e
 *      segue verde de qualquer jeito. Não existe portão de commit neste
 *      repositório: não há husky, não há `.husky/`, não há `core.hooksPath`
 *      e não há hook em `.git/hooks`. Ou seja: nada neste caminho executa
 *      esta prova sozinho. Se ninguém digitar o comando, o invariante fica
 *      sem ser medido.
 *
 *      Honestidade sobre o que isso cobre: a cerca do `anon` tem TRÊS
 *      mecanismos, e nenhum deles roda sem gente — a assertiva de migration
 *      (só quando alguém aplica aquele arquivo), este script (só quando
 *      alguém o chama) e o aviso da CI (que só avisa). O que falta para a
 *      CI verificar sozinha é uma credencial de produção nos secrets do
 *      GitHub Actions, e essa decisão é do dono.
 *
 *      As duas direções, porque uma só não é cerca: `anon` não alcança
 *      NENHUM chunk de arquivo (`node_id` nulo) E alcança ao menos um chunk
 *      de artigo publicado em espaço público. Sem a segunda, uma policy
 *      reescrita para `using (false)` passaria neste script e derrubaria a
 *      busca do portal público em silêncio — que é precisamente o modo de
 *      falha que a 20260925160000 encontrou por outra porta.
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
 *   SABOTAR=campanha    npx tsx --env-file=.env.local .audit/isolamento-documentacao-e2e.ts
 *
 * `SABOTAR=isolamento` reproduz o cenário do brief: anexa a documentação de
 * teste de B também à base de teste A. `SABOTAR=anon` reescreve
 * `chunks_public_read` (via `ALTER POLICY`, revertido pelo `ROLLBACK` como
 * qualquer outro DDL transacional) para o mesmo formato vazador que a
 * migration da tarefa 2 documentou por extenso. `SABOTAR=campanha` anexa a
 * CAMPANHA de teste de B à base de teste A, e faz cair quatro casos ao mesmo
 * tempo: o alerta de B passa a sair para A, o alerta de B para de sair na
 * própria B, o painel de A ganha uma visualização que não é dele e o painel de
 * B perde a que era.
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
 *   5) CAMPANHAS (projeto 3) — uma campanha em cada base e uma visualização em
 *      cada uma. Prova que o alerta da base B não sai para a base A (com o
 *      controle positivo dos dois lados, senão a negativa passaria por
 *      `alertas_para` devolver lista vazia), que a visualização de uma base não
 *      aparece no painel da outra, e que o portão de ESCRITA recusa gravar
 *      visualização numa campanha de outro cliente. A sabotagem
 *      `SABOTAR=campanha` derruba isto de propósito.
 *
 *      Vale o mesmo argumento da seção 1, e mais forte: `alertas_para` e
 *      `registrar_visualizacao` são `security definer` e têm EXECUTE só para
 *      `service_role`, então a RLS de `ai_campanhas` não vale para elas nem para
 *      o caminho do widget. A cerca entre clientes é o `base_id` dentro daquelas
 *      duas funções, mais o `base_id` das consultas do painel. Sem esta seção,
 *      isso é revisão de código e não banco.
 *
 *   6) ONTOLOGIA POR BASE (tarefa 9b) — um termo da base A, um termo do espaço, e
 *      os três turnos possíveis com os MESMOS espaços: base A, base B e sem base.
 *      Prova que o jargão de um cliente não entra na expansão do outro nem na de
 *      quem lê a documentação sem base, e que o termo da documentação entra nos
 *      três. É a única superfície desta rodada sem cobertura contra o banco, e o
 *      que ela vazaria é informação comercial: os termos que uma empresa usa dizem
 *      o que ela faz.
 *
 *      Limite declarado, porque ele muda o que a prova vale: o carregamento aqui é
 *      SQL escrito na seção, não as consultas PostgREST de `carregarOntologia` —
 *      tudo roda dentro da transação que reverte, e o cliente PostgREST entra por
 *      outra conexão e não vê linha não confirmada. O que é de produção, sem cópia,
 *      é a função que EXPANDE.
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
// A EXPANSÃO É A DE PRODUÇÃO, importada — não uma cópia. Ver a seção 12.
import { expandirComOntologia, normalizarTermo, type EntradaOntologia } from "../src/lib/ai/ontology";

const PREFIXO = "zz-isolamento-teste-";
const SABOTAR = process.env.SABOTAR; // "isolamento" | "anon" | "campanha" | undefined

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

      // ── 4. Arquivos de base ───────────────────────────────────────────
      // `status` EXPLÍCITO nos quatro, e não o default da coluna: o default é
      // `queued`, e desde a `20260926100000_documentos_da_base_so_prontos.sql`
      // a função só devolve `ready`. Omitir o status faria as assertivas
      // NEGATIVAS da seção 6 passarem por motivo errado — "A não contém o
      // arquivo de B" é verdade trivial quando nenhum dos dois sai. É por isso
      // que a seção 6 ganhou também as assertivas POSITIVAS.
      //
      //   docA / docB      → um por base, regra aberta, prontos;
      //   docAPortal       → base A, regra {"portal":["PG"]} — a trava do
      //                      ativo principal do pedido, exercitada por
      //                      identidade ERRADA (seção 6b);
      //   docAExtraindo    → base A, regra aberta, `extracting` — o invariante
      //                      da 20260926100000, repetível a cada portão
      //                      (seção 6c).
      const docA = (
        await client.query<{ id: string }>(
          `insert into public.knowledge_documents (base_id, storage_path, original_name, regra, status)
           values ($1, $2, $3, '{}'::jsonb, 'ready') returning id`,
          [baseA, `${PREFIXO}base-a/arquivo.txt`, `${PREFIXO}arquivo-a.txt`],
        )
      ).rows[0]!.id;
      const docB = (
        await client.query<{ id: string }>(
          `insert into public.knowledge_documents (base_id, storage_path, original_name, regra, status)
           values ($1, $2, $3, '{}'::jsonb, 'ready') returning id`,
          [baseB, `${PREFIXO}base-b/arquivo.txt`, `${PREFIXO}arquivo-b.txt`],
        )
      ).rows[0]!.id;
      const docAPortal = (
        await client.query<{ id: string }>(
          `insert into public.knowledge_documents (base_id, storage_path, original_name, regra, status)
           values ($1, $2, $3, $4::jsonb, 'ready') returning id`,
          [
            baseA,
            `${PREFIXO}base-a/so-gestor.txt`,
            `${PREFIXO}arquivo-a-so-gestor.txt`,
            JSON.stringify({ portal: ["PG"] }),
          ],
        )
      ).rows[0]!.id;
      const docAExtraindo = (
        await client.query<{ id: string }>(
          `insert into public.knowledge_documents (base_id, storage_path, original_name, regra, status)
           values ($1, $2, $3, '{}'::jsonb, 'extracting') returning id`,
          [baseA, `${PREFIXO}base-a/em-extracao.xlsx`, `${PREFIXO}arquivo-a-em-extracao.xlsx`],
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
      // As duas POSITIVAS, sem as quais as duas negativas acima passariam com a
      // função devolvendo lista vazia por qualquer motivo (status, regra, join
      // quebrado). Negativa sozinha não prova cerca, prova ausência.
      registra(
        casos,
        "arquivos de A contêm o próprio arquivo de A (a negativa acima não passa por lista vazia)",
        arquivosA.includes(docA),
        `documentos(A) = [${arquivosA.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "arquivos de B contêm o próprio arquivo de B",
        arquivosB.includes(docB),
        `documentos(B) = [${arquivosB.join(", ") || "vazio"}]`,
      );

      // ── 6b. Arquivo de base restrito pela PRÓPRIA `regra` ─────────────
      // `docA` e `docB` nascem com `regra '{}'`, então o `public.elegivel(k.regra,
      // …)` de `documentos_da_base` nunca era exercitado por identidade ERRADA —
      // e essa é a trava do ativo principal do pedido do dono: o arquivo que só
      // o Gestor daquele cliente pode ver. O molde é o da seção 8 (documentação
      // restrita por portal), aplicado ao ARQUIVO.
      const arquivosDe = async (codigo: string, identidade: Record<string, string>) =>
        (
          await client.query<LinhaArquivo>(`select document_id from public.documentos_da_base($1, $2::jsonb)`, [
            codigo,
            JSON.stringify(identidade),
          ])
        ).rows.map((r) => r.document_id);

      const arquivosA_portalErrado = await arquivosDe(codigoBaseA, { portal: "PO" });
      const arquivosA_portalCerto = await arquivosDe(codigoBaseA, { portal: "PG" });

      registra(
        casos,
        "arquivo com regra portal=PG: identidade PO (errada) NÃO alcança o arquivo da PRÓPRIA base",
        !arquivosA_portalErrado.includes(docAPortal),
        `documentos(A, identidade portal=PO) = [${arquivosA_portalErrado.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "arquivo com regra portal=PG: identidade PG (certa) alcança",
        arquivosA_portalCerto.includes(docAPortal),
        `documentos(A, identidade portal=PG) = [${arquivosA_portalCerto.join(", ") || "vazio"}]`,
      );
      // E o arquivo de regra ABERTA continua alcançado pelas duas identidades:
      // prova que o corte acima é da `regra` do arquivo, não da identidade.
      registra(
        casos,
        "arquivo de regra aberta continua alcançado pelas duas identidades (o corte é da regra, não da identidade)",
        arquivosA_portalErrado.includes(docA) && arquivosA_portalCerto.includes(docA),
        `PO tem arquivo-a = ${arquivosA_portalErrado.includes(docA)} · PG tem = ${arquivosA_portalCerto.includes(docA)}`,
      );

      // ── 6c. Só arquivo PRONTO entra no RAG ────────────────────────────
      // O invariante da `20260926100000_documentos_da_base_so_prontos.sql`. A
      // assertiva dela roda uma vez, no `migrate:apply`; esta roda a cada vez
      // que alguém chama este script. O MESMO documento é consultado nos dois
      // estados — sem isso a prova mediria existência, não o predicado.
      registra(
        casos,
        "arquivo em extração (status extracting) NÃO sai: meia planilha afirmada como inteira é pior do que não responder",
        !arquivosA.includes(docAExtraindo),
        `documentos(A) = [${arquivosA.join(", ") || "vazio"}]`,
      );
      await client.query(`update public.knowledge_documents set status = 'ready' where id = $1`, [docAExtraindo]);
      const arquivosA_depoisDoReady = await arquivosDe(codigoBaseA, {});
      registra(
        casos,
        "o MESMO arquivo, agora ready, SAI — o que decide é o status e nada mais",
        arquivosA_depoisDoReady.includes(docAExtraindo),
        `documentos(A) = [${arquivosA_depoisDoReady.join(", ") || "vazio"}]`,
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

      // ── 10. A cerca do anon, nas DUAS direções, repetível ─────────────
      // A direção ABERTA precisa de um alvo legítimo: um espaço PÚBLICO com um
      // artigo PUBLICADO e um chunk dele. Sem esta parte, uma policy reescrita
      // para `using (false)` passaria na direção fechada e derrubaria a busca do
      // portal público em silêncio — exatamente o modo de falha que a
      // 20260925160000 encontrou por outra porta (`permission denied for table
      // ai_bases`, engolido como lista vazia).
      //
      // Criado AQUI, depois das seções 5 a 9, de propósito: espaço público novo
      // não entra em `ai_base_documentacoes` nem em `documentacoes_universais`,
      // então nenhuma contagem daquelas seções muda.
      const spacePublico = (
        await client.query<{ id: string }>(
          `insert into public.spaces (slug, name, type, visibility) values ($1, $1, 'global', 'public') returning id`,
          [`${PREFIXO}space-publico`],
        )
      ).rows[0]!.id;
      const nodePublicado = (
        await client.query<{ id: string }>(
          `insert into public.nodes (space_id, type, title, slug, position, status)
           values ($1, 'article', $2, $2, 'a0', 'published') returning id`,
          [spacePublico, `${PREFIXO}artigo-publicado`],
        )
      ).rows[0]!.id;
      await client.query(`insert into public.chunks (node_id, space_id, content) values ($1, $2, $3)`, [
        nodePublicado,
        spacePublico,
        `${PREFIXO}conteudo zzmarcadorportalpublico de artigo publicado em espaco publico`,
      ]);

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
      // A direção ABERTA, no MESMO papel e na mesma transação: o chunk do artigo
      // publicado em espaço público TEM de ser alcançável. `count` do id exato,
      // não do total da tabela — um total >0 poderia vir de outro espaço e não
      // provaria que a policy ainda deixa passar o caso do portal.
      const anonArtigoPublicado = Number(
        (
          await client.query<{ n: string }>(`select count(*)::text as n from public.chunks where node_id = $1`, [
            nodePublicado,
          ])
        ).rows[0]!.n,
      );
      await client.query("RESET ROLE");

      registra(
        casos,
        "anon não alcança nenhum chunk de arquivo (node_id nulo)",
        anonAlcancados === 0,
        `contagem alcançável por anon = ${anonAlcancados}`,
      );
      registra(
        casos,
        "anon ALCANÇA o chunk de artigo publicado em espaço público (sem isto, `using (false)` passaria e mataria o portal)",
        anonArtigoPublicado >= 1,
        `chunks do artigo público alcançáveis por anon = ${anonArtigoPublicado}`,
      );

      // ── 11. CAMPANHAS: a cerca entre clientes na ENTREGA e no PAINEL ──
      //
      // Projeto 3, tarefa 4. Sem esta seção, a cerca de campanha é revisão de
      // código e não banco: `alertas_para` e `registrar_visualizacao` são
      // `security definer`, então a RLS de `ai_campanhas` não vale para elas, e a
      // área do cliente escreve com `service_role`, que ignora policy de todo
      // jeito. O que separa um cliente do outro é o `base_id` dentro daquelas duas
      // funções mais o `base_id` das consultas do painel — e isso só se prova
      // rodando.
      //
      // Depois da seção 10 de propósito: o `RESET ROLE` acima já aconteceu, então
      // estas consultas voltam a rodar como o papel da conexão.
      const campanhaA = (
        await client.query<{ id: string }>(
          `insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em)
           values ($1, $2, $3, now() - interval '1 hour') returning id`,
          [baseA, `${PREFIXO}aviso-da-base-a`, "aviso do cliente A"],
        )
      ).rows[0]!.id;
      const campanhaB = (
        await client.query<{ id: string }>(
          `insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em)
           values ($1, $2, $3, now() - interval '1 hour') returning id`,
          [baseB, `${PREFIXO}aviso-da-base-b`, "aviso do cliente B"],
        )
      ).rows[0]!.id;

      /*
        TRÊS identidades, e a terceira não é luxo.

        `identA` e `identB` REGISTRAM visualização, cada uma na campanha do seu
        cliente. `identC` nunca viu nada, e é ela que faz as leituras de entrega,
        porque `ai_campanhas.repetir` nasce FALSO: depois de `identA` registrar a
        visualização, `alertas_para` PARA de devolver aquela campanha para ela. Com
        `identA` nas leituras, o controle positivo falharia pelo motivo certo e
        pareceria cerca quebrada.
      */
      const identA = { portal: "PG", usuario: `${PREFIXO}user-a`, matricula: "9001" };
      const identB = { portal: "PG", usuario: `${PREFIXO}user-b`, matricula: "9002" };
      const identC = { portal: "PG", usuario: `${PREFIXO}user-c`, matricula: "9003" };

      const registrarVisualizacao = async (
        campanha: string,
        codigo: string,
        identidade: Record<string, string>,
      ) =>
        (
          await client.query<{ ok: boolean }>(
            `select public.registrar_visualizacao($1, $2, $3::jsonb) as ok`,
            [campanha, codigo, JSON.stringify(identidade)],
          )
        ).rows[0]!.ok;

      const vistoA = await registrarVisualizacao(campanhaA, codigoBaseA, identA);
      const vistoB = await registrarVisualizacao(campanhaB, codigoBaseB, identB);
      // O PORTÃO DE ESCRITA: `p_campanha` vem do corpo da requisição, ou seja é
      // controlado por quem chama. Gravar visualização na campanha de outro
      // cliente tem de ser RECUSADO, senão o painel do dono mostra gente que
      // nunca viu o aviso dele. Capturado ANTES da sabotagem, que é sobre a
      // leitura.
      const portaoDeOutraBase = await registrarVisualizacao(campanhaB, codigoBaseA, identA);

      if (SABOTAR === "campanha") {
        // SABOTAGEM: anexa a campanha de teste B à base de teste A, que é o
        // cenário pedido pela tarefa 4. Some com o ROLLBACK do `finally`, como
        // todo o resto deste arquivo.
        await client.query(`update public.ai_campanhas set base_id = $1 where id = $2`, [
          baseA,
          campanhaB,
        ]);
        console.log("  [SABOTAGEM ATIVA] a campanha de teste B foi anexada à base de teste A\n");
      }

      /** Os alertas que esta identidade recebe nesta base, pela função de verdade. */
      const alertasDe = async (codigo: string, identidade: Record<string, string>) =>
        (
          await client.query<{ id: string }>(`select id from public.alertas_para($1, $2::jsonb)`, [
            codigo,
            JSON.stringify(identidade),
          ])
        ).rows.map((r) => r.id);

      const alertasA = await alertasDe(codigoBaseA, identC);
      const alertasB = await alertasDe(codigoBaseB, identC);

      registra(
        casos,
        "alerta da base B NÃO aparece para a base A",
        !alertasA.includes(campanhaB),
        `alertas(A) = [${alertasA.join(", ") || "vazio"}]`,
      );
      // As duas positivas, sem as quais a negativa acima passaria com
      // `alertas_para` devolvendo lista vazia por qualquer motivo (janela, regra,
      // filtro de repetição). Negativa sozinha não prova cerca, prova ausência.
      registra(
        casos,
        "alerta da base A aparece na PRÓPRIA base A (a negativa acima não passa por lista vazia)",
        alertasA.includes(campanhaA),
        `alertas(A) = [${alertasA.join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "alerta da base B aparece na PRÓPRIA base B",
        alertasB.includes(campanhaB),
        `alertas(B) = [${alertasB.join(", ") || "vazio"}]`,
      );

      /*
        O PAINEL de um cliente, exatamente como a tela o monta: as visualizações
        das campanhas DAQUELA base. A tela faz isso em dois passos (lista as
        campanhas por `base_id`, depois conta e lista as visualizações por
        `campanha_id`); aqui a junção é uma consulta só, e o que ela prova é o
        mesmo — nenhuma visualização atravessa de um cliente para o outro.
      */
      const campanhasNoPainelDe = async (base: string) =>
        new Set(
          (
            await client.query<{ campanha_id: string }>(
              `select v.campanha_id
                 from public.ai_campanha_visualizacoes v
                 join public.ai_campanhas c on c.id = v.campanha_id
                where c.base_id = $1
                order by v.campanha_id`,
              [base],
            )
          ).rows.map((r) => r.campanha_id),
        );

      const painelA = await campanhasNoPainelDe(baseA);
      const painelB = await campanhasNoPainelDe(baseB);

      registra(
        casos,
        "as duas visualizações de teste foram aceitas, e o portão RECUSOU a campanha de outra base",
        vistoA && vistoB && !portaoDeOutraBase,
        `visualização em A = ${vistoA} · em B = ${vistoB} · campanha de B gravada pela base A = ${portaoDeOutraBase}`,
      );
      registra(
        casos,
        "visualização da base B NÃO aparece no painel da base A",
        !painelA.has(campanhaB),
        `painel(A) = [${[...painelA].join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "visualização da base A NÃO aparece no painel da base B",
        !painelB.has(campanhaA),
        `painel(B) = [${[...painelB].join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "painel da base A contém a visualização da PRÓPRIA campanha (a negativa acima não passa por painel vazio)",
        painelA.has(campanhaA),
        `painel(A) = [${[...painelA].join(", ") || "vazio"}]`,
      );
      registra(
        casos,
        "painel da base B contém a visualização da PRÓPRIA campanha",
        painelB.has(campanhaB),
        `painel(B) = [${[...painelB].join(", ") || "vazio"}]`,
      );

      // ── 12. ONTOLOGIA POR BASE: o jargão de um cliente não expande a
      //        consulta de outro, nem a de quem lê sem base ─────────────────
      //
      // A superfície nova da tarefa 9b: `ontology_terms` ganhou `base_id`, e o
      // vocabulário que um arquivo do cliente ensina passou a EXPANDIR as
      // consultas daquele cliente. Os termos que uma empresa usa dizem o que ela
      // faz, então um termo cruzando para outro cliente é vazamento comercial —
      // e nada disso tinha cobertura contra o banco real.
      //
      // ── O QUE ESTA SEÇÃO PROVA, E O QUE ELA NÃO PROVA ──────────────────────
      // Prova: com os MESMOS espaços e o MESMO idioma (o caso comum, porque os
      // clientes compartilham a documentação global), o termo da base A não entra
      // na expansão do turno da base B nem na do turno SEM base, e o termo do
      // espaço entra nos três (o controle positivo, sem o qual um carregador que
      // devolvesse lista vazia passaria por aqui).
      //
      // NÃO prova que as consultas do PostgREST em `carregarOntologia` são estas:
      // tudo aqui roda dentro da transação que sempre reverte, e o cliente
      // PostgREST — que entra por outra conexão — não vê linha não confirmada.
      // Então o PREDICADO DE DONO está escrito uma vez, abaixo, em SQL, com a
      // mesma forma que aquele arquivo usa (`space_id in (...)` de um lado,
      // `base_id = ...` do outro); a EXPANSÃO em si é a função de produção,
      // importada, sem cópia. O piso de vocabulário de RH fica de fora de
      // propósito: ele não tem dono e não muda nada do que se afirma aqui.
      const termoDoEspaco = `${PREFIXO}termo-do-espaco-a`;
      const termoDaBase = `${PREFIXO}jargao-so-da-base-a`;
      const apelidoDaBase = `${PREFIXO}apelido-so-da-base-a`;

      const termoEspacoId = (
        await client.query<{ id: string }>(
          `insert into public.ontology_terms (space_id, term, term_norm, kind, source)
           values ($1, $2, $3, 'conceito', 'manual') returning id`,
          [spaceA, termoDoEspaco, normalizarTermo(termoDoEspaco)],
        )
      ).rows[0]!.id;
      const termoBaseId = (
        await client.query<{ id: string }>(
          `insert into public.ontology_terms (base_id, term, term_norm, kind, source)
           values ($1, $2, $3, 'conceito', 'manual') returning id`,
          [baseA, termoDaBase, normalizarTermo(termoDaBase)],
        )
      ).rows[0]!.id;
      // Um apelido em cada: o alias é alcançado pelo `term_id`, então ele herda o
      // dono do termo. Provar isso junto é de graça, e sem ele a cerca ficaria
      // afirmada só para a linha de `ontology_terms`.
      await client.query(
        `insert into public.ontology_aliases (term_id, alias, alias_norm, source) values ($1, $2, $3, 'manual')`,
        [termoBaseId, apelidoDaBase, normalizarTermo(apelidoDaBase)],
      );
      await client.query(
        `insert into public.ontology_aliases (term_id, alias, alias_norm, source) values ($1, $2, $3, 'manual')`,
        [termoEspacoId, `${PREFIXO}apelido-do-espaco-a`, normalizarTermo(`${PREFIXO}apelido-do-espaco-a`)],
      );

      /**
       * As entradas da ontologia de UM dono — o predicado, num lugar só.
       *
       * `coluna` é validada contra as duas únicas possibilidades antes de entrar
       * na consulta: é interpolação de identificador, e mesmo num script de
       * auditoria isso não vai para o SQL sem conferência.
       */
      const ontologiaDe = async (
        coluna: "space_id" | "base_id",
        valores: string[],
      ): Promise<EntradaOntologia[]> => {
        if (coluna !== "space_id" && coluna !== "base_id") throw new Error("coluna inválida");
        if (!valores.length) return [];
        const linhas = (
          await client.query<{ term: string; term_norm: string; apelidos: string[]; apelidos_norm: string[] }>(
            `select t.term,
                    t.term_norm,
                    coalesce(array_agg(a.alias) filter (where a.alias is not null), '{}') as apelidos,
                    coalesce(array_agg(a.alias_norm) filter (where a.alias_norm is not null), '{}') as apelidos_norm
               from public.ontology_terms t
               left join public.ontology_aliases a on a.term_id = t.id
              where t.${coluna} = any($1::uuid[])
              group by t.id, t.term, t.term_norm`,
            [valores],
          )
        ).rows;
        return linhas.map((l) => ({
          matchNorms: [l.term_norm, ...l.apelidos_norm],
          forms: [l.term, ...l.apelidos],
        }));
      };

      // A pergunta cita os DOIS vocabulários. Quem decide o que expande é o dono,
      // nunca a pergunta.
      const pergunta = `preciso de ajuda com ${termoDaBase} e com ${termoDoEspaco}`;
      /*
        A AGULHA É A FORMA ENTRE ASPAS, e não o termo cru.

        `expandirComOntologia` devolve `pergunta or "forma" or "forma"`, então a
        pergunta inteira está dentro do resultado — e a pergunta CITA o jargão da
        base A de propósito, para provar que quem decide é o dono e não o texto
        digitado. Procurar o termo cru acharia a própria pergunta e as duas
        negativas nunca poderiam passar. Aspas só aparecem no trecho EXPANDIDO.
      */
      const expandiu = (resultado: string, forma: string) => resultado.includes(`"${forma}"`);
      const doEspacoA = await ontologiaDe("space_id", [spaceA]);
      const daBaseA = await ontologiaDe("base_id", [baseA]);
      const daBaseB = await ontologiaDe("base_id", [baseB]);

      // Os três turnos, com os MESMOS espaços: o que muda é só o dono da segunda
      // lista. É exatamente a condição em que um cache com chave errada entregava
      // a lista de um ao outro.
      const turnoDaBaseA = expandirComOntologia(pergunta, [...doEspacoA, ...daBaseA]);
      const turnoDaBaseB = expandirComOntologia(pergunta, [...doEspacoA, ...daBaseB]);
      const turnoSemBase = expandirComOntologia(pergunta, doEspacoA);

      registra(
        casos,
        "termo da base A NÃO expande a consulta da base B",
        !expandiu(turnoDaBaseB, termoDaBase) && !expandiu(turnoDaBaseB, apelidoDaBase),
        `expansão(base B) = ${turnoDaBaseB}`,
      );
      registra(
        casos,
        "termo de base NÃO aparece na expansão de quem consulta SEM base (portal, Cmd+K)",
        !expandiu(turnoSemBase, termoDaBase) && !expandiu(turnoSemBase, apelidoDaBase),
        `expansão(sem base) = ${turnoSemBase}`,
      );
      registra(
        casos,
        "a base A recebe o PRÓPRIO jargão, e o apelido dele (sem isto, as negativas passariam por expansão vazia)",
        expandiu(turnoDaBaseA, termoDaBase) && expandiu(turnoDaBaseA, apelidoDaBase),
        `expansão(base A) = ${turnoDaBaseA}`,
      );
      registra(
        casos,
        "o termo da DOCUMENTAÇÃO expande nos três turnos (o global não é rebaixado por ter base, nem perdido por não ter)",
        [turnoDaBaseA, turnoDaBaseB, turnoSemBase].every((x) => expandiu(x, termoDoEspaco)),
        `base A / base B / sem base expandem com o termo do espaço: ${[turnoDaBaseA, turnoDaBaseB, turnoSemBase]
          .map((x) => (expandiu(x, termoDoEspaco) ? "sim" : "NÃO"))
          .join(" / ")}`,
      );

    } finally {
      await client.query("ROLLBACK");
    }

    // ── Prova de que nada sujou produção ────────────────────────────────
    // Fora de qualquer transação: se o rollback falhou silenciosamente por
    // algum motivo, isto pega. Conta por prefixo nas ONZE tabelas tocadas
    // (a quinta, `chunks`, entrou com a tarefa 7; a sexta,
    // `documentacoes_universais`, com a tarefa 9; a sétima, `nodes`, com o
    // artigo publicado do caso positivo do `anon`; a oitava e a nona,
    // `ai_campanhas` e `ai_campanha_visualizacoes`, com o projeto 3 — a
    // visualização é contada pelo `p_usuario` dela, e não pela junção com a
    // campanha, justamente para uma linha ÓRFÃ aparecer nesta conta; a décima e a
    // décima primeira, `ontology_terms` e `ontology_aliases`, com a seção 12 — o
    // alias é contado pelo texto DELE, e não pela junção com o termo, pela mesma
    // razão).
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
             (select count(*) from public.nodes where slug like $1) +
             (select count(*) from public.ai_campanhas where titulo like $1) +
             (select count(*) from public.ai_campanha_visualizacoes where p_usuario like $1) +
             (select count(*) from public.chunks where content like $1) +
             (select count(*) from public.ontology_terms where term like $1) +
             (select count(*) from public.ontology_aliases where alias like $1)
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
          ? "PASSOU — nenhuma base alcança a documentação da outra, a busca recusa documento de outra base mesmo pedido explicitamente, a regra por portal fecha a identidade errada na documentação E no arquivo, arquivo em extração não chega ao RAG, a sobreposição por base só ESTREITA (esconder e estreitar na base A não mexem na base B, e sobreposição aberta não alarga universal restrita), a cerca do anon segue de pé nas duas direções (fecha arquivo, abre artigo publicado), nenhum alerta ou visualização de campanha atravessa de um cliente para o outro (na entrega, no painel e na gravação), e o jargão de um cliente não expande a consulta de outro nem a de quem lê sem base"
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
