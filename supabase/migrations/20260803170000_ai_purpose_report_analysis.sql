-- Finalidade de IA "report_analysis" (Análise de relatório — modelo/provedor próprio
-- usado na análise pura do relatório da tela) foi adicionada ao catálogo (catalog.ts),
-- mas a CHECK constraint de ai_assignments não acompanhou — salvar a atribuição falhava
-- com "violates check constraint ai_assignments_purpose_check". Recria o constraint com
-- a lista COMPLETA do PURPOSES.
--
-- Inclui também "query_rewrite": está no catálogo como atribuível ("Reescrita de busca")
-- mas nunca entrou no constraint — mesmo bug latente. Alinhar tudo de uma vez.
alter table public.ai_assignments
  drop constraint if exists ai_assignments_purpose_check;

alter table public.ai_assignments
  add constraint ai_assignments_purpose_check
  check (purpose in (
    'chat', 'report_analysis', 'query_rewrite', 'embedding',
    'import_structure', 'import_layout', 'editor_text', 'editor_generate', 'transcricao'
  ));
