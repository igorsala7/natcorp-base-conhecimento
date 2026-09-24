-- =====================================================================
-- MODELO DE CONTINGÊNCIA: o crédito acaba e o assistente BARATEIA,
-- em vez de perder metade do que sabe fazer
--
-- Regra nova do dono (24/09), substituindo a de 23/09.
--
-- ── O que valia até aqui ─────────────────────────────────────────────
-- Saldo zerado cortava TODAS as ferramentas e o chat seguia só com a
-- documentação. A intenção era não deixar o cliente sem assistente, mas
-- o efeito prático é quase o mesmo: quem pergunta "quantos dias de
-- férias eu tenho" recebe um artigo explicando o que são férias. O
-- produto some sem avisar que sumiu.
--
-- ── O que passa a valer ──────────────────────────────────────────────
-- As ferramentas FICAM. O que muda é o modelo: cada finalidade pode ter
-- um segundo modelo, mais barato, usado enquanto o crédito estiver
-- zerado. A capacidade continua; o custo por token cai.
--
-- ── Por que colunas na mesma linha, e não uma tabela nova ────────────
-- "Qual modelo esta finalidade usa sem crédito" é um atributo DA
-- atribuição, não uma entidade. Numa tabela à parte, as duas precisariam
-- ser lidas e casadas em toda resolução, e a segunda envelheceria calada
-- quando alguém apagasse a primeira. Aqui a cascata de `resolveAi` já
-- lê a linha; o modelo de contingência vem junto, de graça.
--
-- Nulo significa "não configurado", e aí a resolução cai na cascata
-- normal (padrão global → chat → env) sem nunca cortar ferramenta: a
-- ausência de configuração não pode reintroduzir, pela porta dos fundos,
-- o corte que esta migration existe para remover.
-- =====================================================================

alter table public.ai_assignments
  add column if not exists model_sem_credito text,
  add column if not exists provider_sem_credito uuid references public.ai_providers(id) on delete set null;

comment on column public.ai_assignments.model_sem_credito is
  'Modelo usado enquanto a base está sem crédito. NULL = não configurado; a resolução segue a cascata normal e NUNCA corta ferramenta.';
comment on column public.ai_assignments.provider_sem_credito is
  'Provedor do modelo de contingência. Pode ser outro provedor (ex.: chat num modelo forte, contingência num rápido de outra casa).';

-- Os dois andam juntos: modelo sem provedor não instancia nada, e
-- provedor sem modelo não sabe o que chamar. Meio preenchido é a
-- configuração que parece pronta na tela e falha só quando o crédito
-- acaba, que é o pior momento para descobrir.
alter table public.ai_assignments
  drop constraint if exists ai_assignments_sem_credito_completo;

alter table public.ai_assignments
  add constraint ai_assignments_sem_credito_completo check (
    (model_sem_credito is null and provider_sem_credito is null)
    or (btrim(coalesce(model_sem_credito, '')) <> '' and provider_sem_credito is not null)
  );

-- ── Embedding fica FORA da contingência, e o banco é quem recusa ────────
-- A tela só oferece o campo para chat, chat com ferramentas, análise de
-- relatório e reescrita de consulta. Mas a tela não é a regra: quem editar
-- esta tabela por SQL conseguiria pôr um modelo de embedding mais barato aqui,
-- e o estrago não apareceria como erro.
--
-- Vetor gerado por outro modelo vive em OUTRO espaço. Os `chunks` já gravados
-- continuariam lá, a busca continuaria retornando linhas, e o que mudaria é só
-- a QUALIDADE — silenciosamente, e apenas para as bases sem crédito, que são
-- justamente as que menos serão olhadas. Custaria uma reindexação inteira para
-- descobrir.
--
-- `resolveAi` nunca passa `semCredito` para embedding (todos os quatro
-- chamadores usam o padrão `false`), então isto é a segunda tranca, não a
-- primeira. É a tranca que sobrevive a alguém mexer no código.
alter table public.ai_assignments
  drop constraint if exists ai_assignments_embedding_sem_contingencia;

alter table public.ai_assignments
  add constraint ai_assignments_embedding_sem_contingencia check (
    purpose <> 'embedding' or model_sem_credito is null
  );
