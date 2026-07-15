import type { ReactNode } from "react";
import { AuthShell } from "@/components/layout/AuthShell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
