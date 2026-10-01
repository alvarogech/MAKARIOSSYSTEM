-- Dispara /api/cron/student-reminders uma vez por dia (09:00 UTC ~ 06:00
-- em Brasília) — a rota decide sozinha quem precisa de lembrete (3 dias
-- depois do convite, ou perto da primeira aula). Rodar isto todo dia não
-- manda e-mail todo dia: cada convite só avança de estágio uma vez.
--
-- O valor real de x-cron-secret NÃO fica neste arquivo (vazaria pelo
-- histórico do git) — foi aplicado diretamente via migration no projeto,
-- com o mesmo valor configurado como CRON_SECRET no Netlify. Se precisar
-- reaplicar/trocar, gere um novo valor e repita os dois lados.
create extension if not exists pg_net;

select cron.schedule(
  'student-onboarding-reminders',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://makarios-plataforma.netlify.app/api/cron/student-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET_VALUE>', 'content-type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
