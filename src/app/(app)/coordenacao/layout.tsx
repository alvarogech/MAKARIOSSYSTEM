import type { ReactNode } from "react";
import { SectionTabs } from "@/components/layout/SectionTabs";

export default function CoordenacaoLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <SectionTabs />
      {children}
    </div>
  );
}
