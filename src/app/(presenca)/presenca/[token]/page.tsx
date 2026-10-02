import type { Metadata } from "next";
import { ScanAttendance } from "@/modules/attendance/components/ScanAttendance";

export const metadata: Metadata = { title: "Marcar presença", robots: { index: false } };

export default async function PresencaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <ScanAttendance token={token} />
    </main>
  );
}
