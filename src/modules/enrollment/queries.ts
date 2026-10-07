import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ENROLLMENT_GR_NETWORKS, ENROLLMENT_SCHEDULES, ENROLLMENT_VOLUMES } from "@/config/enrollment";
import {
  addSaoPauloDays,
  formatSaoPauloDayLabel,
  formatSaoPauloMonthLabel,
  getSaoPauloDateKey,
  startOfSaoPauloDay,
  startOfSaoPauloDayFromKey,
  startOfSaoPauloMonth,
  startOfSaoPauloWeek,
} from "@/lib/saoPauloDate";
import {
  ENROLLMENT_PAGE_SIZE,
  type ChartGranularity,
  type ChartPoint,
  type ChurchVinculoValue,
  type EnrollmentFilters,
  type EnrollmentRequestRow,
  type EnrollmentRequestStatus,
  type EnrollmentSortField,
  type EnrollmentStats,
  type EnrollmentStatsRow,
  type EnrollmentTurmaCapacity,
  type StudentEnrollmentForTransfer,
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
  | "viewed_at"
  | "viewed_by"
  | "created_at"
  | "updated_at"
  | "student_id"
>;

const TABLE_COLUMNS =
  "id, protocol, full_name, cpf_last4, email, phone, primary_volume_slug, primary_schedule_slug, wants_second_volume, secondary_volume_slug, secondary_schedule_slug, prerequisite_declaration, notes, is_other_church_member, other_church_name, is_emaus_member, has_gr, gr_network_slug, status, reviewed_at, reviewed_by, viewed_at, viewed_by, created_at, updated_at, student_id" as const;

const SORT_COLUMNS: Record<EnrollmentSortField, string> = {
  createdAt: "created_at",
  fullName: "full_name",
  primaryVolumeSlug: "primary_volume_slug",
  primaryScheduleSlug: "primary_schedule_slug",
  status: "status",
};

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
    viewedAt: row.viewed_at,
    viewedBy: row.viewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    studentId: row.student_id,
  };
}

/**
 * Matrículas do aluno (geralmente uma só) com as outras turmas da mesma
 * oferta de volume, pro painel de detalhes da inscrição oferecer mover de
 * turma sem precisar ir em Matrículas. Só chamada quando a inscrição já
 * tem `student_id` (ou seja, a pessoa já aceitou o convite).
 */
