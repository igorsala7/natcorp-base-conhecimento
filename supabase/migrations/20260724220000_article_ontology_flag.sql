-- =====================================================================
-- Marca quando um artigo foi VARRIDO pela ontologia (para a bolinha na árvore
-- do admin, ao lado de publicado/embedding). Preenchido pelo worker ao final de
-- uma varredura, para os nós do escopo. Só um carimbo de tempo — sem RLS nova
-- (a policy de `articles` já cobre).
-- =====================================================================
alter table public.articles add column ontology_at timestamptz;
