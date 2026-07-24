-- Template de e-mail (design de marca) da instalação: um BlockDoc (v2) que
-- envolve os e-mails transacionais, injetando o corpo no token {{conteudo}}.
-- Nulo = sem template (o app aplica um shell mínimo). Mora na mesma tabela
-- singleton email_settings, então a RLS/os grants (integrations.manage) já valem.
alter table public.email_settings add column if not exists template jsonb;

comment on column public.email_settings.template is
  'BlockDoc (v2) do template de e-mail. Nulo = sem template. Tokens no texto: {{conteudo}}, {{ano}}, {{remetente}}.';
