-- Perguntas adicionais do formulário público de inscrição sobre vínculo
-- eclesiástico: se a pessoa faz parte de outra igreja, se é membro da
-- Igreja Emaús e, se for, a rede de GR (Grupo de Relacionamento).
--
-- Todas nulas por padrão: solicitações enviadas antes desta pergunta
-- existir não têm resposta, e nulo nunca deve ser confundido com "não".

alter table public.enrollment_requests
  add column is_other_church_member boolean,
  add column other_church_name text,
  add column is_emaus_member boolean,
  add column has_gr boolean,
  add column gr_network_slug text
    check (gr_network_slug is null or gr_network_slug in (
      'antonio_carlos',
      'ranyere_araujo',
      'alvaro_henrique_huios',
      'matheus_soares_folk',
      'vitor_motta_slaves'
    ));

alter table public.enrollment_requests
  add constraint enrollment_requests_gr_consistent check (
    (
      is_emaus_member is distinct from true
      and has_gr is null
      and gr_network_slug is null
    )
    or (
      is_emaus_member = true
      and (
        has_gr is null
        or (has_gr = false and gr_network_slug is null)
        or (has_gr = true and gr_network_slug is not null)
      )
    )
  );

comment on column public.enrollment_requests.is_other_church_member is
  'Se a pessoa também frequenta outra igreja. Nulo = pergunta não existia quando a solicitação foi enviada.';
comment on column public.enrollment_requests.other_church_name is
  'Nome da outra igreja, quando informado. Sempre opcional.';
comment on column public.enrollment_requests.is_emaus_member is
  'Se a pessoa é membro da Igreja Emaús. Nulo = pergunta não existia quando a solicitação foi enviada.';
comment on column public.enrollment_requests.has_gr is
  'Só relevante quando is_emaus_member = true: se a pessoa participa de um GR.';
comment on column public.enrollment_requests.gr_network_slug is
  'Só preenchido quando has_gr = true: a rede de GR à qual a pessoa pertence.';
