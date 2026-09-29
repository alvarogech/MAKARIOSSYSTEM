/** Link de busca do Google Maps para um texto de endereço/local livre. */
export function buildMapsSearchUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
