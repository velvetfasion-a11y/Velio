export type UserLocation = {
  lat: number;
  lng: number;
  label: string;
  accuracy: number | null;
};

function coordsFallback(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function fromBigDataCloud(data: {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  localityInfo?: { administrative?: { name: string; adminLevel?: number }[] };
}): string {
  const admins = data.localityInfo?.administrative ?? [];
  const district =
    admins
      .filter((item) => (item.adminLevel ?? 0) >= 8)
      .map((item) => item.name)
      .find(Boolean) || "";
  return data.locality || district || data.city || data.principalSubdivision || data.countryName || "";
}

/** Reverse-geocode: BigDataCloud (browser-friendly) then Nominatim. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = coordsFallback(lat, lng);

  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("localityLanguage", "sv");
    const response = await fetch(url.toString());
    if (response.ok) {
      const data = (await response.json()) as Parameters<typeof fromBigDataCloud>[0];
      const label = fromBigDataCloud(data);
      if (label) return label;
    }
  } catch {
    // try Nominatim next
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("accept-language", "sv");
    url.searchParams.set("zoom", "16");
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const address = data.address ?? {};
    const short =
      address.suburb ||
      address.neighbourhood ||
      address.city_district ||
      address.quarter ||
      address.village ||
      address.town ||
      address.city ||
      address.municipality ||
      "";
    if (short) return short;
    return data.display_name?.split(",")[0]?.trim() || fallback;
  } catch {
    return fallback;
  }
}

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(Object.assign(new Error("unsupported"), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function resolveCurrentLocation(): Promise<UserLocation> {
  let position: GeolocationPosition;
  try {
    position = await getPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15_000,
    });
  } catch {
    // Retry without high accuracy — works more often on tablets/Wi‑Fi.
    position = await getPosition({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60_000,
    });
  }

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
