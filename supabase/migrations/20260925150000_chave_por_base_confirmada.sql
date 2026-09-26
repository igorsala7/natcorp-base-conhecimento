-- =====================================================================
-- A CATRACA: `confirmada_em` decide se aquele cliente AINDA pode assinar
-- com a chave compartilhada do espaço
--
-- ── O que esta coluna decide ───────────────────────────────────────────
--
-- Ela não guarda "quando a chave foi criada" (isso é `updated_at`). Ela
-- guarda UMA decisão, por (base, espaço), lida em todo turno por
-- `src/lib/tracking/resolve.ts`:
--
--   nulo         → aquele cliente ainda não recolou o bloco do APEX com a
--                  chave PRÓPRIA. Um token que não fecha com a chave da base
--                  pode cair no caminho legado e ser verificado com a chave
--                  do ESPAÇO, como sempre foi. É a transição.
--
--   preenchida   → aquele cliente JÁ PROVOU ter a chave própria (um token
--                  dele fechou com ela). A partir daí, token que não fecha
--                  com a chave da base é RECUSADO — nunca mais cai na chave
--                  do espaço. Aceitar a compartilhada depois disso reabriria,
--                  só para ele, exatamente o furo que a inversão fecha.
--
-- ── Por que uma catraca, e não uma data de corte ───────────────────────
--
-- A chave do espaço é UMA para todos os clientes daquele painel e mora em
-- texto puro na constante `c_key` do bloco PL/SQL dentro do APEX de cada
-- cliente (`apex/token-rastreio.sql`). Quem administra o APEX de um cliente
-- podia assinar `{"p_base":"<outro cliente>"}` e o servidor aceitava, porque
-- nada amarrava o `p_base` do payload à chave.
--
-- Fechar isso de uma vez exigiria recolar o bloco em TODOS os clientes no
-- mesmo instante, ou manter à mão uma lista de quem já migrou. A catraca
-- dispensa as duas coisas: cada cliente fecha SOZINHO no momento em que o
-- bloco dele é recolado, e nunca mais volta atrás. Migração um cliente por
-- vez, sem derrubar ninguém e sem lista para envelhecer.
--
-- ── Custo em produção ──────────────────────────────────────────────────
--
-- 14 linhas na tabela, todas com a coluna nula na aplicação. Coluna anulável
-- e sem default: `add column` não reescreve a tabela. Nenhum cliente muda de
-- comportamento por aplicar isto — o que muda comportamento é o código que
-- lê a coluna, e ele trata nulo exatamente como o produto se comporta hoje.
--
-- ── Sem default, de propósito ──────────────────────────────────────────
--
-- `default now()` faria toda linha existente nascer "confirmada" e RECUSARIA
-- na hora os 14 clientes, que é o oposto da catraca. Nulo é "não sei ainda",
-- e nulo não é zero.
-- =====================================================================

alter table public.ai_base_tracking_keys
  add column if not exists confirmada_em timestamptz;

comment on column public.ai_base_tracking_keys.confirmada_em is
  'CATRACA, não histórico: decide se esta base ainda pode ser verificada com a chave COMPARTILHADA do espaço (space_tracking_keys). Nulo = ainda não recolou o bloco do APEX com a chave própria, então o caminho legado segue valendo para ela. Preenchida = um token dela já fechou com a chave da base, e a partir daí token que não fecha com a chave da base é RECUSADO (aceitar a do espaço depois disso reabriria o furo de um cliente assinar como outro). Gravada uma única vez, na primeira verificação bem-sucedida, por src/lib/tracking/resolve.ts. Quando a chave foi criada/rotacionada é updated_at.';

-- Restatado de propósito: o arquivo tem de ser auto-suficiente e re-rodável
-- (não há ledger). A tabela nasceu sem policy e sem grant em 20260908110000 —
-- só service-role lê e escreve. Coluna nova não concede nada, mas se este
-- arquivo for aplicado sozinho num banco restaurado, o revoke tem de estar
-- aqui. `public` inclui `anon`, então revogar só de `anon` seria no-op.
revoke all on public.ai_base_tracking_keys from public, anon, authenticated;

-- =====================================================================
-- ASSERTIVAS — de FORMA, e é o que se pode afirmar sendo re-rodável
--
-- A tentação era afirmar "nenhuma linha está confirmada", porque é verdade
-- na primeira aplicação. Seria uma armadilha: na segunda vez, depois de
-- clientes terem recolado o bloco, a mesma assertiva falharia e reverteria a
-- transação de uma migration que não tinha nada de errado. O que se afirma
-- aqui é o que não pode mudar: a coluna existe, é timestamptz, é anulável e
-- NÃO tem default — as três propriedades que fazem a catraca começar aberta.
-- =====================================================================
do $$
declare
  v_tipo    text;
  v_nulavel text;
  v_default text;
begin
  select data_type, is_nullable, column_default
    into v_tipo, v_nulavel, v_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'ai_base_tracking_keys'
     and column_name  = 'confirmada_em';

  assert v_tipo is not null,
    'assertiva 1: a coluna confirmada_em deveria existir depois do add column, e nao existe';
  assert v_tipo = 'timestamp with time zone',
    format('assertiva 1: confirmada_em deveria ser timestamptz, veio %s', v_tipo);
  raise notice 'assertiva 1 OK — confirmada_em existe como timestamptz';

  assert v_nulavel = 'YES',
    'assertiva 2: confirmada_em precisa ser ANULAVEL — nulo e "ainda nao recolou o bloco", e sem isso a catraca nao tem estado inicial';
  raise notice 'assertiva 2 OK — confirmada_em e anulavel';

  assert v_default is null,
    format('assertiva 3: confirmada_em NAO pode ter default — um default faria toda linha existente nascer confirmada e recusaria os clientes na hora; veio %s', v_default);
  raise notice 'assertiva 3 OK — confirmada_em sem default, catraca comeca aberta';
end $$;
