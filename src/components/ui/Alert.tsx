import type { HTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

const VARIANT_STYLES = {
  info: "border-brand-blue/30 bg-brand-blue-light text-brand-blue-dark",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
} as const;

const VARIANT_ICONS = {
  info: Info,
  success: CheckCircle2,
  danger: AlertTriangle,
} as const;

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof VARIANT_STYLES;
}

export function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  const Icon = VARIANT_ICONS[variant];

  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-sm)] border p-3.5 text-sm",
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
