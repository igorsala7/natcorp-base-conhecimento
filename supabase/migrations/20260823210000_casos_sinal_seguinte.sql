-- O QUE O TURNO SEGUINTE DISSE SOBRE ESTE.
--
-- `veredito` é o julgamento de GENTE e continua sendo. Esta coluna é de outra
-- natureza: quando a pessoa corrige o agente na mensagem seguinte — "Você não
-- fez o word", "Mas eu não pedi amostra", "De novo??? Eu estou falando que é só
-- da minha equipe!" —, ela está dizendo que o turno anterior errou, de graça e
-- sem saber que está rotulando.
--
-- A migration de 17/08 separou rótulo humano ("caro, raro e confiável") de sinal
-- automático ("barato, abundante e ambíguo") e o motivo vale aqui inteiro: este
-- sinal é da segunda espécie. Ele serve para ORDENAR a fila de quem vai rotular
-- — o caso que o próprio usuário reclamou vem primeiro — e NUNCA para dispensar
-- o julgamento. Por isso coluna própria, e não um valor a mais no check do
-- veredito: misturar apagaria a diferença que dá valor ao segundo.
--
-- Medido em 23/08 sobre os 1.424 turnos gravados: marca 14 (1,0%), e os 14 são
-- correção legítima — nenhum falso positivo. A cobertura NÃO é completa de
-- propósito: o detector fica calado na dúvida, porque marcar um turno bom rouba
-- a atenção de quem julga, enquanto um erro não marcado só espera na fila.

alter table public.ai_tool_casos
  add column if not exists sinal_seguinte text
  check (sinal_seguinte is null or sinal_seguinte in ('corrigido_pelo_usuario'));

comment on column public.ai_tool_casos.sinal_seguinte is
  'Sinal AUTOMÁTICO lido do turno seguinte (ex.: o usuário corrigiu o agente). Ordena a fila de rotulagem; não é veredito e não substitui o julgamento humano.';

-- A fila que importa: caso sem veredito que o próprio usuário reclamou.
create index if not exists ai_tool_casos_reclamados_idx
  on public.ai_tool_casos (space_id, created_at desc)
  where veredito is null and sinal_seguinte is not null;
