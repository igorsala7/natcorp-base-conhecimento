-- Corrige `set_email_secret`: o UPDATE sem WHERE quebra sob a proteção
-- `safeupdate` ("UPDATE requires a WHERE clause"), inclusive dentro de uma
-- função SECURITY DEFINER. `email_secrets` é singleton (id boolean = true), então
-- `where id = true` é semanticamente idêntico e satisfaz a proteção.
-- Sintoma: "Falha ao gravar o segredo: UPDATE requires a WHERE clause" ao salvar
-- a chave da API do Brevo (ou a senha do SMTP) em /admin/sistema.

-- Garante o registro único (idempotente).
insert into public.email_secrets (id) values (true) on conflict do nothing;

create or replace function public.set_email_secret(p_campo text, p_valor_enc text)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if public.max_role_level(auth.uid(), null) < 100 then
    raise exception 'Apenas o Owner pode alterar segredos de e-mail'
      using errcode = '42501';
  end if;
  if p_campo = 'brevo' then
    update public.email_secrets set brevo_api_key_enc = p_valor_enc, updated_at = now() where id = true;
  elsif p_campo = 'smtp' then
    update public.email_secrets set smtp_pass_enc = p_valor_enc, updated_at = now() where id = true;
  else
    raise exception 'Campo desconhecido: %', p_campo;
  end if;
end $$;

-- create or replace preserva os grants; reafirmamos o estado atual por clareza.
revoke all on function public.set_email_secret(text, text) from public, anon;
grant execute on function public.set_email_secret(text, text) to authenticated;
