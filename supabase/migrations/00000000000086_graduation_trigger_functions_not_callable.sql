-- As funcoes de auditoria da Formatura so existem para serem disparadas por gatilho.
-- O Postgres nao exige EXECUTE do usuario para disparar um gatilho, entao retirar a
-- permissao evita que elas aparecam como RPC na API sem afetar a auditoria.
revoke all on function public.graduation_audit_edition() from public, anon, authenticated;
revoke all on function public.graduation_audit_participant() from public, anon, authenticated;
revoke all on function public.graduation_audit_history() from public, anon, authenticated;
