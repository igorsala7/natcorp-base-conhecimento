-- Publicação agendada (padrão HubSpot): publicar e despublicar em data/hora,
-- com destino de redirect ao despublicar — link compartilhado nunca quebra.
--
-- O EXECUTOR é o worker (pg-boss cron a cada minuto), que roda a MESMA lógica
-- de publicar das Server Actions (snapshot de versão + reindex de embeddings);
-- aqui só ficam as colunas e os índices parciais da varredura de vencidos.

alter table public.nodes
  add column publish_at timestamptz,
  add column unpublish_at timestamptz,
  add column unpublish_redirect_to uuid references public.nodes (id) on delete set null;

create index nodes_publish_due_idx on public.nodes (publish_at)
  where publish_at is not null;
create index nodes_unpublish_due_idx on public.nodes (unpublish_at)
  where unpublish_at is not null;
