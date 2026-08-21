-- REMUNERAÇÃO VARIÁVEL/FLEXÍVEL NÃO EXISTIA EM TERMO DE BUSCA NENHUM.
--
-- "Então faça pelo total da remuneração" devia cair em
-- `informacoes_pessoais_funcionais` e ficou em 11º de 88. Medido em 21/08/2026:
-- NENHUMA das duas ferramentas de cadastro tinha um único termo de busca sobre
-- remuneração, salário, variável ou flexível. A pergunta não casava com nenhuma,
-- e o topo do turno foi ocupado por vizinhas de assunto financeiro.
--
-- ── Por que só na COMPLETA, e só estes três termos ──────────────────────────
-- A regra do dono é "resumida por padrão; completa só quando pedirem algo que
-- só ela tem". As duas trazem SALÁRIO — a descrição da resumida já o lista —,
-- então acrescentar "salário" aqui criaria a ambiguidade que se quer evitar.
-- O que é exclusivo da completa é a remuneração VARIÁVEL e FLEXÍVEL, e o TOTAL
-- que as soma. São exatamente esses os termos, e nenhum a mais.
--
-- ── O que isto NÃO conserta, e é preciso dizer ──────────────────────────────
-- As duas ferramentas são quase idênticas no espaço vetorial porque falam do
-- mesmo assunto. A descrição da completa JÁ diz "Use SOMENTE quando pedirem um
-- documento ou dado que não esteja no resumo" — e embedding não captura regra
-- condicional: ele captura assunto, não política. Este UPDATE ataca o caso em
-- que a regra é enunciável como VOCABULÁRIO (quem diz "remuneração variável"
-- está pedindo um campo exclusivo). Onde a distinção não vira palavra, ele não
-- ajuda, e a seleção continuará dependendo do desempate pareado.

UPDATE ai_tools
   SET search_terms = coalesce(search_terms, '') ||
       E'\ntotal da remuneração\nremuneração variável\nremuneração flexível'
 WHERE key = 'informacoes_pessoais_funcionais'
   AND search_terms NOT LIKE '%remuneração variável%';

-- Verificação: o termo entrou, e NÃO entrou na irmã.
DO $$
DECLARE na_completa int; na_resumida int;
BEGIN
  SELECT count(*) INTO na_completa FROM ai_tools
   WHERE key = 'informacoes_pessoais_funcionais' AND search_terms LIKE '%remuneração variável%';
  SELECT count(*) INTO na_resumida FROM ai_tools
   WHERE key = 'informacoes_pessoais_funcionais_resumido' AND search_terms LIKE '%remuneração variável%';
  IF na_completa <> 1 THEN RAISE EXCEPTION 'termo não entrou na ferramenta completa'; END IF;
  IF na_resumida <> 0 THEN RAISE EXCEPTION 'termo vazou para a resumida — recria a ambiguidade'; END IF;
END $$;
