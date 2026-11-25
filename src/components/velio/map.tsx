"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { coordsForArea, type Provider } from "@/lib/velio/data";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "velio-osm-pin",
  html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:#1c1814;border:2px solid #f4efe8;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const activeIcon = L.divIcon({
  className: "velio-osm-pin",
  html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:#c4a15a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitPeople({ people }: { people: Provider[] }) {
  const map = useMap();
  useEffect(() => {
    if (!people.length) {
      map.setView([59.33, 18.068], 12);
      return;
    }
    const bounds = L.latLngBounds(
      people.map((person) => {
        const c = coordsForArea(person.area);
        return [c.lat, c.lng] as [number, number];
      }),
    );
    map.fitBounds(bounds.pad(0.35));
  }, [map, people]);
  return null;
}

export function CityMap({
  people,
  locationOn,
  activeId,
  onSelect,
}: {
  people: Provider[];
  locationOn: boolean;
  activeArea: string | null;
  activeId?: string | null;
  onArea: (area: string) => void;
  onProvider: (id: string) => void;
  onClear: () => void;
  onSelect?: (id: string) => void;
}) {
  const center = useMemo(() => {
    if (activeId) {
      const person = people.find((item) => item.id === activeId);
      if (person) {
        const c = coordsForArea(person.area);
        return [c.lat, c.lng] as [number, number];
      }
    }
    return [59.33, 18.068] as [number, number];
  }, [activeId, people]);

  const you = coordsForArea("Östermalm");

  return (
    <div className="relative h-full min-h-[16rem] w-full overflow-hidden rounded-[1.5rem] border border-line bg-[#dfe8d8]">
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPeople people={people} />
        {locationOn ? (
          <CircleMarker
            center={[you.lat, you.lng]}
            radius={8}
            pathOptions={{ color: "#1c1814", fillColor: "#c4a15a", fillOpacity: 0.9 }}
          >
            <Popup>Din plats</Popup>
          </CircleMarker>
        ) : null}
        {people.map((person) => {
          const c = coordsForArea(person.area);
          const active = person.id === activeId;
          return (
            <Marker
              key={person.id}
              position={[c.lat, c.lng]}
              icon={active ? activeIcon : pinIcon}
              eventHandlers={{
                click: () => {
                  onSelect?.(person.id);
                },
              }}
            >
              <Popup>
                <button
                  type="button"
                  className="text-left text-sm font-semibold"
                  onClick={() => onSelect?.(person.id)}
                >
                  {person.name}
                  <span className="mt-0.5 block text-xs font-normal text-[#5c564f]">
                    {person.area} · fr. {person.price} kr
                  </span>
                </button>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {!people.length ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl bg-paper/95 px-3 py-2 text-center text-xs text-muted shadow">
          Inga utförare att visa ännu — öppna karta när riktiga profiler publicerats.
        </div>
      ) : null}
    </div>
  );
}
