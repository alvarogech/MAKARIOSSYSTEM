import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ENROLLMENT_VOLUMES } from "@/config/enrollment";
import {
  addSaoPauloDays,
  formatSaoPauloDayLabel,
  formatSaoPauloMonthLabel,
  getSaoPauloDateKey,
  startOfSaoPauloDay,
  startOfSaoPauloMonth,
  startOfSaoPauloWeek,
} from "@/lib/saoPauloDate";
import {
  ENROLLMENT_PAGE_SIZE,
  type ChartGranularity,
  type ChartPoint,
  type EnrollmentFilters,
  type EnrollmentRequestRow,
  type EnrollmentRequestStatus,
  type EnrollmentStats,
  type EnrollmentStatsRow,
} from "./types";

type EnrollmentRequestNarrowRow = Pick<
  Database["public"]["Tables"]["enrollment_requests"]["Row"],
  | "id"
  | "protocol"
  | "full_name"
  | "cpf_last4"
  | "email"
  | "phone"
  | "primary_volume_slug"
  | "primary_schedule_slug"
  | "wants_second_volume"
  | "secondary_volume_slug"
  | "secondary_schedule_slug"
  | "prerequisite_declaration"
  | "notes"
  | "is_other_church_member"
  | "other_church_name"
  | "is_emaus_member"
  | "has_gr"
  | "gr_network_slug"
  | "status"
  | "reviewed_at"
  | "reviewed_by"
  | "created_at"
  | "updated_at"
>;

const TABLE_COLUMNS =
  "id, protocol, full_name, cpf_last4, email, phone, primary_volume_slug, primary_schedule_slug, wants_second_volume, secondary_volume_slug, secondary_schedule_slug, prerequisite_declaration, notes, is_other_church_member, other_church_name, is_emaus_member, has_gr, gr_network_slug, status, reviewed_at, reviewed_by, created_at, updated_at" as const;

