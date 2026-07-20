-- =====================================================================
-- Chatbots por finalidade: uma chave pode enxergar VÁRIAS documentações,
-- e cada chatbot pode ter o próprio prompt.
--
-- `widget_keys.space_id` CONTINUA existindo como espaço DONO: é ele que
-- responde por permissão (widget.manage) e por `conversations.space_id`, que é
-- NOT NULL. A tabela nova é só o ESCOPO DE LEITURA do RAG.
-- =====================================================================

create table public.widget_key_spaces (
  widget_key_id uuid not null references public.widget_keys (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (widget_key_id, space_id)
);
create index widget_key_spaces_key_idx on public.widget_key_spaces (widget_key_id);
create index widget_key_spaces_space_idx on public.widget_key_spaces (space_id);

alter table public.widget_key_spaces enable row level security;

-- Espelha widget_keys: quem administra a CHAVE administra o escopo dela.
-- A permissão é checada no espaço DONO da chave, não no espaço adicionado —
-- senão bastaria ter widget.manage em qualquer espaço para se auto-incluir no
-- escopo de uma chave alheia.
create policy widget_key_spaces_rw on public.widget_key_spaces
  for all to authenticated using (
    exists (
      select 1 from public.widget_keys k
      where k.id = widget_key_spaces.widget_key_id
        and public.has_permission(auth.uid(), 'widget.manage', k.space_id)
    )
  )
  with check (
    exists (
      select 1 from public.widget_keys k
      where k.id = widget_key_spaces.widget_key_id
        and public.has_permission(auth.uid(), 'widget.manage', k.space_id)
    )
    -- E precisa poder LER o espaço que está sendo adicionado ao escopo: sem
    -- isto, um admin de um espaço ampliaria o alcance do chatbot para
    -- documentações que ele não tem direito de ver.
    and public.has_permission(auth.uid(), 'content.view', widget_key_spaces.space_id)
  );

-- BACKFILL OBRIGATÓRIO: sem isto toda chave em produção fica sem escopo e o
-- widget para de responder.
insert into public.widget_key_spaces (widget_key_id, space_id)
select id, space_id from public.widget_keys
on conflict do nothing;

-- =====================================================================
-- Prompts personalizados.
-- Nulo = herda o nível de cima. Cascata: chave → documentação → padrão do
-- produto. As REGRAS ABSOLUTAS (citar fontes, não usar conhecimento geral)
-- são anexadas no código DEPOIS deste texto e não podem ser desligadas aqui.
-- =====================================================================
alter table public.widget_keys add column system_prompt text;
alter table public.spaces add column chat_prompt text;

comment on column public.widget_keys.system_prompt is
  'Prompt do chatbot desta chave. Nulo = usa spaces.chat_prompt do espaço dono.';
comment on column public.spaces.chat_prompt is
  'Prompt padrão do chatbot desta documentação. Nulo = usa o padrão do produto.';
