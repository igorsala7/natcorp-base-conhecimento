-- Fase 5 (req. 3) — instante do CLIENTE de cada evento, para intercalar prints e
-- narração na ordem certa da fala/vídeo. Para 'transcript', t_ms = início da
-- gravação (epoch ms); os segmentos temporizados ficam em `meta.segments`.
alter table public.extension_events
  add column t_ms bigint;
