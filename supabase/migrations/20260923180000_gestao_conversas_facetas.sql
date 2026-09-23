-- =====================================================================
-- AS OPÇÕES DOS FILTROS DE CONVERSAS SAEM DO PRÓPRIO RELATÓRIO
--
-- Pedido do dono (23/09): a tela de Conversas precisa de filtros por
-- período, painel, perfil, usuário, empresa e matrícula, e as listas
-- devem "retornar o que tem no relatório".
--
-- ── Por que não reusar `gestao_consumo_facetas` ──────────────────────
-- Aquela lê `ai_usage`, que é consumo de TOKEN. Esta lê `conversations`.
-- Os dois conjuntos não coincidem: há conversa sem consumo registrado
-- (respondida só pela documentação, por exemplo) e há consumo de origem
-- que não é conversa. Oferecer no filtro de Conversas um usuário que só
-- aparece em `ai_usage` produz o pior tipo de filtro: o que existe na
-- lista e devolve zero linha, sem explicar por quê.
--
-- ── Por que RPC e não `select` paginado ─────────────────────────────
-- É o teto de 1.000 linhas do PostgREST, que já mordeu este projeto sete
-- vezes. Montar a lista lendo as conversas e deduzindo em JavaScript
-- funcionaria até a base passar de mil conversas no período; daí em
-- diante um usuário sumiria da lista sem nenhum sinal. `distinct` roda
-- onde os dados estão.
--
-- `hidden_at is null` acompanha o que a listagem já faz: conversa oculta
-- não aparece no relatório, então não pode aparecer no filtro dele.
-- =====================================================================

drop function if exists public.gestao_conversas_facetas(text, timestamptz, timestamptz);

create function public.gestao_conversas_facetas(
  p_base text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (eixo text, valor text, conversas bigint)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with linhas as (
    select c.p_portal, c.p_perfil, c.p_usuario, c.p_empresa, c.p_matricula
      from public.conversations c
     where lower(btrim(c.p_base)) = lower(btrim(p_base))
       and c.hidden_at is null
       and c.created_at >= p_from
       and c.created_at <  p_to
  ),
  eixos as (
    select 'painel'    as eixo, btrim(p_portal)    as valor from linhas
    union all select 'perfil',    btrim(p_perfil)    from linhas
    union all select 'usuario',   btrim(p_usuario)   from linhas
    union all select 'empresa',   btrim(p_empresa)   from linhas
    union all select 'matricula', btrim(p_matricula) from linhas
  )
  select eixo, valor, count(*)::bigint as conversas
    from eixos
   where valor is not null and valor <> ''
   group by eixo, valor
   -- Frequência primeiro: quem mais conversa é quem mais se procura.
   order by eixo, count(*) desc, valor;
$$;

comment on function public.gestao_conversas_facetas(text, timestamptz, timestamptz) is
  'Valores distintos presentes nas CONVERSAS da base no período, por eixo, com contagem. Alimenta os filtros da tela de Conversas — separada de gestao_consumo_facetas, que lê ai_usage e não coincide.';

revoke all on function public.gestao_conversas_facetas(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.gestao_conversas_facetas(text, timestamptz, timestamptz) to service_role;
