-- Importação de PLANILHA COM FLUXOGRAMAS: quando o usuário escolhe interpretar o xlsx
-- como fluxograma, o worker converte via LibreOffice (headless) e a IA (visão) lê ABA
-- POR ABA, redesenhando cada fluxo no bloco `flow` do editor + o passo a passo.
--   NULL   = importação normal (extração de texto/estrutura).
--   'pdf'   = converter para PDF e ler (PDF nativo p/ Anthropic/Google).
--   'image' = converter e rasterizar as páginas (imagens) — serve p/ qualquer modelo.
alter table public.import_jobs add column if not exists flow_render text;

alter table public.import_jobs drop constraint if exists import_jobs_flow_render_chk;
alter table public.import_jobs add constraint import_jobs_flow_render_chk
  check (flow_render is null or flow_render in ('pdf', 'image'));

comment on column public.import_jobs.flow_render is
  'NULL = import normal. pdf|image = interpretar como FLUXOGRAMA (LibreOffice + visão, aba por aba).';