export async function getStudentEnrollmentsForTransfer(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<StudentEnrollmentForTransfer[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, status, class_id, season_volume_offering_id")
    .eq("student_id", studentId);
  if (!enrollments || enrollments.length === 0) return [];

  const offeringIds = [...new Set(enrollments.map((e) => e.season_volume_offering_id))];
  const [{ data: offerings }, { data: allClasses }] = await Promise.all([
    supabase.from("season_volume_offerings").select("id, season_id, volume_id").in("id", offeringIds),
    supabase.from("classes").select("id, name, season_volume_offering_id").in("season_volume_offering_id", offeringIds),
  ]);

  const volumeIds = [...new Set((offerings ?? []).map((o) => o.volume_id))];
  const seasonIds = [...new Set((offerings ?? []).map((o) => o.season_id))];
  const [{ data: volumes }, { data: seasons }] = await Promise.all([
    supabase.from("volumes").select("id, name").in("id", volumeIds),
    supabase.from("seasons").select("id, name").in("id", seasonIds),
  ]);

  const offeringsById = new Map((offerings ?? []).map((o) => [o.id, o]));
  const volumeNamesById = new Map((volumes ?? []).map((v) => [v.id, v.name]));
  const seasonNamesById = new Map((seasons ?? []).map((s) => [s.id, s.name]));
  const classesById = new Map((allClasses ?? []).map((c) => [c.id, c]));

  return enrollments.map((enrollment) => {
    const offering = offeringsById.get(enrollment.season_volume_offering_id);
    const offeringLabel = offering
      ? `${volumeNamesById.get(offering.volume_id) ?? "Volume"} — ${seasonNamesById.get(offering.season_id) ?? "Temporada"}`
      : "Oferta";
    const classesInSameOffering = (allClasses ?? [])
      .filter((c) => c.season_volume_offering_id === enrollment.season_volume_offering_id)
      .map((c) => ({ id: c.id, name: c.name }));

    return {
      enrollmentId: enrollment.id,
      status: enrollment.status,
      classId: enrollment.class_id,
      className: classesById.get(enrollment.class_id)?.name ?? "Turma",
      offeringLabel,
      classesInSameOffering,
    };
  });
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

/**
 * Intervalo de datas efetivo de um filtro: `dateFrom`/`dateTo` explícitos
 * (usados ao clicar num ponto do gráfico) têm prioridade sobre `period`.
 * `end` é exclusivo; `null` em ambos significa "sem filtro de data".
 */
export function getDateRange(
  filters: Pick<EnrollmentFilters, "period" | "dateFrom" | "dateTo">,
  now: Date,
): { start: Date | null; end: Date | null } {
  if (filters.dateFrom || filters.dateTo) {
    const fromKey = filters.dateFrom ?? filters.dateTo;
    const toKey = filters.dateTo ?? filters.dateFrom;
    const start = fromKey ? startOfSaoPauloDayFromKey(fromKey) : null;
    const end = toKey ? addSaoPauloDays(startOfSaoPauloDayFromKey(toKey), 1) : null;
    return { start, end };
  }
  return { start: getPeriodStart(filters.period, now), end: null };
}

/**
 * Único ponto de aplicação dos filtros de busca/segmentação — usado tanto
 * na página paginada quanto na exportação CSV, para nunca deixar os dois
 * caminhos divergirem silenciosamente.
 *
 * Tipado como `any` de propósito: o tipo real do query builder encadeável
 * do supabase-js (`PostgrestFilterBuilder<...>`) exige type args que mudam
 * conforme `select()`/`count` são chamados, e expressar isso genericamente
 * numa função compartilhada não vale a complexidade — as duas chamadoras
 * (`getEnrollmentRequestsPage`/`getAllFilteredEnrollmentRequests`) e os
 * testes já cobrem o comportamento real.
 */
function applyEnrollmentFilters(
  query: any,
  filters: Omit<EnrollmentFilters, "page" | "granularity" | "sort" | "dir">,
  now: Date,
): any {
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

  if (filters.schedule !== "all") {
    query = query.eq("primary_schedule_slug", filters.schedule);
  }

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.churchVinculo !== "all") {
    if (filters.churchVinculo === "nao_informado") {
      query = query.is("is_emaus_member", null);
    } else if (filters.churchVinculo === "member") {
      query = query.eq("is_emaus_member", true);
    } else {
      query = query.eq("is_emaus_member", false);
    }
  }

  if (filters.grNetwork !== "all") {
    if (filters.grNetwork === "nao_informado") {
      query = query.or("is_emaus_member.is.null,is_emaus_member.eq.false,has_gr.is.null");
    } else if (filters.grNetwork === "sem_gr") {
      query = query.eq("is_emaus_member", true).eq("has_gr", false);
    } else {
      query = query.eq("has_gr", true).eq("gr_network_slug", filters.grNetwork);
    }
  }

  if (filters.notViewed) {
    query = query.is("viewed_at", null);
  }

  const { start, end } = getDateRange(filters, now);
  if (start) query = query.gte("created_at", start.toISOString());
  if (end) query = query.lt("created_at", end.toISOString());

  return query;
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
  let query = supabase.from("enrollment_requests").select(TABLE_COLUMNS, { count: "exact" });
  query = applyEnrollmentFilters(query, filters, now);
  query = query.order(SORT_COLUMNS[filters.sort], { ascending: filters.dir === "asc" });
  if (filters.sort !== "createdAt") {
    // Critério de desempate estável quando a ordenação principal não é a data.
    query = query.order("created_at", { ascending: false });
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
  let query = supabase.from("enrollment_requests").select(TABLE_COLUMNS);
  query = applyEnrollmentFilters(query, filters, now);
  query = query.order(SORT_COLUMNS[filters.sort], { ascending: filters.dir === "asc" });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível exportar as inscrições: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

const MAX_SELECTION_IDS = 500;

/**
 * Só os ids que atendem aos filtros ativos — usado por "selecionar todos os
 * resultados do filtro" na barra de ações em lote. Nunca traz mais do que
 * `MAX_SELECTION_IDS` de uma vez, nem nunca traz colunas com PII.
 */
export async function getFilteredEnrollmentRequestIds(
  supabase: SupabaseClient<Database>,
  filters: Omit<EnrollmentFilters, "page">,
  now: Date = new Date(),
): Promise<{ ids: string[]; truncated: boolean }> {
  let query = supabase.from("enrollment_requests").select("id").limit(MAX_SELECTION_IDS + 1);
  query = applyEnrollmentFilters(query, filters, now);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Não foi possível carregar os ids filtrados: ${error.message}`);
  }

  const ids = (data ?? []).map((row: { id: string }) => row.id);
  return { ids: ids.slice(0, MAX_SELECTION_IDS), truncated: ids.length > MAX_SELECTION_IDS };
}

/**
 * Busca inscrições por um conjunto explícito de ids — usada pelas ações em
 * lote e pela exportação de selecionados, sempre revalidando contra as
 * mesmas colunas (nunca confia em ids vindos do cliente sem checar RLS).
 */
export async function getEnrollmentRequestsByIds(
  supabase: SupabaseClient<Database>,
  ids: string[],
): Promise<EnrollmentRequestRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("enrollment_requests").select(TABLE_COLUMNS).in("id", ids);

  if (error) {
    throw new Error(`Não foi possível carregar as inscrições selecionadas: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

/**
 * Colunas enxutas (sem PII) das inscrições que atendem aos filtros ativos
 * (exceto paginação/ordenação) — usadas para agregar estatísticas e o
 * gráfico. Aplicar os mesmos filtros da tabela aqui é o que garante que
 * cada segmentação ("Por curso", "Por status" etc.) sempre feche com o
 * total filtrado exibido na tela, e não com o total geral da base. Uma
 * única leitura, nunca uma contagem por card — o volume de inscrições de
 * um curso presencial é pequeno o suficiente para isso ser mais simples e
 * barato do que várias queries de `count`; se um dia crescer muito, trocar
 * por uma função agregada no Postgres sem mudar a assinatura desta função.
 */
export async function getEnrollmentStatsRows(
  supabase: SupabaseClient<Database>,
  filters: Omit<EnrollmentFilters, "page" | "granularity" | "sort" | "dir">,
  now: Date = new Date(),
): Promise<EnrollmentStatsRow[]> {
  let query = supabase
    .from("enrollment_requests")
    .select(
      "status, student_id, primary_volume_slug, primary_schedule_slug, is_other_church_member, is_emaus_member, has_gr, gr_network_slug, viewed_at, created_at",
    );
  query = applyEnrollmentFilters(query, filters, now);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível carregar as estatísticas: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    status: row.status as EnrollmentRequestStatus,
    primaryVolumeSlug: row.primary_volume_slug as EnrollmentStatsRow["primaryVolumeSlug"],
    primaryScheduleSlug: row.primary_schedule_slug as EnrollmentStatsRow["primaryScheduleSlug"],
    isOtherChurchMember: row.is_other_church_member,
    isEmausMember: row.is_emaus_member,
    hasGr: row.has_gr,
    grNetworkSlug: row.gr_network_slug as EnrollmentStatsRow["grNetworkSlug"],
    viewedAt: row.viewed_at,
    createdAt: row.created_at,
    hasAccount: row.student_id !== null,
  }));
}

const ALL_STATUSES: EnrollmentRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];

