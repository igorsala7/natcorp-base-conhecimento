-- Em quais PAINÉIS o widget aparece nesta base.
--
-- Até aqui a única chave era `widget_keys.active`, que é por PAINEL e vale para
-- TODOS os clientes: desligar o widget do painel do colaborador o desligaria em
-- todas as bases de uma vez. E `ai_bases.active` é o oposto — desliga a base
-- inteira, inclusive as integrações.
--
-- Faltava o cruzamento, que é como a coisa é decidida na prática: "o cliente X
-- ainda não liberou o widget para os colaboradores, mas os gestores já usam".
--
-- NULL = todos os painéis (é o comportamento de sempre, e é o que toda base
-- existente tem). Lista vazia = nenhum. Sem isso, a migration precisaria
-- adivinhar a intenção de cada base já cadastrada.
alter table public.ai_bases
  add column if not exists widget_paineis text[];

comment on column public.ai_bases.widget_paineis is
  'Painéis (PO/PG/PC) em que o widget aparece nesta base. NULL = todos; {} = nenhum.';
