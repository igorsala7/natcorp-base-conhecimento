-- widget_keys ganham um TIPO: 'widget' (embutir o chat num site) ou 'api'
-- (acesso REST programático aos endpoints /api/v1/*). A AUTENTICAÇÃO é a mesma
-- para os dois (chave pk_ + allowlist de origem + rate limit + escopo); o tipo
-- só separa a gestão na tela do Chatbot (aba Widget vs aba API). Chaves
-- existentes viram 'widget' (o comportamento anterior).
alter table public.widget_keys
  add column if not exists kind text not null default 'widget';

alter table public.widget_keys
  drop constraint if exists widget_keys_kind_check;
alter table public.widget_keys
  add constraint widget_keys_kind_check check (kind in ('widget', 'api'));
