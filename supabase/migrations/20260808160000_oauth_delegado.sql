-- =====================================================================
-- OAUTH DELEGADO — a credencial que age COMO O USUÁRIO
--
-- O `oauth2` que existe hoje é `client_credentials`: um token por credencial,
-- compartilhado por todos os usuários da base (está fixo em lib/integrations/
-- oauth.ts). Serve para uma API institucional — o ORDS do NATCORP responde a
-- mesma coisa independentemente de quem perguntou, e o recorte por pessoa vem
-- do parâmetro `matricula`.
--
-- Não serve para o Microsoft Graph. `/me/messages` devolve a caixa de entrada
-- de QUEM AUTENTICOU; não existe parâmetro que faça um token de aplicativo
-- responder "os e-mails do Fulano". Ou o token é da pessoa, ou a resposta é de
-- outra pessoa. Daí `oauth2_user`: `authorization_code` + `refresh_token` por
-- usuário, com consentimento individual.
--
-- Os dois convivem, de propósito: o institucional continua atendendo o que é
-- da empresa (calendário de serviço, caixa no-reply, SharePoint compartilhado)
-- e o delegado atende o que é da pessoa.
--
-- ── Onde mora o quê ─────────────────────────────────────────────────────
-- A configuração do fluxo (authorize_url, token_url, client_id, client_secret,
-- scopes, tenant) fica no JSON cifrado de `ai_base_credential_secrets`, junto
-- com o resto — mesma tabela isolada, mesmas garantias. Só `provider` sobe para
-- os metadados, porque a TELA precisa saber se desenha "Conectar Microsoft" ou
-- "Conectar Google" sem decifrar segredo nenhum para isso.
--
-- `tenant` é campo do JSON e não constante no código por um motivo concreto: um
-- registro single-tenant só aceita usuários do próprio locatário. Se as
-- empresas clientes tiverem tenants próprios, o valor tem de virar `common` sem
-- deploy.
-- =====================================================================

alter table public.ai_base_credentials
  drop constraint if exists ai_base_credentials_auth_type_check;
alter table public.ai_base_credentials
  add constraint ai_base_credentials_auth_type_check
  check (auth_type in ('none', 'basic', 'api_key', 'bearer', 'oauth2', 'oauth2_user'));

alter table public.ai_base_credentials
  add column if not exists provider text;

alter table public.ai_base_credentials
  drop constraint if exists ai_base_credentials_provider_check;
alter table public.ai_base_credentials
  add constraint ai_base_credentials_provider_check
  check (provider is null or provider in ('microsoft', 'google'));

comment on column public.ai_base_credentials.provider is
  'Só para auth_type = oauth2_user: qual suíte, para a tela desenhar o botão certo e o fluxo saber montar a URL de consentimento. O resto da configuração (client_id, secret, scopes, tenant) fica no JSON cifrado em ai_base_credential_secrets.';

-- Uma credencial delegada tem de dizer de quem ela é.
alter table public.ai_base_credentials
  drop constraint if exists ai_base_credentials_provider_exigido;
alter table public.ai_base_credentials
  add constraint ai_base_credentials_provider_exigido
  check (auth_type <> 'oauth2_user' or provider is not null);
