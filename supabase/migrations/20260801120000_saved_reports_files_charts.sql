-- Estende widget_saved_reports para guardar também ARQUIVOS gerados (xlsx/pptx/
-- docx/pdf/csv…) e GRÁFICOS, no mesmo lugar dos relatórios salvos.
--   kind='report' → columns/rows/total (planilha) — comportamento atual
--   kind='file'   → file_name/mime/content(base64 do corpo do data URL)
--   kind='chart'  → chart(spec jsonb) (+ columns/rows opcionais p/ CSV)

alter table widget_saved_reports
  add column if not exists kind      text not null default 'report',
  add column if not exists file_name text,
  add column if not exists mime      text,
  add column if not exists content   text,   -- base64 (corpo do data URL) para arquivos
  add column if not exists chart     jsonb;   -- spec do gráfico
