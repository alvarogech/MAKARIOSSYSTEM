import type { Metadata } from "next";
import Image from "next/image";
import { Clock3, GraduationCap, MapPin, ShieldCheck } from "lucide-react";
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
          <span className="hidden rounded-full border border-brand-cream/30 px-4 py-2 text-xs font-medium text-brand-cream sm:inline-flex">
            Inscrições presenciais
          </span>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue">Escola Makários</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-neutral-900 sm:text-5xl">
              Um caminho de formação para viver aquilo que Deus está construindo em você.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600 sm:text-lg">
              Preencha sua solicitação para os volumes Essência, Caminho ou Voz. Nossa equipe analisará as informações e entrará em contato para orientar os próximos passos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={<GraduationCap />} title="Três volumes" text="Essência → Caminho → Voz" />
            <InfoCard icon={<Clock3 />} title="16 horas presenciais" text="Por volume cursado" />
            <InfoCard icon={<MapPin />} title={ENROLLMENT_LOCATION.name} text={ENROLLMENT_LOCATION.address} />
            <InfoCard icon={<ShieldCheck />} title="Análise da coordenação" text="A solicitação não garante a vaga" />
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
            <Card>
              <h2 className="text-xl font-semibold text-neutral-900">Dias e horários</h2>
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
              <h2 className="text-lg font-semibold text-neutral-900">Local das aulas</h2>
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
              <strong className="text-neutral-800">Pré-requisitos:</strong> Essência antecede Caminho, e Caminho antecede Voz. Exceções e solicitações simultâneas são analisadas individualmente.
            </div>
          </aside>

          <Card className="p-5 sm:p-8">
            <div className="mb-7">
              <p className="text-sm font-semibold text-brand-blue">Solicitação de inscrição</p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-900">Conte-nos como você deseja participar</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">Leva aproximadamente 3 minutos.</p>
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

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 p-4">
      <span className="text-brand-blue [&>svg]:size-5" aria-hidden="true">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{text}</p>
    </div>
  );
}

