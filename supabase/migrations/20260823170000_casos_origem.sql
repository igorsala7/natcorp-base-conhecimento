-- DE ONDE VEIO O CASO: do gabarito anotado à mão, ou da captura automática.
--
-- `ai_tool_casos` vai receber duas populações de naturezas opostas, e a
-- migration de 17/08 já dizia por quê: o rótulo humano é "caro, raro e
-- confiável" e o sinal automático é "barato, abundante e ambíguo".
--
-- Sem um discriminador explícito, o carregador do gabarito
-- (`scripts/carregar-casos-rotulados.ts`) não consegue reexecutar sem risco:
-- ele apaga e regrava, e precisa saber o que é dele. Medido em 23/08/2026:
-- 574 de 1.402 turnos (41%) repetem exatamente uma pergunta anterior, e 48 das
-- 138 perguntas do gabarito já reapareceram em produção, somando 126 turnos.
-- Casar por texto da pergunta apagaria turnos reais.
--
-- ── Por que uma coluna, e não `conversation_id is null` ────────────────────
-- Foi a primeira ideia, e ela se desfez na auditoria: as linhas do gabarito
-- DEVEM ter `conversation_id` e `trace_id`, porque é o elo que permite
-- recomputar o veredito contra uma rodada nova e recuperar tudo o que o gabarito
-- não guarda (perfil, base, espaço). Jogar o elo fora para usá-lo de bandeira
-- seria trocar dado por convenção.
--
-- `rotulado_em is not null` também não serve: um caso capturado e depois
-- rotulado por gente teria os dois preenchidos e viraria alvo do carregador.
--
-- A origem é fato do REGISTRO, não do conteúdo. Merece coluna.

alter table public.ai_tool_casos
  add column if not exists origem text not null default 'runtime'
  check (origem in ('gabarito', 'runtime'));

comment on column public.ai_tool_casos.origem is
  'gabarito = veio de eval/cenarios.jsonl, rotulado à mão, e o carregador pode reescrever. runtime = capturado da rota de chat; só um humano rotula, e nenhum script apaga.';

-- As 138 que já estão lá são o gabarito: foram inseridas pelo carregador em
-- 23/08, antes desta coluna existir, e pegariam o default 'runtime'.
update public.ai_tool_casos
   set origem = 'gabarito'
 where conversation_id is null and veredito is not null and origem = 'runtime';

-- A fila de trabalho humano é a captura sem veredito. Índice parcial: a fila é
-- pequena e a consulta é constante.
create index if not exists ai_tool_casos_origem_idx
  on public.ai_tool_casos (space_id, origem, created_at desc);

do $$
declare n_gab int; n_run int;
begin
  select count(*) into n_gab from public.ai_tool_casos where origem = 'gabarito';
  select count(*) into n_run from public.ai_tool_casos where origem = 'runtime';
  raise notice 'ai_tool_casos: % do gabarito, % de runtime', n_gab, n_run;
  if n_gab = 0 then
    raise exception 'nenhuma linha marcada como gabarito — o backfill não pegou, e o carregador vai duplicar';
  end if;
end $$;