function mapRow(row: EnrollmentRequestNarrowRow): EnrollmentRequestRow {
  return {
    id: row.id,
    protocol: row.protocol,
    fullName: row.full_name,
    cpfLast4: row.cpf_last4,
    email: row.email,
    phone: row.phone,
    primaryVolumeSlug: row.primary_volume_slug as EnrollmentRequestRow["primaryVolumeSlug"],
    primaryScheduleSlug: row.primary_schedule_slug as EnrollmentRequestRow["primaryScheduleSlug"],
    wantsSecondVolume: row.wants_second_volume,
    secondaryVolumeSlug: row.secondary_volume_slug as EnrollmentRequestRow["secondaryVolumeSlug"],
    secondaryScheduleSlug: row.secondary_schedule_slug as EnrollmentRequestRow["secondaryScheduleSlug"],
    prerequisiteDeclaration: row.prerequisite_declaration,
    notes: row.notes,
    isOtherChurchMember: row.is_other_church_member,
    otherChurchName: row.other_church_name,
    isEmausMember: row.is_emaus_member,
    hasGr: row.has_gr,
    grNetworkSlug: row.gr_network_slug as EnrollmentRequestRow["grNetworkSlug"],
    status: row.status as EnrollmentRequestStatus,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Início do período em São Paulo — `null` significa "sem filtro de data". */
export function getPeriodStart(period: EnrollmentFilters["period"], now: Date): Date | null {
  switch (period) {
    case "today":
      return startOfSaoPauloDay(now);
    case "7d":
      return addSaoPauloDays(startOfSaoPauloDay(now), -6);
    case "30d":
      return addSaoPauloDays(startOfSaoPauloDay(now), -29);
    case "week":
      return startOfSaoPauloWeek(now);
    case "month":
      return startOfSaoPauloMonth(now);
    case "all":
    default:
      return null;
  }
}

export interface EnrollmentRequestsPage {
  rows: EnrollmentRequestRow[];
  totalCount: number;
}

/**
 * Busca uma única inscrição por id — usada pelo painel de detalhes quando
 * a linha não está na página atual da tabela (ex.: link direto, ou a
 * pessoa mudou de página/filtro depois de abrir o link).
 */
export async function getEnrollmentRequestById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<EnrollmentRequestRow | null> {
  const { data, error } = await supabase
    .from("enrollment_requests")
    .select(TABLE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/**
 * Busca uma página filtrada/ordenada de inscrições. Paginação e contagem
 * acontecem no Postgres (`range` + `count: "exact"`) — nunca traz a tabela
 * inteira para paginar em memória.
 */
export async function getEnrollmentRequestsPage(
  supabase: SupabaseClient<Database>,
  filters: EnrollmentFilters,
  now: Date = new Date(),
): Promise<EnrollmentRequestsPage> {
  let query = supabase
    .from("enrollment_requests")
    .select(TABLE_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  const rawTerm = filters.q.trim();
  if (rawTerm) {
    const escaped = rawTerm.replace(/[%_,()]/g, "");
    const digitsOnly = rawTerm.replace(/\D/g, "");
    const orParts = [`full_name.ilike.%${escaped}%`, `email.ilike.%${escaped}%`];
    if (digitsOnly) orParts.push(`phone.ilike.%${digitsOnly}%`);
    query = query.or(orParts.join(","));
  }

  if (filters.volume !== "all") {
    query = query.eq("primary_volume_slug", filters.volume);
  }

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const periodStart = getPeriodStart(filters.period, now);
  if (periodStart) {
    query = query.gte("created_at", periodStart.toISOString());
  }

  const from = (filters.page - 1) * ENROLLMENT_PAGE_SIZE;
  const to = from + ENROLLMENT_PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Não foi possível carregar as inscrições: ${error.message}`);
  }

  return { rows: (data ?? []).map(mapRow), totalCount: count ?? 0 };
}

/**
 * Busca todas as inscrições que atendem aos filtros, sem paginar — usado
 * pela exportação CSV, que precisa do conjunto filtrado completo, não só
 * da página visível. Traz apenas as colunas exibidas (nunca CPF cifrado).
 */
export async function getAllFilteredEnrollmentRequests(
  supabase: SupabaseClient<Database>,
  filters: Omit<EnrollmentFilters, "page">,
  now: Date = new Date(),
): Promise<EnrollmentRequestRow[]> {
  let query = supabase
    .from("enrollment_requests")
    .select(TABLE_COLUMNS)
    .order("created_at", { ascending: false });

  const rawTerm = filters.q.trim();
  if (rawTerm) {
    const escaped = rawTerm.replace(/[%_,()]/g, "");
    const digitsOnly = rawTerm.replace(/\D/g, "");
    const orParts = [`full_name.ilike.%${escaped}%`, `email.ilike.%${escaped}%`];
    if (digitsOnly) orParts.push(`phone.ilike.%${digitsOnly}%`);
    query = query.or(orParts.join(","));
  }

  if (filters.volume !== "all") {
    query = query.eq("primary_volume_slug", filters.volume);
  }

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const periodStart = getPeriodStart(filters.period, now);
  if (periodStart) {
    query = query.gte("created_at", periodStart.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível exportar as inscrições: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

/**
 * Colunas enxutas (sem PII) de todas as inscrições, usadas só para agregar
 * estatísticas e o gráfico — uma única leitura, nunca uma contagem por
 * card. O volume de inscrições de um curso presencial é pequeno o
 * suficiente para isso ser mais simples e barato do que várias queries de
 * `count` — se um dia crescer muito, trocar por uma função agregada no
 * Postgres sem mudar a assinatura desta função.
 */
export async function getEnrollmentStatsRows(
  supabase: SupabaseClient<Database>,
): Promise<EnrollmentStatsRow[]> {
  const { data, error } = await supabase
    .from("enrollment_requests")
    .select("status, primary_volume_slug, primary_schedule_slug, created_at");

  if (error) {
    throw new Error(`Não foi possível carregar as estatísticas: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    status: row.status as EnrollmentRequestStatus,
    primaryVolumeSlug: row.primary_volume_slug as EnrollmentStatsRow["primaryVolumeSlug"],
    primaryScheduleSlug: row.primary_schedule_slug as EnrollmentStatsRow["primaryScheduleSlug"],
    createdAt: row.created_at,
  }));
}

const ALL_STATUSES: EnrollmentRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];

export function computeEnrollmentStats(rows: EnrollmentStatsRow[], now: Date): EnrollmentStats {
  const todayStart = startOfSaoPauloDay(now);
  const weekStart = startOfSaoPauloWeek(now);
  const monthStart = startOfSaoPauloMonth(now);
  const sevenDaysAgo = addSaoPauloDays(todayStart, -6);
  const thirtyDaysAgo = addSaoPauloDays(todayStart, -29);

  let today = 0;
  let last7Days = 0;
  let last30Days = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  const byVolumeMap = new Map<string, number>();
  const byStatusMap = new Map<string, number>();

  for (const row of rows) {
    const created = new Date(row.createdAt);
    if (created >= todayStart) today += 1;
    if (created >= sevenDaysAgo) last7Days += 1;
    if (created >= thirtyDaysAgo) last30Days += 1;
    if (created >= weekStart) thisWeek += 1;
    if (created >= monthStart) thisMonth += 1;
    byVolumeMap.set(row.primaryVolumeSlug, (byVolumeMap.get(row.primaryVolumeSlug) ?? 0) + 1);
    byStatusMap.set(row.status, (byStatusMap.get(row.status) ?? 0) + 1);
  }

  return {
    total: rows.length,
    today,
    last7Days,
    last30Days,
    thisWeek,
    thisMonth,
    byVolume: ENROLLMENT_VOLUMES.map((volume) => ({
      slug: volume.slug,
      label: volume.label,
      count: byVolumeMap.get(volume.slug) ?? 0,
    })),
    byStatus: ALL_STATUSES.map((status) => ({ status, count: byStatusMap.get(status) ?? 0 })),
  };
}

function monthStartAt(now: Date, monthsBack: number): Date {
  const [yearStr, monthStr] = getSaoPauloDateKey(now).split("-");
  let year = Number(yearStr);
  let month = Number(monthStr) - monthsBack;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  return startOfSaoPauloMonth(new Date(Date.UTC(year, month - 1, 15, 12)));
}

export function buildChartPoints(
  rows: EnrollmentStatsRow[],
  granularity: ChartGranularity,
  now: Date,
): ChartPoint[] {
  if (granularity === "day") {
    const totalDays = 14;
    const points: ChartPoint[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const dayStart = addSaoPauloDays(startOfSaoPauloDay(now), -i);
      const dayEnd = addSaoPauloDays(dayStart, 1);
      const count = rows.filter((row) => {
        const created = new Date(row.createdAt);
        return created >= dayStart && created < dayEnd;
      }).length;
      points.push({
        key: getSaoPauloDateKey(dayStart),
        label: formatSaoPauloDayLabel(dayStart),
        count,
      });
    }
    return points;
  }

  if (granularity === "week") {
    const totalWeeks = 10;
    const currentWeekStart = startOfSaoPauloWeek(now);
    const points: ChartPoint[] = [];
    for (let i = totalWeeks - 1; i >= 0; i--) {
      const weekStart = addSaoPauloDays(currentWeekStart, -7 * i);
      const weekEnd = addSaoPauloDays(weekStart, 7);
      const count = rows.filter((row) => {
        const created = new Date(row.createdAt);
        return created >= weekStart && created < weekEnd;
      }).length;
      points.push({
        key: getSaoPauloDateKey(weekStart),
        label: formatSaoPauloDayLabel(weekStart),
        count,
      });
    }
    return points;
  }

  const totalMonths = 6;
  const points: ChartPoint[] = [];
  for (let i = totalMonths - 1; i >= 0; i--) {
    const monthStart = monthStartAt(now, i);
    const monthEnd = monthStartAt(now, i - 1);
    const count = rows.filter((row) => {
      const created = new Date(row.createdAt);
      return created >= monthStart && created < monthEnd;
    }).length;
    points.push({
      key: getSaoPauloDateKey(monthStart),
      label: formatSaoPauloMonthLabel(monthStart),
      count,
    });
  }
  return points;
}
