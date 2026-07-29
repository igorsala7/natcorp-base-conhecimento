-- =====================================================================
-- Layout do MAPA VISUAL (aba Fluxo) por base: guarda a posição (x,y) de cada
-- nó arrastado no canvas editável, para o desenho persistir entre sessões.
-- jsonb no formato { "<node_key>": { "x": <num>, "y": <num> }, ... } onde
-- node_key é "agent:<id>" / "tool:<id>" / "base:<id>" / "ep:<...>".
-- =====================================================================
alter table public.ai_bases
  add column if not exists flow_layout jsonb;

comment on column public.ai_bases.flow_layout is
  'Posições (x,y) dos nós do mapa visual (aba Fluxo) desta base. NULL = layout automático.';