function churchVinculoOf(row: EnrollmentStatsRow): ChurchVinculoValue {
  if (row.isEmausMember === true) return "member";
  if (row.isEmausMember === false) return "other";
  return "nao_informado";
}

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
  let notViewedCount = 0;
  let approvedWithoutAccount = 0;
  const approvedByTurma: Record<string, number> = {};
  let noGrCount = 0;
  let grNetworkNotInformedCount = 0;
  const byVolumeMap = new Map<string, number>();
  const byVolumeScheduleMap = new Map<string, number>();
  const byStatusMap = new Map<string, number>();
  const byGrNetworkMap = new Map<string, number>();
  const byChurchVinculoMap = new Map<ChurchVinculoValue, number>();

  for (const row of rows) {
    const created = new Date(row.createdAt);
    if (created >= todayStart) today += 1;
    if (created >= sevenDaysAgo) last7Days += 1;
    if (created >= thirtyDaysAgo) last30Days += 1;
    if (created >= weekStart) thisWeek += 1;
    if (created >= monthStart) thisMonth += 1;
    if (!row.viewedAt) notViewedCount += 1;
    if (row.status === "approved") {
      if (!row.hasAccount) approvedWithoutAccount += 1;
      const turmaKey = `${row.primaryVolumeSlug}:${row.primaryScheduleSlug}`;
      approvedByTurma[turmaKey] = (approvedByTurma[turmaKey] ?? 0) + 1;
    }
    byVolumeMap.set(row.primaryVolumeSlug, (byVolumeMap.get(row.primaryVolumeSlug) ?? 0) + 1);
    const volumeScheduleKey = `${row.primaryVolumeSlug}:${row.primaryScheduleSlug}`;
    byVolumeScheduleMap.set(volumeScheduleKey, (byVolumeScheduleMap.get(volumeScheduleKey) ?? 0) + 1);
    byStatusMap.set(row.status, (byStatusMap.get(row.status) ?? 0) + 1);

    const vinculo = churchVinculoOf(row);
    byChurchVinculoMap.set(vinculo, (byChurchVinculoMap.get(vinculo) ?? 0) + 1);

    if (row.isEmausMember === true && row.hasGr === true && row.grNetworkSlug) {
      byGrNetworkMap.set(row.grNetworkSlug, (byGrNetworkMap.get(row.grNetworkSlug) ?? 0) + 1);
    } else if (row.isEmausMember === true && row.hasGr === false) {
      noGrCount += 1;
    } else {
      // Não é membro da Emaús, ou a pergunta nunca foi respondida: nenhuma
      // informação de rede de GR se aplica a este registro.
      grNetworkNotInformedCount += 1;
    }
  }

  return {
    total: rows.length,
    today,
    last7Days,
    last30Days,
    thisWeek,
    thisMonth,
    notViewedCount,
    approvedWithoutAccount,
    approvedByTurma,
    byVolume: ENROLLMENT_VOLUMES.map((volume) => ({
      slug: volume.slug,
      label: volume.label,
      count: byVolumeMap.get(volume.slug) ?? 0,
    })),
    byVolumeSchedule: ENROLLMENT_VOLUMES.flatMap((volume) =>
      ENROLLMENT_SCHEDULES.map((schedule) => ({
        volumeSlug: volume.slug,
        scheduleSlug: schedule.slug,
        label: `${volume.label} · ${schedule.label}`,
        count: byVolumeScheduleMap.get(`${volume.slug}:${schedule.slug}`) ?? 0,
      })),
    ),
    byStatus: ALL_STATUSES.map((status) => ({ status, count: byStatusMap.get(status) ?? 0 })),
    byChurchVinculo: (["member", "other", "nao_informado"] as ChurchVinculoValue[]).map((value) => ({
      value,
      label:
        value === "member" ? "Membro da Emaús" : value === "other" ? "Outro vínculo" : "Não informado",
      count: byChurchVinculoMap.get(value) ?? 0,
    })),
    byGrNetwork: ENROLLMENT_GR_NETWORKS.map((network) => ({
      slug: network.slug,
      label: network.label,
      count: byGrNetworkMap.get(network.slug) ?? 0,
    })),
    noGrCount,
    grNetworkNotInformedCount,
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
        rangeStart: dayStart.toISOString(),
        rangeEnd: dayEnd.toISOString(),
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
        rangeStart: weekStart.toISOString(),
        rangeEnd: weekEnd.toISOString(),
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
      rangeStart: monthStart.toISOString(),
      rangeEnd: monthEnd.toISOString(),
    });
  }
  return points;
}

/**
 * Temporada aberta atual — mesma checagem usada no envio do formulário
 * público. `null` quando não há nenhuma temporada com inscrições abertas.
 */
export async function getOpenSeasonId(supabase: SupabaseClient<Database>): Promise<string | null> {
  const { data } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Capacidade configurada por curso+turma para uma temporada — ausência de
 * linha significa "não configurada", nunca inventamos um número.
 */
export async function getEnrollmentTurmaCapacities(
  supabase: SupabaseClient<Database>,
  seasonId: string,
): Promise<EnrollmentTurmaCapacity[]> {
  const { data, error } = await supabase
    .from("enrollment_turma_capacity")
    .select("id, volume_slug, schedule_slug, capacity")
    .eq("season_id", seasonId);

  if (error) {
    throw new Error(`Não foi possível carregar a capacidade das turmas: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    volumeSlug: row.volume_slug as EnrollmentTurmaCapacity["volumeSlug"],
    scheduleSlug: row.schedule_slug as EnrollmentTurmaCapacity["scheduleSlug"],
    capacity: row.capacity,
  }));
}
