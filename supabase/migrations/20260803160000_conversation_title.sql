-- Título da conversa guardado na própria linha (robustez do Histórico).
--
-- A listagem derivava o título da 1ª mensagem do usuário via um lote de mensagens com
-- teto — que esbarra no limite de 1000 linhas do PostgREST (mesmo gotcha de [[tree-1000-row-cap]]).
-- Com muitas mensagens, as conversas mais recentes perderiam o título. Guardando o título
-- na conversa, a lista vira uma única consulta robusta (o subtítulo/contagem seguem
-- best-effort a partir das mensagens, mas o título nunca falha).
alter table public.conversations
  add column if not exists title text;

-- Backfill: título = 1ª mensagem do USUÁRIO de cada conversa (a mais antiga), truncada.
update public.conversations c
   set title = left(btrim(sub.content), 200)
  from (
    select distinct on (conversation_id) conversation_id, content
      from public.messages
     where role = 'user'
     order by conversation_id, created_at asc
  ) sub
 where sub.conversation_id = c.id
   and c.title is null
   and btrim(coalesce(sub.content, '')) <> '';
