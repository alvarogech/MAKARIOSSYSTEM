import type { Metadata } from "next";
import Image from "next/image";
import { ENROLLMENT_LOCATION, ENROLLMENT_SCHEDULES } from "@/config/enrollment";
import { EnrollmentRequestForm } from "@/modules/enrollment/components/EnrollmentRequestForm";

export const metadata: Metadata = {
  title: "Inscrição",
  description: "Solicite sua inscrição na Escola Makários, da Igreja Emaús.",
};

export default function EnrollmentPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-brand-blue px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <Image
            src="/brand/logo-makarios-oficial.png"
            alt="Escola Makários, Igreja Emaús"
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
              Fé fundamentada na Palavra, vivida no Espírito.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600 sm:text-lg">
              Três volumes presenciais para fundamentar sua fé, formar seu caráter e preparar
              você para servir a igreja e a cidade. Comece sua inscrição abaixo; qualquer
              dúvida, alguém da nossa equipe fala com você.
            </p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-neutral-200 border-y border-neutral-200 py-6 sm:py-8">
            <Stat value="3" label="Volumes" />
            <Stat value="16h" label="Por volume" />
            <Stat value="Setor Bueno" label="Presencial" />
          </dl>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <aside className="flex flex-col gap-8 lg:sticky lg:top-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Agenda</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">Dias e horários</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                As aulas acontecem presencialmente na {ENROLLMENT_LOCATION.name}.
              </p>
              <div className="mt-5 flex flex-col gap-4">
                {ENROLLMENT_SCHEDULES.map((schedule) => (
                  <div key={schedule.slug} className="rounded-[var(--radius-sm)] bg-brand-blue-light p-4">
                    <p className="font-semibold text-brand-blue-dark">{schedule.label}</p>
                    <p className="mt-1 text-sm text-neutral-700">{schedule.time}</p>
                    <p className="mt-1 text-xs text-neutral-500">{schedule.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-8">
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
            </div>

            <p className="border-t border-neutral-200 pt-6 text-sm leading-6 text-neutral-600">
              <strong className="text-neutral-800">Pré-requisitos:</strong> Essência antecede
              Caminho, e Caminho antecede Voz. Já cursou algum volume antes, ou quer cursar dois
              ao mesmo tempo? Dá pra sinalizar isso no formulário.
            </p>
          </aside>

          <div className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white p-6 sm:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Sua inscrição</p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-900 sm:text-3xl">
                Preencha seus dados para se inscrever
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Leva poucos minutos, e sua vaga já fica garantida.
              </p>
            </div>
            <EnrollmentRequestForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-5 py-8 text-center text-xs text-neutral-500">
        Escola Makários · Igreja Emaús · Goiânia, Goiás
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-2 text-center sm:px-6 sm:text-left">
      <p className="text-2xl font-semibold text-neutral-900 sm:text-3xl">{value}</p>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">{label}</p>
    </div>
  );
}
