-- =====================================================================
-- RPCs DA ÁREA DE GESTÃO — consumo, saldo e o portão de bloqueio
--
-- ── A unidade, uma vez só ───────────────────────────────────────────────
-- 1 crédito = 1.000.000 de tokens BRUTOS (`input_tokens + output_tokens`), e só
-- da origem `widget`. Portal público, uso interno do admin e jobs de sistema
-- NÃO entram — é a mesma regra de `faturamento_detalhe`, e existe um motivo
-- medido: a origem `sistema` custa US$ 4,73 por milhão contra US$ 1,19 do
-- widget, porque é onde rodam as avaliações e a indexação. Cobrar isso do
-- cliente seria cobrá-lo pelo nosso desenvolvimento.
--
-- ── "Nulo não é zero" ───────────────────────────────────────────────────
-- Linhas sem `p_portal`/`p_perfil`/`p_usuario` existem (12 chamadas medidas em
-- 120 dias). Elas NÃO são somadas como se pertencessem a um recorte: aparecem
-- separadas, com o rótulo '(não atribuído)', e as funções devolvem
-- `tokens_nao_atribuidos` ao lado do total. Empurrar imensurável para dentro de
-- um recorte produz um número que parece completo e não é.
-- =====================================================================

-- ── Consumo detalhado por recorte ───────────────────────────────────────
drop function if exists public.gestao_consumo(text, timestamptz, timestamptz);

create function public.gestao_consumo(
  p_base text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  painel text,
  perfil text,
  usuario text,
  chamadas bigint,
  conversas bigint,
  tokens_entrada bigint,
  tokens_saida bigint,
  tokens_brutos bigint,
  creditos numeric,
  atribuido boolean
)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select
    coalesce(nullif(btrim(u.p_portal),  ''), '(não atribuído)') as painel,
    coalesce(nullif(btrim(u.p_perfil),  ''), '(não atribuído)') as perfil,
    coalesce(nullif(btrim(u.p_usuario), ''), '(não atribuído)') as usuario,
    count(*)::bigint                                       as chamadas,
    count(distinct u.conversation_id)::bigint              as conversas,
    coalesce(sum(u.input_tokens), 0)::bigint               as tokens_entrada,
    coalesce(sum(u.output_tokens), 0)::bigint              as tokens_saida,
    coalesce(sum(u.input_tokens + u.output_tokens), 0)::bigint as tokens_brutos,
    round(coalesce(sum(u.input_tokens + u.output_tokens), 0) / 1000000.0, 4) as creditos,
    -- Falso quando qualquer eixo do recorte veio nulo: a linha conta no total
    -- da base, mas não pode ser cobrada de um perfil ou de uma pessoa.
    (u.p_portal is not null and u.p_perfil is not null and u.p_usuario is not null) as atribuido
  from public.ai_usage u
  where lower(btrim(u.p_base)) = lower(btrim(p_base))
    and u.origem = 'widget'
    and u.created_at >= p_from
    and u.created_at <  p_to
  group by 1, 2, 3, 10
  order by sum(u.input_tokens + u.output_tokens) desc;
$$;

comment on function public.gestao_consumo(text, timestamptz, timestamptz) is
  'Consumo em créditos por painel × perfil × usuário de UMA base. `atribuido = false` marca o que não pode ser imputado a um recorte — some no total, nunca no recorte.';

revoke execute on function public.gestao_consumo(text, timestamptz, timestamptz) from anon, authenticated;

-- ── Saldo do mês ────────────────────────────────────────────────────────
drop function if exists public.gestao_saldo(text, date);

