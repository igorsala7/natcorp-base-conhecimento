-- Backfill do escopo do widget nas conversas ANTIGAS.
--
-- As conversas criadas antes de [[20260803140000]] ficaram com widget_user_ref NULL e,
-- por isso, sumiam do Histórico (que filtra por space_id + widget_user_ref). Mas elas já
-- guardam a identidade nas colunas de rastreio (p_base + p_usuario/p_matricula), então dá
-- para reconstruir o mesmo userRef que a rota /api/v1/conversations calcula:
--
--     userRef = "<p_base>:<p_usuario || p_matricula>"   (|| = cai p/ matrícula se usuário vazio)
--
-- Idempotente: só toca linhas com widget_user_ref NULL e que TENHAM identidade. Conversas
-- anônimas (sem p_usuario e sem p_matricula) continuam de fora — não há dono para filtrar.
update public.conversations
   set widget_user_ref = coalesce(p_base, '') || ':' || coalesce(nullif(p_usuario, ''), p_matricula)
 where widget_user_ref is null
   and coalesce(nullif(p_usuario, ''), p_matricula) is not null;
