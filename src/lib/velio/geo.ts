export type AddressHit = {
  id: string;
  label: string;
  detail: string;
  lat?: number;
  lng?: number;
};

const SWEDEN_BBOX = "10.5,55.2,24.2,69.1";

type PhotonProps = {
  osm_id?: number;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  locality?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
};

function formatPhoton(props: PhotonProps): { label: string; detail: string } | null {
  if (props.countrycode && props.countrycode !== "SE") return null;
  const street = [props.street, props.housenumber].filter(Boolean).join(" ");
  const municipality = props.city && !/län$/i.test(props.city) ? props.city : "";
  const local = props.locality || props.district || "";
  const place = municipality || local;
  const line = street || props.name || place;
  if (!line) return null;
  const cityLine = [props.postcode, place].filter(Boolean).join(" ");
  const label = street && cityLine && street !== place ? `${street}, ${cityLine}` : cityLine && line !== cityLine ? `${line}, ${cityLine}` : line;
  const detail = [props.district, props.county || props.state, "Sverige"].filter((part, index, list) => part && list.indexOf(part) === index).join(" · ");
  return { label, detail };
}

/** Address search for a static site: Photon, then Nominatim. Sweden only, no API key. */
export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    url.searchParams.set("bbox", SWEDEN_BBOX);
    url.searchParams.set("lat", "59.33");
    url.searchParams.set("lon", "18.07");
    const response = await fetch(url.toString(), { signal });
    if (response.ok) {
      const data = (await response.json()) as {
        features?: { geometry?: { coordinates?: number[] }; properties?: PhotonProps }[];
      };
      const hits = (data.features ?? [])
        .map((feature) => {
          const formatted = feature.properties ? formatPhoton(feature.properties) : null;
          if (!formatted) return null;
          const [lng, lat] = feature.geometry?.coordinates ?? [];
          const id = String(feature.properties?.osm_id ?? formatted.label);
          const hit: AddressHit = { id, ...formatted };
          if (typeof lat === "number" && typeof lng === "number") {
            hit.lat = lat;
            hit.lng = lng;
          }
          return hit;
        })
        .filter((hit): hit is AddressHit => hit !== null);
      const unique = hits.filter((hit, index) => hits.findIndex((other) => other.label === hit.label) === index);
      if (unique.length) return unique.slice(0, 6);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "se");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as { place_id?: number; display_name?: string; lat?: string; lon?: string }[];
  return rows
    .map((row) => {
      const parts = (row.display_name ?? "").split(",").map((part) => part.trim()).filter(Boolean);
      if (!parts.length) return null;
      const label = parts.slice(0, 3).join(", ");
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      const hit: AddressHit = { id: String(row.place_id ?? label), label, detail: "Sverige" };
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        hit.lat = lat;
        hit.lng = lng;
      }
      return hit;
    })
    .filter((hit): hit is AddressHit => hit !== null);
}

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
    const town = (address.town || address.municipality || address.city || "").replace(/ kommun$/i, "");
    const local = address.quarter || address.suburb || address.village || address.hamlet || address.neighbourhood || "";
    if (local && town && local !== town) return `${local}, ${town}`;
    if (town) return town;
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
