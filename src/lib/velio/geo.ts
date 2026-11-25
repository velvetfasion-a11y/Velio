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
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
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
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
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

function readPosition(options: PositionOptions & { waitMs: number }): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(Object.assign(new Error("unsupported"), { code: 0 }));
      return;
    }
    let settled = false;
    let watchId = -1;
    const finish = (ok: boolean, value: GeolocationPosition | GeolocationPositionError | Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (watchId >= 0) navigator.geolocation.clearWatch(watchId);
      if (ok) resolve(value as GeolocationPosition);
      else reject(value);
    };
    // Own timer only. Passing timeout to WebKit starts the clock before the person taps Allow,
    // so the prompt dies and the page looks like location never worked.
    const timer = window.setTimeout(() => {
      finish(false, Object.assign(new Error("timeout"), { code: 3 }));
    }, options.waitMs);
    const { enableHighAccuracy, maximumAge } = options;
    watchId = navigator.geolocation.watchPosition(
      (position) => finish(true, position),
      (error) => {
        const code = Number(error?.code ?? 0);
        if (code === 1 || code === 2) finish(false, error);
      },
      { enableHighAccuracy, maximumAge },
    );
  });
}

export async function resolveCurrentLocation(): Promise<UserLocation> {
  let position: GeolocationPosition;
  try {
    position = await readPosition({
      enableHighAccuracy: false,
      maximumAge: 600_000,
      waitMs: 30_000,
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? Number((error as { code: number }).code) : 0;
    if (code === 1 || code === 0 || code === 2) throw error;
    position = await readPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      waitMs: 20_000,
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
