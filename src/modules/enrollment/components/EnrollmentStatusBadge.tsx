import { ENROLLMENT_STATUS_LABELS, type EnrollmentRequestStatus } from "../types";

const STATUS_STYLES: Record<EnrollmentRequestStatus, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-danger/30 bg-danger/10 text-danger",
  cancelled: "border-neutral-200 bg-neutral-100 text-neutral-500",
};

export function EnrollmentStatusBadge({ status }: { status: EnrollmentRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {ENROLLMENT_STATUS_LABELS[status]}
    </span>
  );
}
