-- Anexos de arquivo nos chats (Fase 3C). O visitante/usuário anexa um documento
-- (pdf/docx/pptx/xlsx/csv/txt/md/código); o servidor valida, guarda o arquivo no
-- Storage privado ('imports', sob 'chat/'), EXTRAI o texto e o injeta como DADO
-- na resposta daquele turno. Imagens ficam para um passo futuro (exigem visão).
--
-- Sem sessão verificada nas superfícies públicas: escrito/lido só pelo servidor
-- (service-role) nas rotas do widget/portal, sempre escopado por space_id. RLS
-- nega anon/authenticated, como em prompts_usuario_cliente.

create table public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- Preenchido quando a mensagem é enviada (o anexo é criado ANTES de existir a
  -- conversa). Ao apagar a conversa, o anexo vai junto.
  conversation_id uuid references public.conversations (id) on delete cascade,
  storage_path text not null,
  name text not null,
  mime text not null,
  size_bytes integer not null,
  -- Texto extraído do documento (o que vai ao modelo). Pode ser truncado.
  extracted_text text,
  char_count integer,
  created_at timestamptz not null default now()
);
create index chat_attachments_conv_idx on public.chat_attachments (conversation_id);
create index chat_attachments_space_idx on public.chat_attachments (space_id, created_at desc);

alter table public.chat_attachments enable row level security;
-- Só service-role (rotas do servidor). Nenhum acesso direto do cliente.
revoke all on public.chat_attachments from anon, authenticated;

-- Metadados leves do anexo na própria mensagem, para reexibir o "chip" no
-- histórico (nome/mime/tamanho). NOT NULL com default, como `citations`.
alter table public.messages
  add column attachments jsonb not null default '[]'::jsonb;
