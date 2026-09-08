-- =====================================================================
-- `p_base` NORMALIZADO NA LEITURA — o mesmo cliente parou de ser dois
--
-- Medido em 08/09/2026 sobre 120 dias de `ai_usage`:
--
--   NATCORP    · widget · 2.311 chamadas · 76.612.239 tokens
--   natcorp    · widget · 5.130 chamadas · 50.367.327 tokens
--   STEFANINI  ·   88 chamadas   |   stefanini · 347 chamadas
--   INCOR      ·    4 chamadas   |   incor     · 407 chamadas
--
-- São o MESMO cliente. `faturamento_detalhe` agrupa por `trim(u.p_base)` sem
-- baixar a caixa, então hoje ele emite duas linhas de fatura para a natcorp e
-- nenhuma das duas está certa. Com créditos e bloqueio entrando em cena, o
-- estrago passa de contábil a operacional: o saldo fica partido em dois, e o
-- cliente é bloqueado com crédito sobrando na outra metade.
--
-- ── Por que índice funcional e não UPDATE no histórico ─────────────────
-- Reescrever `p_base` em 46 mil linhas apagaria o que o APEX realmente mandou.
-- Se amanhã aparecer um cliente cujo `base_code` legítimo difere só na caixa, o
-- histórico reescrito não permitiria separar os dois. A leitura normaliza; o
-- registro continua fiel. `ai_bases.base_code` já é minúsculo em todas as 14
-- bases, então não há ambiguidade real a preservar — só a evidência.
--
-- Daqui pra frente a GRAVAÇÃO também normaliza (src/lib/ai/usage-context.ts), e
-- as tabelas novas têm CHECK que recusa caixa alta.
-- =====================================================================

-- Caminho quente do portão de créditos: saldo do mês de uma base.
create index if not exists ai_usage_base_norm_periodo_idx
  on public.ai_usage (lower(btrim(p_base)), created_at desc)
  where p_base is not null;

-- Recorte por painel/perfil/usuário na tela de consumo e no portão.
create index if not exists ai_usage_base_norm_recorte_idx
  on public.ai_usage (lower(btrim(p_base)), p_portal, created_at desc)
  where p_base is not null and origem = 'widget';

-- Histórico de conversas da área /gestao, sempre filtrado por base.
create index if not exists conversations_base_norm_idx
  on public.conversations (lower(btrim(p_base)), created_at desc)
  where p_base is not null;

-- Traces, para cruzar o passo a passo de um turno na tela de conversas.
create index if not exists ai_chat_traces_base_norm_idx
  on public.ai_chat_traces (lower(btrim(base_code)), created_at desc)
  where base_code is not null;
