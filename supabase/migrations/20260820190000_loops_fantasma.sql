-- LAÇOS QUE APONTAM PARA PARÂMETRO INEXISTENTE.
--
-- 8 das 31 ferramentas com `loop` nomeiam um `param` que não está em
-- `params`. O executor não valida isso, e cada caso falha de um jeito
-- diferente — nenhum deles em voz alta.
--
-- (A auditoria de 20/08 contou 7 em 26 porque filtrou por `active`. A oitava,
-- `bi_dados_cadastrais`, está inativa: o defeito dorme até alguém religá-la.
-- Consertar dormindo é mais barato que descobrir acordada.)
--
-- ── (a) `unit:'month'` sobre `data_ref`, que não existe (5 ferramentas)
-- O laço expande `periodo_ini`→`periodo_fim` mês a mês e injeta `data_ref`
-- em cada volta. Como `data_ref` não é parâmetro declarado, `resolveParams`
-- o descarta ao montar a query: as N requisições saem IDÊNTICAS, e
-- `achatarLoop` as apresenta numa coluna "Competência" como se fossem meses
-- diferentes. Medido em 60 dias: bi_avaliacoes = 169 chamadas para 8 URLs
-- distintas (21×), pior turno 48 chamadas para 1 URL. É resposta errada com
-- aparência de relatório — o caro deste defeito não é o custo, é a mentira.
-- Confirmado contra a API: `?data_ref=2026-08` devolve 200 e o MESMO corpo.
--
-- ── (b) `unit:'values'` sobre `matricula`, quando o parâmetro é `p_matricula`
-- Aqui o laço é inerte: `modelArgs['matricula']` é sempre undefined, a lista
-- sai vazia e, como o parâmetro é opcional, cai na chamada única. Nunca
-- quebrou nada — mas é uma armadilha carregada, que dispara no dia em que
-- alguém renomear o parâmetro.
--
-- ── Por que estas duas não viram `values` sobre `p_matricula`
-- Porque a API JÁ aceita lista por vírgula: medido em 20/08, `p_matricula=
-- 365785,205818` devolve 200 com os dois registros. Ativar o laço trocaria
-- UMA requisição que funciona por N. Em `bi/v1/*` é o oposto — lista por
-- vírgula devolve ORA-01722 ("número inválido"), e ali o laço é o conserto.
--
-- Um UPDATE por ferramenta, de propósito: `UPDATE ... FROM (VALUES ...)` com
-- duas linhas casando a mesma tool aplica UMA e descarta a outra em silêncio
-- (foi assim que `requisicoes_req_ferias.periodo` se perdeu em 20/08).

-- (a1) Laço de mês sem sentido no domínio: CEP não tem competência, e os dois
-- painéis de SESMT/risco são fotografias do presente, não séries mensais.
UPDATE ai_tools SET loop = NULL WHERE key = 'consultar_cep';
UPDATE ai_tools SET loop = NULL WHERE key = 'bi_conformidade_sesmt';
UPDATE ai_tools SET loop = NULL WHERE key = 'bi_risco';

-- (a2) Aqui o laço vira útil trocando de eixo: de mês (que a API ignora) para
-- matrícula (que a API exige uma por vez).
UPDATE ai_tools SET loop = jsonb_build_object('unit', 'values', 'param', 'matricula', 'max', 20)
 WHERE key = 'bi_avaliacoes';
UPDATE ai_tools SET loop = jsonb_build_object('unit', 'values', 'param', 'matricula', 'max', 20)
 WHERE key = 'bi_contrato_gestao';
UPDATE ai_tools SET loop = jsonb_build_object('unit', 'values', 'param', 'matricula', 'max', 20)
 WHERE key = 'bi_dados_cadastrais';   -- inativa hoje; mesma API, mesmo tratamento

-- (b) Preserva o comportamento de hoje (chamada única com a lista inteira) e
-- remove o ponteiro solto.
UPDATE ai_tools SET loop = NULL WHERE key = 'informacoes_pessoais_funcionais';
UPDATE ai_tools SET loop = NULL WHERE key = 'informacoes_pessoais_funcionais_resumido';

-- Verificação: nenhuma ferramenta com `loop` pode nomear parâmetro ausente.
DO $$
DECLARE fantasmas int;
BEGIN
  SELECT count(*) INTO fantasmas
    FROM ai_tools t
   WHERE t.loop IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(t.params, '[]'::jsonb)) p
        WHERE p->>'nome' = t.loop->>'param');
  IF fantasmas > 0 THEN
    RAISE EXCEPTION 'Ainda há % ferramenta(s) com loop.param inexistente', fantasmas;
  END IF;
END $$;
