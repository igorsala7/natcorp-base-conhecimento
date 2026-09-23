-- =====================================================================
-- ELEGIBILIDADE NOS CINCO PARÂMETROS DE RASTREIO
--
-- Correção do dono (23/09): "tem que ser base, portal, usuário, empresa e
-- matrícula". A primeira versão tinha só portal, perfil e usuário.
--
-- O token de rastreio (`kbt1h.`) carrega p_base, p_usuario, p_portal,
-- p_empresa, p_matricula, p_perfil e p_cod_candidato. Não há motivo para
-- a elegibilidade enxergar metade deles: "só a empresa 700" e "só estas
-- matrículas" são recortes que o cliente pede o tempo todo, e sem a
-- dimensão o admin cairia em gambiarra (cadastrar o mesmo prompt N vezes
-- com lista de usuário).
--
-- PERFIL FICA. O exemplo que originou a funcionalidade é dele ("apenas no
-- portal do gestor para o perfil FOLHA"), e tirar uma dimensão que já
-- funciona por omissão numa lista seria decidir no lugar do dono.
--
-- ── `bases` NÃO é o mesmo que `base_code` ───────────────────────────
-- `base_code` diz de QUEM É o prompt: NULL = catálogo da Natcorp,
-- preenchido = do cliente (e é ele que decide quem pode editar).
-- `bases` diz QUEM VÊ. A diferença só importa no catálogo global: é o
-- que permite à Natcorp escrever um prompt que vale para três clientes
-- específicos, sem duplicá-lo três vezes e sem entregá-lo a todos.
-- Num prompt de cliente a lista é redundante (o escopo já restringe) —
-- redundante, não contraditória, então não estorva.
-- =====================================================================

alter table public.prompt_sugerido
  add column if not exists bases text[] not null default '{}',
  add column if not exists empresas text[] not null default '{}',
  add column if not exists matriculas text[] not null default '{}';

comment on column public.prompt_sugerido.bases is
  'Allowlist de VISIBILIDADE por base. Diferente de base_code, que é a propriedade. Vazio = todas as bases do escopo.';
comment on column public.prompt_sugerido.empresas is
  'Allowlist por p_empresa (o CÓDIGO da empresa no ERP: 700, 1, 2…). Vazio = todas.';
comment on column public.prompt_sugerido.matriculas is
  'Allowlist por p_matricula. Vazio = todas.';

-- ── O casamento de uma allowlist, uma vez só ────────────────────────
-- Seis dimensões com a mesma regra dariam seis blocos quase idênticos na
-- função — e "quase" é onde mora o defeito: basta um `coalesce` faltando
-- num deles para uma dimensão passar a restringir quando deveria liberar,
-- e isso não falha, só some o prompt. Uma função só, testada uma vez.
--
-- `immutable` e sem `set search_path` de propósito: o planejador consegue
-- inlinear, e a função não toca em objeto nenhum do schema.
create or replace function public.allowlist_casa(lista text[], valor text)
returns boolean
language sql
immutable
parallel safe
as $$
  select lista is null
      or cardinality(lista) = 0
      or lower(btrim(coalesce(valor, ''))) = any (
           select lower(btrim(x)) from unnest(lista) x
         );
$$;

comment on function public.allowlist_casa(text[], text) is
  'Allowlist: vazia/NULL não restringe; senão compara por lower(btrim()) dos dois lados. Usada pela elegibilidade dos prompts sugeridos.';

-- A assinatura mudou (duas dimensões novas), então a antiga precisa sair.
drop function if exists public.prompts_sugeridos(text, text, text, text);
drop function if exists public.prompts_sugeridos(text, text, text, text, text, text);

create function public.prompts_sugeridos(
  base_ref text,
  portal_ref text default null,
  perfil_ref text default null,
  usuario_ref text default null,
  empresa_ref text default null,
  matricula_ref text default null
)
returns table (
  id uuid,
  label text,
  texto text,
  global boolean,
  favorito boolean,
  categorias text[]
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with vis as (
    select
      s.id,
      s.label,
      s.texto,
      s.base_code,
      s.ordem,
      exists (
        select 1
          from public.prompt_favorito f
         where f.prompt_id = s.id
           and lower(btrim(f.p_base))    = lower(btrim(coalesce(base_ref, '')))
           and lower(btrim(f.p_usuario)) = lower(btrim(coalesce(usuario_ref, '')))
      ) as fav
      from public.prompt_sugerido s
     where s.ativo
       -- PROPRIEDADE: o catálogo da Natcorp mais o do próprio cliente.
       and (s.base_code is null
            or lower(btrim(s.base_code)) = lower(btrim(coalesce(base_ref, ''))))
       -- VISIBILIDADE: as seis dimensões, combinadas com E.
       -- Vazia não restringe; uma preenchida corta tudo que não estiver nela.
       and public.allowlist_casa(s.bases,      base_ref)
       and public.allowlist_casa(s.portais,    portal_ref)
       and public.allowlist_casa(s.perfis,     perfil_ref)
       and public.allowlist_casa(s.empresas,   empresa_ref)
       and public.allowlist_casa(s.usuarios,   usuario_ref)
       and public.allowlist_casa(s.matriculas, matricula_ref)
  )
  select
    v.id,
    v.label,
    v.texto,
    (v.base_code is null),
    v.fav,
    coalesce(
      (select array_agg(c.nome order by c.ordem, c.nome)
         from public.prompt_sugerido_categoria sc
         join public.prompt_categoria c on c.id = sc.categoria_id and c.ativo
        where sc.prompt_id = v.id),
      '{}'::text[]
    )
  from vis v
  -- Favorito primeiro, depois a ordem que o admin definiu, e o rótulo
  -- como desempate — sem ele a lista dança entre duas aberturas.
  order by v.fav desc, v.ordem, lower(v.label);
$$;

comment on function public.prompts_sugeridos(text, text, text, text, text, text) is
  'Prompts sugeridos VISÍVEIS para (base, portal, perfil, usuário, empresa, matrícula). O corte é aqui porque o widget é código público — mandar a lista inteira publicaria o prompt restrito.';

revoke all on function public.prompts_sugeridos(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.prompts_sugeridos(text, text, text, text, text, text) to service_role;

-- =====================================================================
-- VOCABULÁRIO REAL DAS DIMENSÕES — para a tela não ser campo livre
--
-- Substitui `perfis_da_base`, que resolvia uma dimensão só. Agora que são
-- seis, uma função por dimensão viraria seis funções que envelhecem em
-- ritmos diferentes; esta devolve (campo, valor, contagem) e a tela
-- separa.
--
-- ── Por que só perfil e empresa ─────────────────────────────────────
-- Portal é fixo (PO/PG/PC, vem do P_PAINEL). Base sai de `ai_bases`, que
-- é cadastro, não observação. E usuário e matrícula IDENTIFICAM PESSOAS:
-- no catálogo global (sem base) um seletor montaria, na tela de um
-- administrador, a lista de logins e matrículas de todos os clientes. Os
-- dois ficam como texto livre — quem cadastra por pessoa já sabe de quem
-- está falando.
--
-- ── Por que RPC e não `select` paginado ─────────────────────────────
-- A primeira versão lia as 2.000 conversas mais recentes e deduplicava em
-- JavaScript. É o teto de 1.000 linhas do PostgREST esperando de novo: na
-- natcorp aquilo achava 2 perfis, e esta função acha 3 — o `PC` estava
-- fora da janela. Um perfil que some da tela sem nenhum sinal.
-- =====================================================================

drop function if exists public.perfis_da_base(text);
drop function if exists public.vocabulario_rastreio(text);

create function public.vocabulario_rastreio(base_ref text default null)
returns table (campo text, valor text, conversas bigint)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with base as (
    select c.p_perfil, c.p_empresa
      from public.conversations c
     -- Sem base = todas: é o vocabulário do catálogo GLOBAL da Natcorp,
     -- que precisa enxergar os valores de todos os clientes.
     where base_ref is null
        or lower(btrim(c.p_base)) = lower(btrim(base_ref))
  )
  select 'perfil'::text, btrim(b.p_perfil), count(*)
    from base b
   where b.p_perfil is not null and btrim(b.p_perfil) <> ''
   group by btrim(b.p_perfil)
  union all
  select 'empresa'::text, btrim(b.p_empresa), count(*)
    from base b
   where b.p_empresa is not null and btrim(b.p_empresa) <> ''
   group by btrim(b.p_empresa)
  -- Frequência primeiro: põe na frente o que o admin escolhe em 90% das
  -- vezes. Alfabético poria 'ADM_COORD_SUP' antes de 'MASTER'.
  order by 1, 3 desc, 2;
$$;

comment on function public.vocabulario_rastreio(text) is
  'Valores distintos já vistos em conversas para perfil e empresa, com contagem. Alimenta os seletores de elegibilidade dos prompts. Usuário e matrícula ficam de fora de propósito: identificam pessoas.';

revoke all on function public.vocabulario_rastreio(text) from public, anon, authenticated;
grant execute on function public.vocabulario_rastreio(text) to service_role;
