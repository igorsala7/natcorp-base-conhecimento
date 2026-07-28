-- Consumo de IA por TIPO e por IDENTIDADE (pedido do usuário): além de
-- provedor/modelo/ação, o registro passa a guardar se veio do SISTEMA (importador,
-- editor, embeddings…) ou de um USUÁRIO (chat do widget/portal) e, nesse caso, os
-- parâmetros de rastreio p_* — para filtrar o consumo por base, painel, perfil,
-- usuário, empresa e matrícula.
alter table public.ai_usage
  add column if not exists kind text not null default 'system',
  add column if not exists p_base text,
  add column if not exists p_usuario text,
  add column if not exists p_portal text,
  add column if not exists p_empresa text,
  add column if not exists p_matricula text,
  add column if not exists p_perfil text;

create index if not exists ai_usage_kind_created_idx on public.ai_usage (kind, created_at);

-- Relatório com filtros. Assinatura nova (mais parâmetros) → DROP + CREATE. Os
-- filtros p_* são "contém" (ilike), como na tela de Conversas; nulos = ignora.
drop function if exists public.ai_usage_report(timestamptz, timestamptz);

create function public.ai_usage_report(
  p_from timestamptz,
  p_to timestamptz,
  p_kind text default null,
  p_base text default null,
  p_usuario text default null,
  p_portal text default null,
  p_empresa text default null,
  p_matricula text default null,
  p_perfil text default null
)
returns table (
  provider text,
  model text,
  purpose text,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  calls bigint
)
  language sql
  stable
  set search_path = public, extensions
as $$
  select
    u.provider,
    u.model,
    u.purpose,
    coalesce(sum(u.input_tokens), 0)::bigint  as input_tokens,
    coalesce(sum(u.output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(u.total_tokens), 0)::bigint  as total_tokens,
    count(*)::bigint                          as calls
  from public.ai_usage u
  where u.created_at >= p_from and u.created_at < p_to
    and (p_kind      is null or u.kind = p_kind)
    and (p_base      is null or u.p_base      ilike '%' || p_base      || '%')
    and (p_usuario   is null or u.p_usuario   ilike '%' || p_usuario   || '%')
    and (p_portal    is null or u.p_portal    ilike '%' || p_portal    || '%')
    and (p_empresa   is null or u.p_empresa   ilike '%' || p_empresa   || '%')
    and (p_matricula is null or u.p_matricula ilike '%' || p_matricula || '%')
    and (p_perfil    is null or u.p_perfil    ilike '%' || p_perfil    || '%')
  group by u.provider, u.model, u.purpose
  order by sum(u.total_tokens) desc;
$$;

revoke execute on function public.ai_usage_report(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) from anon;
