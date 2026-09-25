-- =====================================================================
-- `chunks_write` DERROTAVA O APERTO QUE A MIGRATION ANTERIOR FEZ
--
-- A 20260925110000 restringiu a LEITURA de chunk de arquivo de cliente a
-- quem tem `ai.configure`. Só que `chunks_write` é `FOR ALL`, e policy
-- permissiva no Postgres se combina com OU: ela também vale para SELECT.
-- Com `space_id` anulável, o seu `has_permission(uid,'content.edit',
-- space_id)` reduz a "tem content.edit GLOBAL", então esse papel lia e
-- escrevia chunk de arquivo de cliente pela policy de escrita, e o aperto
-- da policy de leitura não tinha efeito para ele.
--
-- Concretamente: um Gestor de conteúdo (nível 60, papel global) alcançava
-- os chunks do PDF de regras internas de um cliente sem ter ai.configure.
--
-- A lição, porque ela volta: ao apertar uma policy, verificar se existe
-- outra `FOR ALL` na mesma tabela. Uma policy permissiva mais frouxa
-- anula silenciosamente qualquer aperto feito em outra.
-- =====================================================================

drop policy if exists chunks_write on public.chunks;
create policy chunks_write on public.chunks
  for all to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'content.edit', space_id))
    or (space_id is null and exists (
          select 1 from public.knowledge_documents k
           where k.id = chunks.document_id
             and k.base_id is not null
             and public.has_permission(auth.uid(), 'ai.configure', null)))
  )
  with check (
    (space_id is not null and public.has_permission(auth.uid(), 'content.edit', space_id))
    or (space_id is null and exists (
          select 1 from public.knowledge_documents k
           where k.id = chunks.document_id
             and k.base_id is not null
             and public.has_permission(auth.uid(), 'ai.configure', null)))
  );
