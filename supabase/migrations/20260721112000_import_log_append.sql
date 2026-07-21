-- =====================================================================
-- Append atômico no log do job de importação.
--
-- O worker fazia read-modify-write: `select log` → concatena em JS →
-- `update log = [...]`. Duas escritas concorrentes perdem linhas. Hoje há um
-- produtor por job, mas o próprio worker passou a processar lotes, e o
-- caminho de erro escreve fora da sequência principal.
--
-- `log || jsonb_build_array(...)` resolve no banco, numa instrução só.
-- =====================================================================

create or replace function public.import_job_log_append(
  p_job_id uuid,
  p_msg text
) returns void
  language sql
  security definer
  set search_path = public
as $$
  update public.import_jobs
  set log = log || jsonb_build_array(
    jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'msg', p_msg)
  )
  where id = p_job_id;
$$;

-- Só o worker (service-role) escreve log. Ver a migration
-- 20260721111000_revoke_anon_maintenance.sql: revogar de `public` e
-- `authenticated` NÃO tira a concessão explícita que o `anon` recebe por
-- ALTER DEFAULT PRIVILEGES — as três precisam ser nomeadas.
revoke all on function public.import_job_log_append(uuid, text)
  from public, anon, authenticated;