create function public.gestao_saldo(p_base text, p_mes date)
returns table (
  base_code text,
  mes_ref date,
  creditos_contratados numeric,
  creditos_extra numeric,
  creditos_disponiveis numeric,
  creditos_consumidos numeric,
  creditos_saldo numeric,
  tokens_brutos bigint,
  tokens_nao_atribuidos bigint,
  usd_por_credito numeric,
  usd_total numeric
)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  with alvo as (
    select lower(btrim(p_base)) as base, date_trunc('month', p_mes)::date as mes
  ),
  janela as (
    select base, mes, mes::timestamptz as ini,
           (mes + interval '1 month')::timestamptz as fim
    from alvo
  ),
  contrato as (
    select coalesce(sum(c.creditos), 0) as creditos,
           max(c.usd_por_credito)       as usd_por_credito
    from public.ai_creditos_contrato c, alvo a
    where c.base_code = a.base and c.mes_ref = a.mes
  ),
  extra as (
    select coalesce(sum(e.creditos), 0) as creditos
    from public.ai_creditos_extra e, alvo a
    where e.base_code = a.base and e.mes_ref = a.mes
  ),
  consumo as (
    select
      coalesce(sum(u.input_tokens + u.output_tokens), 0)::bigint as tokens,
      coalesce(sum(u.input_tokens + u.output_tokens)
        filter (where u.p_portal is null or u.p_perfil is null or u.p_usuario is null),
        0)::bigint as tokens_nao_atribuidos
    from public.ai_usage u, janela j
    where lower(btrim(u.p_base)) = j.base
      and u.origem = 'widget'
      and u.created_at >= j.ini
      and u.created_at <  j.fim
  )
  select
    a.base,
    a.mes,
    ct.creditos,
    ex.creditos,
    ct.creditos + ex.creditos                                as creditos_disponiveis,
    round(co.tokens / 1000000.0, 4)                          as creditos_consumidos,
    round(ct.creditos + ex.creditos - co.tokens / 1000000.0, 4) as creditos_saldo,
    co.tokens,
    co.tokens_nao_atribuidos,
    -- Sem contrato no mês, o preço de tabela vigente; nunca zero, que passaria
    -- por "de graça".
    coalesce(ct.usd_por_credito, 3.50)                       as usd_por_credito,
    round((ct.creditos + ex.creditos) * coalesce(ct.usd_por_credito, 3.50), 2) as usd_total
  from alvo a, contrato ct, extra ex, consumo co;
$$;

comment on function public.gestao_saldo(text, date) is
  'Saldo de créditos de uma base num mês: contratado + avulso − consumido. Uma consulta só, de propósito — se os totalizadores viessem de funções diferentes, um dia discordariam e ninguém saberia qual acreditar.';

revoke execute on function public.gestao_saldo(text, date) from anon, authenticated;

-- ── Consumo por alocação ────────────────────────────────────────────────
-- Cada orçamento cadastrado, com o que já foi gasto DENTRO daquele recorte.
drop function if exists public.gestao_alocacoes(text, date);

create function public.gestao_alocacoes(p_base text, p_mes date)
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
  with j as (
    select lower(btrim(p_base)) as base,
           date_trunc('month', p_mes)::timestamptz as ini,
           (date_trunc('month', p_mes) + interval '1 month')::timestamptz as fim
  )
  select
    al.id,
    al.painel,
    al.alvo_tipo,
    al.alvo,
    al.creditos,
    round(coalesce((
      select sum(u.input_tokens + u.output_tokens)
        from public.ai_usage u, j
       where lower(btrim(u.p_base)) = j.base
         and u.origem = 'widget'
         and u.created_at >= j.ini and u.created_at < j.fim
         and (al.painel is null or u.p_portal = al.painel)
         and (
           al.alvo_tipo = 'painel'
           or (al.alvo_tipo = 'perfil'  and lower(btrim(u.p_perfil))  = lower(btrim(al.alvo)))
           or (al.alvo_tipo = 'usuario' and lower(btrim(u.p_usuario)) = lower(btrim(al.alvo)))
         )
    ), 0) / 1000000.0, 4) as creditos_consumidos,
    round(al.creditos - coalesce((
      select sum(u.input_tokens + u.output_tokens)
        from public.ai_usage u, j
       where lower(btrim(u.p_base)) = j.base
         and u.origem = 'widget'
         and u.created_at >= j.ini and u.created_at < j.fim
         and (al.painel is null or u.p_portal = al.painel)
         and (
           al.alvo_tipo = 'painel'
           or (al.alvo_tipo = 'perfil'  and lower(btrim(u.p_perfil))  = lower(btrim(al.alvo)))
           or (al.alvo_tipo = 'usuario' and lower(btrim(u.p_usuario)) = lower(btrim(al.alvo)))
         )
    ), 0) / 1000000.0, 4) as creditos_saldo,
    al.ativo
  from public.ai_creditos_alocacao al, j
  where al.base_code = j.base
  order by al.alvo_tipo, al.painel nulls first, al.alvo;
