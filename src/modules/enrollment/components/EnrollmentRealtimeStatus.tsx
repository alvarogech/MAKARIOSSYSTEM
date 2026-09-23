"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/integrations/supabase/client";

type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: "Conectando",
  live: "Ao vivo",
  reconnecting: "Reconectando",
  offline: "Offline",
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connecting: "bg-neutral-300",
  live: "bg-success",
  reconnecting: "bg-warning",
  offline: "bg-danger",
};

/**
 * Assina Realtime (postgres_changes) em enrollment_requests com o client
 * autenticado do navegador — a RLS da tabela decide o que chega; um
 * usuário sem perfil coordenação/admin não receberia nenhum evento, mesmo
 * inscrito. Nunca aplica o payload do evento diretamente numa lista local
 * (evitaria duplicar registro ou desalinhar com filtros/paginação/
 * ordenação já ativos) — só pede um `router.refresh()`, que reexecuta o
 * Server Component da página com a URL (e portanto os filtros) atual.
 */
export function EnrollmentRealtimeStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("enrollment-requests-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enrollment_requests" },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 400);
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("live");
        } else if (subscriptionStatus === "TIMED_OUT" || subscriptionStatus === "CHANNEL_ERROR") {
          setStatus("reconnecting");
        } else if (subscriptionStatus === "CLOSED") {
          setStatus("offline");
        }
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
