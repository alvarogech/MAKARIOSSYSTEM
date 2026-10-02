-- Aumenta a frequência de 1x/dia pra de 2 em 2 horas. Motivo: cada chamada
-- só processa um lote pequeno (MAX_SENDS_PER_RUN, hoje 15) pra nunca
-- estourar o tempo limite da function — rodando só 1x/dia, um acúmulo
-- grande (ex.: e-mails represados pelo limite diário do provedor) levaria
-- dias pra esvaziar. De 2 em 2 horas, o mesmo teto por chamada dá bem mais
-- chances de drenar a fila no mesmo dia, assim que a cota do provedor
-- renovar — sem nunca mandar e-mail duplicado (reminder_stage/
-- initial_email_sent_at continuam garantindo isso).
--
-- O segredo real (x-cron-secret) não fica neste arquivo pelo mesmo motivo
-- da migração anterior — aplicado direto via tool, idêntico ao já
-- configurado no Netlify.
select cron.schedule(
  'student-onboarding-reminders',
  '0 */2 * * *',
  $$
  select net.http_post(
    url := 'https://makarios-plataforma.netlify.app/api/cron/student-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET_VALUE>', 'content-type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
