-- =====================================================================
-- p_cod_candidato: o Painel do Candidato entra no rastreio
--
-- Até aqui todo mundo que falava com o assistente era colaborador, e a
-- identidade cabia em (empresa, matrícula). O Painel do Candidato traz gente
-- que AINDA NÃO tem matrícula — e a regra do produto (Igor, 12/08/2026) é:
--
--   p_matricula preenchida                          → COLABORADOR
--   p_matricula vazia + p_cod_candidato preenchido  → CANDIDATO
--
-- A ordem importa: quem foi contratado passa a ter matrícula e volta a ser
-- colaborador sem que nada mais mude.
--
-- A coluna entra em TODAS as tabelas que recebem o espalhamento dos campos de
-- rastreio (`...track`) — conversations, ai_usage, page_views — porque uma
-- chave nova em `TRACKING_KEYS` sem coluna correspondente faz o insert inteiro
-- falhar no PostgREST, e o sintoma aparece longe daqui: conversa que não grava,
-- consumo que não contabiliza. `ai_chat_traces` grava os p_* coluna a coluna e
-- entra junto para o diagnóstico saber de quem era a conversa.
-- =====================================================================

alter table public.conversations  add column if not exists p_cod_candidato text;
alter table public.ai_usage       add column if not exists p_cod_candidato text;
alter table public.page_views     add column if not exists p_cod_candidato text;
alter table public.ai_chat_traces add column if not exists p_cod_candidato text;

comment on column public.conversations.p_cod_candidato is
  'Código do candidato (Painel do Candidato). Preenchido só quando p_matricula está vazia — ver tipoDeAcesso() em src/lib/chat/tipo-acesso.ts.';
