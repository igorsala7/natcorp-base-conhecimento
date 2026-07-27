-- Consumo de IA agora também por AÇÃO (purpose): a região de Sistema → IA ganha
-- um relatório por IA + modelo + ação. A assinatura de RETORNO muda (nova
-- coluna), então é preciso DROP + CREATE — `create or replace` não altera o
-- tipo de retorno de uma função.
drop function if exists public.ai_usage_report(timestamptz, timestamptz);

create function public.ai_usage_report(p_from timestamptz, p_to timestamptz)
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
  group by u.provider, u.model, u.purpose
  order by sum(u.total_tokens) desc;
$$;

revoke execute on function public.ai_usage_report(timestamptz, timestamptz) from anon;
