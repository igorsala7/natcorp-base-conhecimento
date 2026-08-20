-- =====================================================================
-- MÁSCARA DE DATA nos parâmetros que estavam sem ela
--
-- Das 24 ferramentas cujo parâmetro de data é preenchido pelo MODELO, 12
-- estavam cadastradas como `tipo: "string"` SEM máscara. `resolveParams` só
-- formata quando há máscara (params.ts:183), então o valor ia em ISO
-- (2025-01-01) e o Oracle recusava:
--
--   ORA-01861: o literal não corresponde à string de formato
--
-- Dez ferramentas devolviam HTTP 555 por isso, entre elas requisições de
-- exames, comissões e tratamento de batidas. Ninguém tinha notado porque quase
-- não são usadas — 46 das 88 ativas nunca foram chamadas em 60 dias.
--
-- ── As máscaras NÃO foram deduzidas ─────────────────────────────────────
-- Cada endpoint foi sondado (só GET) com o campo em quatro formatos, um de
-- cada vez, e aqui entra apenas o que a API ACEITOU:
--
--   requisicoes_exames_colab       dd/MM/yyyy  (único aceito)
--   requisicoes_sistema_comissoes  dd/MM/yyyy  (único aceito)
--   frequencia_req_trat_bat        dd/MM/yyyy  (único aceito)
--   usuarios_usuarios_fotos_2      dd/MM/yyyy  (único aceito)
--   requisicoes_req_ferias         data_ini/data_ter: dd/MM/yyyy · periodo: yyyyMM
--   requisicoes_req_vaga           periodo: yyyyMM
--   requisicoes_exames_cand        aceita tudo → segue o irmão exames_colab
--   requisicoes_req_pessoal        aceita tudo → segue o padrão de `periodo`
--
-- `tipo` também vai para "date": é o que faz o schema do modelo declarar data,
-- e sem isso ele continua mandando texto livre.
--
-- ── O QUE NÃO ENTRA, e por quê ──────────────────────────────────────────
-- · sesmt_procedimentos — falha com HTTP 555 mesmo SEM parâmetro de data
--   nenhum. É outro defeito, e mascarar a data não conserta.
-- · requisicoes_req_desligamento — o endpoint estoura o tempo mesmo sem data;
--   não deu para determinar formato nenhum.
-- · requisicoes_req_alt_func — só aceitou `yyyy` (ano), recusando `yyyyMM`.
--   Um `periodo` que é ano contraria o padrão das outras duas; pode ser o
--   endpoint ignorando o parâmetro. Fica para o dono confirmar em vez de eu
--   escolher entre perder o mês e quebrar a chamada.
-- · pagamento_registrar_saque_2 — é ESCRITA e não foi sondada. Sondar exigiria
--   registrar um saque real.
-- =====================================================================

update public.ai_tools t
   set params = (
     select jsonb_agg(
       case
         when p->>'origem' = 'modelo' and p->>'nome' = any(campos.lista)
           then p || jsonb_build_object('tipo', 'date', 'mascara', campos.mascara)
         else p
       end order by ord)
       from jsonb_array_elements(t.params) with ordinality e(p, ord)
   ),
   updated_at = now()
  from (values
    ('frequencia_req_trat_bat',       array['data_fim','data_ini'],                                   'dd/MM/yyyy'),
    ('requisicoes_exames_cand',       array['dt_requisicao_fim','dt_requisicao_ini','dt_sit_requisicao_fim','dt_sit_requisicao_ini'], 'dd/MM/yyyy'),
    ('requisicoes_exames_colab',      array['dt_requisicao_fim','dt_requisicao_ini','dt_sit_requisicao_fim','dt_sit_requisicao_ini'], 'dd/MM/yyyy'),
    ('requisicoes_sistema_comissoes', array['data_atualizacao_fim','data_atualizacao_ini','data_fechamento_fim','data_fechamento_ini','data_requisicao_fim','data_requisicao_ini'], 'dd/MM/yyyy'),
    ('usuarios_usuarios_fotos_2',     array['dt_atualizacao'],                                        'dd/MM/yyyy'),
    ('requisicoes_req_ferias',        array['data_ini','data_ter'],                                   'dd/MM/yyyy'),
    ('requisicoes_req_ferias',        array['periodo'],                                               'yyyyMM'),
    ('requisicoes_req_vaga',          array['periodo'],                                               'yyyyMM'),
    ('requisicoes_req_pessoal',       array['periodo'],                                               'yyyyMM')
  ) as campos(chave, lista, mascara)
 where t.key = campos.chave;
