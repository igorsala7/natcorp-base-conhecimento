-- Descrição curta de um nó, exibida nos cards de categoria da home pública
-- (como as bases da HubSpot/Intercom: título + uma linha do que há dentro).
-- O ícone já existia (`nodes.icon`); a descrição completa o par.
alter table public.nodes
  add column if not exists description text;

comment on column public.nodes.description is
  'Resumo de uma linha exibido nos cards da home pública do espaço.';
