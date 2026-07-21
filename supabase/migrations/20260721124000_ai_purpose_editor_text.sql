-- Nova finalidade de IA: "editor_text" — o assistente de escrita do editor
-- (reescrever/expandir/resumir/mudar tom, sempre com revisão e aceite).
-- Separada de import_layout de propósito: são políticas diferentes (uma
-- reformata sem tocar no texto; a outra propõe texto novo ao autor).
alter table public.ai_assignments
  drop constraint if exists ai_assignments_purpose_check;

alter table public.ai_assignments
  add constraint ai_assignments_purpose_check
  check (purpose in ('chat', 'embedding', 'import_structure', 'import_layout', 'editor_text'));
