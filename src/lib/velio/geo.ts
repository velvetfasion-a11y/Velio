export type UserLocation = {
  lat: number;
  lng: number;
  label: string;
  accuracy: number | null;
};

function pickLabel(address: Record<string, string> | undefined, fallback: string) {
  if (!address) return fallback;
  return (
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.quarter ||
    address.village ||
    address.town ||
    address.city ||
    address.municipality ||
    fallback
  );
}

/** Reverse-geocode with OpenStreetMap Nominatim (free). */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("accept-language", "sv");
    url.searchParams.set("zoom", "16");
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { address?: Record<string, string>; display_name?: string };
    const short = pickLabel(data.address, "");
    if (short) return short;
    return data.display_name?.split(",")[0]?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function readDevicePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 10_000,
    });
  });
}

export async function resolveCurrentLocation(): Promise<UserLocation> {
  const position = await readDevicePosition();
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const label = await reverseGeocode(lat, lng);
  return {
    lat,
    lng,
    label,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  };
}
