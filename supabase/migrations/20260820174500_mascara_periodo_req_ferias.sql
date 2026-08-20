-- =====================================================================
-- Completa a migration anterior: requisicoes_req_ferias.periodo
--
-- A migration 20260820173000 trazia DUAS linhas para `requisicoes_req_ferias`
-- na lista de VALUES — uma para `data_ini`/`data_ter` (dd/MM/yyyy) e outra para
-- `periodo` (yyyyMM). `UPDATE ... FROM` com duas linhas casando a mesma tabela
-- aplica UMA delas, escolhida arbitrariamente pelo Postgres, e descarta a outra
-- em silêncio. As datas entraram; o período ficou sem máscara.
--
-- Erro meu de SQL, pego na conferência do cadastro depois de aplicar — que é
-- justamente por que se confere depois de aplicar.
--
-- yyyyMM é o formato que o endpoint ACEITOU na sondagem, testado campo a campo
-- (dd/MM/yyyy, MM/yyyy, yyyy-MM-dd e yyyyMM, um de cada vez).
-- =====================================================================

update public.ai_tools t
   set params = (
     select jsonb_agg(
       case when p->>'origem' = 'modelo' and p->>'nome' = 'periodo'
            then p || jsonb_build_object('tipo', 'date', 'mascara', 'yyyyMM')
            else p end order by ord)
       from jsonb_array_elements(t.params) with ordinality e(p, ord)
   ),
   updated_at = now()
 where t.key = 'requisicoes_req_ferias';
