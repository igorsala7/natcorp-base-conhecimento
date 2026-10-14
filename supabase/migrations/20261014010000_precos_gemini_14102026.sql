-- =====================================================================
-- PREÇOS DO GEMINI CONFERIDOS NA FONTE — 14/10/2026
--
-- Fontes lidas nesta data (nível pago Standard, US$ por 1M tokens):
--   · https://ai.google.dev/gemini-api/docs/pricing?hl=pt-br  (atualizada 13/10/2026)
--   · https://ai.google.dev/gemini-api/docs/deprecations?hl=pt-br
--
-- ── 1. Preço com DATA: 3.6 Flash, 3.8 Flash e 4 Argon ──────────────────
-- A página publica dois preços com vigência. 3.6/3.8 Flash: US$ 0,75 / 3,75
-- "até 31 de dezembro de 2026" e 1,50 / 7,50 "a partir de 1º de janeiro de
-- 2027". 4 Argon: 2,00 / 10,00 até 30/11/2026 e 4,00 / 20,00 a partir de
-- 01/12/2026. Entram as DUAS linhas de cada um: a consulta de faturamento
-- pega a vigente na data da chamada, então a virada acontece sozinha.
--
-- O 3.6 Flash estava em 1,50 / 7,50 (informado em 19/08). Não se sabe desde
-- quando vale o 0,75: o preço novo entra a partir de HOJE e o período antigo
-- fica com o valor mais alto, o lado conservador (nunca subestima).
--
-- ── 2. Modelos que viraram redirecionamento ────────────────────────────
-- A página de descontinuação diz que o endpoint não será desligado e que as
-- chamadas são ENCAMINHADAS: `gemini-3.5-flash` → 3.6 Flash e
-- `gemini-3.7-flash` → 3.8 Flash. Ambos estão atribuídos aqui (Estrutura da
-- importação; Chat com ferramentas e Análise de relatório), e o uso é gravado
-- com o nome pedido. Por isso recebem o preço do modelo de destino a partir
-- de hoje. O 3.7 não tinha linha nenhuma: as 279 chamadas dos últimos 30
-- dias ficam sem custo (marcadas) porque não se sabe o preço anterior ao
-- encaminhamento; preço inventado vira fatura, ausente só some da tela.
--
-- ── 3. Novos na tabela ──────────────────────────────────────────────────
-- 4 Argon, 3.8 Flash, 3.1 Pro Preview, 3 Flash Preview (legado), 2.5 Pro,
-- 2.5 Flash Lite e Gemini Embedding 2.
-- 3.1 Pro e 2.5 Pro: valor da faixa ATÉ 200 mil tokens de prompt (acima disso
-- a Google cobra mais; a tabela não tem faixa, e este uso não chega lá).
--
-- ── Multiplicador de cache (leitura ÷ entrada, da própria tabela) ────────
-- 0,10 em todos, exceto 4 Argon: 0,10 ÷ 2,00 = 0,05 (e 0,20 ÷ 4,00 depois).
--
-- ── Conferido e já estava certo (não mexer) ──────────────────────────────
-- 3.5 Flash Lite 0,30 / 2,50 · 3.1 Flash Lite 0,25 / 1,50 · 2.5 Flash 0,30 / 2,50.
--
-- ── O que segue FORA, e por quê ──────────────────────────────────────────
-- · gemini-embedding-001 sumiu da página de preços, mas segue servido até
--   14/05/2028 (substituto: gemini-embedding-2). O preço 0,15 fica como está.
--   Trocar o embedding exige reindexar TODOS os chunks: decisão à parte.
-- · Áudio, imagem, vídeo, TTS, Live e armazenamento de cache: não usados.
--
-- Idempotente: re-rodável sem efeito colateral.
-- =====================================================================

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte, vigente_desde)
values
  -- 3.6 Flash: preço reduzido até 31/12/2026, volta ao cheio em 2027.
  ('google', 'gemini-3.6-flash', 0.75, 3.75, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 0,75 / 3,75 / cache 0,075 até 31/12/2026', '2026-10-14T00:00:00-03:00'),
  ('google', 'gemini-3.6-flash', 1.50, 7.50, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 1,50 / 7,50 / cache 0,15 a partir de 01/01/2027', '2027-01-01T00:00:00-03:00'),
  -- 3.8 Flash: modelo novo, mesma tabela do 3.6.
  ('google', 'gemini-3.8-flash', 0.75, 3.75, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 0,75 / 3,75 / cache 0,075 até 31/12/2026', '1970-01-01T00:00:00Z'),
  ('google', 'gemini-3.8-flash', 1.50, 7.50, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 1,50 / 7,50 / cache 0,15 a partir de 01/01/2027', '2027-01-01T00:00:00-03:00'),
  -- Redirecionamentos (deprecations): cobrados como o destino a partir de hoje.
  ('google', 'gemini-3.5-flash', 0.75, 3.75, 0.10, 1.00, true,
   'deprecations 14/10/2026: encaminhado para gemini-3.6-flash; preço do destino', '2026-10-14T00:00:00-03:00'),
  ('google', 'gemini-3.5-flash', 1.50, 7.50, 0.10, 1.00, true,
   'deprecations 14/10/2026: encaminhado para gemini-3.6-flash; preço do destino a partir de 01/01/2027', '2027-01-01T00:00:00-03:00'),
  ('google', 'gemini-3.7-flash', 0.75, 3.75, 0.10, 1.00, true,
   'deprecations 14/10/2026: encaminhado para gemini-3.8-flash; preço do destino', '2026-10-14T00:00:00-03:00'),
  ('google', 'gemini-3.7-flash', 1.50, 7.50, 0.10, 1.00, true,
   'deprecations 14/10/2026: encaminhado para gemini-3.8-flash; preço do destino a partir de 01/01/2027', '2027-01-01T00:00:00-03:00'),
  -- 4 Argon: 2/10 até 30/11/2026, 4/20 a partir de 01/12/2026. Cache 0,05×.
  ('google', 'gemini-4-argon', 2.00, 10.00, 0.05, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 2,00 / 10,00 / cache 0,10 até 30/11/2026', '1970-01-01T00:00:00Z'),
  ('google', 'gemini-4-argon', 4.00, 20.00, 0.05, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 4,00 / 20,00 / cache 0,20 a partir de 01/12/2026', '2026-12-01T00:00:00-03:00'),
  -- Demais, sem data de mudança.
  ('google', 'gemini-3.1-pro-preview', 2.00, 12.00, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 2,00 / 12,00 / cache 0,20 (prompt <= 200 mil)', '1970-01-01T00:00:00Z'),
  ('google', 'gemini-3-flash-preview', 0.50, 3.00, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 0,50 / 3,00 / cache 0,05 (legado)', '1970-01-01T00:00:00Z'),
  ('google', 'gemini-2.5-pro', 1.25, 10.00, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 1,25 / 10,00 / cache 0,125 (prompt <= 200 mil)', '1970-01-01T00:00:00Z'),
  ('google', 'gemini-2.5-flash-lite', 0.10, 0.40, 0.10, 1.00, true,
   'ai.google.dev pricing 14/10/2026: 0,10 / 0,40 / cache 0,01', '1970-01-01T00:00:00Z'),
  ('google', 'gemini-embedding-2', 0.20, 0.00, 1.00, 1.00, true,
   'ai.google.dev pricing 14/10/2026: texto 0,20 (sem cache)', '1970-01-01T00:00:00Z')
on conflict (provider, model, vigente_desde) do update set
  input_usd_mtok   = excluded.input_usd_mtok,
  output_usd_mtok  = excluded.output_usd_mtok,
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  confirmado       = excluded.confirmado,
  fonte            = excluded.fonte;
