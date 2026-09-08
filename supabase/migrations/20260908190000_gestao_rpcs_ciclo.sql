-- =====================================================================
-- AS RPCs PASSAM A FALAR EM CICLO E EM LASTRO
--
-- Duas mudanças atravessam todas elas:
--
--   · a janela deixa de ser o MÊS e passa a ser o CICLO do cliente
--     (`ai_cliente_plano.dia_inicio_ciclo`), que pode ir de 14/09 a 13/10;
--   · crédito deixa de ser 1 milhão fixo e passa a ser
--     `ai_cliente_plano.tokens_por_credito`, negociável por cliente.
--
-- Onde não houver plano cadastrado, valem os padrões (0 créditos, US$ 3,50,
-- 1.000.000 de tokens, ciclo no dia 1) — e "0 créditos contratados" NÃO
-- bloqueia: quem nunca passou pelo comercial continua atendido. O bloqueio
-- exige plano cadastrado, que é uma afirmação, não uma omissão.
-- =====================================================================

-- ── Plano vigente de uma base ───────────────────────────────────────────
create or replace function public.gestao_plano(p_base text, p_momento timestamptz default now())
returns table (
  base_code text,
  creditos_por_ciclo numeric,
  usd_por_credito numeric,
  tokens_por_credito bigint,
  dia_inicio_ciclo int,
  tem_plano boolean,
  ciclo_inicio timestamptz,
  ciclo_fim timestamptz
)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  with p as (
    select pl.*
      from public.ai_cliente_plano pl
     where pl.base_code = lower(btrim(p_base))
       and pl.vigente_desde <= (p_momento at time zone 'America/Sao_Paulo')::date
     order by pl.vigente_desde desc
     limit 1
  ),
  d as (
    select coalesce((select dia_inicio_ciclo from p), 1) as dia
  ),
  c as (
    select * from public.gestao_ciclo((select dia from d), p_momento)
  )
  select
    lower(btrim(p_base)),
    coalesce((select creditos_por_ciclo from p), 0),
    coalesce((select usd_por_credito from p), 3.50),
    coalesce((select tokens_por_credito from p), 1000000),
    (select dia from d),
    (select count(*) > 0 from p),
    c.inicio,
    c.fim
  from c;
$$;

revoke execute on function public.gestao_plano(text, timestamptz) from anon, authenticated;

-- ── Saldo do CICLO ──────────────────────────────────────────────────────
drop function if exists public.gestao_saldo(text, date);
drop function if exists public.gestao_saldo(text, timestamptz);

create function public.gestao_saldo(p_base text, p_momento timestamptz default now())
returns table (
  base_code text,
  ciclo_inicio timestamptz,
  ciclo_fim timestamptz,
  creditos_contratados numeric,
  creditos_extra numeric,
  creditos_disponiveis numeric,
  creditos_consumidos numeric,
  creditos_saldo numeric,
  tokens_brutos bigint,
  tokens_nao_atribuidos bigint,
  tokens_por_credito bigint,
  usd_por_credito numeric,
  usd_total numeric,
  tem_plano boolean
)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  with pl as (
    select * from public.gestao_plano(p_base, p_momento)
  ),
  extra as (
    select coalesce(sum(e.creditos), 0) as creditos
      from public.ai_creditos_extra e, pl
     where e.base_code = pl.base_code
       and e.ciclo_inicio = (pl.ciclo_inicio at time zone 'America/Sao_Paulo')::date
  ),
  consumo as (
    select
      coalesce(sum(u.input_tokens + u.output_tokens), 0)::bigint as tokens,
      coalesce(sum(u.input_tokens + u.output_tokens)
        filter (where u.p_portal is null or u.p_perfil is null or u.p_usuario is null),
        0)::bigint as tokens_nao_atribuidos
      from public.ai_usage u, pl
     where lower(btrim(u.p_base)) = pl.base_code
       and u.origem = 'widget'
       and u.created_at >= pl.ciclo_inicio
       and u.created_at <  pl.ciclo_fim
  )
  select
    pl.base_code,
    pl.ciclo_inicio,
    pl.ciclo_fim,
    pl.creditos_por_ciclo,
    ex.creditos,
    pl.creditos_por_ciclo + ex.creditos,
    round(co.tokens::numeric / pl.tokens_por_credito, 4),
    round(pl.creditos_por_ciclo + ex.creditos - co.tokens::numeric / pl.tokens_por_credito, 4),
    co.tokens,
    co.tokens_nao_atribuidos,
    pl.tokens_por_credito,
    pl.usd_por_credito,
    round((pl.creditos_por_ciclo + ex.creditos) * pl.usd_por_credito, 2),
    pl.tem_plano
  from pl, extra ex, consumo co;
