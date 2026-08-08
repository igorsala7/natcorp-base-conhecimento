-- =====================================================================
-- DESCRIÇÃO PARA O USUÁRIO (separada da descrição para a IA)
--
-- `ai_tools.description` tem UM dono: o modelo. É por ela que a IA decide qual
-- ferramenta usar, então é longa, técnica, cita nomes de endpoint e às vezes
-- outras ferramentas. Nunca foi escrita para ser lida por gente.
--
-- Só que os botões de desambiguação do chat ("de onde você quer que eu busque?")
-- saíam desse mesmo texto: `rotuloTool` cortava a 1ª frase em 70 caracteres, e o
-- usuário recebia um pedaço de instrução técnica interrompido no meio. Um
-- analista de RH não reconhece "Consulta o endpoint de eventos financeiros por
-- competência; use historico_financeiro_meses para…".
--
-- Um campo por leitor, então: `description` continua a serviço do roteamento,
-- `descricao_usuario` é 1-2 frases em português claro, escritas para quem clica.
--
-- Vazio = comportamento de hoje (corte da descrição técnica). Isso é
-- deliberado: com 100+ ferramentas cadastradas, exigir preenchimento antes de
-- funcionar transformaria a melhoria em regressão para todo mundo que ainda não
-- preencheu. Ver `scripts/gen-descricao-usuario.ts` para o preenchimento em lote.
--
-- NÃO entra no embedding do catálogo nem no prompt do modelo: acrescentar um
-- resumo do que a própria `description` já diz só diluiria o vetor de
-- roteamento — o mesmo motivo pelo qual `search_terms` fica fora do prompt.
-- =====================================================================

alter table public.ai_tools
  add column if not exists descricao_usuario text not null default '';

comment on column public.ai_tools.descricao_usuario is
  'Como a ferramenta é apresentada AO USUÁRIO no chat (1-2 frases, linguagem do negócio). Vazio = cai no corte de `description`. Nunca entra no embedding nem no prompt do modelo.';
