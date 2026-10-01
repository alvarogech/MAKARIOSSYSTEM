import type { PendingInviteRow, TeacherProvisioningRow } from "../teacherProvisioningList";
import { RevokeInvitationButton } from "./RevokeInvitationButton";
import { RegenerateInvitationButton } from "./RegenerateInvitationButton";
import { GenerateAssistedResetButton } from "./GenerateAssistedResetButton";
import { EditPendingInvitationClassesForm } from "./EditPendingInvitationClassesForm";

const INVITE_STATUS_LABEL: Record<PendingInviteRow["inviteStatus"], string> = {
  pending: "Convite pendente",
  expired: "Convite expirado",
  revoked: "Convite revogado",
};

const INVITE_STATUS_CLASS: Record<PendingInviteRow["inviteStatus"], string> = {
  pending: "bg-brand-blue-light text-brand-blue-dark",
  expired: "bg-amber-50 text-amber-800",
  revoked: "bg-neutral-100 text-neutral-500",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  );
}

export function TeacherProvisioningTable({
  rows,
  classes,
}: {
  rows: TeacherProvisioningRow[];
  classes: { id: string; name: string }[];
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-neutral-400">Nenhum professor cadastrado ainda.</p>;
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {rows.map((row) => (
        <li key={row.kind === "active" ? row.userId : row.invitationId} className="py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-neutral-900">{row.fullName}</p>
              <p className="text-sm text-neutral-500">
                {row.email}
                {row.phone ? ` · ${row.phone}` : ""}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Turmas:{" "}
                {row.classNames.length > 0 ? row.classNames.join(", ") : "nenhuma (vínculo pendente)"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {row.kind === "active" ? (
                <>
                  <Badge
                    label={row.accountStatus === "suspended" ? "Conta suspensa" : "Ativo"}
                    className={
                      row.accountStatus === "suspended"
                        ? "bg-danger/10 text-danger"
                        : "bg-success/10 text-success"
                    }
                  />
                  <Badge
                    label={row.onboardingCompleted ? "Cadastro concluído" : "Cadastro pendente"}
                    className={
                      row.onboardingCompleted
                        ? "bg-success/10 text-success"
                        : "bg-amber-50 text-amber-800"
                    }
                  />
                </>
              ) : (
                <Badge
                  label={INVITE_STATUS_LABEL[row.inviteStatus]}
                  className={INVITE_STATUS_CLASS[row.inviteStatus]}
                />
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-start gap-3">
            {row.kind === "active" ? (
              <GenerateAssistedResetButton userId={row.userId} />
            ) : (
              <>
                {row.inviteStatus === "pending" ? (
                  <>
                    <EditPendingInvitationClassesForm
                      invitationId={row.invitationId}
                      classes={classes}
                      currentClassIds={row.classIds}
                    />
                    <RevokeInvitationButton invitationId={row.invitationId} />
                  </>
                ) : null}
                <RegenerateInvitationButton invitationId={row.invitationId} />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
