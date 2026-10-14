-- =====================================================================
-- PREÇOS CONFERIDOS NA FONTE (14/10/2026): família Claude 5.5 e GPT-5.6 Sol
--
-- Motivo: benchmark Maritaca × OpenAI × Claude de 14/10. A avaliação ABORTA
-- quando o modelo não tem preço (custo-da-rodada.ts: nulo não é zero), e os
-- três Claude 5.5 respondem pela chave do sistema sem linha em
-- ai_model_prices. Sem esta migration o consumo deles também sairia sem custo
-- na tela de faturamento.
--
-- Fontes lidas nesta data (US$ por 1M tokens, nível padrão):
--   · https://platform.claude.com/docs/en/about-claude/pricing
--   · https://developers.openai.com/api/docs/pricing
--
-- ── Claude 5.5 ──────────────────────────────────────────────────────
--   Haiku 5.5   0,10 / 0,50  (prompt até 100 mil tokens; acima: 0,50 / 2,50)
--   Sonnet 5.5  2,00 / 10,00
--   Opus 5.5    4,00 / 20,00
-- Cache: escrita de 5 min = 1,25× a entrada (as três). Leitura: Sonnet 5.5 e
-- Opus 5.5 cobram 0,05× (nota 2 da página); Haiku 5.5, 0,10× (padrão).
-- A faixa acima de 100 mil do Haiku 5.5 fica fora: a tabela não tem preço por
-- faixa, e os turnos do chat medem ~12 mil tokens de entrada. Se um dia
-- passarem de 100 mil, este preço SUBESTIMA o Haiku 5.5.
--
-- ── GPT-5.6 Sol ─────────────────────────────────────────────────────
-- A linha de 08/08 diz 5,00 / 30,00. A página hoje publica 4,00 / 20,00
-- (cache 0,40), como preço PROMOCIONAL "pelo menos até 21/11/2026", sem dizer
-- desde quando. Entra linha nova vigente a partir de HOJE, sem editar a
-- antiga: o consumo anterior continua no preço maior (lado conservador). Quando
-- a promoção acabar, entra outra linha com a data publicada.
-- "gpt-5.6" sem sufixo responde como gpt-5.6-sol (sondado em 14/10), mas não
-- tem linha na página; não cadastro preço para um apelido.
--
-- Idempotente: re-rodar só reescreve os mesmos valores.
-- =====================================================================

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte, vigente_desde)
values
  ('anthropic', 'claude-haiku-5-5', 0.10, 0.50, 0.10, 1.25, true,
   'platform.claude.com pricing 14/10/2026: 0,10 / 0,50 / cache 0,01 (prompt <= 100 mil)', '1970-01-01T00:00:00Z'),
  ('anthropic', 'claude-sonnet-5-5', 2.00, 10.00, 0.05, 1.25, true,
   'platform.claude.com pricing 14/10/2026: 2,00 / 10,00 / cache 0,10', '1970-01-01T00:00:00Z'),
  ('anthropic', 'claude-opus-5-5', 4.00, 20.00, 0.05, 1.25, true,
   'platform.claude.com pricing 14/10/2026: 4,00 / 20,00 / cache 0,20', '1970-01-01T00:00:00Z'),
  ('openai', 'gpt-5.6-sol', 4.00, 20.00, 0.10, 1.00, true,
   'developers.openai.com pricing 14/10/2026: 4,00 / 20,00 / cache 0,40, promocional pelo menos até 21/11/2026', '2026-10-14T00:00:00-03:00')
on conflict (provider, model, vigente_desde) do update set
  input_usd_mtok   = excluded.input_usd_mtok,
  output_usd_mtok  = excluded.output_usd_mtok,
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  confirmado       = excluded.confirmado,
  fonte            = excluded.fonte;
