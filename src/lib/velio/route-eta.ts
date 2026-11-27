import { coordsForArea, distanceKm } from "@/lib/velio/data";
import { searchAddresses } from "@/lib/velio/geo";

const CITY_KMH = 25;

export function straightLineEta(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const km = distanceKm(from, to);
  const minutes = Math.max(1, Math.round((km / CITY_KMH) * 60));
  return { minutes, distanceM: Math.round(km * 1000) };
}

/** Driving ETA from the public OSRM demo. Falls back to straight-line distance at city speed. */
export async function routeEta(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = (await response.json()) as { code?: string; routes?: { duration?: number; distance?: number }[] };
      const route = data.routes?.[0];
      if (data.code === "Ok" && route?.duration) {
        return {
          minutes: Math.max(1, Math.round(route.duration / 60)),
          distanceM: Math.round(route.distance || 0),
          routed: true,
        };
      }
    }
  } catch {
    // public demo can be down; the straight line still gives an ETA
  }
  return { ...straightLineEta(from, to), routed: false };
}

export async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  try {
    const hits = await searchAddresses(q);
    const hit = hits.find((item) => typeof item.lat === "number" && typeof item.lng === "number");
    if (!hit || hit.lat == null || hit.lng == null) return null;
    return { lat: hit.lat, lng: hit.lng };
  } catch {
    return null;
  }
}

/** Rough minutes from the worker's saved area when the phone will not share a position. */
export async function etaFromArea(area: string, place: string): Promise<number | null> {
  const job = await geocodePlace(place);
  if (!job) return null;
  const from = coordsForArea(area);
  return straightLineEta(from, job).minutes;
}

export function distanceLabel(meters?: number) {
  if (!meters || meters <= 0) return "";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km`;
}

export function etaPhrase(input: { approximate: boolean; etaMin: number; etaMax?: number; status: "enroute" | "arrived" }) {
  if (input.status === "arrived") return "Framme";
  if (input.approximate) {
    if (!input.etaMax) return `ungefär ${input.etaMin}+ min`;
    return `ungefär ${input.etaMin}–${input.etaMax} min`;
  }
  return `ca ${input.etaMin} min bort`;
}
