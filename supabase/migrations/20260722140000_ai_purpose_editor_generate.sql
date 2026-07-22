-- Nova finalidade de IA: "editor_generate" — o wizard "Artigo com IA"
-- (tema → outline editável → corpo seção a seção) e o remix (FAQ/TL;DR).
-- Separada de editor_text: gerar conteúdo NOVO é outra política de custo e
-- de modelo que retocar um trecho existente.
alter table public.ai_assignments
  drop constraint if exists ai_assignments_purpose_check;

alter table public.ai_assignments
  add constraint ai_assignments_purpose_check
  check (purpose in ('chat', 'embedding', 'import_structure', 'import_layout', 'editor_text', 'editor_generate'));
