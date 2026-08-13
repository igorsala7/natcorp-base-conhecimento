-- Os ARGUMENTOS que a pessoa confirmou.
--
-- A pendência já guardava `detail` — o resumo em TEXTO que virou a pergunta
-- ("confirma criar a requisição — cod_empresa: 700 · dt_saida_1: 2026-10-01…").
-- Texto serve para perguntar, não para executar: quem executava era o modelo,
-- reemitindo os 25 parâmetros a cada tentativa.
--
-- Isso custou caro em duas frentes ao mesmo tempo (conversa de 13/08/2026):
--   · CORREÇÃO — os valores atravessavam uma reinterpretação em linguagem
--     natural entre o "sim" e a gravação;
--   · CUSTO — o turno do "sim" reenviava 30+ ferramentas e 3.268 tokens de
--     documentação para o modelo redescobrir uma conclusão que o servidor já
--     tinha tomado ao registrar a pendência.
--
-- Com os argumentos aqui, o servidor executa o que a pessoa VIU e confirmou, e
-- o modelo só redige o resultado.
alter table public.ai_pending_confirmations
  add column if not exists args jsonb;

comment on column public.ai_pending_confirmations.args is
  'Argumentos exatos que a pessoa confirmou. O servidor executa ESTES — o modelo não reemite.';
