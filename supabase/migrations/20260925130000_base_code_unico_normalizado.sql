-- =====================================================================
-- O CÓDIGO DA BASE PASSA A SER ÚNICO JÁ NORMALIZADO
--
-- `ai_bases_base_code_key` é unique sobre o texto CRU: 'Natcorp',
-- 'natcorp' e 'natcorp ' são três valores distintos para ele, e podem
-- coexistir.
--
-- A cerca de base do banco (`20260925120000_busca_recusa_documento_de_
-- outra_base.sql`) resolve a base alvo por `lower(btrim(base_code))`, em
-- `hybrid_search_scoped` e em `knowledge_list_chunks`. `loadBaseContext`
-- faz o mesmo pelo lado da aplicação, por `ilike`. Ou seja: as duas
-- pontas comparam o código NORMALIZADO, e o banco só garantia unicidade
-- do código cru.
--
-- No dia em que duas bases diferissem apenas por caixa ou por espaço, as
-- duas pontas discordariam sobre qual é a base alvo — a cerca casaria as
-- DUAS (o `not exists` sobre `base_alvo` tolera várias linhas de
-- propósito, justamente para não levantar exceção nesse caso) enquanto a
-- aplicação resolveria UMA. O efeito seria o cliente A alcançando
-- documento do cliente B, sem erro em lugar nenhum. É a classe de
-- defeito que este projeto inteiro existe para fechar.
--
-- A alternativa era normalizar na aplicação, em todo ponto de escrita.
-- Decisão do dono em 25/09: impedir no BANCO. Medido antes de criar:
-- `group by lower(btrim(base_code)) having count(*) > 1` devolve vazio,
-- então o índice nasce sem conflito.
--
-- ── Por que NÃO `concurrently` ──────────────────────────────────────
-- `scripts/apply-migrations.ts` envolve o arquivo em `begin`/`commit`, e
-- `create index concurrently` não roda dentro de transação. A tabela tem
-- uma dezena de linhas: o lock exclusivo dura o que dura um `select`.
--
-- ── Por que índice e não constraint ────────────────────────────────
-- `alter table ... add constraint unique` não aceita expressão, só
-- coluna. Índice único sobre expressão é a forma que o Postgres oferece,
-- e ele é igualmente respeitado por `insert`/`update`.
-- =====================================================================

create unique index if not exists ai_bases_base_code_normalizado_key
  on public.ai_bases ((lower(btrim(base_code))));

comment on index public.ai_bases_base_code_normalizado_key is
  'Unicidade do base_code JÁ NORMALIZADO (lower+btrim). Existe porque a cerca de base de hybrid_search_scoped/knowledge_list_chunks (20260925120000) e o loadBaseContext da aplicação resolvem a base por lower(btrim(base_code)): duas bases que diferissem só por caixa ou espaço fariam a cerca casar as duas e a aplicação casar uma, e um cliente alcançaria documento de outro sem erro nenhum.';

-- ── Assertiva ───────────────────────────────────────────────────────
-- Prova que o índice EXISTE e que ele de fato RECUSA a colisão por
-- caixa. Afirmar só a existência em `pg_indexes` não provaria o
-- comportamento: um índice sobre a expressão errada também existiria.
--
-- Mesmo molde de limpeza da migration 120000: prefixo `zz-`, apaga antes
-- (defensivo, caso uma aplicação anterior tenha sido interrompida) e
-- depois.
do $$
declare
  v_existe boolean;
  v_recusou boolean;
begin
  select exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'ai_bases'
       and indexname = 'ai_bases_base_code_normalizado_key'
  ) into v_existe;
  assert v_existe, 'ai_bases_base_code_normalizado_key deveria existir depois desta migration';

  delete from public.ai_bases where lower(base_code) like 'zz-idx-assert-%';

  insert into public.ai_bases (base_code, name)
    values ('zz-idx-assert-base', 'zz-idx-assert-base');

  -- Subtransação: sem o bloco interno, a violação abortaria o bloco
  -- anônimo inteiro em vez de ser observada. Difere da primeira só por
  -- CAIXA, que é o caso que o unique antigo deixava passar.
  --
  -- (Aqui não se escreve o par de dólares nem dentro de comentário: o
  -- dollar quoting é LEXICAL e ignora comentário, então mencioná-lo
  -- fecharia o corpo no meio. Custou uma aplicação recusada com "syntax
  -- error at or near backtick", que não aponta para nada parecido.)
  begin
    insert into public.ai_bases (base_code, name)
      values ('ZZ-IDX-ASSERT-BASE', 'zz-idx-assert-base-2');
    v_recusou := false;
  exception when unique_violation then
    v_recusou := true;
  end;
  assert v_recusou,
    'duas bases diferindo apenas por caixa deveriam colidir no índice normalizado, e a segunda foi aceita';

  -- E por ESPAÇO, que o unique antigo também deixava passar.
  begin
    insert into public.ai_bases (base_code, name)
      values ('  zz-idx-assert-base  ', 'zz-idx-assert-base-3');
    v_recusou := false;
  exception when unique_violation then
    v_recusou := true;
  end;
  assert v_recusou,
    'duas bases diferindo apenas por espaço nas pontas deveriam colidir no índice normalizado, e a segunda foi aceita';

  delete from public.ai_bases where lower(btrim(base_code)) like 'zz-idx-assert-%';
end $$;
