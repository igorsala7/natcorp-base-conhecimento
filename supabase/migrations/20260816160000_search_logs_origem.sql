-- DE ONDE VEIO A BUSCA
--
-- `search_logs` alimenta duas métricas que o produto trata como verdade sobre a
-- DOCUMENTAÇÃO: "buscas sem resultado" no Painel e "lacunas de conteúdo" em
-- Análises. As duas contam `results_count = 0`.
--
-- Só que a mesma tabela recebia as buscas do Cmd+K do admin. Dois problemas
-- somados, ambos inflando a métrica:
--
--  1. A equipe interna procura de outro jeito. O time digita "flow-canvas" ou o
--     nome de um cliente; o leitor do portal digita "como pedir férias". Contar
--     os dois juntos como lacuna de documentação mistura duas perguntas.
--  2. O registro era por TECLA. A busca tem debounce e gravava a cada consulta:
--     digitar "férias" produzia `fé`, `féri`, `féria`, `férias` — quatro linhas,
--     três delas com zero resultado. A métrica de lacuna crescia com o ato de
--     digitar.
--
-- A coluna separa as origens sem perder dado: "o que o time procura" continua
-- sendo informação útil, só para de ser contada como buraco de conteúdo.
--
-- O default é 'portal' de propósito: as linhas já existentes vieram do portal
-- (o admin era a exceção, não a regra), e um default 'admin' as reclassificaria
-- todas de uma vez.
alter table public.search_logs
  add column if not exists origin text not null default 'portal'
    check (origin in ('portal', 'widget', 'admin'));

comment on column public.search_logs.origin is
  'Onde a busca foi feita. Só ''portal'' conta como lacuna de documentação — admin é o time procurando, não leitor sem resposta.';

-- As métricas filtram por origem, então o índice precisa começar por ela.
create index if not exists search_logs_origem_sem_resultado_idx
  on public.search_logs (origin, created_at desc)
  where results_count = 0;
