-- =====================================================================
-- PREÇOS DA MARITACA EM DÓLAR — 14/10/2026
--
-- Fontes lidas nesta data:
--   · https://docs.maritaca.ai/pt/precos   (tabela completa, inclusive br-sp e cache)
--   · https://www.maritaca.ai/planos/      (mesmos preços; publica o câmbio)
--
-- A Maritaca cobra em REAIS e `ai_model_prices` é em dólar. A migration de
-- 13/10 deixou o US$ nulo e `confirmado = false` até haver um câmbio para usar.
-- Decisão do dono (14/10): converter pelo câmbio que a PRÓPRIA Maritaca
-- publica na página de planos, US$ 1 ≈ R$ 5,14. A conta fica escrita abaixo
-- (R$ ÷ 5,14) para quem conferir ver de onde saiu cada número.
--
-- Câmbio mudou? Não edite estas linhas: insira linhas novas com
-- `vigente_desde` = data da mudança. A consulta de faturamento pega o preço
-- vigente NA DATA da chamada, e o histórico continua batendo.
--
-- Estas linhas atualizam as de vigência 1970 criadas em 13/10. Não houve
-- chamada paga à Maritaca antes daqui (a conta estava sem crédito), então
-- não há período antigo que mereça outro preço.
--
-- ── Cache ───────────────────────────────────────────────────────────────
-- Input em cache custa 1/4 do input (R$ 1,25 ÷ R$ 5,00; nos br-sp, R$ 1,63 ÷
-- R$ 6,50 = 0,2508, arredondamento da própria tabela). Cache é automático,
-- sem prêmio de escrita: `cache_write_mult` = 1,0.
--
-- ── O que segue FORA desta tabela, e por quê ─────────────────────────────
-- · Desconto noturno (22h–6h de Brasília, 30%), Flex e Batch (50%): a tabela
--   não tem preço por horário nem por modo. O custo sai pelo preço cheio, o
--   lado conservador: nunca subestima.
-- · Extração de documento por página (OCR de PDF): cobrada por página, não
--   por token, e não está na tabela de preços atual. Não entra em `ai_usage`.
-- · Ferramentas integradas (busca web, leitura de página, execução de
--   código): não usadas por esta plataforma.
--
-- Idempotente: re-rodável sem efeito colateral.
-- =====================================================================

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte)
values
  ('maritaca', 'sabia-4-thinking',       round(5.00 / 5.14, 6), round(40.00 / 5.14, 6), 0.25, 1.00, true,
   'docs.maritaca.ai/pt/precos 14/10/2026: R$ 5,00 in / R$ 40,00 out / R$ 1,25 cache por M; US$1≈R$5,14 (maritaca.ai/planos)'),
  ('maritaca', 'sabia-4-thinking-br-sp', round(6.50 / 5.14, 6), round(52.00 / 5.14, 6), 0.25, 1.00, true,
   'docs.maritaca.ai/pt/precos 14/10/2026: R$ 6,50 in / R$ 52,00 out / R$ 1,63 cache por M; US$1≈R$5,14 (maritaca.ai/planos)'),
  ('maritaca', 'sabia-4',                round(5.00 / 5.14, 6), round(20.00 / 5.14, 6), 0.25, 1.00, true,
   'docs.maritaca.ai/pt/precos 14/10/2026: R$ 5,00 in / R$ 20,00 out / R$ 1,25 cache por M; US$1≈R$5,14 (maritaca.ai/planos)'),
  ('maritaca', 'sabia-4-br-sp',          round(6.50 / 5.14, 6), round(26.00 / 5.14, 6), 0.25, 1.00, true,
   'docs.maritaca.ai/pt/precos 14/10/2026: R$ 6,50 in / R$ 26,00 out / R$ 1,63 cache por M; US$1≈R$5,14 (maritaca.ai/planos)'),
  ('maritaca', 'sabiazinho-4',           round(1.00 / 5.14, 6), round(4.00 / 5.14, 6),  0.25, 1.00, true,
   'docs.maritaca.ai/pt/precos 14/10/2026: R$ 1,00 in / R$ 4,00 out / R$ 0,25 cache por M; US$1≈R$5,14 (maritaca.ai/planos)'),
  ('maritaca', 'sabiazinho-4-br-sp',     round(1.30 / 5.14, 6), round(5.20 / 5.14, 6),  0.25, 1.00, true,
   'docs.maritaca.ai/pt/precos 14/10/2026: R$ 1,30 in / R$ 5,20 out / R$ 0,33 cache por M; US$1≈R$5,14 (maritaca.ai/planos)')
on conflict (provider, model, vigente_desde) do update set
  input_usd_mtok   = excluded.input_usd_mtok,
  output_usd_mtok  = excluded.output_usd_mtok,
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  confirmado       = excluded.confirmado,
  fonte            = excluded.fonte;
