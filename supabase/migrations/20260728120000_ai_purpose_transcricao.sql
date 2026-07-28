-- Finalidade de IA "transcricao" (Transcrição de voz — Whisper na extensão) foi
-- adicionada ao catálogo (catalog.ts) mas a CHECK constraint de ai_assignments
-- não acompanhou — salvar a atribuição de transcrição falhava com
-- "violates check constraint ai_assignments_purpose_check". Inclui a finalidade.
alter table public.ai_assignments
  drop constraint if exists ai_assignments_purpose_check;

alter table public.ai_assignments
  add constraint ai_assignments_purpose_check
  check (purpose in (
    'chat', 'embedding', 'import_structure', 'import_layout',
    'editor_text', 'editor_generate', 'transcricao'
  ));