$$;

revoke execute on function public.gestao_saldo(text, timestamptz) from anon, authenticated;

-- ── Alocações, contadas no ciclo e no lastro do cliente ─────────────────
drop function if exists public.gestao_alocacoes(text, date);
drop function if exists public.gestao_alocacoes(text, timestamptz);

create function public.gestao_alocacoes(p_base text, p_momento timestamptz default now())
returns table (
  id uuid,
  painel text,
  alvo_tipo text,
  alvo text,
  creditos_alocados numeric,
  creditos_consumidos numeric,
  creditos_saldo numeric,
  ativo boolean
)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  with pl as (select * from public.gestao_plano(p_base, p_momento)),
  uso as (
    select al.id,
           coalesce(sum(u.input_tokens + u.output_tokens), 0)::numeric as tokens
      from public.ai_creditos_alocacao al
      cross join pl
      left join public.ai_usage u
        on lower(btrim(u.p_base)) = pl.base_code
       and u.origem = 'widget'
       and u.created_at >= pl.ciclo_inicio
       and u.created_at <  pl.ciclo_fim
       and (al.painel is null or u.p_portal = al.painel)
       and (
         al.alvo_tipo = 'painel'
         or (al.alvo_tipo = 'perfil'  and lower(btrim(u.p_perfil))  = lower(btrim(al.alvo)))
         or (al.alvo_tipo = 'usuario' and lower(btrim(u.p_usuario)) = lower(btrim(al.alvo)))
       )
     where al.base_code = pl.base_code
     group by al.id
  )
  select
    al.id,
    al.painel,
    al.alvo_tipo,
    al.alvo,
    al.creditos,
    round(uso.tokens / pl.tokens_por_credito, 4),
    round(al.creditos - uso.tokens / pl.tokens_por_credito, 4),
    al.ativo
  from public.ai_creditos_alocacao al
  join uso on uso.id = al.id
  cross join pl
  where al.base_code = pl.base_code
  order by al.alvo_tipo, al.painel nulls first, al.alvo;
$$;

revoke execute on function public.gestao_alocacoes(text, timestamptz) from anon, authenticated;

-- ── Histórico de compras, com filtro de período ─────────────────────────
-- Sem `p_de`/`p_ate` devolve o CICLO corrente, que é o que a tela abre.
create or replace function public.gestao_compras(
  p_base text,
  p_de timestamptz default null,
  p_ate timestamptz default null
)
returns table (
  id uuid,
  criado_em timestamptz,
  ciclo_inicio date,
  creditos numeric,
  usd_por_credito numeric,
  usd_total numeric,
  solicitado_por text,
  motivo text
)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  with pl as (select * from public.gestao_plano(p_base, now()))
  select
    e.id,
    e.criado_em,
    e.ciclo_inicio,
    e.creditos,
    e.usd_por_credito,
    round(e.creditos * e.usd_por_credito, 2),
    e.solicitado_por,
    e.motivo
  from public.ai_creditos_extra e, pl
  where e.base_code = pl.base_code
    and e.criado_em >= coalesce(p_de, pl.ciclo_inicio)
    and e.criado_em <  coalesce(p_ate, pl.ciclo_fim)
  order by e.criado_em desc;
$$;

revoke execute on function public.gestao_compras(text, timestamptz, timestamptz) from anon, authenticated;

-- ── Portão, no ciclo e no lastro ────────────────────────────────────────
drop function if exists public.gestao_portao_credito(text, text, text, text);

create function public.gestao_portao_credito(
  p_base text,
  p_painel text default null,
  p_perfil text default null,
  p_usuario text default null
)
returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, extensions
as $$
declare
  v_base text := lower(btrim(p_base));
  v_pl record;
  v_disponivel numeric;
  v_consumido numeric;
  v_aloc record;
  v_aloc_consumido numeric;
