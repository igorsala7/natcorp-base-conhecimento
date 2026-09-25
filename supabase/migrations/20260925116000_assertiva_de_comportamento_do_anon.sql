-- =====================================================================
-- A ASSERTIVA DA 20260925110000 TESTAVA TEXTO, NÃO COMPORTAMENTO
--
-- A assertiva original:
--
--   assert (select count(*) from pg_policies
--            where schemaname='public' and tablename='chunks'
--              and policyname='chunks_public_read'
--              and qual like '%node_id%') = 1, '...';
--
-- ...verifica se a PALAVRA `node_id` aparece no texto da policy. Uma
-- reescrita como
--
--   using (n.id = chunks.node_id OR chunks.node_id IS NULL)
--
-- mantém a palavra `node_id` no `qual`, vaza TODO chunk de arquivo
-- (documentação e de base de cliente) para o portal público, e passa
-- pela assertiva antiga sem disparar. `qual like '%node_id%'` não sabe
-- distinguir "exige node_id" de "menciona node_id incidentalmente".
--
-- ── A correção: testar o INVARIANTE, não o texto que supostamente o
--    implementa ────────────────────────────────────────────────────
-- Em vez de inspecionar o SQL da policy, este arquivo assume de fato o
-- papel `anon` dentro da própria migration e conta quantos chunks sem
-- `node_id` esse papel alcança. Isso é o que importa para a garantia
-- ("arquivo nunca chega ao portal público"), e nenhuma reescrita de
-- policy que quebre a garantia passa por essa contagem, não importa
-- como o SQL da policy esteja escrito.
--
-- Verificado antes de escrever isto, com consulta só-leitura:
--   · `set local role anon` funciona normalmente dentro de um bloco
--     `do $$ ... $$` (PL/pgSQL repassa `SET`/`RESET` ao motor SQL); o
--     `current_user` dentro do bloco vira `anon` de fato.
--   · `anon` TEM grant de SELECT na tabela `chunks` — a contagem não
--     estoura `permission denied`, é filtrada pela RLS e devolve `0`
--     quando a cerca está de pé. Confirmado com a policy real (sem
--     sabotagem) e, num script descartável fora do repositório com
--     `begin`/`rollback` nunca aplicado, com a policy sabotada para
--     `(... OR chunks.node_id IS NULL)` — a assertiva abaixo DISPAROU
--     nesse teste, provando que ela pega a regressão que a antiga não
--     pegava.
--
-- `reset role` aparece nos dois caminhos (fim do bloco normal E no
-- `exception when others`): sem isso no caminho de erro, uma falha no
-- meio do bloco deixaria a transação com o papel trocado para `anon`
-- até o fim — e como `apply-migrations.ts` roda cada arquivo na sua
-- própria transação, isso vazaria para o `commit`/`rollback` seguinte
-- com o papel errado.
-- =====================================================================

do $$
declare v_n int;
begin
  set local role anon;
  select count(*) into v_n from public.chunks where node_id is null;
  reset role;
  assert v_n = 0,
    'anon alcancou chunk sem node_id: a cerca do portal publico caiu';
exception when others then
  reset role;
  raise;
end $$;
