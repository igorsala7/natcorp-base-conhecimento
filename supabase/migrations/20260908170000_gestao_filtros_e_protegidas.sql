-- =====================================================================
-- (1) FERRAMENTAS QUE NÃO PODEM SER BLOQUEADAS
-- (2) FILTROS NO CONSUMO (painel, perfil, usuário, empresa, matrícula)
-- =====================================================================

-- ── (1) `protegida_de_bloqueio` ─────────────────────────────────────────
--
-- As consultas de ESTRUTURA são tabelas de domínio: empresas, filiais, cargos,
-- centros de custo, sindicatos, situações funcionais. Elas quase nunca são o
-- objetivo da pergunta — são o que o agente usa para TRADUZIR o resto. Sem
-- "Estrutura: Centros de Custo", um pedido por centro de custo vira um código
-- que ninguém reconhece, e o sintoma aparece longe da causa: a resposta sai
-- errada numa consulta de folha, e a regra que a quebrou está em outro módulo.
--
-- Por isso elas ficam fora do alcance das regras de bloqueio, na UI e no
-- servidor. É coluna, e não lista fixa no código, para o dono mudar de ideia
-- sem deploy.
--
-- ── Por que NÃO reusar `always_include` ────────────────────────────────
-- São coisas diferentes que hoje coincidem em parte. `always_include` diz
-- "ignore o recorte por assunto" — é sobre ROTEAMENTO. Esta diz "ninguém pode
-- desligar" — é sobre PERMISSÃO. Duas das seis `always_include` atuais
-- (`informacoes_pessoais_funcionais` e `meus_dados`) são dado pessoal, e travar
-- o bloqueio delas seria tirar do cliente a capacidade de restringir justamente
-- o que ele mais quer restringir.

alter table public.ai_tools
  add column if not exists protegida_de_bloqueio boolean not null default false;

comment on column public.ai_tools.protegida_de_bloqueio is
  'Ferramenta transversal que não pode ser desligada por regra de acesso do cliente (ai_acesso_regras). São as tabelas de domínio — estrutura e menu de opções — sem as quais outras consultas devolvem código em vez de nome. Diferente de always_include, que é sobre roteamento por assunto, não sobre permissão.';

-- As de estrutura e o menu de opções. `informacoes_pessoais_funcionais` e
-- `meus_dados` ficam DE FORA de propósito: são dados de pessoa, e bloqueá-los
-- é um pedido legítimo do cliente.
update public.ai_tools
   set protegida_de_bloqueio = true
 where key like 'estrutura\_%'
    or key = 'lista_opcoes';

-- ── (2) Consumo com filtros ─────────────────────────────────────────────
--
-- Ganha `empresa` e `matricula` nas colunas e cinco parâmetros de filtro. Os
-- filtros são de IGUALDADE (case-insensitive), não `ilike '%x%'`: aqui se
-- procura o perfil FOLHA, não "tudo que contém FOLHA" — e um `%` no meio faria
-- FOLHA casar com FOLHA_ADM sem ninguém pedir.
--
-- Nulo em qualquer parâmetro = sem filtro naquele eixo. Diferente de filtrar
-- por vazio, que devolveria só as linhas SEM aquele campo.

drop function if exists public.gestao_consumo(text, timestamptz, timestamptz);
drop function if exists public.gestao_consumo(text, timestamptz, timestamptz, text, text, text, text, text);

create function public.gestao_consumo(
  p_base text,
  p_from timestamptz,
  p_to timestamptz,
  p_painel text default null,
  p_perfil text default null,
  p_usuario text default null,
  p_empresa text default null,
  p_matricula text default null
)
returns table (
  painel text,
  perfil text,
  usuario text,
  empresa text,
  matricula text,
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
    coalesce(nullif(btrim(u.p_portal),    ''), '(não atribuído)') as painel,
    coalesce(nullif(btrim(u.p_perfil),    ''), '(não atribuído)') as perfil,
    coalesce(nullif(btrim(u.p_usuario),   ''), '(não atribuído)') as usuario,
    coalesce(nullif(btrim(u.p_empresa),   ''), '(não atribuído)') as empresa,
    coalesce(nullif(btrim(u.p_matricula), ''), '(não atribuído)') as matricula,
    count(*)::bigint                                          as chamadas,
    count(distinct u.conversation_id)::bigint                 as conversas,
    coalesce(sum(u.input_tokens), 0)::bigint                  as tokens_entrada,
    coalesce(sum(u.output_tokens), 0)::bigint                 as tokens_saida,
    coalesce(sum(u.input_tokens + u.output_tokens), 0)::bigint as tokens_brutos,
    round(coalesce(sum(u.input_tokens + u.output_tokens), 0) / 1000000.0, 4) as creditos,
    (u.p_portal is not null and u.p_perfil is not null and u.p_usuario is not null) as atribuido
  from public.ai_usage u
  where lower(btrim(u.p_base)) = lower(btrim(p_base))
    and u.origem = 'widget'
    and u.created_at >= p_from
    and u.created_at <  p_to
    and (p_painel    is null or upper(btrim(u.p_portal))    = upper(btrim(p_painel)))
    and (p_perfil    is null or lower(btrim(u.p_perfil))    = lower(btrim(p_perfil)))
    and (p_usuario   is null or lower(btrim(u.p_usuario))   = lower(btrim(p_usuario)))
    and (p_empresa   is null or lower(btrim(u.p_empresa))   = lower(btrim(p_empresa)))
    and (p_matricula is null or lower(btrim(u.p_matricula)) = lower(btrim(p_matricula)))
  group by 1, 2, 3, 4, 5, 12
  order by sum(u.input_tokens + u.output_tokens) desc;
$$;

comment on function public.gestao_consumo(text, timestamptz, timestamptz, text, text, text, text, text) is
  'Consumo em créditos de UMA base, por painel × perfil × usuário × empresa × matrícula, com filtro opcional em cada eixo. `atribuido = false` marca o que não pode ser imputado a um recorte.';

revoke execute on function public.gestao_consumo(text, timestamptz, timestamptz, text, text, text, text, text) from anon, authenticated;

-- ── Valores disponíveis para os filtros ─────────────────────────────────
-- Alimenta os seletores com o que EXISTE no período, e não com uma lista fixa:
-- oferecer um perfil que nunca apareceu produz filtro que devolve tela vazia e
-- parece defeito.
drop function if exists public.gestao_consumo_facetas(text, timestamptz, timestamptz);

create function public.gestao_consumo_facetas(
  p_base text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (eixo text, valor text, chamadas bigint)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  with linhas as (
    select u.p_portal, u.p_perfil, u.p_usuario, u.p_empresa, u.p_matricula
      from public.ai_usage u
     where lower(btrim(u.p_base)) = lower(btrim(p_base))
       and u.origem = 'widget'
       and u.created_at >= p_from
       and u.created_at <  p_to
  ),
  eixos as (
    select 'painel'    as eixo, btrim(p_portal)    as valor from linhas
    union all select 'perfil',    btrim(p_perfil)    from linhas
    union all select 'usuario',   btrim(p_usuario)   from linhas
    union all select 'empresa',   btrim(p_empresa)   from linhas
    union all select 'matricula', btrim(p_matricula) from linhas
  )
  select eixo, valor, count(*)::bigint as chamadas
    from eixos
   where valor is not null and valor <> ''
   group by eixo, valor
   order by eixo, count(*) desc, valor;
$$;

revoke execute on function public.gestao_consumo_facetas(text, timestamptz, timestamptz) from anon, authenticated;
