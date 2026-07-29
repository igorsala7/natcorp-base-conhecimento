-- Idempotência do webhook do WhatsApp: a Meta pode REENVIAR o mesmo evento
-- (retries). Guardamos o id de cada mensagem já processada e ignoramos repetições
-- — sem isto, o usuário receberia respostas duplicadas.
--
-- Tabela interna: só o servidor (service-role) escreve/lê. Sem grant para papéis
-- comuns.
create table public.whatsapp_events (
  message_id text primary key,
  created_at timestamptz not null default now()
);
create index whatsapp_events_created_idx on public.whatsapp_events (created_at);

alter table public.whatsapp_events enable row level security;
revoke all on public.whatsapp_events from anon, authenticated;
