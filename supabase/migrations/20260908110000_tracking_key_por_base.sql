-- =====================================================================
-- CHAVE DE RASTREIO POR BASE — fecha a brecha que deixa um cliente se
-- passar por outro
--
-- ── O problema, medido em 08/09/2026 ────────────────────────────────────
--
-- `space_tracking_keys` guarda UMA chave por ESPAÇO. Os três espaços que têm
-- chave hoje (`natcorp` = Operador, `painel-do-gestor`, `painel-do-colaborador`)
-- estão ligados às MESMAS 14 bases. Ou seja: uma única chave assina os tokens de
-- todos os clientes de um painel.
--
-- Essa chave não vive só no nosso servidor. Ela é a constante `c_key` do bloco
-- PL/SQL de `apex/token-rastreio.sql`, colada em texto puro dentro do APEX DE
-- CADA CLIENTE. E `resolve.ts` valida o token buscando a chave por `space_id`,
-- conferindo apenas HMAC e `exp` — NADA amarra o `p_base` do payload à chave.
--
-- Consequência: quem administra o APEX da Leadec lê o `c_key` da região dele e
-- emite `{"p_base":"natcorp", ...}`. O servidor aceita como identidade legítima.
--
-- No widget o estrago é contido por acidente: as ferramentas ainda batem no ERP
-- da outra base, com credenciais que essa pessoa não tem. Na área de gestão
-- (`/gestao`) não existe esse anteparo — consumo, fatura e o histórico de
-- conversas estão no NOSSO Postgres e sairiam direto.
--
-- ── A correção ─────────────────────────────────────────────────────────
--
-- Uma chave por (BASE, ESPAÇO). A validação inverte a ordem: lê o `p_base` do
-- payload SEM confiar nele, busca a chave DAQUELA base e só então confere o
-- HMAC. Um token da Leadec dizendo `natcorp` é verificado com a chave da
-- natcorp e não fecha a assinatura.
--
-- Isto NÃO quebra o widget: ele segue em `space_tracking_keys` até ser migrado.
-- As duas tabelas convivem de propósito — migrar o widget exige trocar o
-- `c_key` em todos os APEX, e é decisão à parte.
--
-- Mesma proteção das outras chaves (`ai_provider_keys`, `space_tracking_keys`):
-- TABELA ISOLADA, sem grant para anon/authenticated. Só service-role lê/escreve.
-- Se esta chave vazar pelo cliente público, forjar token vira trivial.
-- =====================================================================

create table if not exists public.ai_base_tracking_keys (
  base_id  uuid not null references public.ai_bases (id) on delete cascade,
  space_id uuid not null references public.spaces (id)   on delete cascade,
  key_enc text not null,               -- chave (32 bytes base64) cifrada em repouso
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (base_id, space_id)
);

comment on table public.ai_base_tracking_keys is
  'Chave de rastreio por (base, espaço). Diferente de space_tracking_keys, que é por espaço e portanto COMPARTILHADA entre todas as bases do painel — o que permite um cliente assinar token com o p_base de outro. A área /gestao valida por aqui: busca a chave da base declarada no payload e só então confere o HMAC.';
comment on column public.ai_base_tracking_keys.key_enc is
  'Chave AES/HMAC (32 bytes em base64) cifrada por src/lib/crypto/secrets.ts. É o valor que vai na constante c_key do bloco PL/SQL do APEX daquele cliente — e SÓ daquele.';

-- Busca é sempre por (espaço, base) na validação de token.
create index if not exists ai_base_tracking_keys_space_idx
  on public.ai_base_tracking_keys (space_id);

alter table public.ai_base_tracking_keys enable row level security;

-- Nenhuma policy e nenhum grant: inalcançável por SQL comum, como
-- space_tracking_keys. A escrita passa por server action com checagem de
-- permissão (integrations.manage) + service-role.
revoke all on public.ai_base_tracking_keys from anon, authenticated;
