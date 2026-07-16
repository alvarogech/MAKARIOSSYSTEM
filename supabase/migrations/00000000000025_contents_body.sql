-- Corpo do conteúdo quando type = 'text' (texto/markdown) ou 'link'
-- (URL) — vídeo usa `video_contents`, arquivo usa `content_files`.
alter table public.contents add column body text;
