-- =====================================================================
-- O PORTÃO PERDE A PARTE QUE PRECISA DO FOLD, E GANHA UM MODO NOVO
--
-- Duas mudanças, e a primeira é urgente: esta função referenciava
-- `ai_creditos_extra.ciclo_inicio`, renomeada na migration das 03:06.
-- Ela roda A CADA TURNO do chat, então qualquer base COM plano passou a
-- receber `errorMissingColumn` — verificado contra o banco antes desta
-- correção (natcorp escapava só porque sai antes, por não ter contrato).
--
-- ── Por que o saldo da base sai daqui ───────────────────────────────
-- O saldo do adicional virou um fold sobre os ciclos, com teto em cada
-- passo (ver `src/lib/gestao/creditos.ts`). Reimplementar isso aqui em
-- plpgsql seria a MESMA regra escrita duas vezes, e duas cópias de regra
-- de dinheiro divergem sem ninguém perceber.
--
-- Então a divisão passa a ser:
--   · aqui  — a cota por perfil/usuário/painel, que é do ciclo corrente
--             e não depende de histórico;
--   · no TS — o saldo da base, via `lerSaldo`, que já faz o fold e já
--             está cacheado por 30s em `portao.ts`.
--
-- ── E o modo novo ───────────────────────────────────────────────────
-- Zerar o saldo deixou de derrubar o turno. Decisão do dono: o chat
-- continua, mas só com a documentação do sistema — sem nenhuma
-- ferramenta. Quem decide isso é o TS, com o saldo em mãos; esta função
-- só precisa parar de opinar sobre o crédito da base.
-- =====================================================================

create or replace function public.gestao_portao_credito(
  p_base text,
  p_painel text default null,
  p_perfil text default null,
  p_usuario text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_base text := lower(btrim(p_base));
  v_pl record;
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
    return jsonb_build_object('permitido', true, 'motivo', 'sem_alocacao');
  end if;

  select coalesce(sum(u.input_tokens + u.output_tokens), 0)::numeric / nullif(v_pl.tokens_por_credito, 0)
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

comment on function public.gestao_portao_credito(text, text, text, text) is
  'Cota por perfil/usuário/painel do ciclo corrente. O saldo da BASE não é decidido aqui: depende do fold do adicional acumulado, que vive em src/lib/gestao/creditos.ts.';

revoke all on function public.gestao_portao_credito(text, text, text, text) from public, anon, authenticated;
grant execute on function public.gestao_portao_credito(text, text, text, text) to service_role;
