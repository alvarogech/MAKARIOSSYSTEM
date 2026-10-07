import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

/** O único "próximo passo" da home do aluno: uma frase, um botão. */
export function NextStepCard({ title, detail, href, cta }: { title: string; detail?: string | null; href: string | null; cta?: string }) {
  return (
    <Card className="border-brand-blue/30 bg-brand-blue-light">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Seu próximo passo</p>
      <p className="mt-1.5 text-base font-semibold text-neutral-900">{title}</p>
      {detail ? <p className="mt-0.5 text-sm text-neutral-600">{detail}</p> : null}
      {href ? (
        <Link href={href} className={`${buttonVariants({ variant: "primary", size: "sm" })} mt-3 inline-flex items-center gap-1.5`}>
          {cta ?? "Continuar"} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </Card>
  );
}
