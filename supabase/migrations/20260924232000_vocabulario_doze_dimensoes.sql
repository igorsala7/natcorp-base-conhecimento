-- =====================================================================
-- O VOCABULÁRIO PASSA DE DUAS DIMENSÕES PARA DOZE
--
-- `vocabulario_rastreio` devolvia só `perfil` e `empresa`, porque nasceu
-- para o formulário de prompts sugeridos. Agora ela é o instrumento de
-- DIAGNÓSTICO da elegibilidade: a tela oferece as doze dimensões sempre
-- (decisão do dono), e o que evita a regra impossível virar chamado de
-- suporte é dizer, ao lado, se aquela base já enviou algum valor naquela
-- dimensão.
--
-- ── Por que presença de dimensão, e não contagem de pessoas ─────────
-- A primeira versão do desenho contava quantos usuários uma regra
-- alcançava. Medido em 24/09: `natcorp` tem 317 conversas e 4 valores
-- distintos de `p_usuario`; a maior base conhece 7 usuários. Um contador
-- mostraria 0 ou 1 para qualquer regra e seria impossível distinguir
-- "regra impossível" de "pouca gente usou o chatbot". Presença de
-- dimensão é respondível com 7 usuários; contagem de pessoas não é.
--
-- `campo` usa o nome da DIMENSÃO (`centro_custo`), não o do parâmetro
-- (`p_centro_custo`), para casar com src/lib/elegibilidade/dimensoes.ts.
-- Traduzir de um lado só já custou um bug neste projeto.
-- =====================================================================

-- ── `create or replace`, e NÃO `drop` + `create` ─────────────────────
-- Este arquivo fazia `drop function` + `create function`. Função recém
-- criada nasce com EXECUTE para PUBLIC, e o `grant` daqui somava
-- `authenticated`. Como não há ledger de migrations — a convenção do
-- projeto é que reaplicar tem de ser seguro, e `npm run migrate:apply`
-- convida a isso —, reaplicar ESTE arquivo desfazia em silêncio a
-- correção de segurança de `20260925003000` e devolvia a enumeração de
-- matrícula entre clientes a qualquer conta autenticada. `security
-- definer` + `base_ref` nulo devolve perfil, empresa, usuário e matrícula
-- de TODOS os clientes.
--
-- `create or replace` preserva o ACL e não pode mudar o tipo de retorno —
-- medido na revisão da tarefa: o retorno não mudou entre a versão de duas
-- dimensões e esta, então o `replace` basta.
create or replace function public.vocabulario_rastreio(base_ref text default null)
returns table (campo text, valor text, conversas bigint)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with base as (
    select c.p_portal, c.p_perfil, c.p_usuario, c.p_empresa, c.p_matricula,
           c.p_filial, c.p_centro_custo, c.p_unidade_adm,
           c.p_unidade_negocio, c.p_vinculo, c.p_sindicato
      from public.conversations c
     -- Sem base = todas: é o vocabulário do catálogo GLOBAL da Natcorp,
     -- que precisa enxergar os valores de todos os clientes.
     where base_ref is null
        or lower(btrim(c.p_base)) = lower(btrim(base_ref))
  ),
  longo as (
    select 'portal'::text          as campo, b.p_portal          as valor from base b
    union all select 'perfil',          b.p_perfil          from base b
    union all select 'usuario',         b.p_usuario         from base b
    union all select 'empresa',         b.p_empresa         from base b
    union all select 'matricula',       b.p_matricula       from base b
    union all select 'filial',          b.p_filial          from base b
    union all select 'centro_custo',    b.p_centro_custo    from base b
    union all select 'unidade_adm',     b.p_unidade_adm     from base b
    union all select 'unidade_negocio', b.p_unidade_negocio from base b
    union all select 'vinculo',         b.p_vinculo         from base b
    union all select 'sindicato',       b.p_sindicato       from base b
  )
  select l.campo, btrim(l.valor), count(*)::bigint
    from longo l
   where l.valor is not null and btrim(l.valor) <> ''
   group by l.campo, btrim(l.valor)
  -- Frequência primeiro: põe na frente o que o admin escolhe em 90% das
  -- vezes. Alfabético poria 'ADM_COORD_SUP' antes de 'MASTER'.
  order by 1, 3 desc, 2;
$$;

comment on function public.vocabulario_rastreio(text) is
  'Valores DISTINTOS já vistos por dimensão de elegibilidade nas conversas da base (ou de todas, se base_ref é nulo), com contagem. Alimenta o diagnóstico "esta base nunca enviou valor nesta dimensão". `campo` usa o nome da dimensão, não o do parâmetro p_*.';

-- SÓ `service_role`. O único consumidor (`vocabularioDoEscopo`) usa
-- `createAdminClient()`, e as funções irmãs (gestao_ciclos,
-- gestao_conversas_facetas, prompts_sugeridos) são todas `postgres,
-- service_role`. `authenticated` aqui era erro de quem escreveu o plano, e
-- custou a correção de `20260925003000`.
revoke all on function public.vocabulario_rastreio(text) from public, anon, authenticated;
grant execute on function public.vocabulario_rastreio(text) to service_role;

-- A assertiva é o teste de regressão DESTE arquivo: reaplicá-lo sozinho não
-- pode mais alargar o acesso.
do $$
declare
  v_quem text;
begin
  select string_agg(distinct grantee, ', ' order by grantee)
    into v_quem
    from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'vocabulario_rastreio';
  assert v_quem = 'postgres, service_role',
    'grants de vocabulario_rastreio deveriam ser postgres, service_role — vieram: ' || coalesce(v_quem, '(nenhum)');
end $$;

-- `base` não entra no vocabulário: a base é o filtro, não uma dimensão a
-- descobrir. Oferecê-la aqui deixaria a tela sugerir restringir um
-- conteúdo da base X à base Y.
