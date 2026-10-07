import type { ReactNode } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, Hourglass, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

/** Tela de preparação: tudo o que vale saber antes de iniciar. Abrir esta tela não inicia a prova nem usa tentativa. */
export function AssessmentPrep({
  title,
  type,
  questionsCount,
  durationMinutes,
  passingGrade,
  closesAt,
  attemptsAllowed,
  attemptsUsed,
  children,
}: {
  title: string;
  type: string;
  questionsCount: number;
  durationMinutes: number;
  passingGrade: number | string;
  closesAt: string | null;
  attemptsAllowed: number;
  attemptsUsed: number;
  children: ReactNode;
}) {
  const remaining = Math.max(0, attemptsAllowed - attemptsUsed);

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{type === "recovery" ? "Recuperação" : "Avaliação final"}</p>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">{title}</h1>
        {type === "recovery" ? null : <p className="mt-0.5 text-sm text-neutral-600">Uma etapa para reunir o que você aprendeu.</p>}
      </div>

      <ul className="grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
        <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <ClipboardList className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>
            <strong>{questionsCount}</strong> {questionsCount === 1 ? "questão" : "questões"}
          </span>
        </li>
        <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <Hourglass className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>
            <strong>{durationMinutes} minutos</strong> a partir do clique em “Iniciar avaliação”
          </span>
        </li>
        <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <Repeat className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>
            {attemptsAllowed === 1 ? "Uma tentativa" : `${attemptsAllowed} tentativas`}
            {attemptsUsed > 0 ? ` · ${remaining} ${remaining === 1 ? "restante" : "restantes"}` : ""}
          </span>
        </li>
        <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span>Nota mínima: {passingGrade}</span>
        </li>
        {closesAt ? (
          <li className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-neutral-50 p-3 sm:col-span-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
            <span>Prazo final para iniciar: {dateTime(closesAt)}</span>
          </li>
        ) : null}
      </ul>

      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Como funciona</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-neutral-700">
          <li>Uma questão por vez. Você pode ir e voltar entre elas pela numeração.</li>
          <li>
            <strong>Confirme cada resposta.</strong> Ao confirmar, ela é salva e não pode ser alterada — só a primeira confirmação conta. Resposta marcada e não
            confirmada não é salva.
          </li>
          <li>O tempo é controlado pelo servidor: recarregar ou sair e voltar não reinicia o relógio.</li>
          <li>Você pode enviar com questões sem resposta; elas não pontuam. O envio é definitivo.</li>
          <li>Ao enviar, você vê sua nota e quantas questões acertou. O gabarito, com as explicações, é liberado depois pela coordenação.</li>
          <li>Apenas abrir esta página não inicia a avaliação nem usa tentativa.</li>
        </ul>
      </div>

      <div>{children}</div>
    </Card>
  );
}
