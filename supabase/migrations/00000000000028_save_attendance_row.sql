-- Upsert de uma linha de frequência com justificativa na MESMA transação
-- (necessário para que o trigger de histórico veja `app.justification` —
-- `set_config(..., true)` só vale dentro da transação corrente, então
-- precisa estar na mesma função que faz o UPDATE, não numa chamada RPC
-- separada antes). SECURITY INVOKER de propósito: quem chama continua
-- sujeito às mesmas políticas de RLS de `attendance_records` (professor
-- só grava nas próprias turmas, e só enquanto ainda é rascunho).
create or replace function public.save_attendance_row(
  p_meeting_id uuid,
  p_enrollment_id uuid,
  p_status public.attendance_status,
  p_recognized_minutes integer,
  p_observation text default null,
  p_justification text default null
)
returns public.attendance_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.attendance_records;
  v_result public.attendance_records;
begin
  select * into v_existing
  from public.attendance_records
  where meeting_id = p_meeting_id and enrollment_id = p_enrollment_id;

  if v_existing.id is not null and p_justification is not null then
    perform set_config('app.justification', p_justification, true);
  end if;

  insert into public.attendance_records (
    meeting_id, enrollment_id, status, recognized_minutes, observation, recorded_by
  ) values (
    p_meeting_id, p_enrollment_id, p_status, p_recognized_minutes, p_observation, auth.uid()
  )
  on conflict (enrollment_id, meeting_id)
  do update set
    status = excluded.status,
    recognized_minutes = excluded.recognized_minutes,
    observation = excluded.observation
  returning * into v_result;

  return v_result;
end;
$$;

revoke execute on function public.save_attendance_row(uuid, uuid, public.attendance_status, integer, text, text) from public, anon;
grant execute on function public.save_attendance_row(uuid, uuid, public.attendance_status, integer, text, text) to authenticated;
