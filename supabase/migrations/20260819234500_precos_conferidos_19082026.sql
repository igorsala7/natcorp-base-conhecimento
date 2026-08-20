-- =====================================================================
-- PREÇOS CONFERIDOS NA FONTE — 19/08/2026
--
-- Fontes indicadas pelo responsável e lidas nesta data:
--   · https://platform.claude.com/docs/en/about-claude/pricing
--   · https://developers.openai.com/api/docs/pricing?latest-pricing=standard
--   · https://ai.google.dev/gemini-api/docs/pricing
--
-- Google e OpenAI conferiram INTEGRALMENTE com o que já estava cadastrado.
-- Duas correções, ambas na conta de quem já usa o sistema:
--
-- ── 1. claude-sonnet-5 estava 50% CARO ─────────────────────────────────
-- Tínhamos US$ 3,00 / 15,00. O oficial é US$ 2,00 / 10,00, e a documentação
-- é explícita: o preço promocional de lançamento VIROU o padrão, e o aumento
-- para 3/15 que estava marcado para 01/09/2026 não vai acontecer.
--
-- Isso não é detalhe de catálogo — o sonnet-5 entrou na comparação de modelos
-- de 19/08 custando US$ 424,38 por 1.000 turnos, e o número certo é ~283. A
-- conclusão (não trocar) não muda, mas o número que a sustentava estava errado,
-- e um erro para MAIS num modelo caro é o tipo que ninguém vai conferir.
--
-- ── 2. gpt-5.2 voltou à tabela pública ─────────────────────────────────
-- A migration de 08/08 o deixou sem preço de propósito: ele tinha saído da
-- tabela da OpenAI e um valor deduzido seria pior que célula vazia. Hoje ele
-- está publicado (US$ 1,75 entrada · US$ 0,175 cache · US$ 14,00 saída), e há
-- consumo dele no histórico — sem a linha, aquele período fica sem custo.
--
-- ── Multiplicadores de cache ────────────────────────────────────────────
-- Anthropic: leitura 0,1× e escrita 1,25× (TTL de 5 min) valem para toda a
-- linha — é o que a própria tabela de multiplicadores publica, não uma divisão
-- que eu fiz. O TTL de 1 hora custa 2× para gravar e não é usado aqui.
-- OpenAI gpt-5.2: US$ 0,175 ÷ US$ 1,75 = 0,10, igual ao resto da família 5.x.
-- =====================================================================

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte)
values
  ('anthropic', 'claude-sonnet-5', 2.00, 10.00, 0.10, 1.25, true,
   'platform.claude.com/docs/en/about-claude/pricing — 19/08/2026 (2/10 virou padrão; o aumento de 01/09 foi cancelado)'),
  ('openai', 'gpt-5.2', 1.75, 14.00, 0.10, 1.00, true,
   'developers.openai.com/api/docs/pricing — 19/08/2026 (entrada 1,75 · cache 0,175 · saída 14,00)')
on conflict (provider, model, vigente_desde) do update set
  input_usd_mtok   = excluded.input_usd_mtok,
  output_usd_mtok  = excluded.output_usd_mtok,
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  confirmado       = excluded.confirmado,
  fonte            = excluded.fonte;

-- ── O que foi CONFERIDO e já estava certo (não mexer) ────────────────────
-- anthropic: haiku-4-5 1/5 · opus-5 5/25 · opus-4-8 5/25 · fable-5 10/50
-- google:    3.6-flash 1,50/7,50 · 3.5-flash 1,50/9 · 3.5-flash-lite 0,30/2,50
--            (cache 0,03 ÷ 0,30 = 0,10) · embedding-001 0,15
-- openai:    5.6-luna 0,20/1,20 · 5.6-terra 2/12 · 5.6-sol 5/30 · 5.5 5/30
--            4o 2,50/10 (cache 1,25 ÷ 2,50 = 0,50) · 4o-mini 0,15/0,60 (0,50)
--            embeddings 0,02 / 0,13 / 0,10
--
-- ── O que segue FORA desta tabela, e por quê ─────────────────────────────
-- · Armazenamento do cache explícito do Gemini (US$ 1,00/1M por HORA): cobrado
--   por tempo, não por token, e o cache explícito não é usado aqui.
-- · Busca web da Anthropic (US$ 10 por 1.000 buscas) e execução de código
--   (US$ 0,05 por hora de contêiner): cobrados por evento e por tempo.
-- · `whisper-1`: áudio é cobrado por MINUTO e a chamada nem passa pelo
--   registro de consumo. Custo real fora deste relatório.
