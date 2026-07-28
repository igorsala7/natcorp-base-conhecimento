-- Fase 5.2 — ao finalizar uma sessão, a captura vira um artigo RASCUNHO.
-- Guarda o nó criado para o admin conseguir abrir o rascunho a partir da sessão.
alter table public.extension_sessions
  add column node_id uuid references public.nodes (id) on delete set null;
