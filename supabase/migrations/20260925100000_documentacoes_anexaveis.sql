-- =====================================================================
-- DOCUMENTAÇÃO DEIXA DE SER A CASA DO CHATBOT E VIRA RECURSO ANEXÁVEL
--
-- Duas tabelas, com nomes diferentes DE PROPÓSITO.
--
-- A primeira versão do desenho pôs a allowlist só na tabela por base.
-- Não fechava: documentação universal não está anexada a base nenhuma,
-- então "esta documentação é só do portal do Gestor" não teria onde
-- existir, e a saída seria anexar as universais a todas as bases, o que
-- destrói o sentido de universal.
--
-- `documentacoes_universais` é o conjunto que toda base alcança sem
-- configuração, com a parametrização por portal e perfil morando aqui.
-- `ai_base_documentacoes` é o que é de um cliente e só dele.
--
-- E isto resolve de graça um segundo furo: existem quatro espaços
-- `global`, incluindo o manual da própria plataforma e a documentação de
-- um segmento. Se "universal" significasse `type = 'global'`, todo
-- cliente passaria a pesquisar os dois. Aqui universal é uma linha que
-- alguém escreveu, nunca efeito colateral do tipo do espaço.
--
-- ── Por que `regra jsonb` e não seis colunas de array ────────────────
-- O projeto 0 existiu para a regra de "quem alcança isto" ter um lugar
-- só, e `public.elegivel` recebe jsonb. Com colunas de array esta
-- tabela teria de converter a cada consulta ou reescrever a comparação,
-- e reescrever é o que o projeto 0 comprou o direito de não fazer.
-- `ai_base_tools` fica com arrays por decisão do dono; a fronteira está
-- documentada em src/lib/elegibilidade/dimensoes.ts.
-- =====================================================================

create table if not exists public.documentacoes_universais (
  space_id   uuid primary key references public.spaces(id) on delete cascade,
  enabled    boolean not null default true,
  regra      jsonb   not null default '{}'::jsonb,
  observacao text,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

comment on table public.documentacoes_universais is
  'Documentações que TODA base alcança sem configuração. `regra` é elegibilidade no formato do motor (public.elegivel); vazia não restringe. Ser universal é uma linha aqui, nunca o tipo do espaço.';
comment on column public.documentacoes_universais.regra is
  'Elegibilidade nas doze dimensões, formato de public.elegivel. Restrição por portal mora AQUI, e não na tabela por base, porque universal não está anexada a base nenhuma.';

create table if not exists public.ai_base_documentacoes (
  base_id    uuid not null references public.ai_bases(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  enabled    boolean not null default true,
  regra      jsonb   not null default '{}'::jsonb,
  observacao text,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  primary key (base_id, space_id)
);

comment on table public.ai_base_documentacoes is
  'Documentação de UM cliente. Acréscimo ao conjunto universal, nunca substituição: o RAG une os dois. `regra` é elegibilidade no formato de public.elegivel.';

-- A regra gravada precisa ser um OBJETO cujas chaves sejam dimensões
-- conhecidas e cujos valores sejam listas. Sem isto, `elegivel` faria o
-- que o projeto 0 mandou fazer com dado malformado — FECHAR — e o efeito
-- seria conteúdo que não alcança ninguém, sem erro em lugar nenhum.
-- Barrar na gravação é o que transforma isso em mensagem de tela.
create or replace function public.regra_valida(p jsonb)
returns boolean
language sql
immutable parallel safe
as $$
  select jsonb_typeof(coalesce(p, '{}'::jsonb)) = 'object'
     and not exists (
       select 1 from jsonb_each(coalesce(p, '{}'::jsonb)) r(dim, lista)
        where r.dim <> all (public.dimensoes_elegibilidade())
           or jsonb_typeof(r.lista) not in ('array', 'null')
     );
$$;

comment on function public.regra_valida(jsonb) is
  'A regra é objeto, só com chaves das doze dimensões e valores lista (ou null)? Guarda de GRAVAÇÃO: sem ela, uma regra malformada é aceita e public.elegivel a trata fechando, produzindo conteúdo que não alcança ninguém sem nenhum erro.';

alter table public.documentacoes_universais
  drop constraint if exists documentacoes_universais_regra_valida;
alter table public.documentacoes_universais
  add constraint documentacoes_universais_regra_valida check (public.regra_valida(regra));

alter table public.ai_base_documentacoes
  drop constraint if exists ai_base_documentacoes_regra_valida;
alter table public.ai_base_documentacoes
  add constraint ai_base_documentacoes_regra_valida check (public.regra_valida(regra));

-- ── RLS ─────────────────────────────────────────────────────────────
-- Tabela de configuração interna: quem administra IA lê e escreve, o
-- widget chega por service-role, e `anon` não tem nada aqui.
alter table public.documentacoes_universais enable row level security;
alter table public.ai_base_documentacoes   enable row level security;

drop policy if exists documentacoes_universais_admin on public.documentacoes_universais;
create policy documentacoes_universais_admin on public.documentacoes_universais
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

drop policy if exists ai_base_documentacoes_admin on public.ai_base_documentacoes;
create policy ai_base_documentacoes_admin on public.ai_base_documentacoes
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

revoke all on public.documentacoes_universais from anon, public;
revoke all on public.ai_base_documentacoes   from anon, public;

-- ── A resolução do escopo ───────────────────────────────────────────
-- Devolve as documentações que ESTA identidade alcança nesta base, com a
-- origem, porque a tela precisa dizer de onde cada uma veio e o RAG
-- precisa saber se resolveu algo (se não, cai no escopo da chave — é o
-- que torna a rodada aditiva).
--
-- `base` desconhecida devolve só as universais: chegar com um p_base que
-- não existe em ai_bases não é motivo para não alcançar a documentação do
-- sistema, e conteúdo de cliente ela não alcança por não casar base_id.
create or replace function public.escopo_documentacao(
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns table (space_id uuid, origem text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select u.space_id, 'universal'::text
    from public.documentacoes_universais u
   where u.enabled
     and public.elegivel(u.regra, p_identidade)
  union
  select d.space_id, 'base'::text
    from public.ai_base_documentacoes d
    join public.ai_bases b on b.id = d.base_id
   where d.enabled
     and lower(btrim(b.base_code)) = lower(btrim(coalesce(p_base, '')))
     and public.elegivel(d.regra, p_identidade);
$$;

comment on function public.escopo_documentacao(text, jsonb) is
  'Documentações que esta identidade alcança nesta base: universais mais as do cliente, ambas filtradas por public.elegivel. `origem` diz de qual das duas veio. Base desconhecida devolve só as universais.';

revoke all on function public.escopo_documentacao(text, jsonb) from public, anon;
grant execute on function public.escopo_documentacao(text, jsonb) to authenticated, service_role;

-- ── Assertivas ──────────────────────────────────────────────────────
do $$
begin
  assert public.regra_valida('{}'::jsonb), 'regra vazia e valida';
  assert public.regra_valida('{"portal":["PG"]}'), 'dimensao conhecida com lista e valida';
  assert public.regra_valida('{"portal":null}'), 'null na dimensao e valido (nao configurada)';
  assert not public.regra_valida('{"centro_custos":["1"]}'), 'typo no nome da dimensao e INVALIDO';
  assert not public.regra_valida('{"portal":"PG"}'), 'valor que nao e lista e INVALIDO';
  assert not public.regra_valida('"texto"'::jsonb), 'regra que nao e objeto e INVALIDA';
  assert public.regra_valida(null), 'nulo e valido (coalesce para vazio)';
end $$;
