-- Ação sobre os itens que uma ferramenta de LEITURA devolve.
--
-- Quando alguém pergunta "o que tenho para aprovar?", a resposta é uma lista —
-- e o passo seguinte é uma AÇÃO sobre alguns daqueles itens. Hoje isso vira
-- digitação: a pessoa lê os números na tela e escreve "aprova a 57463 e a
-- 57465". Ler número de tela e redigitar é onde se aprova a requisição errada.
--
-- Esta coluna deixa a ferramenta de leitura DECLARAR que seus itens aceitam uma
-- ação, e qual. O chat então mostra a lista com seleção e o botão da ação.
--
-- Por que na ferramenta de LEITURA e não na de escrita: assim o vínculo é
-- explícito e auditável — só as listas que alguém marcou viram lista clicável.
-- Parear por adivinhação ("esta lista tem um campo que aquela ação aceita")
-- transformaria qualquer consulta num formulário de ação.
--
-- Formato (ver src/lib/integrations/acao-lista.ts):
-- {
--   "tool": "ferias_aprovar",            -- ferramenta que executa
--   "lista": "itens",                    -- caminho da lista no retorno
--   "chave_item": "cod_solicitacao",     -- identificador do item
--   "param_item": "cod_solicitacao",     -- parâmetro da ação que recebe o id
--   "titulo": "colaborador.nome",        -- o que a pessoa lê na linha
--   "detalhe": "periodo.dt_inic_per_ferias",
--   "condicao": { "campo": "minha_vez", "igual": true },
--   "param_variante": "status",
--   "variantes": [ { "valor": "A", "rotulo": "Aprovar" },
--                  { "valor": "R", "rotulo": "Reprovar", "estilo": "perigo" } ],
--   "campos": [ { "nome": "justificativa", "rotulo": "Justificativa",
--                 "obrigatorio": true, "multilinha": true } ],
--   "lote": true
-- }
alter table public.ai_tools
  add column if not exists acao_em_lista jsonb;

comment on column public.ai_tools.acao_em_lista is
  'Declara que os itens devolvidos por esta ferramenta aceitam uma ação (aprovar, cancelar…). '
  'O chat renderiza a lista com seleção e executa via /api/v1/acao. NULL = lista comum.';
