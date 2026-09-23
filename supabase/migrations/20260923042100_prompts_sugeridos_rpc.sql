-- =====================================================================
-- QUEM VÊ QUAL PROMPT — decidido no servidor, nunca no widget
--
-- O widget roda dentro do APEX do cliente, em JavaScript que qualquer
-- pessoa lê e edita no navegador. Mandar a lista inteira e filtrar lá
-- seria publicar o prompt que só o perfil FOLHA deveria ver — e o texto
-- de um prompt conta o que existe no sistema ("dados deste centro de
-- custo" revela que há consulta por centro de custo).
--
-- Então o corte acontece aqui, e o que trafega já é só o permitido.
--
-- ── A regra, literal ────────────────────────────────────────────────
-- Três allowlists combinadas com E. Vazia não restringe:
--
--     visível = (portais  = {} OU portal  ∈ portais)
--           E   (perfis   = {} OU perfil  ∈ perfis)
--           E   (usuarios = {} OU usuario ∈ usuarios)
--
-- Mais o escopo: global (base_code NULL) OU do cliente que está pedindo.
--
-- Comparação sempre por `lower(btrim())` dos dois lados. Perfil chega do
-- ERP como 'MASTER'/'PORTAL_COLAB'; o admin digita na tela e vai digitar
-- 'Master' em algum momento. Casar por igualdade crua transformaria isso
-- num prompt que "sumiu" sem erro em lugar nenhum.
--
-- ── Por que os parâmetros NÃO se chamam `p_base`/`p_usuario` ────────
-- As colunas de `prompt_favorito` se chamam exatamente assim (é a
-- convenção dos params de rastreio do ERP). Parâmetro com o mesmo nome
-- de coluna visível no escopo faz o Postgres recusar a função inteira
-- com `column reference "p_base" is ambiguous` — em tempo de EXECUÇÃO,
-- não de criação. Daí o sufixo `_ref`.
-- =====================================================================

drop function if exists public.prompts_sugeridos(text, text, text, text);

create function public.prompts_sugeridos(
  base_ref text,
  portal_ref text default null,
  perfil_ref text default null,
  usuario_ref text default null
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
       -- Escopo: o conjunto da Natcorp mais o do próprio cliente.
       and (s.base_code is null
            or lower(btrim(s.base_code)) = lower(btrim(coalesce(base_ref, ''))))
       -- As três dimensões, com E. Vazia não restringe.
       and (cardinality(s.portais) = 0
            or lower(btrim(coalesce(portal_ref, ''))) = any (
                 select lower(btrim(x)) from unnest(s.portais) x))
       and (cardinality(s.perfis) = 0
            or lower(btrim(coalesce(perfil_ref, ''))) = any (
                 select lower(btrim(x)) from unnest(s.perfis) x))
       and (cardinality(s.usuarios) = 0
            or lower(btrim(coalesce(usuario_ref, ''))) = any (
                 select lower(btrim(x)) from unnest(s.usuarios) x))
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

comment on function public.prompts_sugeridos(text, text, text, text) is
  'Prompts sugeridos VISÍVEIS para (base, portal, perfil, usuário). O corte é aqui porque o widget é código público — mandar a lista inteira publicaria o prompt restrito.';

revoke all on function public.prompts_sugeridos(text, text, text, text) from public, anon, authenticated;
grant execute on function public.prompts_sugeridos(text, text, text, text) to service_role;

-- ── Favoritar / desfavoritar ────────────────────────────────────────
-- Escreve só a linha do par (prompt, usuário); não toca no prompt, que
-- é do admin. Devolve false em vez de erro para a rota não precisar
-- distinguir "não pode" de "quebrou" — o widget só reexibe o estado.
drop function if exists public.prompt_favoritar(uuid, text, text, boolean);

create function public.prompt_favoritar(
  prompt_ref uuid,
  base_ref text,
  usuario_ref text,
  marcar boolean
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  if base_ref is null or btrim(base_ref) = ''
     or usuario_ref is null or btrim(usuario_ref) = '' then
    return false;
  end if;

  -- Só favorita o que a pessoa PODE ver. Sem isto, um id adivinhado
  -- criaria vínculo com prompt de outro cliente — e o favorito é, ele
  -- mesmo, um sinal de que aquele prompt existe.
  if not exists (
    select 1 from public.prompt_sugerido s
     where s.id = prompt_ref
       and s.ativo
       and (s.base_code is null
            or lower(btrim(s.base_code)) = lower(btrim(base_ref)))
  ) then
    return false;
  end if;

  if marcar then
    insert into public.prompt_favorito (prompt_id, p_base, p_usuario)
    values (prompt_ref, btrim(base_ref), btrim(usuario_ref))
    on conflict do nothing;
  else
    delete from public.prompt_favorito f
     where f.prompt_id = prompt_ref
       and lower(btrim(f.p_base))    = lower(btrim(base_ref))
       and lower(btrim(f.p_usuario)) = lower(btrim(usuario_ref));
  end if;
  return true;
end $$;

comment on function public.prompt_favoritar(uuid, text, text, boolean) is
  'Marca/desmarca favorito de um prompt sugerido para (base, usuário). Valida visibilidade antes de gravar. false = não pode ou faltou identidade.';

revoke all on function public.prompt_favoritar(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.prompt_favoritar(uuid, text, text, boolean) to service_role;

-- =====================================================================
-- OS PERFIS QUE A BASE REALMENTE TEM — para a tela não ser campo livre
--
-- O perfil não é enum: chega do ERP como texto ('MASTER', 'PORTAL_COLAB',
-- 'FOLHA', 'CGP ADM'...). Uma lista fixa no código envelheceria calada, e
-- digitar livre produz 'Folha' onde o ERP manda 'FOLHA' — um prompt que
-- não aparece para ninguém e não dá erro em lugar nenhum.
--
-- ── Por que RPC e não `select` paginado ─────────────────────────────
-- A primeira versão lia as 2.000 conversas mais recentes e deduplicava em
-- JavaScript. É o teto de 1.000 linhas do PostgREST esperando para
-- acontecer de novo (já mordeu este projeto seis vezes): numa base com
-- muito volume, um perfil raro cai fora da janela e some da tela sem
-- nenhum sinal. `distinct` roda onde os dados estão.
--
-- A CONTAGEM vem junto porque ordenar por frequência põe na frente o que
-- o admin vai escolher em 90% das vezes; alfabético põe 'ADM_COORD_SUP'
-- antes de 'MASTER'.
-- =====================================================================

drop function if exists public.perfis_da_base(text);

create function public.perfis_da_base(base_ref text default null)
returns table (perfil text, conversas bigint)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select btrim(c.p_perfil) as perfil, count(*) as conversas
    from public.conversations c
   where c.p_perfil is not null
     and btrim(c.p_perfil) <> ''
     -- Sem base = todas: é o vocabulário do catálogo GLOBAL da Natcorp,
     -- que precisa enxergar os perfis de todos os clientes.
     and (base_ref is null
          or lower(btrim(c.p_base)) = lower(btrim(base_ref)))
   group by btrim(c.p_perfil)
   order by count(*) desc, btrim(c.p_perfil);
$$;

comment on function public.perfis_da_base(text) is
  'Perfis distintos já vistos em conversas, com a contagem. Alimenta o seletor de elegibilidade dos prompts — evita o teto de 1.000 linhas do PostgREST e a digitação livre.';

revoke all on function public.perfis_da_base(text) from public, anon, authenticated;
grant execute on function public.perfis_da_base(text) to service_role;
