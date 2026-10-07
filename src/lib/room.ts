/** "Sala 02" e "02" viram sempre "Sala 02" — nunca "Sala Sala 02". Vazio vira null. */
export function formatRoom(room: string | null | undefined): string | null {
  const trimmed = (room ?? "").trim();
  if (!trimmed) return null;
  const bare = trimmed.replace(/^(sala\s+)+/i, "").trim();
  return bare ? `Sala ${bare}` : "Sala";
}
