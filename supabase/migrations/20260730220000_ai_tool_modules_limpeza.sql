-- Limpeza da taxonomia de módulos das tools (base NATCORP).
--
-- Problema: as tags de ai_tool_modules estavam redundantes (a mesma tool sob 3-4
-- caminhos), super-aninhadas (até 4 níveis), em DOIS eixos sobrepostos (domínio de
-- dado x processo) e com ERROS (ex.: "marcações de ponto" tagueada como
-- "BENEFÍCIOS > EMPRÉSTIMOS"). Isso dilui o recorte por assunto (a tool casa quase
-- qualquer módulo → não corta tokens) e ainda AMBIGUA o classificador.
--
-- Correção: UM eixo, módulos distintos, 1 tag por tool. As transversais
-- (empresas/filiais, menu de opções, "meus dados") viram ESSENCIAIS
-- (always_include) — nunca são excluídas, preservando o recall.
--
-- Reversível: a tabela de backup abaixo guarda o estado ANTERIOR das tags.

-- 1) BACKUP (revert = re-inserir a partir daqui). Preserva o estado original mesmo
--    que a migration seja reaplicada.
create table if not exists ai_tool_modules_bkp_20260730 as table ai_tool_modules;

-- 2) ESSENCIAIS (always_include): sempre enviadas, fora do roteamento por assunto.
--    Zera todas as tools do NATCORP e liga só as 4 transversais.
update ai_tools set always_include = false
 where id in (
   select bt.tool_id from ai_base_tools bt join ai_bases b on b.id = bt.base_id
   where b.base_code = 'natcorp'
 );
update ai_tools set always_include = true
 where key in ('estrutura_empresas', 'estrutura_filiais', 'lista_opcoes', 'meus_dados');

-- 3) Zera as tags atuais das tools do NATCORP.
delete from ai_tool_modules
 where tool_id in (
   select bt.tool_id from ai_base_tools bt join ai_bases b on b.id = bt.base_id
   where b.base_code = 'natcorp'
 );

-- 4) Aplica a taxonomia enxuta (1 módulo por tool; essenciais ficam SEM tag).
insert into ai_tool_modules (id, tool_id, modulo, submodulo)
select gen_random_uuid(), t.id, m.modulo, null
from ai_tools t
join ( values
  -- FINANCEIRO (holerite, eventos, informe, antecipação/adiantamento, BI financeiro)
  ('antecipacao_efetivar', 'FINANCEIRO'),
  ('antecipacao_historico', 'FINANCEIRO'),
  ('antecipacao_regras', 'FINANCEIRO'),
  ('antecipacao_saldo', 'FINANCEIRO'),
  ('antecipacao_simular', 'FINANCEIRO'),
  ('bi_hist_financeiro', 'FINANCEIRO'),
  ('historico_financeiro', 'FINANCEIRO'),
  ('historico_financeiro_meses', 'FINANCEIRO'),
  ('relatorio_informe_rendimentos', 'FINANCEIRO'),
  ('relatorio_recibo_pagamento', 'FINANCEIRO'),
  -- FÉRIAS
  ('consultar_ferias', 'FÉRIAS'),
  ('relatorio_aviso_ferias', 'FÉRIAS'),
  ('relatorio_aviso_ferias_meses', 'FÉRIAS'),
  -- PONTO E FREQUÊNCIA (marcações, apuração, espelho)
  ('consultar_marcacoes', 'PONTO E FREQUÊNCIA'),
  ('resultado_apuracao_ponto', 'PONTO E FREQUÊNCIA'),
  ('relatorio_espelho_ponto', 'PONTO E FREQUÊNCIA'),
  -- BENEFÍCIOS
  ('consultar_beneficios', 'BENEFÍCIOS'),
  -- DADOS CADASTRAIS (atualizações pessoais, CEP, documentos de assinatura)
  ('atualizar_email', 'DADOS CADASTRAIS'),
  ('atualizar_telefone', 'DADOS CADASTRAIS'),
  ('consultar_assinatura_eletronica', 'DADOS CADASTRAIS'),
  ('consultar_cep', 'DADOS CADASTRAIS'),
  -- DADOS FUNCIONAIS (linha do tempo / histórico funcional)
  ('linha_tempo', 'DADOS FUNCIONAIS'),
  ('linha_tempo_fato', 'DADOS FUNCIONAIS'),
  -- EQUIPE (visão do gestor: alertas, equipe, colaborador da equipe)
  ('alertas_gestor', 'EQUIPE'),
  ('dados_colaborador_equipe', 'EQUIPE'),
  ('listar_colaboradores_resumo', 'EQUIPE'),
  -- ESTRUTURA (cargos, funções, centros de custo, locais, unidades)
  ('estrutura_cargos', 'ESTRUTURA'),
  ('estrutura_centros_custo', 'ESTRUTURA'),
  ('estrutura_funcoes', 'ESTRUTURA'),
  ('estrutura_locais_trabalho', 'ESTRUTURA'),
  ('estrutura_unidades_adm', 'ESTRUTURA'),
  -- SEGURANÇA DO TRABALHO (SESMT)
  ('bi_risco', 'SEGURANÇA DO TRABALHO'),
  -- AVALIAÇÕES
  ('consultar_feedback', 'AVALIAÇÕES')
) as m(key, modulo) on m.key = t.key;
