-- =====================================================================
-- Loop de período por ferramenta: APIs mensais (ex.: BI de histórico
-- financeiro, histórico financeiro do colaborador) recebem UM mês por chamada.
-- Quando o usuário pede um PERÍODO ("todo 2025", "de abril a setembro"), o
-- servidor itera mês a mês e AGREGA num único resultado — o modelo faz UMA
-- chamada em vez de 12, economizando steps e tokens.
--
-- `loop` (jsonb) descreve a expansão:
--   { "unit": "month", "param": "data_ref", "from": "periodo_ini",
--     "to": "periodo_fim", "max": 24 }
--   - unit : unidade da iteração (por ora, "month");
--   - param: nome do parâmetro single-value que a API espera (recebe cada mês);
--   - from : parâmetro (visível ao modelo) com o início do período (ISO AAAA-MM);
--   - to   : parâmetro com o fim do período (opcional; ausente = 1 mês);
--   - max  : teto de iterações (protege contra períodos absurdos). NULL = sem loop.
-- =====================================================================
alter table public.ai_tools
  add column if not exists loop jsonb;

comment on column public.ai_tools.loop is
  'Expansão de período (jsonb): {unit,param,from,to,max}. O servidor itera a unidade (ex.: mês) e agrega num só resultado. NULL = sem loop.';
