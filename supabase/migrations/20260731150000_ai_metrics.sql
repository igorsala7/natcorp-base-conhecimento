-- Observabilidade: agregado de consumo de IA numa janela (RPM/TPM) para o
-- endpoint /api/metrics. Barato (índice em created_at já existe pelo uso normal).

create or replace function public.ai_usage_window(p_seconds int)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'chamadas', count(*),
    'tokens', coalesce(sum(total_tokens), 0),
    'input', coalesce(sum(input_tokens), 0),
    'output', coalesce(sum(output_tokens), 0)
  )
  from ai_usage
  where created_at >= now() - make_interval(secs => p_seconds);
$$;

revoke all on function public.ai_usage_window(int) from anon;

create index if not exists ai_usage_created_at on ai_usage (created_at);
