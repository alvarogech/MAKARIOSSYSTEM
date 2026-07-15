import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Página não encontrada
      </h1>
      <p className="max-w-sm text-sm text-neutral-500">
        O endereço acessado não existe ou foi movido.
      </p>
      <Link href="/dashboard" className={buttonVariants({ variant: "primary" })}>
        Voltar ao início
      </Link>
    </div>
  );
}
