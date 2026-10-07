import Link from "next/link";
import { Award } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { visibleAchievements, type Achievement } from "../achievements";
import type { StudentRewards } from "../achievementsLoader";
import { WeeklyGoalForm } from "./WeeklyGoalForm";

const dateLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(iso));

function Item({ achievement }: { achievement: Achievement }) {
  return (
    <li className="flex items-start gap-2.5">
      <Award className={`mt-0.5 size-4 shrink-0 ${achievement.earned ? "text-success" : "text-neutral-300"}`} aria-hidden="true" />
      <span className="min-w-0 text-sm">
        <span className={`block font-medium ${achievement.earned ? "text-neutral-900" : "text-neutral-600"}`}>{achievement.title}</span>
        <span className="block text-xs text-neutral-500">
          {achievement.earned
            ? achievement.earnedAt
              ? `Conquistada em ${dateLabel(achievement.earnedAt)}`
              : "Conquistada"
            : achievement.progress
              ? `${achievement.progress.current} de ${achievement.progress.target}`
              : achievement.description}
        </span>
      </span>
    </li>
  );
}

/** Conquistas pessoais + meta semanal. Sem pontos, níveis ou comparação com outros alunos. */
export function AchievementsCard({ rewards, compact = false }: { rewards: StudentRewards; compact?: boolean }) {
  const { earned, upNext } = visibleAchievements(rewards.achievements);
  const shownEarned = compact ? earned.slice(-3).reverse() : [...earned].reverse();
  const shownNext = compact ? upNext.slice(0, 1) : upNext;

  return (
    <Card id="conquistas" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-neutral-900">Suas conquistas</h2>
        {compact ? (
          <Link href="/meu-aprendizado#conquistas" className="text-sm font-medium text-brand-blue hover:underline">
            Ver todas →
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-neutral-500">Só você vê. Elas mostram o que você já fez, não medem nota nem comparam com ninguém.</p>

      {shownEarned.length === 0 ? (
        <p className="text-sm text-neutral-600">Quando você começar um desafio ou um material, a primeira conquista aparece aqui.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shownEarned.map((a) => (
            <Item key={a.id} achievement={a} />
          ))}
        </ul>
      )}

      {shownNext.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{compact ? "Próxima" : "Próximas"}</h3>
          <ul className="mt-1.5 flex flex-col gap-2.5">
            {shownNext.map((a) => (
              <Item key={a.id} achievement={a} />
            ))}
          </ul>
        </div>
      ) : null}

      <WeeklyGoalForm goal={rewards.goal} />
    </Card>
  );
}
