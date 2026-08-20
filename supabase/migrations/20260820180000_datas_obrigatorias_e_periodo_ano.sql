-- =====================================================================
-- Fecha a rodada de datas: obrigatoriedade e `periodo` como ANO
--
-- Varredura de 11 formatos por endpoint (só GET), campo a campo:
--
-- ── requisicoes_exames_colab: as QUATRO datas são obrigatórias ──────────
-- Ela devolvia 555 e eu tinha concluído que a data não era o problema, porque
-- falhava "sem data nenhuma". Estava errado: falha com DUAS das quatro e
-- responde 200 com as QUATRO preenchidas. O SQL do endpoint não trata data nula.
-- Marcá-las obrigatórias é o que faz o modelo sempre preenchê-las — e é também
-- o que liga o portão de período para ela, corretamente.
--
-- ── requisicoes_req_desligamento e requisicoes_req_alt_func: `periodo` é ANO ──
-- Das quatro ferramentas com `periodo`, duas aceitam yyyyMM (req_ferias,
-- req_vaga) e estas duas aceitam SÓ `yyyy` — testados 01/01/2025, 2025-01-01,
-- 01/2025, 202501, 20250101, 01-01-2025, 01.01.2025, JAN/2025 e 01/JAN/2025,
-- todos com 555. Não é o mesmo campo com o mesmo nome; é ano contra competência.
-- Ficava para o dono decidir; a varredura decidiu.
--
-- ── O que continua fora ─────────────────────────────────────────────────
-- · sesmt_procedimentos — os ONZE formatos dão 555, com e sem data. É defeito do
--   endpoint, e nenhuma máscara conserta.
-- · resultado_apuracao_ponto — o cadastro já estava certo (date + dd/MM/yyyy).
--   Falhava na sondagem porque o sondador pedia de 1990 até hoje; com 2025
--   responde 200. É intervalo largo demais, não formato.
-- =====================================================================

-- As quatro datas de exames_colab passam a ser obrigatórias.
update public.ai_tools t
   set params = (
     select jsonb_agg(
       case when p->>'origem' = 'modelo'
             and p->>'nome' in ('dt_requisicao_ini','dt_requisicao_fim','dt_sit_requisicao_ini','dt_sit_requisicao_fim')
            then p || jsonb_build_object('obrigatorio', true)
            else p end order by ord)
       from jsonb_array_elements(t.params) with ordinality e(p, ord)
   ),
   updated_at = now()
 where t.key = 'requisicoes_exames_colab';

-- `periodo` = ANO nestas duas. Uma ferramenta por comando: `UPDATE ... FROM` com
-- várias linhas casando a mesma tabela aplica UMA e descarta as outras em
-- silêncio — foi assim que a migration de 17:30 perdeu um parâmetro.
update public.ai_tools t
   set params = (
     select jsonb_agg(
       case when p->>'origem' = 'modelo' and p->>'nome' = 'periodo'
            then p || jsonb_build_object('tipo', 'date', 'mascara', 'yyyy')
            else p end order by ord)
       from jsonb_array_elements(t.params) with ordinality e(p, ord)
   ),
   updated_at = now()
 where t.key = 'requisicoes_req_desligamento';

update public.ai_tools t
   set params = (
     select jsonb_agg(
       case when p->>'origem' = 'modelo' and p->>'nome' = 'periodo'
            then p || jsonb_build_object('tipo', 'date', 'mascara', 'yyyy')
            else p end order by ord)
       from jsonb_array_elements(t.params) with ordinality e(p, ord)
   ),
   updated_at = now()
 where t.key = 'requisicoes_req_alt_func';
