-- Cargo/função interna do usuário (identidade), separado do perfil PÚBLICO de
-- autor (author_profiles). A foto já existe (profiles.avatar_url).
alter table public.profiles add column if not exists job_title text;
comment on column public.profiles.job_title is
  'Cargo/função interna do usuário — identidade, separada do perfil de autor.';
