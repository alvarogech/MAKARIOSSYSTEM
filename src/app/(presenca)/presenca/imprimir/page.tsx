import type { Metadata } from "next";
import QRCode from "qrcode";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { PrintButton } from "@/modules/attendance/components/AttendanceForms";

export const metadata: Metadata = {
  title: "QR Codes de presença",
  robots: { index: false },
};

// Uma folha A4 por volume, na identidade da Makarios (creme, azul da marca,
// moldura de linha fina, lema "filhos bem-aventurados").
const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #f7f6f1 !important; }
  .folha { box-shadow: none !important; margin: 0 !important; }
}
.folha { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

const STEPS = [
  "Abra a câmera do celular",
  "Aponte para o QR Code",
  "Permita a localização e confirme",
];

export default async function ImprimirQrPage() {
  const auth = await getAuthContext();
  if (!auth || !canAccessArea(auth, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data: codes } = await supabase
    .from("attendance_qr_codes")
    .select("token, volumes(name)")
    .order("created_at");

  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const cards = await Promise.all(
    (codes ?? []).map(async (c) => ({
      name: c.volumes?.name ?? "",
      svg: await QRCode.toString(`${base}/presenca/${c.token}`, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#1b4f7a", light: "#ffffff" },
      }),
    })),
  );

  return (
    <main className="flex flex-col items-center gap-8 bg-neutral-200 py-8 print:gap-0 print:bg-transparent print:py-0">
      <style>{PRINT_CSS}</style>
      <div className="flex w-[210mm] items-center justify-between print:hidden">
        <p className="text-sm text-neutral-600">
          Primeiro as 3 folhas A4, uma por volume. Depois, 3 folhas com 4 cartões pequenos (1/4 de A4) do mesmo volume, para
          recortar. No diálogo de impressão, escolha as páginas que quiser e marque &quot;Gráficos de fundo&quot; para sair o
          fundo creme.
        </p>
        <PrintButton />
      </div>
      {cards.length === 0 ? (
        <p className="text-neutral-500">Nenhum QR Code gerado ainda.</p>
      ) : null}

      {cards.map((card) => (
            <section
              key={card.name}
              className="folha relative flex h-[297mm] w-[210mm] flex-col items-center overflow-hidden bg-brand-cream shadow-xl break-after-page"
            >
              {/* moldura de linha fina */}
              <div className="pointer-events-none absolute inset-[12mm] border border-brand-blue" />

              {/* "makarios" vazado ao fundo */}
              <p
                aria-hidden
                className="pointer-events-none absolute bottom-[34mm] select-none text-[64mm] font-semibold leading-none tracking-tight text-transparent"
                style={{ WebkitTextStroke: "0.35mm #2e7fbf", opacity: 0.18 }}
              >
                makarios
              </p>

              <div className="relative flex h-full w-full flex-col items-center px-[24mm] pt-[24mm] pb-[22mm] text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/logo-makarios-oficial-azul.png"
                  alt="Makarios"
                  className="h-[16mm] w-auto"
                />

                <p className="mt-[10mm] text-[11pt] font-medium tracking-[0.35em] text-brand-blue uppercase">
                  Chamada · Escola Makarios
                </p>
                <h1 className="mt-[3mm] text-[46pt] leading-tight font-semibold text-brand-blue-dark">
                  {card.name}
                </h1>

                <div className="mt-[8mm] rounded-[6mm] border border-brand-blue bg-white p-[7mm]">
                  <div
                    className="h-[100mm] w-[100mm]"
                    dangerouslySetInnerHTML={{ __html: card.svg }}
                  />
                </div>

                <p className="mt-[9mm] text-[17pt] font-semibold text-brand-blue-dark">
                  Escaneie para marcar presença
                </p>
                <p className="mt-[2mm] text-[12pt] text-neutral-700">
                  Na chegada e de novo na volta do intervalo
                </p>

                <ol className="mt-[8mm] grid w-full grid-cols-3 gap-[5mm]">
                  {STEPS.map((step, i) => (
                    <li
                      key={step}
                      className="flex flex-col items-center gap-[2mm] text-[10pt] leading-snug text-neutral-700"
                    >
                      <span className="flex h-[9mm] w-[9mm] items-center justify-center rounded-full bg-brand-blue text-[12pt] font-semibold text-white">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>

                <div className="mt-auto flex flex-col items-center gap-[1mm]">
                  <p className="text-[15pt] font-semibold text-brand-blue">
                    filhos bem-aventurados
                  </p>
                  <p className="text-[9pt] tracking-[0.25em] text-neutral-500 uppercase">
                    Igreja Emaús
                  </p>
                </div>
              </div>
            </section>
          ))}
      {cards.map((card) => (
            <section
              key={`pequeno-${card.name}`}
              className="folha grid h-[297mm] w-[210mm] grid-cols-2 grid-rows-2 bg-white shadow-xl break-after-page"
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="relative border border-dashed border-neutral-300 bg-brand-cream"
                >
                  <div className="pointer-events-none absolute inset-[5mm] border border-brand-blue" />
                  <div className="relative flex h-full flex-col items-center px-[9mm] pt-[8mm] pb-[7mm] text-center">
                    <div className="flex w-full items-center justify-between">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/brand/logo-makarios-oficial-azul.png"
                        alt="Makarios"
                        className="h-[6mm] w-auto"
                      />
                      <p className="text-[15pt] leading-none font-semibold text-brand-blue-dark">
                        {card.name}
                      </p>
                    </div>
                    <div className="mt-[4mm] rounded-[3mm] border border-brand-blue bg-white p-[3mm]">
                      <div
                        className="h-[78mm] w-[78mm]"
                        dangerouslySetInnerHTML={{ __html: card.svg }}
                      />
                    </div>
                    <p className="mt-[4mm] text-[11pt] font-semibold text-brand-blue-dark">
                      Escaneie para marcar presença
                    </p>
                    <p className="mt-[1mm] text-[8pt] text-neutral-700">
                      Na chegada e de novo na volta do intervalo
                    </p>
                    <p className="mt-auto text-[7pt] tracking-[0.25em] text-brand-blue uppercase">
                      Escola Makarios · Igreja Emaús
                    </p>
                  </div>
                </div>
              ))}
            </section>
          ))}
    </main>
  );
}
