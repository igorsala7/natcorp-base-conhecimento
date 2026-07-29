-- Documentação que o CHATBOT da base usa: fonte do RAG e espaço onde as
-- conversas são registradas (conversations.space_id é obrigatório).
--
-- Nullable: uma base sem isto ainda serve as APIs, mas não responde
-- documentação nem funciona no WhatsApp (precisa de um espaço para logar a
-- conversa). NÃO é único: várias bases podem apontar para a mesma documentação
-- compartilhada (o acesso doc↔cliente é muitos-para-muitos).
alter table public.ai_bases
  add column chat_space_id uuid references public.spaces (id) on delete set null;
