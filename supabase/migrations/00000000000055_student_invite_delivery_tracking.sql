-- Rastreia se o e-mail INICIAL de aprovação (não o lembrete) foi
-- realmente entregue. Até agora, uma falha de envio na hora da aprovação
-- (ex.: limite diário do provedor de e-mail) deixava o convite com um
-- token válido mas ninguém nunca tentava reenviar sozinho — dependia de
-- alguém perceber o aviso e pedir reenvio manual. Null = nunca entregue
-- (seja por nunca ter tentado, seja por falha) — o cron diário de
-- lembrete agora também cobre esse caso, com prioridade máxima.
alter table public.invitations
  add column initial_email_sent_at timestamptz;

-- Backfill: os convites já existentes foram enviados com sucesso (confirmado
-- no provedor) — exceção feita aos 4 que falharam por limite diário do
-- Resend na aprovação das 12:59 UTC de hoje, relatados pela coordenação.
update public.invitations
set initial_email_sent_at = invited_at
where purpose = 'student_onboarding' and channel = 'email'
  and id not in (
    '7d5b1fbd-b28a-4be8-ab82-ab68aa30eac1',
    '4342f37a-b1d4-4bca-a0a3-d3132f42154c',
    'cea691ad-aecd-46a9-97d7-3ab20e5436f2',
    'ea61700a-b3c8-4d36-bfa8-36d8291e1d37'
  );
