-- Uma base (cliente) pode usar VÁRIAS documentações no chatbot (RAG). Substitui
-- o vínculo único `ai_bases.chat_space_id` por um muitos-para-muitos ordenado.
--
-- A primeira (menor `position`) é a PRINCIPAL: é onde as conversas do WhatsApp
-- são registradas (conversations.space_id é único). O RAG usa todas.
create table public.ai_base_spaces (
  base_id uuid not null references public.ai_bases (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  position int not null default 0,
  primary key (base_id, space_id)
);
create index ai_base_spaces_base_idx on public.ai_base_spaces (base_id);

alter table public.ai_base_spaces enable row level security;
create policy ai_base_spaces_read on public.ai_base_spaces
  for select to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  );
create policy ai_base_spaces_write on public.ai_base_spaces
  for all to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  )
  with check (public.has_permission(auth.uid(), 'integrations.manage', null));
revoke all on public.ai_base_spaces from anon;

-- Migra o vínculo único que já existia.
insert into public.ai_base_spaces (base_id, space_id, position)
select id, chat_space_id, 0 from public.ai_bases where chat_space_id is not null
on conflict do nothing;

alter table public.ai_bases drop column chat_space_id;
