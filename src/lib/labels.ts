/** Rótulos em português para valores crus do banco que apareciam na tela (open, active, obrigatorio...). */

const STATUS: Record<string, string> = {
  open: "Aberta",
  closed: "Encerrada",
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  published: "Publicado",
  archived: "Arquivado",
  active: "Ativa",
  inactive: "Inativa",
  scheduled: "Agendada",
  canceled: "Cancelada",
  cancelled: "Cancelada",
  pending: "Pendente",
  rejected: "Recusada",
};

const CONTENT_TYPE: Record<string, string> = {
  video: "Vídeo",
  file: "Arquivo",
  link: "Link",
  text: "Texto",
};

const CLASSIFICATION: Record<string, string> = {
  obrigatorio: "Obrigatório",
  complementar: "Complementar",
  preparatorio: "Preparatório",
  aprofundamento: "Aprofundamento",
  revisao: "Revisão",
  exclusivo_professor: "Exclusivo de professor",
  exclusivo_coordenacao: "Exclusivo de coordenação",
  exclusivo_administracao: "Exclusivo de administração",
};

const QUESTION_TYPE: Record<string, string> = {
  multiple_choice: "Múltipla escolha",
  true_false: "Verdadeiro ou falso",
  matching: "Associação",
  ordering: "Ordenação",
  fill_in_blank: "Completar",
};

const DIFFICULTY: Record<string, string> = { facil: "Fácil", medio: "Média", dificil: "Difícil" };

const pick = (map: Record<string, string>, value: string | null | undefined) =>
  value ? (map[value] ?? value) : "";

export const statusLabel = (value: string | null | undefined) => pick(STATUS, value);
export const contentTypeLabel = (value: string | null | undefined) => pick(CONTENT_TYPE, value);
export const classificationLabel = (value: string | null | undefined) => pick(CLASSIFICATION, value);
export const questionTypeLabel = (value: string | null | undefined) => pick(QUESTION_TYPE, value);
export const difficultyLabel = (value: string | null | undefined) => pick(DIFFICULTY, value);
