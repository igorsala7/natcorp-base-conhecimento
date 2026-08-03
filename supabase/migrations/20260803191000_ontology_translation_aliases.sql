-- Ajuste do modelo de tradução da ontologia: a IA traduz os sinônimos como uma LISTA
-- por termo (não casados 1:1 com cada alias PT). Guardar os aliases traduzidos num jsonb
-- em ontology_translations é mais simples e cobre a busca (carregarOntologia lê a lista e
-- normaliza na leitura). A tabela ontology_alias_translations (por alias_id) sai — sem uso.
alter table public.ontology_translations
  add column if not exists aliases jsonb not null default '[]'::jsonb;

drop table if exists public.ontology_alias_translations;
