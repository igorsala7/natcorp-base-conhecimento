-- Fase 8 (pós) — Agenda a política de retenção de versões (gc_versions)
-- para rodar diariamente via pg_cron. Idempotente.

create extension if not exists pg_cron;

-- gc_versions não deve ser disparável por usuário comum; só o agendador
-- (dono) ou o service-role. Revoga de public/authenticated.
revoke execute on function public.gc_versions() from public;
revoke execute on function public.gc_versions() from authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'gc-versions-daily') then
    perform cron.unschedule('gc-versions-daily');
  end if;
  perform cron.schedule('gc-versions-daily', '30 3 * * *', 'select public.gc_versions();');
end $$;
