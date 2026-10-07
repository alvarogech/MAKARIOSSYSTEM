import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isValidBrazilianMobile } from "@/services/phone";

export interface ActiveTeacherRow {
  kind: "active";
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountStatus: "active" | "suspended";
  onboardingCompleted: boolean;
  classNames: string[];
  /** WhatsApp ausente ou sem DDD + 9 dígitos: a coordenação não consegue chamar. */
  phoneIncomplete: boolean;
}

export interface PendingInviteRow {
  kind: "pending";
  invitationId: string;
  fullName: string;
  email: string;
  phone: string | null;
  inviteStatus: "pending" | "expired" | "revoked";
  classIds: string[];
  meetingBlockIds: string[];
  classNames: string[];
  invitedAt: string;
  /** Mesmo WhatsApp de um professor já ativo: provavelmente um convite repetido (ex.: outro e-mail da mesma pessoa). */
  possibleDuplicateOf: string | null;
}

export type TeacherProvisioningRow = ActiveTeacherRow | PendingInviteRow;

export interface TeacherProvisioningData {
  rows: TeacherProvisioningRow[];
  classes: { id: string; name: string }[];
}

export async function loadTeacherProvisioningData(
  supabase: SupabaseClient<Database>,
): Promise<TeacherProvisioningData> {
  const { data: teacherRole } = await supabase
    .from("roles")
    .select("id")
    .eq("slug", "teacher")
    .single();

  const [{ data: classes }, { data: teacherRoleRows }, { data: pendingInvites }] =
    await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      teacherRole
        ? supabase.from("user_roles").select("user_id").eq("role_id", teacherRole.id)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
      supabase
        .from("invitations")
        .select("id, email, intended_full_name, phone, class_ids, meeting_block_ids, token_expires_at, revoked_at, invited_at")
        .eq("channel", "manual_link")
        .eq("purpose", "teacher_onboarding")
        .is("consumed_at", null)
        .order("invited_at", { ascending: false }),
    ]);

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const teacherIds = (teacherRoleRows ?? []).map((r) => r.user_id);

  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    teacherIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name, email, phone, status, onboarding_completed_at")
          .in("id", teacherIds)
      : Promise.resolve({ data: [] as never[] }),
    teacherIds.length
      ? supabase
          .from("teacher_assignments")
          .select("teacher_id, class_id")
          .in("teacher_id", teacherIds)
      : Promise.resolve({ data: [] as { teacher_id: string; class_id: string }[] }),
  ]);

  const classIdsByTeacher = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = classIdsByTeacher.get(a.teacher_id) ?? [];
    list.push(a.class_id);
    classIdsByTeacher.set(a.teacher_id, list);
  }

  const activeRows: ActiveTeacherRow[] = (profiles ?? []).map((p) => ({
    kind: "active",
    userId: p.id,
    fullName: p.full_name,
    email: p.email ?? "",
    phone: p.phone,
    accountStatus: p.status,
    onboardingCompleted: p.onboarding_completed_at !== null,
    classNames: (classIdsByTeacher.get(p.id) ?? [])
      .map((id) => classNameById.get(id) ?? "Turma")
      .sort(),
    phoneIncomplete: !p.phone || !isValidBrazilianMobile(p.phone),
  }));

  const digits = (value: string | null) => (value ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const activeEmails = new Set(activeRows.map((r) => r.email.trim().toLowerCase()).filter(Boolean));
  const activeByPhone = new Map(activeRows.filter((r) => digits(r.phone)).map((r) => [digits(r.phone), r.fullName]));

  const now = Date.now();
  // Convite revogado de um e-mail que já virou professor ativo é só resto: não precisa aparecer na lista.
  const visibleInvites = (pendingInvites ?? []).filter(
    (inv) => !(inv.revoked_at && activeEmails.has(inv.email.trim().toLowerCase())),
  );
  const pendingRows: PendingInviteRow[] = visibleInvites.map((inv) => {
    let inviteStatus: PendingInviteRow["inviteStatus"] = "pending";
    if (inv.revoked_at) inviteStatus = "revoked";
    else if (!inv.token_expires_at || new Date(inv.token_expires_at).getTime() < now) {
      inviteStatus = "expired";
    }
    return {
      kind: "pending",
      invitationId: inv.id,
      fullName: inv.intended_full_name ?? "Professor(a)",
      email: inv.email,
      phone: inv.phone,
      inviteStatus,
      classIds: inv.class_ids ?? [],
      meetingBlockIds: inv.meeting_block_ids ?? [],
      classNames: (inv.class_ids ?? []).map((id) => classNameById.get(id) ?? "Turma").sort(),
      invitedAt: inv.invited_at,
      possibleDuplicateOf: inviteStatus !== "revoked" && digits(inv.phone) ? (activeByPhone.get(digits(inv.phone)) ?? null) : null,
    };
  });

  activeRows.sort((a, b) => a.fullName.localeCompare(b.fullName));
  pendingRows.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    rows: [...activeRows, ...pendingRows],
    classes: (classes ?? []).map((c) => ({ id: c.id, name: c.name })),
  };
}
