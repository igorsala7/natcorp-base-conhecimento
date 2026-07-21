-- =====================================================================
-- Manutenção agendada. Três coisas que a interface prometia e ninguém fazia.
--
-- 1. A lixeira diz "itens excluídos ficam aqui por 30 dias" desde a Fase 7.5,
--    mas NÃO existia expurgo nenhum — o único cron era gc-versions-daily, que
--    limpa versões, não nós. Conteúdo soft-deleted acumulava para sempre.
-- 2. `rate_limits_gc()` foi criada na Fase 7 e nunca foi chamada: nem no src,
--    nem no worker, nem em migration. Uma linha por (bucket, janela de 60s),
--    para sempre.
-- 3. Job de importação cujo worker nunca subiu (ou morreu no meio) ficava em
--    'queued'/'extracting' eternamente, sem timeout e sem sinal na tela.
-- =====================================================================

-- ── 1. Expurgo da lixeira ────────────────────────────────────────────────
-- NÃO reusa hard_delete_subtree de propósito: aquela função exige
-- has_permission(auth.uid(), 'trash.empty'), e no cron não há auth.uid().
-- Aqui a autorização é a própria política de retenção.
--
-- Apagar por deleted_at basta para levar a subárvore: nodes.parent_id é
-- ON DELETE CASCADE, e soft_delete_subtree carimba o mesmo instante em todos
-- os descendentes. articles/article_versions/chunks caem por cascata.
create or replace function public.purge_trash(p_days int default 30)
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare v_count int;
begin
  delete from public.nodes
  where deleted_at is not null
    and deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.purge_trash(int) from public;
revoke execute on function public.purge_trash(int) from authenticated;

-- ── 3. Jobs de importação órfãos ─────────────────────────────────────────
-- 'preview' e 'done' NÃO entram: preview é o estado de espera pela revisão
-- humana, que pode legitimamente durar dias.
create or replace function public.fail_stale_import_jobs(p_minutes int default 60)
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare v_count int;
begin
  update public.import_jobs
  set status = 'error',
      error = coalesce(error, 'Processamento interrompido: o worker não respondeu. Verifique se `npm run worker` está de pé e reenvie o arquivo.')
  where status in ('queued', 'extracting', 'inferring', 'importing')
    and updated_at < now() - make_interval(mins => p_minutes);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.fail_stale_import_jobs(int) from public;
revoke execute on function public.fail_stale_import_jobs(int) from authenticated;

-- ── Agendamento ──────────────────────────────────────────────────────────
create extension if not exists pg_cron;

do $$
begin
  -- Expurgo da lixeira: 04:00, depois do gc-versions das 03:30.
  if exists (select 1 from cron.job where jobname = 'purge-trash-daily') then
    perform cron.unschedule('purge-trash-daily');
  end if;
  perform cron.schedule('purge-trash-daily', '0 4 * * *', 'select public.purge_trash(30);');

  -- rate_limits: de hora em hora. A própria função só guarda 1 hora de janelas.
  if exists (select 1 from cron.job where jobname = 'rate-limits-gc-hourly') then
    perform cron.unschedule('rate-limits-gc-hourly');
  end if;
  perform cron.schedule('rate-limits-gc-hourly', '15 * * * *', 'select public.rate_limits_gc();');

  -- Jobs órfãos: a cada 15 min, para o usuário ver o erro no mesmo dia.
  if exists (select 1 from cron.job where jobname = 'fail-stale-imports') then
    perform cron.unschedule('fail-stale-imports');
  end if;
  perform cron.schedule('fail-stale-imports', '*/15 * * * *', 'select public.fail_stale_import_jobs(60);');
end $$;
