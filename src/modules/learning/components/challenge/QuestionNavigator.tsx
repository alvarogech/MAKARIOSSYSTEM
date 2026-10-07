import type { ActivityQuestion } from "../../actions/activityAttempt";
import type { AnswerState } from "./types";

function statusOf(answer: AnswerState | undefined): "sem resposta" | "respondida" | "verificada" {
  if (!answer || answer.selected.length === 0) return "sem resposta";
  return answer.feedback ? "verificada" : "respondida";
}

/** Bolinhas numeradas para ir direto a qualquer questão; o estado vai por texto, não só por cor. */
export function QuestionNavigator({
  questions,
  answers,
  index,
  onSelect,
}: {
  questions: ActivityQuestion[];
  answers: Record<string, AnswerState>;
  index: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Questões do desafio">
      {questions.map((q, i) => {
        const status = statusOf(answers[q.questionId]);
        return (
          <li key={q.questionId}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Ir para a questão ${i + 1} (${status})`}
              aria-current={i === index ? "step" : undefined}
              className={
                "size-9 rounded-full border text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue " +
                (i === index
                  ? "border-brand-blue bg-brand-blue text-white"
                  : status !== "sem resposta"
                    ? "border-brand-blue/40 bg-brand-blue-light text-brand-blue"
                    : "border-neutral-300 text-neutral-500")
              }
            >
              {i + 1}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
