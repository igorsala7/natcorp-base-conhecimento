-- =====================================================================
-- Ontologia da documentação (por espaço) — melhora a PRECISÃO do RAG.
-- Um termo canônico (ex.: "Nota Fiscal") reúne as variações/siglas que o
-- usuário digita ("NF", "nota", "NF-e"). No momento da busca, a consulta é
-- EXPANDIDA com os termos/sinônimos casados, ampliando o braço LÉXICO do
-- hybrid_search_scoped sem poluir o vetor semântico.
--
-- `term_norm`/`alias_norm` são a forma normalizada (minúsculas, sem acento)
-- calculada NO APP, para o casamento no momento da busca ser idêntico ao
-- gravado — e para a unicidade deduplicar variações equivalentes.
-- =====================================================================

create table public.ontology_terms (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  term text not null,
  term_norm text not null,
  kind text not null default 'conceito'
    check (kind in ('conceito', 'entidade', 'acao', 'sigla', 'outro')),
  description text,
  source text not null default 'manual' check (source in ('ia', 'manual')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, term_norm)
);
create index ontology_terms_space_idx on public.ontology_terms (space_id);

create table public.ontology_aliases (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.ontology_terms (id) on delete cascade,
  alias text not null,
  alias_norm text not null,
  source text not null default 'manual' check (source in ('ia', 'manual')),
  created_at timestamptz not null default now(),
  unique (term_id, alias_norm)
);
create index ontology_aliases_term_idx on public.ontology_aliases (term_id);

-- Job da varredura por IA (Gemini lê os artigos e sugere termos). Espelha
-- embedding_jobs: progresso via Realtime.
create table public.ontology_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  total int not null default 0,
  done int not null default 0,
  progress int not null default 0,                  -- 0-100
  found int not null default 0,                     -- termos gravados
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ontology_jobs_space_idx on public.ontology_jobs (space_id);

-- ── RLS ──────────────────────────────────────────────────────────────
-- Leitura ampla (quem vê o conteúdo) para o RAG do usuário aproveitar a
-- ontologia; escrita/curadoria restrita a quem configura a IA.
alter table public.ontology_terms enable row level security;
create policy ontology_terms_read on public.ontology_terms
  for select to authenticated
  using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy ontology_terms_write on public.ontology_terms
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', space_id))
  with check (public.has_permission(auth.uid(), 'ai.configure', space_id));
revoke all on public.ontology_terms from anon;

alter table public.ontology_aliases enable row level security;
create policy ontology_aliases_read on public.ontology_aliases
  for select to authenticated
  using (
    exists (
      select 1 from public.ontology_terms t
      where t.id = ontology_aliases.term_id
        and public.has_permission(auth.uid(), 'content.view', t.space_id)
    )
  );
create policy ontology_aliases_write on public.ontology_aliases
  for all to authenticated
  using (
    exists (
      select 1 from public.ontology_terms t
      where t.id = ontology_aliases.term_id
        and public.has_permission(auth.uid(), 'ai.configure', t.space_id)
    )
  )
  with check (
    exists (
      select 1 from public.ontology_terms t
      where t.id = ontology_aliases.term_id
        and public.has_permission(auth.uid(), 'ai.configure', t.space_id)
    )
  );
revoke all on public.ontology_aliases from anon;

alter table public.ontology_jobs enable row level security;
create policy ontology_jobs_read on public.ontology_jobs
  for select to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', space_id));
create policy ontology_jobs_write on public.ontology_jobs
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', space_id))
  with check (public.has_permission(auth.uid(), 'ai.configure', space_id));
revoke all on public.ontology_jobs from anon;

-- Realtime: alimenta a barra de progresso da varredura.
alter table public.ontology_jobs replica identity full;
alter publication supabase_realtime add table public.ontology_jobs;
