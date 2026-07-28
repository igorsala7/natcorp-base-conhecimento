-- CORREÇÃO: na migration anterior os parâmetros de filtro (p_base, p_usuario, …)
-- tinham o MESMO nome das COLUNAS da tabela ai_usage. Numa função SQL, o nome
-- nu resolve para a COLUNA, então `u.p_usuario ilike '%'||p_usuario||'%'` virava
-- `u.p_usuario ilike '%'||u.p_usuario||'%'` — sempre verdadeiro (não filtrava).
-- Renomeados para pf_* (sem colisão). p_kind não colide (coluna é `kind`).
drop function if exists public.ai_usage_report(
  timestamptz, timestamptz, text, text, text, text, text, text, text
);

create function public.ai_usage_report(
  p_from timestamptz,
  p_to timestamptz,
  p_kind text default null,
  pf_base text default null,
  pf_usuario text default null,
  pf_portal text default null,
  pf_empresa text default null,
  pf_matricula text default null,
  pf_perfil text default null
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
    and (p_kind       is null or u.kind = p_kind)
    and (pf_base      is null or u.p_base      ilike '%' || pf_base      || '%')
    and (pf_usuario   is null or u.p_usuario   ilike '%' || pf_usuario   || '%')
    and (pf_portal    is null or u.p_portal    ilike '%' || pf_portal    || '%')
    and (pf_empresa   is null or u.p_empresa   ilike '%' || pf_empresa   || '%')
    and (pf_matricula is null or u.p_matricula ilike '%' || pf_matricula || '%')
    and (pf_perfil    is null or u.p_perfil    ilike '%' || pf_perfil    || '%')
  group by u.provider, u.model, u.purpose
  order by sum(u.total_tokens) desc;
$$;

revoke execute on function public.ai_usage_report(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) from anon;
