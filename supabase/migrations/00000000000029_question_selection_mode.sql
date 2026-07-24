-- Retrofit da Fase 3, motivado por referência real do formato já usado
-- pela escola (site de exercícios de uma temporada anterior, sem o
-- sistema): perguntas de múltipla escolha podem pedir "uma resposta
-- correta" (rádio) ou "marque todas as corretas" (checkbox). A correção
-- (comparação de conjuntos em submit_activity_attempt/
-- submit_assessment_answer) já lida com as duas corretamente — faltava
-- só a UI saber qual controle renderizar.

alter table public.question_bank
  add column selection_mode text not null default 'single'
  check (selection_mode in ('single', 'multiple'));

comment on column public.question_bank.selection_mode is
  '"single" = uma resposta correta (rádio); "multiple" = marque todas as '
  'corretas (checkbox). "Marque a incorreta" também usa "single" — é '
  'semântica de enunciado, não muda a mecânica de seleção.';