begin
  if v_base is null or v_base = '' then
    return jsonb_build_object('permitido', true, 'motivo', 'sem_base');
  end if;

  select * into v_pl from public.gestao_plano(v_base, now());

  -- Sem plano cadastrado não há cota: transformar "ainda não passou pelo
  -- comercial" em "cliente sem serviço" derrubaria todo mundo.
  if not v_pl.tem_plano then
    return jsonb_build_object('permitido', true, 'motivo', 'sem_contrato');
  end if;

  select v_pl.creditos_por_ciclo + coalesce(sum(e.creditos), 0)
    into v_disponivel
    from public.ai_creditos_extra e
   where e.base_code = v_base
     and e.ciclo_inicio = (v_pl.ciclo_inicio at time zone 'America/Sao_Paulo')::date;

  select coalesce(sum(u.input_tokens + u.output_tokens), 0)::numeric / v_pl.tokens_por_credito
    into v_consumido
    from public.ai_usage u
   where lower(btrim(u.p_base)) = v_base
     and u.origem = 'widget'
     and u.created_at >= v_pl.ciclo_inicio
     and u.created_at <  v_pl.ciclo_fim;

  if v_consumido >= v_disponivel then
    return jsonb_build_object(
      'permitido', false,
      'motivo', 'base_sem_creditos',
      'creditos_disponiveis', round(v_disponivel, 4),
      'creditos_consumidos', round(v_consumido, 4)
    );
  end if;

  -- Alocação MAIS ESPECÍFICA que cobre este turno.
  select al.* into v_aloc
    from public.ai_creditos_alocacao al
   where al.base_code = v_base
     and al.ativo
     and (al.painel is null or al.painel = p_painel)
     and (
       (al.alvo_tipo = 'usuario' and p_usuario is not null
          and lower(btrim(al.alvo)) = lower(btrim(p_usuario)))
       or (al.alvo_tipo = 'perfil' and p_perfil is not null
          and lower(btrim(al.alvo)) = lower(btrim(p_perfil)))
       or (al.alvo_tipo = 'painel' and al.painel = p_painel)
     )
   order by
     case al.alvo_tipo when 'usuario' then 1 when 'perfil' then 2 else 3 end,
     case when al.painel is not null then 0 else 1 end
   limit 1;

  if not found then
    return jsonb_build_object(
      'permitido', true,
      'motivo', 'sem_alocacao',
      'creditos_disponiveis', round(v_disponivel, 4),
      'creditos_consumidos', round(v_consumido, 4)
    );
  end if;

  select coalesce(sum(u.input_tokens + u.output_tokens), 0)::numeric / v_pl.tokens_por_credito
    into v_aloc_consumido
    from public.ai_usage u
   where lower(btrim(u.p_base)) = v_base
     and u.origem = 'widget'
     and u.created_at >= v_pl.ciclo_inicio
     and u.created_at <  v_pl.ciclo_fim
     and (v_aloc.painel is null or u.p_portal = v_aloc.painel)
     and (
       v_aloc.alvo_tipo = 'painel'
       or (v_aloc.alvo_tipo = 'perfil'  and lower(btrim(u.p_perfil))  = lower(btrim(v_aloc.alvo)))
       or (v_aloc.alvo_tipo = 'usuario' and lower(btrim(u.p_usuario)) = lower(btrim(v_aloc.alvo)))
     );

  if v_aloc_consumido >= v_aloc.creditos then
    return jsonb_build_object(
      'permitido', false,
      'motivo', 'alocacao_sem_creditos',
      'alvo_tipo', v_aloc.alvo_tipo,
      'alvo', v_aloc.alvo,
      'painel', v_aloc.painel,
      'creditos_disponiveis', round(v_aloc.creditos, 4),
      'creditos_consumidos', round(v_aloc_consumido, 4)
    );
  end if;

  return jsonb_build_object(
    'permitido', true,
    'motivo', 'ok',
    'alvo_tipo', v_aloc.alvo_tipo,
    'alvo', v_aloc.alvo,
    'creditos_disponiveis', round(v_aloc.creditos, 4),
    'creditos_consumidos', round(v_aloc_consumido, 4)
  );
end;
$$;

revoke execute on function public.gestao_portao_credito(text, text, text, text) from anon, authenticated;
