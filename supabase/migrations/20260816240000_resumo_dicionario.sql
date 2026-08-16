-- O QUE ESTÁ NO DICIONÁRIO AGORA, POR ORIGEM.
--
-- Relatado pelo Igor (16/08/2026): "subi uma nova leva de tabelas, colunas, tipo
-- e comentário, mas não dá pra saber se realmente foi, se substituiu o anterior,
-- se apenas adicionou — não tem feedback nenhum".
--
-- Havia feedback: a action devolve as contagens e a tela mostra um toast. Só que
-- as três perguntas dele não são sobre o EVENTO ("deu certo?"), são sobre o
-- ESTADO ("o que tem lá agora?"). Estado não se comunica com aviso efêmero — o
-- toast dura 5s, a importação de 65 mil linhas leva 12s, e a pergunta "o que tem
-- lá?" volta a ser feita amanhã.
--
-- ── Por que RPC e não consulta direta ───────────────────────────────────────
-- Contar TABELAS DISTINTAS por origem é `count(distinct db_table)`, que o
-- PostgREST não expressa. A alternativa seria trazer 65 mil linhas para contar
-- no servidor Node — a mesma troca ruim que fez a página não abrir.
--
-- `stable` + `security invoker`: a RLS de `data_dictionary` continua valendo,
-- então cada um só conta o que já poderia ler.
create or replace function public.resumo_dicionario(p_space_id uuid)
returns table (
  origem text,
  linhas bigint,
  tabelas bigint,
  com_label bigint,
  com_descricao bigint,
  com_tipo bigint,
  atualizado_em timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    source                                            as origem,
    count(*)                                          as linhas,
    count(distinct db_table)                          as tabelas,
    count(label)                                      as com_label,
    count(description)                                as com_descricao,
    -- O tipo da coluna mora em `metadata->>'data_type'`; sem ele a linha existe
    -- mas não diz se o campo é número, data ou texto.
    count(nullif(metadata->>'data_type', ''))         as com_tipo,
    max(coalesce(updated_at, created_at))             as atualizado_em
  from public.data_dictionary
  where space_id = p_space_id
    and kind = 'column'
  group by source
  order by count(*) desc;
$$;

comment on function public.resumo_dicionario(uuid) is
  'Estado atual do dicionário por origem (db_ddl/apex_dict/manual): quantas colunas, quantas tabelas, quantas têm rótulo, comentário e tipo, e quando foi a última gravação.';
