import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateLocationForm } from "@/modules/academic/components/CreateLocationForm";
import { LocationCoordinatesForm } from "@/modules/attendance/components/AttendanceForms";

export const metadata: Metadata = { title: "Locais" };

export default async function LocaisPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, address, entry_instructions, parking_instructions, arrival_minutes_before, coordination_contact, latitude, longitude")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Locais</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cadastro reutilizável de espaços — depois associe cada turma ao local correto em Turmas.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-neutral-900">Locais cadastrados</h2>
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100 text-sm">
          {(locations ?? []).map((location) => (
            <li key={location.id} className="py-2 text-neutral-700">
              <span className="font-medium">{location.name}</span>
              {location.address ? <span className="text-neutral-400"> — {location.address}</span> : null}
              <div className="text-xs text-neutral-400">
                {location.entry_instructions ? `Entrada: ${location.entry_instructions} · ` : ""}
                {location.parking_instructions ? `Estacionamento: ${location.parking_instructions} · ` : ""}
                {location.arrival_minutes_before ? `Chegar ${location.arrival_minutes_before} min antes · ` : ""}
                {location.coordination_contact ? `Contato: ${location.coordination_contact}` : ""}
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                Coordenadas para a chamada por QR Code (no Google Maps, clique com o botão direito no prédio e copie os números):
              </div>
              <LocationCoordinatesForm
                id={location.id}
                current={location.latitude != null ? `${location.latitude}, ${location.longitude}` : ""}
              />
            </li>
          ))}
          {(locations ?? []).length === 0 ? <li className="py-2 text-neutral-400">Nenhum local cadastrado ainda.</li> : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-neutral-900">Cadastrar local</h2>
        <div className="mt-4">
          <CreateLocationForm />
        </div>
      </Card>
    </div>
  );
}
