-- =====================================================================
-- FATURAMENTO — a consulta única de onde sai a fatura e o painel
--
-- Devolve o DETALHE (cliente × origem × kind × provedor × modelo × ação) e o
-- painel monta todos os totalizadores a partir dele. Uma consulta só, de
-- propósito: se os subtotais por provedor viessem de uma função e o total geral
-- de outra, um dia eles discordariam e ninguém saberia qual acreditar.
--
-- ── As duas contagens, e por que existem as duas ────────────────────────
-- `tokens_brutos`      = entrada + saída, como o provedor reporta.
-- `tokens_ponderados`  = entrada nova + cache lido×mult + cache escrito×mult
--                        + saída.
--
-- O ponderado NÃO é o custo em dólar: ele continua sendo uma CONTAGEM DE
-- TOKENS, só que com a fatia de cache convertida para "quantos tokens de preço
-- cheio isto equivale". É essa contagem que faz sentido multiplicar por uma
-- tarifa plana de US$/milhão, porque a tarifa plana pressupõe que todo token
-- custa igual — e um token lido do cache não custa.
--
-- A saída entra 1× nas duas: o multiplicador de cache é do preço de ENTRADA, e
-- a diferença real entre preço de entrada e de saída (5× na Anthropic) é do
-- lado do CUSTO, que sai em `custo_usd` e não se mistura com a contagem.
--
-- ── Por que `custo_usd` pode vir nulo ───────────────────────────────────
-- Só soma quando existe preço CONFIRMADO para aquele provedor/modelo na data
-- da chamada. Modelo sem preço cadastrado devolve nulo e o painel mostra o
-- aviso, em vez de exibir zero e passar por lucro que não existe.
-- =====================================================================

drop function if exists public.faturamento_detalhe(timestamptz, timestamptz, text[], text);

create function public.faturamento_detalhe(
  p_from timestamptz,
  p_to timestamptz,
  -- Cobrável por decisão do produto: só o widget. O portal público de
  -- documentação, o uso interno do admin e os jobs de sistema ficam de fora.
  -- Parametrizado (e não fixo) para o painel poder mostrar "quanto o portal
  -- consumiu" sem que isso entre em fatura nenhuma.
  p_origens text[] default array['widget'],
  pf_cliente text default null
)
returns table (
  cliente text,
  origem text,
  kind text,
  provider text,
  model text,
  purpose text,
  chamadas bigint,
  entrada_total bigint,
  entrada_nova bigint,
  cache_read bigint,
  cache_write bigint,
  saida bigint,
  tokens_brutos bigint,
  tokens_ponderados bigint,
  cache_read_mult numeric,
  cache_write_mult numeric,
  preco_confirmado boolean,
  custo_usd numeric
)
  language sql
  stable
  set search_path = public, extensions
as $$
  with linhas as (
    select
      coalesce(nullif(trim(u.p_base), ''), '(sem cliente)') as cliente,
      u.origem,
      coalesce(u.kind, 'system') as kind,
      u.provider,
      u.model,
      u.purpose,
      u.input_tokens,
      u.output_tokens,
      u.cache_read_tokens,
      u.cache_write_tokens,
      -- Entrada NOVA = o que sobra depois de tirar as duas fatias de cache.
      -- `greatest(...,0)`: se um provedor reportar as fatias somando mais que o
      -- total, a conta não pode virar negativa e comer tokens de outra linha.
      greatest(u.input_tokens - u.cache_read_tokens - u.cache_write_tokens, 0) as entrada_nova,
      pr.cache_read_mult,
      pr.cache_write_mult,
      pr.input_usd_mtok,
      pr.output_usd_mtok,
      coalesce(pr.confirmado, false) as confirmado
    from public.ai_usage u
    -- Preço VIGENTE NA DATA DA CHAMADA, não o mais recente: uma fatura de junho
    -- tem de continuar batendo depois de um reajuste em dezembro.
    left join lateral (
      select p.*
        from public.ai_model_prices p
       where p.provider = u.provider
         and p.model = u.model
         and p.vigente_desde <= u.created_at
       order by p.vigente_desde desc
       limit 1
    ) pr on true
    where u.created_at >= p_from
      and u.created_at < p_to
      and u.origem = any (p_origens)
      and (
        pf_cliente is null
        or coalesce(nullif(trim(u.p_base), ''), '(sem cliente)') ilike '%' || pf_cliente || '%'
      )
  )
  select
    l.cliente,
    l.origem,
    l.kind,
    l.provider,
    l.model,
    l.purpose,
    count(*)::bigint                        as chamadas,
    sum(l.input_tokens)::bigint             as entrada_total,
    sum(l.entrada_nova)::bigint             as entrada_nova,
    sum(l.cache_read_tokens)::bigint        as cache_read,
    sum(l.cache_write_tokens)::bigint       as cache_write,
    sum(l.output_tokens)::bigint            as saida,
    sum(l.input_tokens + l.output_tokens)::bigint as tokens_brutos,
    round(sum(
      l.entrada_nova
      + l.cache_read_tokens  * coalesce(l.cache_read_mult, 1.0)
      + l.cache_write_tokens * coalesce(l.cache_write_mult, 1.0)
      + l.output_tokens
    ))::bigint                              as tokens_ponderados,
    max(l.cache_read_mult)                  as cache_read_mult,
    max(l.cache_write_mult)                 as cache_write_mult,
    bool_and(l.confirmado)                  as preco_confirmado,
    case when bool_and(l.confirmado) then
      round(sum(
        (l.entrada_nova
          + l.cache_read_tokens  * coalesce(l.cache_read_mult, 1.0)
          + l.cache_write_tokens * coalesce(l.cache_write_mult, 1.0)
        ) * coalesce(l.input_usd_mtok, 0)
        + l.output_tokens * coalesce(l.output_usd_mtok, 0)
      ) / 1000000.0, 6)
    end                                     as custo_usd
  from linhas l
  group by l.cliente, l.origem, l.kind, l.provider, l.model, l.purpose
  order by sum(l.input_tokens + l.output_tokens) desc;
