-- =====================================================================
-- UM app da Azure para todo o sistema — e o isolamento onde ele existe de fato
--
-- Constatação do Igor (11/08/2026): no Azure há UM registro para esta
-- aplicação, com UMA URL de callback:
--
--   https://www.natcorpbr.com.br/natcorp/ia/api/v1/connect/microsoft/callback
--
-- E não podia ser diferente: `redirectUri()` sai de `NEXT_PUBLIC_SITE_URL`, que
-- não varia por cliente. Exigir uma credencial `oauth2_user` por base — como a
-- rodada anterior passou a fazer — era pedir um app por cliente que só poderia
-- registrar a MESMA URL. Isolamento de fachada: a segunda linha ou repete o
-- mesmo app, ou aponta para um registro que não tem a URL e nunca conecta.
--
-- ── O que muda ──────────────────────────────────────────────────────────
--
-- 1. `is_global`: uma credencial de conta pessoal pode valer para TODAS as
--    bases. A resolução vira "a da base; se não houver, a global" — e vale
--    igual no consentimento, no catálogo de ferramentas e na tela do widget
--    (foi a divergência entre esses caminhos que criou o defeito anterior).
--    A linha continua pendurada na base onde foi criada, e por isso continua
--    visível e editável na tela — credencial órfã (base_id nulo) sumiria do
--    admin.
--
-- 2. `oauth_states.base_id`: com credencial compartilhada, a base do cliente
--    não pode mais ser deduzida da credencial. Ela é fixada no início do
--    consentimento e é o que `user_connections.base_id` grava — o campo que o
--    corte de disponibilidade usa para achar a conexão.
--
-- 3. A chave da pessoa passa a incluir a BASE (ver `user-key.ts`). Numa
--    credencial compartilhada, `1:57292` da Stefanini e `1:57292` de outro
--    cliente são pessoas diferentes e colidiriam na mesma linha — a segunda a
--    conectar sobrescreveria a caixa da primeira.
--
-- O que NÃO muda: quem conectou o quê continua isolado por (credencial, base,
-- pessoa), e uma base só enxerga as conexões dela.
-- =====================================================================

alter table public.ai_base_credentials
  add column if not exists is_global boolean not null default false;

comment on column public.ai_base_credentials.is_global is
  'Credencial de conta pessoal (oauth2_user) que vale para TODAS as bases: existe um único app no provedor porque a URL de callback do sistema é única. A base ainda resolve a própria primeiro; esta é a reserva.';

-- Uma global por provedor: duas seriam uma escolha ambígua resolvida por
-- ordenação de linha, e o sintoma (metade dos clientes num app, metade no
-- outro) é do tipo que só aparece em produção.
create unique index if not exists ai_base_credentials_global_idx
  on public.ai_base_credentials (provider)
  where is_global and auth_type = 'oauth2_user' and active;

alter table public.oauth_states
  add column if not exists base_id uuid references public.ai_bases (id) on delete cascade;

comment on column public.oauth_states.base_id is
  'Base do CLIENTE que iniciou o consentimento. Com credencial global, a base não sai mais da credencial — e é ela que user_connections.base_id grava.';

-- Chaves da geração anterior (sem a base no prefixo) não casam com nenhuma
-- chave nova. As duas linhas existentes já estavam revogadas pela migration
-- 20260811210000; isto cobre qualquer conexão criada entre uma e outra.
update public.user_connections
   set revoked_at = now(), updated_at = now()
 where revoked_at is null
   and person_key not similar to '%:%:%';
