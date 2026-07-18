-- A ordenação fracionária (fractional-indexing) assume ordem lexicográfica por
-- BYTES (onde 'Z' < 'a'). A collation padrão do banco é locale-aware e ordena
-- diferente, quebrando a ordem dos irmãos. Forçamos a coluna position para a
-- collation "C" (ordem de bytes) — assim ORDER BY position bate com a lib.
alter table public.nodes
  alter column position type text collate "C";

-- Recria o índice para usar a mesma ordenação.
drop index if exists public.nodes_space_pos_idx;
create index nodes_space_pos_idx
  on public.nodes (space_id, parent_id, position collate "C");
