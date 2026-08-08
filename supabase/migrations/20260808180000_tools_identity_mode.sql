-- =====================================================================
-- IDENTIDADE EXIGIDA PELA FERRAMENTA
--
-- `/me/messages` do Graph devolve a caixa de quem autenticou. Uma tool assim
-- não pode rodar com o token institucional da base: rodaria, responderia, e
-- devolveria a caixa da conta de serviço como se fosse a do usuário — erro
-- silencioso e do pior tipo, porque a resposta parece certa.
--
-- `identity_mode = 'user'` diz que a tool só executa com o token PESSOAL de
-- quem perguntou. Sem conexão, o executor recusa com um pedido de conexão em
-- vez de tentar com o que tiver à mão.
--
-- Padrão `'service'`: as 100+ tools que já existem continuam idênticas.
-- =====================================================================

alter table public.ai_tools
  add column if not exists identity_mode text not null default 'service';

alter table public.ai_tools
  drop constraint if exists ai_tools_identity_mode_check;
alter table public.ai_tools
  add constraint ai_tools_identity_mode_check
  check (identity_mode in ('service', 'user'));

comment on column public.ai_tools.identity_mode is
  'service = usa a credencial da base (comportamento de sempre). user = exige o token pessoal de quem perguntou (Graph /me/*, Gmail, Drive pessoal); sem conexão, o executor recusa pedindo para conectar em vez de responder com a conta errada.';
