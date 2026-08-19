-- AS TABELAS SOBREVIVEM À CONVERSA, NÃO SÓ AO TURNO.
--
-- "Os usuários vão fazer muitas conferências, então às vezes em 20 mensagens
-- ele ainda está citando o resultado da quinta" (Igor, 19/08/2026).
--
-- Hoje o resultado de uma ferramenta vive num registro em memória e morre no
-- fim do turno. O texto da conversa atravessa (pergunta e resposta), mas as
-- LINHAS não — então o agente lembra que consultou 2.777 marcações e não
-- consegue contar, agrupar nem filtrar aquilo. Ele tentava `dados_de: "ds1"`,
-- recebia "nenhuma tabela carregada neste turno", e refazia a chamada à API.
--
-- Reusa `widget_datasets`, que já resolve a parte difícil: linhas em jsonb,
-- gzip em bucket para conjuntos grandes, escopo por espaço e usuário.
--
-- RETENÇÃO (decisão do Igor): as 10 mais recentes por conversa, expirando em
-- 24h de inatividade. Conferência é trabalho de sessão — no dia seguinte o dado
-- mudou de qualquer jeito. E são linhas com matrícula, nome e salário: guardar
-- indefinidamente é acumular dado pessoal em repouso sem ninguém pedindo.

alter table widget_datasets
  add column if not exists conversation_id uuid references conversations (id) on delete cascade,
  -- O NÚMERO do `dsN`/`telaN`. É ele que faz o id sobreviver: sem isso cada
  -- turno recomeça em ds1 e o agente pede uma tabela recebendo outra, em
  -- silêncio, com os números trocados.
  add column if not exists seq integer,
  add column if not exists expires_at timestamptz;

-- Um `seq` por conversa. Sem a restrição, uma corrida entre dois turnos criaria
-- dois `ds4` diferentes — exatamente a colisão que a coluna existe para impedir.
create unique index if not exists widget_datasets_conversa_seq
  on widget_datasets (conversation_id, seq)
  where conversation_id is not null;

-- Reidratação: as N mais recentes e ainda válidas de uma conversa.
create index if not exists widget_datasets_conversa_lookup
  on widget_datasets (conversation_id, expires_at desc)
  where conversation_id is not null;

comment on column widget_datasets.conversation_id is
  'Conversa dona da tabela. Preenchido só para resultado de FERRAMENTA reidratável entre turnos; o relatório coletado da tela continua sem conversa (chaveado por client_key).';
comment on column widget_datasets.seq is
  'Número do identificador (`ds<seq>`) dentro da conversa — o que impede ds1 de renascer com outro conteúdo.';
comment on column widget_datasets.expires_at is
  'Quando a tabela deixa de ser reidratada (24h da última atividade). A linha some na faxina; o dado é pessoal e não fica em repouso além do necessário.';
