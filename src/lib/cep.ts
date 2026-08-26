/** Consulta de CEP na BrasilAPI e cálculo de distância para o raio de entrega. */

export type EnderecoCep = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
};

export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const limpo = cep.replace(/\D/g, "");
  if (!/^[0-9]{8}$/.test(limpo)) return null;
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`);
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as {
      cep?: string;
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
    };
    const coords = dados.location?.coordinates;
    const lat = coords?.latitude != null ? Number(coords.latitude) : NaN;
    const lng = coords?.longitude != null ? Number(coords.longitude) : NaN;
    return {
      cep: limpo,
      street: dados.street ?? "",
      neighborhood: dados.neighborhood ?? "",
      city: dados.city ?? "",
      state: dados.state ?? "",
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  } catch {
    return null;
  }
}

/** Distância em km entre duas coordenadas (fórmula de Haversine). */
export function distanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatarKm(valor: number) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
