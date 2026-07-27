-- =====================================================================
-- Bucket `avatars`: fotos de usuário (identidade) e de perfil de autor.
--
-- Separado de `assets` de propósito: `assets` gate a escrita por content.edit
-- na DOCUMENTAÇÃO do caminho (storage_space_id), e uma foto de usuário não
-- pertence a documentação nenhuma. Aqui a escrita é gate por `user.manage` —
-- quem edita usuários/autores. A LEITURA é pública (a foto aparece no admin e,
-- no caso do autor, na assinatura dos artigos do portal).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_manage_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.has_permission(auth.uid(), 'user.manage'));

create policy "avatars_manage_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.has_permission(auth.uid(), 'user.manage'))
  with check (bucket_id = 'avatars' and public.has_permission(auth.uid(), 'user.manage'));

create policy "avatars_manage_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.has_permission(auth.uid(), 'user.manage'));
