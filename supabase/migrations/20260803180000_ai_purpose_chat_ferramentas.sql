-- Nova finalidade de IA "chat_ferramentas" (Chat com ferramentas — turnos agênticos que
-- chamam integrações/consultas a sistemas). Permite atribuir um modelo FORTE só a esses
-- turnos, mantendo o Chat simples num modelo barato/rápido. Adicionada ao catálogo
-- (catalog.ts); recria a CHECK constraint de ai_assignments com a lista COMPLETA para o
-- salvamento da atribuição não falhar com "violates check constraint ai_assignments_purpose_check".
alter table public.ai_assignments
  drop constraint if exists ai_assignments_purpose_check;

alter table public.ai_assignments
  add constraint ai_assignments_purpose_check
  check (purpose in (
    'chat', 'chat_ferramentas', 'report_analysis', 'query_rewrite', 'embedding',
    'import_structure', 'import_layout', 'editor_text', 'editor_generate', 'transcricao'
  ));
