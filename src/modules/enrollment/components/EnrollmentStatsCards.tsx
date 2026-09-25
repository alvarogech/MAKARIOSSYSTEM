import type { EnrollmentStats } from "../types";
import { EnrollmentStatusBadge } from "./EnrollmentStatusBadge";

/**
 * Cards de indicadores — Server Component. Os números vêm de
 * `computeEnrollmentStats`, calculado sobre TODAS as inscrições que
 * atendem a nenhum filtro de tabela (nunca só a página visível).
 */
export function EnrollmentStatsCards({ stats }: { stats: EnrollmentStats }) {
  const cards: { label: string; value: number }[] = [
    { label: "Total de inscritos", value: stats.total },
    { label: "Hoje", value: stats.today },
    { label: "Esta semana", value: stats.thisWeek },
    { label: "Este mês", value: stats.thisMonth },
    { label: "Últimos 7 dias", value: stats.last7Days },
    { label: "Últimos 30 dias", value: stats.last30Days },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <p className="text-2xl font-semibold text-neutral-900">{card.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por curso</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.byVolume.map((volume) => (
              <li key={volume.slug} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{volume.label}</span>
                <span className="font-semibold text-neutral-900">{volume.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por turma</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.byVolumeSchedule.map((entry) => (
              <li
                key={`${entry.volumeSlug}:${entry.scheduleSlug}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-neutral-600">{entry.label}</span>
                <span className="font-semibold text-neutral-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por status</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.byStatus.map((entry) => (
              <li key={entry.status} className="flex items-center justify-between text-sm">
                <EnrollmentStatusBadge status={entry.status} />
                <span className="font-semibold text-neutral-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Vínculo com a igreja</h3>
          <ul className="mt-3 flex flex-col gap-2">
            <li className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">De outra igreja</span>
              <span className="font-semibold text-neutral-900">{stats.otherChurchMemberCount}</span>
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Membro da Emaús</span>
              <span className="font-semibold text-neutral-900">{stats.emausMemberCount}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Por rede de GR</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.byGrNetwork.map((network) => (
              <li key={network.slug} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{network.label}</span>
                <span className="font-semibold text-neutral-900">{network.count}</span>
              </li>
            ))}
            <li className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Sem GR</span>
              <span className="font-semibold text-neutral-900">{stats.noGrCount}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
