-- =====================================================================
-- PROMPTS SUGERIDOS — o administrador escreve, o usuário só clica
--
-- Pedido do dono (23/09): muita gente tem dificuldade de formular a
-- pergunta. O administrador passa a cadastrar prompts prontos, que
-- aparecem no widget no MESMO lugar dos prompts que o próprio usuário
-- salvou, com elegibilidade por portal, perfil e usuário, e organizados
-- em categorias.
--
-- ── `base_code NULL` é o que faz "os dois" caberem numa tabela ──────
-- A decisão foi que a Natcorp cadastra um conjunto que vale para TODOS
-- os clientes e cada cliente acrescenta os seus. Em vez de duas tabelas
-- (que divergiriam em coluna, em regra de elegibilidade e em índice),
-- é a mesma, com:
--
--     base_code IS NULL  → global, escrito pela Natcorp, todo mundo vê
--     base_code = 'x'    → do cliente x, só ele vê e só ele edita
--
-- O widget mostra os dois juntos; a origem fica no próprio campo, então
-- a tela sabe o que pode oferecer para editar sem precisar de uma flag
-- paralela que alguém esqueceria de manter em sincronia.
--
-- ── Elegibilidade: allowlist com E, e vazio não restringe ───────────
-- Três dimensões (`portais`, `perfis`, `usuarios`), combinadas com E —
-- é o que o exemplo do dono pede: "apenas no portal do gestor PARA o
-- perfil FOLHA". Array vazio/NULL não restringe aquela dimensão.
--
-- É o MESMO mecanismo de `ai_base_tools.portais/perfis`, de propósito.
-- Um segundo jeito de dizer "quem pode ver" seria um segundo lugar para
-- procurar quando alguém não vê o que deveria.
--
-- Comparação sempre por `lower(btrim())` dos DOIS lados: `p_base` já
-- partiu cliente em dois neste banco por diferença de caixa
-- (`NATCORP`/`natcorp` somaram como clientes distintos), e portal/perfil
-- chegam do ERP sem garantia nenhuma de normalização.
--
-- ── GERAL não é linha ───────────────────────────────────────────────
-- Prompt sem categoria aparece sob "Geral". Se "Geral" fosse uma linha
-- em `prompt_categoria`, alguém poderia renomeá-la, desativá-la ou
-- apagá-la — e aí existiria prompt órfão de um rótulo que o código
-- assume existir. É rótulo da interface, não dado.
-- =====================================================================

create table if not exists public.prompt_sugerido (
  id uuid primary key default gen_random_uuid(),
  -- NULL = global da Natcorp; preenchido = do cliente.
  base_code text,
  label text not null,
  texto text not null,
  -- Allowlists. Vazio = não restringe aquela dimensão.
  portais text[] not null default '{}',
  perfis text[] not null default '{}',
  usuarios text[] not null default '{}',
  ativo boolean not null default true,
  ordem numeric not null default 0,
  -- Duas origens de autoria, e nenhuma serve para as duas: o admin da
  -- Natcorp é usuário do Supabase; o do cliente é login do ERP, que não
  -- existe em `auth.users`. Mesma solução de `ai_creditos_extra`.
  criado_por_id uuid references auth.users(id) on delete set null,
  criado_por_ref text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint prompt_sugerido_label_nao_vazio check (btrim(label) <> ''),
  constraint prompt_sugerido_texto_nao_vazio check (btrim(texto) <> '')
);

create index if not exists prompt_sugerido_base_idx
  on public.prompt_sugerido (lower(btrim(coalesce(base_code, ''))), ativo);

create table if not exists public.prompt_categoria (
  id uuid primary key default gen_random_uuid(),
  -- Mesma regra do prompt: NULL = global.
  base_code text,
  nome text not null,
  ordem numeric not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint prompt_categoria_nome_nao_vazio check (btrim(nome) <> '')
);

-- Nome único por escopo. `coalesce` porque NULL não colide com NULL em
-- índice único, e duas categorias globais "Financeiro" seriam duas
-- gavetas com o mesmo rótulo na mesma tela.
create unique index if not exists prompt_categoria_nome_uq
  on public.prompt_categoria (lower(btrim(coalesce(base_code, ''))), lower(btrim(nome)));

-- N:N — o dono pediu explicitamente que o mesmo prompt possa estar em
-- várias categorias.
create table if not exists public.prompt_sugerido_categoria (
  prompt_id uuid not null references public.prompt_sugerido(id) on delete cascade,
  categoria_id uuid not null references public.prompt_categoria(id) on delete cascade,
  primary key (prompt_id, categoria_id)
);

create index if not exists prompt_sugerido_categoria_cat_idx
  on public.prompt_sugerido_categoria (categoria_id);

-- Favorito do usuário. A decisão foi favoritar, não copiar: cópia vira
-- texto divergente que não acompanha correção do original. Aqui a fonte
-- da verdade continua sendo uma só, e o que é por pessoa é a ORDEM.
create table if not exists public.prompt_favorito (
  prompt_id uuid not null references public.prompt_sugerido(id) on delete cascade,
  p_base text not null,
  p_usuario text not null,
  criado_em timestamptz not null default now(),
  primary key (prompt_id, p_base, p_usuario)
);

create index if not exists prompt_favorito_usuario_idx
  on public.prompt_favorito (lower(btrim(p_base)), lower(btrim(p_usuario)));

alter table public.prompt_sugerido            enable row level security;
alter table public.prompt_categoria           enable row level security;
alter table public.prompt_sugerido_categoria  enable row level security;
alter table public.prompt_favorito            enable row level security;

-- Sem policy: estas tabelas são lidas pelo widget através de RPC
-- `security definer` (o visitante não é usuário do Supabase) e escritas
-- pelo admin com service-role. Ausência de policy é negação por
-- ausência, que é o padrão do projeto para o que não deve ter caminho
-- direto pelo PostgREST.
revoke all on public.prompt_sugerido           from anon, authenticated;
revoke all on public.prompt_categoria          from anon, authenticated;
revoke all on public.prompt_sugerido_categoria from anon, authenticated;
revoke all on public.prompt_favorito           from anon, authenticated;

comment on table public.prompt_sugerido is
  'Prompts prontos que o admin oferece ao usuário. base_code NULL = global da Natcorp; preenchido = do cliente. portais/perfis/usuarios são allowlist combinada com E; vazio não restringe.';
comment on table public.prompt_categoria is
  'Gavetas dos prompts sugeridos. "Geral" NÃO é linha aqui — é o rótulo de quem não tem categoria.';
comment on table public.prompt_favorito is
  'Favorito por usuário do ERP. Favoritar em vez de copiar mantém uma fonte de verdade só para o texto.';
