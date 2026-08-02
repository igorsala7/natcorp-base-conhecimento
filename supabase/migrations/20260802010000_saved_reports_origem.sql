-- "Meus relatórios salvos": marca a ORIGEM do item para a listagem diferenciar um
-- arquivo ENVIADO pelo usuário (upload) de um GERADO pelo próprio widget.
alter table widget_saved_reports add column if not exists origem text;

comment on column widget_saved_reports.origem is
  'Origem do item salvo: "upload" (arquivo enviado pelo usuário) ou "gerado" (gerado pelo widget: relatório/tabela/gráfico/arquivo).';
