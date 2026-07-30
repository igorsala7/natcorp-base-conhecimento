-- Nova finalidade de IA "query_rewrite" (Reescrita de busca) — modelo rápido no
-- caminho crítico do chat. Sem incluí-la no CHECK, salvar a atribuição falha com
-- "violates check constraint ai_assignments_purpose_check".

alter table ai_assignments
  drop constraint if exists ai_assignments_purpose_check;

alter table ai_assignments
  add constraint ai_assignments_purpose_check
  check (purpose in (
    'chat', 'query_rewrite', 'embedding',
    'import_structure', 'import_layout',
    'editor_text', 'editor_generate', 'transcricao'
  ));
