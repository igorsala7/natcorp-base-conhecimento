-- Fase 4 — "o widget sabe a página". Guarda a TELA de onde a conversa nasceu
-- ({href, path, title}) para (a) o admin ver de qual tela veio cada pergunta e
-- (b) futura análise por tela. É DADO de rastreio, como os `p_*`. Nulo quando o
-- cliente não informou (ex.: integração via API REST pura).
alter table public.conversations
  add column page jsonb;
