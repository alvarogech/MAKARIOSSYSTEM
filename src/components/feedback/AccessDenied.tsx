import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";

export function AccessDenied({
  title = "Acesso não permitido",
  description = "Seu perfil ativo não tem permissão para ver esta página.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldAlert className="size-12 text-brand-blue" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      <p className="max-w-sm text-sm text-neutral-500">{description}</p>
      <div className="flex gap-3">
        <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
          Voltar ao início
        </Link>
        <Link href="/selecionar-perfil" className={buttonVariants({ variant: "ghost" })}>
          Trocar de perfil
        </Link>
      </div>
    </div>
  );
}
