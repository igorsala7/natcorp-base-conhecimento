-- =====================================================================
-- Aperta duas policies públicas herdadas.
-- =====================================================================

-- ── search_logs: anon inseria QUALQUER linha ─────────────────────────────
-- A policy era `for insert to anon with check (true)`. Pelo PostgREST dava
-- para inserir busca com space_id arbitrário e texto arbitrário — e essa
-- tabela alimenta a tela "Buscas sem resultado", que o time usa para decidir
-- o que documentar. Envenenar a métrica era trivial e invisível.
--
-- O teto por IP agora vive em lib/portal/rate-limit.ts; aqui garantimos que a
-- linha ao menos pertença a uma documentação pública de verdade.
-- (Busca em espaço com senha entra pelo service-role, que não passa por RLS.)
drop policy if exists search_log_insert on public.search_logs;

create policy search_log_insert on public.search_logs
  for insert to anon, authenticated with check (
    space_id is not null
    and exists (
      select 1 from public.spaces s
      where s.id = search_logs.space_id
        and s.visibility = 'public'
    )
  );

-- ── space_slugs: anon enumerava todas as documentações ───────────────────
-- Era `for select to anon using (true)`: a lista completa de slugs, incluindo
-- documentações privadas e protegidas por senha. Não vaza conteúdo, mas
-- entrega a lista de clientes.
--
-- Nada quebra: quem resolve slug aposentada no portal é `resolvePortalSpace`,
-- que usa service-role justamente porque anon não enxerga espaço 'password'.
drop policy if exists space_slugs_public_read on public.space_slugs;

-- `space_slugs_auth_read` (authenticated, using true) FICA como está de
-- propósito: `validarSlugEspaco` precisa enxergar todas as slugs tomadas para
-- impedir reaproveitamento, e authenticated aqui é a equipe interna.
