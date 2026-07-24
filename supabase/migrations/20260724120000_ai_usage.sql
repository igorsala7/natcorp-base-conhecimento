-- =====================================================================
-- Consumo de IA por chamada: quanto cada provedor/modelo enviou (tokens de
-- entrada = envio) e recebeu (tokens de saída = recebimento), por finalidade.
-- Sem isto não há como medir gasto por IA nem por modelo — o único dado de
-- token que existia era o total do chat em messages.tokens, sem separar
-- entrada/saída e sem provedor/modelo.
--
-- Registro daqui pra frente: gravado pelo middleware do AI SDK em
-- lib/ai/config.ts (service-role, fora do RLS). Uma linha por chamada.
-- =====================================================================
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                 -- 'anthropic' | 'openai' | 'google'
  model text not null,
  purpose text not null,                  -- 'chat' | 'embedding' | 'import_structure' | ...
  input_tokens int not null default 0,    -- envio (tokens de entrada)
  output_tokens int not null default 0,   -- recebimento (tokens de saída; 0 em embeddings)
  total_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at);
create index ai_usage_provider_model_idx on public.ai_usage (provider, model);

alter table public.ai_usage enable row level security;

-- Só leitura, para quem administra a IA; quem escreve é o servidor
-- (service-role, fora do RLS). Sem policy de escrita, como quality_reports.
create policy ai_usage_read on public.ai_usage
  for select to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  );

revoke all on public.ai_usage from anon;

-- =====================================================================
-- Relatório de consumo agregado por provedor + modelo no intervalo [from, to).
-- STABLE e SEM security definer: roda com o privilégio de quem chama; a policy
-- de leitura acima (e o service-role da tela) já limitam o acesso. Chamado
-- pela região "Consumo de IA" em Sistema → IA.
-- =====================================================================
create or replace function public.ai_usage_report(p_from timestamptz, p_to timestamptz)
returns table (
  provider text,
  model text,
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
    coalesce(sum(u.input_tokens), 0)::bigint  as input_tokens,
    coalesce(sum(u.output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(u.total_tokens), 0)::bigint  as total_tokens,
    count(*)::bigint                          as calls
  from public.ai_usage u
  where u.created_at >= p_from and u.created_at < p_to
  group by u.provider, u.model
  order by sum(u.total_tokens) desc;
$$;

-- O portal/anon nunca lê consumo de IA.
revoke execute on function public.ai_usage_report(timestamptz, timestamptz) from anon;
