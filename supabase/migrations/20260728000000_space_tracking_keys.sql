-- Chave de RASTREIO por espaço: assina/cifra os parâmetros p_* (p_usuario,
-- p_empresa, …) que o widget e o portal recebem, para que não possam ser
-- alterados no console do navegador.
--
-- É um SEGREDO COMPARTILHADO com o backend do cliente. Mesma proteção das outras
-- chaves (ai_provider_keys): TABELA ISOLADA, sem grant para anon/authenticated —
-- só o servidor (service-role) lê/escreve. Jamais pode vazar pelo cliente
-- público, senão dá para forjar os tokens.
create table public.space_tracking_keys (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  key_enc text not null,              -- chave AES (base64) cifrada em repouso
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.space_tracking_keys enable row level security;

-- Nenhuma policy e nenhum grant: inalcançável por SQL comum. A escrita passa
-- por uma server action com checagem de permissão (widget.manage) + service-role.
revoke all on public.space_tracking_keys from anon, authenticated;
