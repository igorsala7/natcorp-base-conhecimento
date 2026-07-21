-- =====================================================================
-- Storage isolado por documentação.
--
-- A policy antiga do bucket `imports` era literalmente:
--     for all to authenticated using (bucket_id = 'imports')
-- ou seja, QUALQUER usuário autenticado — inclusive um Leitor (nível 10) —
-- lia, sobrescrevia e apagava os arquivos de importação e da base de
-- conhecimento de TODAS as documentações. É onde ficam os PDFs que o cliente
-- sobe em /admin/base-conhecimento. Vazamento entre clientes.
--
-- O bucket `assets` tinha o mesmo problema na escrita (e nenhuma policy de
-- delete). A LEITURA dele continua pública de propósito: as imagens do
-- conteúdo são servidas ao portal por URL pública.
--
-- Todo caminho gravado já começa com o id da documentação — verificado nos
-- quatro produtores: import-manager.tsx, kb-manager.tsx, lib/content/upload.ts
-- e worker/index.ts (`${spaceId}/...`). É esse primeiro segmento que vira o
-- escopo aqui. O worker usa service-role e não passa por estas policies.
-- =====================================================================

-- Primeiro segmento do caminho como uuid, ou NULL se não for um uuid.
-- Precisa ser função: um `::uuid` cru dentro da policy levanta exceção em
-- objeto legado com prefixo não-uuid, e o erro apareceria como falha genérica
-- de Storage. Devolvendo NULL, o has_permission simplesmente nega.
create or replace function public.storage_space_id(p_name text)
  returns uuid
  language plpgsql
  immutable
  set search_path = public
as $$
declare v_first text;
begin
  v_first := split_part(p_name, '/', 1);
  if v_first !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return v_first::uuid;
end $$;

-- ── bucket `imports` (privado) ───────────────────────────────────────────
drop policy if exists "imports_authenticated_all" on storage.objects;

create policy "imports_read_scoped"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'imports'
    and public.has_permission(auth.uid(), 'content.view', public.storage_space_id(name))
  );

create policy "imports_insert_scoped"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imports'
    and public.has_permission(auth.uid(), 'content.edit', public.storage_space_id(name))
  );

create policy "imports_update_scoped"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'imports'
    and public.has_permission(auth.uid(), 'content.edit', public.storage_space_id(name))
  )
  with check (
    bucket_id = 'imports'
    and public.has_permission(auth.uid(), 'content.edit', public.storage_space_id(name))
  );

create policy "imports_delete_scoped"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'imports'
    and public.has_permission(auth.uid(), 'content.delete', public.storage_space_id(name))
  );

-- ── bucket `assets` (público na leitura) ─────────────────────────────────
drop policy if exists "assets_authenticated_write" on storage.objects;
drop policy if exists "assets_authenticated_update" on storage.objects;

-- `assets_public_read` continua como está: o portal serve estas imagens.

create policy "assets_insert_scoped"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets'
    and public.has_permission(auth.uid(), 'content.edit', public.storage_space_id(name))
  );

create policy "assets_update_scoped"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assets'
    and public.has_permission(auth.uid(), 'content.edit', public.storage_space_id(name))
  )
  with check (
    bucket_id = 'assets'
    and public.has_permission(auth.uid(), 'content.edit', public.storage_space_id(name))
  );

-- Faltava por completo: qualquer autenticado podia sobrescrever, mas ninguém
-- podia apagar — nem o dono da documentação.
create policy "assets_delete_scoped"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assets'
    and public.has_permission(auth.uid(), 'content.delete', public.storage_space_id(name))
  );
