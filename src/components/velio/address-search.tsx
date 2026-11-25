import { useEffect, useState } from "react";
import { MapPin, Navigation, Search } from "lucide-react";
import { resolveCurrentLocation, searchAddresses, type AddressHit } from "@/lib/velio/geo";

export function AddressSearch({
  picked,
  onPick,
  onClear,
}: {
  picked: AddressHit | null;
  onPick: (hit: AddressHit) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(picked?.label ?? "");
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(picked?.label ?? "");
  }, [picked]);

  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true);
      void searchAddresses(query.trim(), controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setHits(next);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!controller.signal.aborted) setHits([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [picked, query]);

  const useMine = () => {
    setLocating(true);
    setError("");
    void resolveCurrentLocation()
      .then((place) => {
        onPick({ id: "gps", label: place.label, detail: "Din plats just nu", lat: place.lat, lng: place.lng });
        setHits([]);
      })
      .catch(() => setError("Platsen gick inte att hämta. Skriv adressen och välj ett förslag."))
      .finally(() => setLocating(false));
  };

  return (
    <div>
      {picked ? (
        <div className="flex items-start gap-3 rounded-2xl bg-sand px-3 py-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-brown" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{picked.label}</p>
            <p className="text-sm text-muted">{picked.detail}</p>
          </div>
          <button type="button" onClick={onClear} className="text-sm font-semibold text-brown">
            Ändra
          </button>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 rounded-full border border-line px-3">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setError("");
              }}
              placeholder="Sök gata, ort eller plats"
              aria-label="Adress"
              className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
            />
          </label>
          {busy ? <p className="mt-2 text-sm text-muted">Söker adresser…</p> : null}
          {hits.length ? (
            <ul className="relative z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-paper">
              {hits.map((hit) => (
                <li key={hit.id} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => onPick(hit)} className="flex w-full items-start gap-2 px-3 py-3 text-left">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-brown" />
                    <span>
                      <span className="block font-semibold">{hit.label}</span>
                      <span className="block text-sm text-muted">{hit.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!busy && query.trim().length >= 2 && hits.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Inga adresser i Sverige. Prova gata och ort.</p>
          ) : null}
        </>
      )}
      <button
        type="button"
        onClick={useMine}
        disabled={locating}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-paper text-sm font-semibold disabled:opacity-60"
      >
        <Navigation className="size-4" />
        {locating ? "Hämtar plats…" : "Använd min plats"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
      <p className="mt-2 text-[11px] text-muted">Adresser från OpenStreetMap.</p>
    </div>
  );
}
