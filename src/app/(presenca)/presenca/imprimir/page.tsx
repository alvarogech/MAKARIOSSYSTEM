import type { Metadata } from "next";
import QRCode from "qrcode";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { PrintButton } from "@/modules/attendance/components/AttendanceForms";

export const metadata: Metadata = { title: "QR Codes de presença", robots: { index: false } };

function br(dateKey: string) {
  return dateKey.split("-").reverse().join("/");
}

export default async function ImprimirQrPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }
  const { semana } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: codes } = await supabase
    .from("attendance_qr_codes")
    .select("token, week_start, volumes(name)")
    .eq("week_start", semana ?? "")
    .order("created_at");

  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const sunday = new Date(`${semana}T12:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const cards = await Promise.all(
    (codes ?? []).map(async (c) => ({
      name: c.volumes?.name ?? "",
      svg: await QRCode.toString(`${base}/presenca/${c.token}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
    })),
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">Uma folha por volume. Cole na porta da sala.</p>
        <PrintButton />
      </div>
      {cards.length === 0 ? <p className="text-neutral-500">Nenhum QR Code gerado para esta semana.</p> : null}
      {cards.map((card) => (
        <section
          key={card.name}
          className="flex min-h-[90vh] break-after-page flex-col items-center justify-center gap-6 text-center"
        >
          <h1 className="text-4xl font-semibold text-neutral-900">{card.name}</h1>
          <p className="text-xl text-neutral-700">Escaneie para marcar presença</p>
          <div className="w-[70vw] max-w-[420px]" dangerouslySetInnerHTML={{ __html: card.svg }} />
          <p className="text-lg text-neutral-700">Na entrada e na volta do intervalo</p>
          <p className="text-sm text-neutral-500">
            Válido de {br(semana ?? "")} a {br(sunday.toISOString().slice(0, 10))}
          </p>
        </section>
      ))}
    </main>
  );
}