$$;

revoke execute on function public.faturamento_detalhe(timestamptz, timestamptz, text[], text) from anon;

-- =====================================================================
-- CONSUMO POR MENSAGEM — o "quanto ESTA mensagem custou", agora exato
--
-- Junta pelo `turn_id`, não por janela de tempo. Sem isso, dois turnos em
-- paralelo do mesmo cliente embaralham as chamadas e nenhuma das duas
-- mensagens fica com o número certo.
--
-- Turnos gravados ANTES desta migration não têm `turn_id` e simplesmente não
-- aparecem aqui — preferível a aparecerem com um número inventado por
-- proximidade de horário.
-- =====================================================================

drop function if exists public.faturamento_por_mensagem(timestamptz, timestamptz, text[]);

create function public.faturamento_por_mensagem(
  p_from timestamptz,
  p_to timestamptz,
  p_origens text[] default array['widget']
)
returns table (
  turn_id uuid,
  conversation_id uuid,
  cliente text,
  criado_em timestamptz,
  pergunta text,
  chamadas bigint,
  entrada_total bigint,
  cache_read bigint,
  cache_write bigint,
  saida bigint,
  tokens_brutos bigint,
  tokens_ponderados bigint
)
  language sql
  stable
  set search_path = public, extensions
as $$
  select
    u.turn_id,
    -- `max(uuid)` não existe no Postgres, e agrupar por conversation_id junto
    -- partiria o turno em dois quando alguma chamada gravasse nulo. Pega o
    -- primeiro não-nulo do grupo, que é o valor certo: um turno é de uma
    -- conversa só.
    (array_agg(u.conversation_id) filter (where u.conversation_id is not null))[1]
                                                                  as conversation_id,
    coalesce(nullif(trim(max(u.p_base)), ''), '(sem cliente)')     as cliente,
    min(u.created_at)                                             as criado_em,
    -- A pergunta do usuário daquele turno: a última mensagem `user` anterior à
    -- resposta marcada com este turn_id. Só para leitura humana no painel.
    (select left(m2.content, 160)
       from public.messages m1
       join public.messages m2
         on m2.conversation_id = m1.conversation_id
        and m2.role = 'user'
        and m2.created_at <= m1.created_at
      where m1.turn_id = u.turn_id
      order by m2.created_at desc
      limit 1)                                                    as pergunta,
    count(*)::bigint                                              as chamadas,
    sum(u.input_tokens)::bigint                                   as entrada_total,
    sum(u.cache_read_tokens)::bigint                              as cache_read,
    sum(u.cache_write_tokens)::bigint                             as cache_write,
    sum(u.output_tokens)::bigint                                  as saida,
    sum(u.input_tokens + u.output_tokens)::bigint                 as tokens_brutos,
    round(sum(
      greatest(u.input_tokens - u.cache_read_tokens - u.cache_write_tokens, 0)
      + u.cache_read_tokens  * coalesce(pr.cache_read_mult, 1.0)
      + u.cache_write_tokens * coalesce(pr.cache_write_mult, 1.0)
      + u.output_tokens
    ))::bigint                                                    as tokens_ponderados
  from public.ai_usage u
  left join lateral (
    select p.cache_read_mult, p.cache_write_mult
      from public.ai_model_prices p
     where p.provider = u.provider and p.model = u.model and p.vigente_desde <= u.created_at
     order by p.vigente_desde desc
     limit 1
  ) pr on true
  where u.created_at >= p_from
    and u.created_at < p_to
    and u.origem = any (p_origens)
    and u.turn_id is not null
  group by u.turn_id
  order by min(u.created_at) desc;
$$;

revoke execute on function public.faturamento_por_mensagem(timestamptz, timestamptz, text[]) from anon;
