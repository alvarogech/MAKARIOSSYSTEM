import type { Metadata } from "next";
import Image from "next/image";
import { Clock3, GraduationCap, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ENROLLMENT_LOCATION, ENROLLMENT_SCHEDULES } from "@/config/enrollment";
import { EnrollmentRequestForm } from "@/modules/enrollment/components/EnrollmentRequestForm";

export const metadata: Metadata = {
  title: "Inscrição",
  description: "Solicite sua inscrição na Escola Makários — Igreja Emaús.",
};

export default function EnrollmentPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-brand-blue px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <Image
            src="/brand/logo-makarios-oficial.png"
            alt="Escola Makários — Igreja Emaús"
            width={190}
            height={62}
            priority
          />
          <span className="hidden rounded-full border border-brand-cream/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-cream sm:inline-flex">
            Inscrições abertas
          </span>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-blue">
              Escola Makários · Igreja Emaús
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-6xl">
              Um caminho para amadurecer sua fé e servir com propósito.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600 sm:text-lg">
              Inscreva-se na trilha Essência, Caminho e Voz. Preencha seus dados abaixo — se
              precisarmos de mais alguma informação, nossa equipe entra em contato.
            </p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-neutral-200 border-y border-neutral-200 py-6 sm:py-8">
            <Stat icon={<GraduationCap />} value="3" label="Volumes" />
            <Stat icon={<Clock3 />} value="16h" label="Por volume" />
            <Stat icon={<MapPin />} value="Setor Bueno" label="Presencial" />
          </dl>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Agenda</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">Dias e horários</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                As aulas acontecem presencialmente na {ENROLLMENT_LOCATION.name}.
              </p>
              <div className="mt-5 flex flex-col gap-4">
                {ENROLLMENT_SCHEDULES.map((schedule) => (
                  <div key={schedule.slug} className="rounded-[var(--radius-md)] bg-brand-blue-light p-4">
                    <p className="font-semibold text-brand-blue-dark">{schedule.label}</p>
                    <p className="mt-1 text-sm text-neutral-700">{schedule.time}</p>
                    <p className="mt-1 text-xs text-neutral-500">{schedule.summary}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Endereço</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">Local das aulas</h2>
              <p className="mt-3 text-sm font-medium text-neutral-800">{ENROLLMENT_LOCATION.name}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600">{ENROLLMENT_LOCATION.address}</p>
              <a
                href={ENROLLMENT_LOCATION.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-sm font-semibold text-brand-blue hover:text-brand-blue-dark hover:underline"
              >
                Ver local no Google Maps
              </a>
            </Card>

            <div className="rounded-[var(--radius-md)] border border-neutral-200 px-5 py-4 text-sm leading-6 text-neutral-600">
              <strong className="text-neutral-800">Pré-requisitos:</strong> Essência antecede Caminho,
              e Caminho antecede Voz. Já cursou algum volume antes, ou quer cursar dois ao mesmo
              tempo? Dá pra sinalizar isso no formulário.
            </div>
          </aside>

          <Card className="p-6 sm:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Sua inscrição</p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-900 sm:text-3xl">
                Vamos começar sua jornada
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">Leva cerca de 3 minutos.</p>
            </div>
            <EnrollmentRequestForm />
          </Card>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-5 py-8 text-center text-xs text-neutral-500">
        Escola Makários · Igreja Emaús · Goiânia, Goiás
      </footer>
    </main>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2 text-center sm:items-start sm:px-6 sm:text-left">
      <span className="text-brand-blue [&>svg]:size-5" aria-hidden="true">{icon}</span>
      <p className="text-2xl font-semibold text-neutral-900 sm:text-3xl">{value}</p>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">{label}</p>
    </div>
  );
}

