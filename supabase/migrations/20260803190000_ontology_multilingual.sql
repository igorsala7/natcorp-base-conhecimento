-- ONTOLOGIA MULTILÍNGUE — traduções contextuais dos termos/aliases por idioma, SEM
-- sobrepor o PT (que continua sendo o canônico/fonte). Traduções são linhas ADICIONAIS
-- ligadas ao termo. Idiomas habilitados por espaço (a lista que o seletor mostra).
-- Espelha o RLS de ontology_terms/aliases (ler = content.view; escrever = ai.configure).

-- Idiomas habilitados por espaço (além do PT canônico, que não precisa estar aqui).
create table public.space_languages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  lang text not null,                               -- ISO 639-1: en, es, fr, de, it, ja, zh
  label text,                                        -- nome exibido (opcional)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (space_id, lang)
);
create index space_languages_space_idx on public.space_languages (space_id);

alter table public.space_languages enable row level security;
create policy space_languages_read on public.space_languages
  for select to authenticated
  using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy space_languages_write on public.space_languages
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', space_id))
  with check (public.has_permission(auth.uid(), 'ai.configure', space_id));
revoke all on public.space_languages from anon;

-- Tradução de um TERMO por idioma (contextual, não literal). `reviewed` = humano validou
-- a sugestão da IA. Um por (termo, idioma).
create table public.ontology_translations (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.ontology_terms (id) on delete cascade,
  lang text not null,
  term text not null,
  term_norm text not null,
  description text,
  source text not null default 'ia' check (source in ('ia', 'manual')),
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, lang)
);
create index ontology_translations_term_idx on public.ontology_translations (term_id);
create index ontology_translations_lang_idx on public.ontology_translations (lang);

alter table public.ontology_translations enable row level security;
create policy ontology_translations_read on public.ontology_translations
  for select to authenticated
  using (
    exists (
      select 1 from public.ontology_terms t
      where t.id = ontology_translations.term_id
        and public.has_permission(auth.uid(), 'content.view', t.space_id)
    )
  );
create policy ontology_translations_write on public.ontology_translations
  for all to authenticated
  using (
    exists (
      select 1 from public.ontology_terms t
      where t.id = ontology_translations.term_id
        and public.has_permission(auth.uid(), 'ai.configure', t.space_id)
    )
  )
  with check (
    exists (
      select 1 from public.ontology_terms t
      where t.id = ontology_translations.term_id
        and public.has_permission(auth.uid(), 'ai.configure', t.space_id)
    )
  );
revoke all on public.ontology_translations from anon;

-- Tradução de um ALIAS (sinônimo) por idioma.
create table public.ontology_alias_translations (
  id uuid primary key default gen_random_uuid(),
  alias_id uuid not null references public.ontology_aliases (id) on delete cascade,
  lang text not null,
  alias text not null,
  alias_norm text not null,
  source text not null default 'ia' check (source in ('ia', 'manual')),
  created_at timestamptz not null default now(),
  unique (alias_id, lang)
);
create index ontology_alias_translations_alias_idx on public.ontology_alias_translations (alias_id);

alter table public.ontology_alias_translations enable row level security;
create policy ontology_alias_translations_read on public.ontology_alias_translations
  for select to authenticated
  using (
    exists (
      select 1
      from public.ontology_aliases a
      join public.ontology_terms t on t.id = a.term_id
      where a.id = ontology_alias_translations.alias_id
        and public.has_permission(auth.uid(), 'content.view', t.space_id)
    )
  );
create policy ontology_alias_translations_write on public.ontology_alias_translations
  for all to authenticated
  using (
    exists (
      select 1
      from public.ontology_aliases a
      join public.ontology_terms t on t.id = a.term_id
      where a.id = ontology_alias_translations.alias_id
        and public.has_permission(auth.uid(), 'ai.configure', t.space_id)
    )
  )
  with check (
    exists (
      select 1
      from public.ontology_aliases a
      join public.ontology_terms t on t.id = a.term_id
      where a.id = ontology_alias_translations.alias_id
        and public.has_permission(auth.uid(), 'ai.configure', t.space_id)
    )
  );
revoke all on public.ontology_alias_translations from anon;
