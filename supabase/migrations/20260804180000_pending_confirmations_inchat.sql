-- Confirmação IN-CHAT (não mais por e-mail): a pendência é liberada quando a ROTA
-- do chat detecta o "sim" do usuário e marca `confirmed_at`. Assim a IA não confirma
-- sozinha (o "sim" vem do usuário, capturado pelo servidor), sem depender de e-mail.
alter table public.ai_pending_confirmations
  add column if not exists confirmed_at timestamptz;

-- O código/e-mail deixou de ser usado; pendência in-chat não guarda hash.
alter table public.ai_pending_confirmations
  alter column code_hash drop not null;

-- Qual FERRAMENTA pediu a confirmação: a rota força essa tool de volta no turno do
-- "sim" (a pergunta crua "sim" não recupera a tool pelo classificador de assunto).
alter table public.ai_pending_confirmations
  add column if not exists tool_key text;