$$;

revoke execute on function public.gestao_alocacoes(text, date) from anon, authenticated;

-- ── PORTÃO — roda a cada turno de chat ──────────────────────────────────
-- Devolve jsonb (e não boolean) porque a rota precisa dizer POR QUE recusou: a
-- mensagem de "seu perfil esgotou a cota" é acionável, "sem crédito" não é.
--
-- Regra, conforme decisão do dono em 08/09/2026 ("bloqueia ao zerar"):
--   · zera o saldo da BASE            → bloqueia todo mundo
--   · zera a ALOCAÇÃO do recorte      → bloqueia aquele recorte
-- Um recorte SEM alocação não é bloqueado por recorte — cai só no saldo da base.
-- Ausência de orçamento é ausência de limite, não limite zero.
--
-- Base sem contrato nenhum no mês NÃO bloqueia: seria transformar "ainda não
-- cadastrei o contrato" em "cliente sem serviço". Quem quiser bloquear cadastra
-- contrato com zero crédito, que é uma afirmação explícita.
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
  v_mes date := date_trunc('month', now())::date;
  v_ini timestamptz := date_trunc('month', now());
  v_fim timestamptz := date_trunc('month', now()) + interval '1 month';
  v_contratado numeric;
  v_tem_contrato boolean;
  v_consumido numeric;
  v_aloc record;
  v_aloc_consumido numeric;
begin
  if v_base is null or v_base = '' then
    -- Sem base não há cobrança nem cota. Quem barra requisição sem `p_base` é a
    -- rota do chat, por outro motivo (não há tools sem base).
    return jsonb_build_object('permitido', true, 'motivo', 'sem_base');
  end if;

  select coalesce(sum(c.creditos), 0), count(*) > 0
    into v_contratado, v_tem_contrato
    from public.ai_creditos_contrato c
   where c.base_code = v_base and c.mes_ref = v_mes;

  select v_contratado + coalesce(sum(e.creditos), 0)
    into v_contratado
    from public.ai_creditos_extra e
   where e.base_code = v_base and e.mes_ref = v_mes;

  if not v_tem_contrato then
    return jsonb_build_object('permitido', true, 'motivo', 'sem_contrato');
  end if;

  select coalesce(sum(u.input_tokens + u.output_tokens), 0) / 1000000.0
    into v_consumido
    from public.ai_usage u
   where lower(btrim(u.p_base)) = v_base
     and u.origem = 'widget'
     and u.created_at >= v_ini and u.created_at < v_fim;

  if v_consumido >= v_contratado then
    return jsonb_build_object(
      'permitido', false,
      'motivo', 'base_sem_creditos',
      'creditos_disponiveis', round(v_contratado, 4),
      'creditos_consumidos', round(v_consumido, 4)
    );
  end if;

  -- Alocação MAIS ESPECÍFICA que cobre este turno. A ordem do `order by` é a
  -- precedência: usuário+painel → usuário → perfil+painel → perfil → painel.
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
      'creditos_disponiveis', round(v_contratado, 4),
      'creditos_consumidos', round(v_consumido, 4)
    );
  end if;

  select coalesce(sum(u.input_tokens + u.output_tokens), 0) / 1000000.0
    into v_aloc_consumido
    from public.ai_usage u
   where lower(btrim(u.p_base)) = v_base
     and u.origem = 'widget'
     and u.created_at >= v_ini and u.created_at < v_fim
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

comment on function public.gestao_portao_credito(text, text, text, text) is
  'Portão de créditos do turno de chat. Bloqueia quando a base zera o saldo do mês OU quando a alocação mais específica do recorte zera. Base sem contrato cadastrado NÃO bloqueia.';

revoke execute on function public.gestao_portao_credito(text, text, text, text) from anon, authenticated;
