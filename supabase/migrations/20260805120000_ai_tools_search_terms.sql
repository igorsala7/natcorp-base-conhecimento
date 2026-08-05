-- B (assertividade da seleção de tools): SINÔNIMOS + EXEMPLOS de pergunta por tool.
-- Enriquece o texto embeddado do catálogo (toolCatalogText) para o matching semântico
-- entender o VOCABULÁRIO do usuário — ex.: "salário"/"holerite" casam com a tool de
-- "Eventos Financeiros". NÃO é mostrado ao modelo (não polui o prompt); só compõe o
-- embedding. Preenchível na mão (Construtor) ou gerado por IA (scripts/gen-search-terms).
alter table ai_tools add column if not exists search_terms text not null default '';

comment on column ai_tools.search_terms is
  'Sinônimos + exemplos de pergunta (um por linha ou separados por vírgula). Só entra no embedding do catálogo (toolCatalogText), nunca no prompt do modelo.';
