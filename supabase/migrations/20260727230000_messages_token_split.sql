-- Consumo de tokens por mensagem, separado em ENTRADA (prompt) e SAÍDA
-- (resposta). Até aqui só havia `tokens` (total) na resposta do assistente; a
-- tela de conversas passa a mostrar entrada/saída por turno.
alter table public.messages
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer;

comment on column public.messages.input_tokens is 'Tokens de ENTRADA (prompt) do turno que gerou esta resposta.';
comment on column public.messages.output_tokens is 'Tokens de SAÍDA (resposta) gerados pelo modelo.';
