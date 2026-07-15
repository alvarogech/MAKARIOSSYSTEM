import type { Metadata } from "next";
import { canAccessArea, getAuthContext } from "@/authorization";
import { AccessDenied } from "@/components/feedback/AccessDenied";
import { Card } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { CreateSeasonForm } from "@/modules/academic/components/CreateSeasonForm";
import { CreateOfferingForm } from "@/modules/academic/components/CreateOfferingForm";

export const metadata: Metadata = { title: "Temporadas" };

export default async function TemporadasPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (!canAccessArea(authContext, "coordination")) {
    return (
      <AccessDenied description="Esta área é exclusiva da Coordenação (ou Administrador)." />
    );
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: seasons }, { data: volumes }, { data: offerings }] =
    await Promise.all([
      supabase.from("seasons").select("id, name, status").order("name"),
      supabase.from("volumes").select("id, name, order_index").order("order_index"),
      supabase
        .from("season_volume_offerings")
        .select("id, season_id, volume_id, status")
        .order("created_at"),
    ]);

  const seasonsById = new Map((seasons ?? []).map((s) => [s.id, s]));
  const volumesById = new Map((volumes ?? []).map((v) => [v.id, v]));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="text-lg font-semibold text-neutral-900">Temporadas</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Uma temporada organiza as ofertas de volume, turmas e encontros
          de um período (ex.: 2026.2).
        </p>
        <div className="mt-4">
          <CreateSeasonForm />
        </div>
        <ul className="mt-6 divide-y divide-neutral-100">
          {(seasons ?? []).map((season) => (
            <li key={season.id} className="py-2 text-sm text-neutral-700">
              <span className="font-medium">{season.name}</span>{" "}
              <span className="text-neutral-400">— {season.status}</span>
            </li>
          ))}
          {(seasons ?? []).length === 0 ? (
            <li className="py-2 text-sm text-neutral-400">
              Nenhuma temporada criada ainda.
            </li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">
          Ofertas de volume
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Cada oferta representa um volume (Essência, Caminho ou Voz)
          disponível numa temporada específica — as turmas pertencem a uma
          oferta.
        </p>
        <div className="mt-4">
          <CreateOfferingForm
            seasons={(seasons ?? []).map((s) => ({ id: s.id, name: s.name }))}
            volumes={(volumes ?? []).map((v) => ({ id: v.id, name: v.name }))}
          />
        </div>
        <ul className="mt-6 divide-y divide-neutral-100">
          {(offerings ?? []).map((offering) => (
            <li key={offering.id} className="py-2 text-sm text-neutral-700">
              <span className="font-medium">
                {volumesById.get(offering.volume_id)?.name ?? "Volume"}
              </span>{" "}
              — {seasonsById.get(offering.season_id)?.name ?? "Temporada"}{" "}
              <span className="text-neutral-400">({offering.status})</span>
            </li>
          ))}
          {(offerings ?? []).length === 0 ? (
            <li className="py-2 text-sm text-neutral-400">
              Nenhuma oferta criada ainda.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
