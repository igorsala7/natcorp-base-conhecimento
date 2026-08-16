-- Escopo `dicionario` para os jobs de ontologia.
--
-- A ingestão do dicionário já alimenta a ontologia de forma DETERMINÍSTICA — o
-- rótulo vira termo e a coluna vira sinônimo. O que faltava é a camada de IA:
-- quem pergunta "quantos funcionários na unidade 3" não escreve "Filial" nem
-- "COD_FILIAL", escreve "unidade". Esse sinônimo nenhuma regra deriva.
--
-- Reusa `sinonimosDeTermos`, a mesma da importação por arquivo: recebe os termos
-- prontos e só enriquece, sem inventar termos fora da lista. Uma segunda
-- extração produziria vocabulário com critério diferente, e o mesmo jargão
-- viraria dois termos conforme a porta de entrada.
--
-- ── Por que uma migration para uma palavra ─────────────────────────────────
-- `scope` tem CHECK. Inserir 'dicionario' sem isto é recusado pelo banco, e a
-- mensagem fala de violação de restrição, não de valor faltando na lista — foi
-- exatamente assim que `csv_dict` e `db_column` falharam antes neste projeto.
alter table public.ontology_jobs
  drop constraint if exists ontology_jobs_scope_check;

alter table public.ontology_jobs
  add constraint ontology_jobs_scope_check
  check (scope in ('space', 'subtree', 'article', 'import', 'document', 'dicionario'));

comment on constraint ontology_jobs_scope_check on public.ontology_jobs is
  'Origem da varredura. `dicionario` = enriquece com sinônimos os rótulos vindos do dicionário de dados (APEX/CSV), sem alvo em `target_id`.';
