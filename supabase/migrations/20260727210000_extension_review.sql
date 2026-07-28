-- Fase 5.5 — revisão dos eventos capturados antes de virar rascunho + preview
-- ao vivo. `discarded` deixa o autor descartar prints/trechos; o finalize pula
-- os descartados. Realtime: a página de revisão vê os eventos chegando ao vivo.
alter table public.extension_events
  add column discarded boolean not null default false;

alter table public.extension_events replica identity full;
alter publication supabase_realtime add table public.extension_events;
