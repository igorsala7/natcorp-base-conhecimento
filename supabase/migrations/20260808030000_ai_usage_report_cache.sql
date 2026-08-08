-- =====================================================================
-- RELATÓRIO DE CONSUMO com a quebra de CACHE — para faturar pelo custo real
--
-- `input_tokens` mistura três coisas de preço bem diferente: entrada nova (1×),
-- leitura de cache (~0,1× na Anthropic) e escrita de cache (~1,25×). Quem
-- repassa o consumo ao cliente precisa das três separadas: faturar o total a
-- preço cheio superestima o custo — medido em ~45% num turno real do chat, onde
-- 29.139 dos 59.461 tokens de entrada vieram do cache.
--
-- Sobe também `kind`, que já existia na tabela e não chegava ao relatório: é ele
-- que separa o que o USUÁRIO pediu do que o sistema gastou por conta própria
-- (classificador de assunto, reescrita da consulta, embeddings). Sem essa coluna
-- não dá para responder "quanto do gasto é overhead interno?", que é exatamente
-- a pergunta de quem monta preço.
--
-- `input_tokens` continua sendo o TOTAL — as colunas de cache são fatias DENTRO
-- dele. Somar por fora dobraria a conta.
--
-- PRESERVADOS desta versão (não mexer): os sete filtros e o prefixo `pf_*`. O
-- prefixo existe porque nome de parâmetro igual ao da coluna resolve para a
-- COLUNA dentro de uma função SQL, e o filtro virava sempre-verdadeiro (ver
-- 20260728150000_ai_usage_report_param_fix.sql).
--
-- A assinatura de RETORNO muda → DROP + CREATE.
-- =====================================================================

-- Duas assinaturas precisam cair: a de 9 argumentos (a real, usada pela tela) e
-- uma de 2 argumentos criada por engano numa tentativa anterior desta migration.
-- Sobrevivendo, a de 2 tornaria a resolução de overload ambígua.
drop function if exists public.ai_usage_report(
  timestamptz, timestamptz, text, text, text, text, text, text, text
);
drop function if exists public.ai_usage_report(timestamptz, timestamptz);

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
  kind text,
  input_tokens bigint,
  output_tokens bigint,
  cache_read_tokens bigint,
  cache_write_tokens bigint,
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
    coalesce(u.kind, 'system')                     as kind,
    coalesce(sum(u.input_tokens), 0)::bigint       as input_tokens,
    coalesce(sum(u.output_tokens), 0)::bigint      as output_tokens,
    coalesce(sum(u.cache_read_tokens), 0)::bigint  as cache_read_tokens,
    coalesce(sum(u.cache_write_tokens), 0)::bigint as cache_write_tokens,
    coalesce(sum(u.total_tokens), 0)::bigint       as total_tokens,
    count(*)::bigint                               as calls
  from public.ai_usage u
  where u.created_at >= p_from and u.created_at < p_to
    and (p_kind       is null or u.kind = p_kind)
    and (pf_base      is null or u.p_base      ilike '%' || pf_base      || '%')
    and (pf_usuario   is null or u.p_usuario   ilike '%' || pf_usuario   || '%')
    and (pf_portal    is null or u.p_portal    ilike '%' || pf_portal    || '%')
    and (pf_empresa   is null or u.p_empresa   ilike '%' || pf_empresa   || '%')
    and (pf_matricula is null or u.p_matricula ilike '%' || pf_matricula || '%')
    and (pf_perfil    is null or u.p_perfil    ilike '%' || pf_perfil    || '%')
  group by u.provider, u.model, u.purpose, coalesce(u.kind, 'system')
  order by sum(u.total_tokens) desc;
$$;

revoke execute on function public.ai_usage_report(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) from anon;

-- =====================================================================
-- CONSUMO POR CLIENTE — a consulta que a FATURA precisa
--
-- O relatório acima responde "quanto a plataforma gastou". Esta responde
-- "quanto o cliente X gastou", que é outra pergunta: agrupa por `p_base` (o
-- código do cliente no rastreio) e mantém a quebra de cache e de kind.
--
-- `p_base` nulo = consumo sem cliente atribuível (importação, geração de
-- conteúdo no admin, tarefa de manutenção). Aparece como '(sem cliente)' em vez
-- de sumir: custo que não se atribui a ninguém ainda é custo, e some da conta
-- se for filtrado fora sem aviso.
-- =====================================================================

-- DROP antes do CREATE: `create or replace` não altera o tipo de retorno, e uma
-- tentativa anterior já criou esta função com outro nome de coluna.
drop function if exists public.ai_usage_por_cliente(timestamptz, timestamptz);

create function public.ai_usage_por_cliente(p_from timestamptz, p_to timestamptz)
returns table (
  cliente text,
  kind text,
  provider text,
  model text,
  input_tokens bigint,
  output_tokens bigint,
  cache_read_tokens bigint,
  cache_write_tokens bigint,
  total_tokens bigint,
  calls bigint,
  usuarios bigint
)
  language sql
  stable
  set search_path = public, extensions
as $$
  select
    coalesce(nullif(trim(u.p_base), ''), '(sem cliente)')   as cliente,
    coalesce(u.kind, 'system')                              as kind,
    u.provider,
    u.model,
    coalesce(sum(u.input_tokens), 0)::bigint                as input_tokens,
    coalesce(sum(u.output_tokens), 0)::bigint               as output_tokens,
    coalesce(sum(u.cache_read_tokens), 0)::bigint           as cache_read_tokens,
    coalesce(sum(u.cache_write_tokens), 0)::bigint          as cache_write_tokens,
    coalesce(sum(u.total_tokens), 0)::bigint                as total_tokens,
    count(*)::bigint                                        as calls,
    count(distinct nullif(trim(u.p_matricula), ''))::bigint as usuarios
  from public.ai_usage u
  where u.created_at >= p_from and u.created_at < p_to
  group by 1, 2, u.provider, u.model
  order by sum(u.total_tokens) desc;
$$;

revoke execute on function public.ai_usage_por_cliente(timestamptz, timestamptz) from anon;
