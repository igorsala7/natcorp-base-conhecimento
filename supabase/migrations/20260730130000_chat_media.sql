-- =====================================================================
-- MÍDIA DO ASSISTENTE NO HISTÓRICO (gráficos, PDFs e outras mídias)
--
-- Gráficos/PDFs vinham só por SSE e sumiam ao reabrir/recarregar o chat. Agora
-- são persistidos na mensagem do assistente para reexibir no histórico:
--   - gráfico  → a spec (JSON leve) inline em `messages.media`;
--   - arquivo  → o CAMINHO no bucket privado `chat-media` (o servidor emite uma
--                URL assinada de curta duração ao ler o histórico).
-- =====================================================================

alter table public.messages add column if not exists media jsonb;

-- Bucket PRIVADO para arquivos do chat (relatórios/holerites etc.). Acesso só via
-- URL assinada emitida pelo servidor (service-role) — sem policy para anon.
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;
