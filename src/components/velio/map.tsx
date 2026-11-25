"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { coordsForArea, type Provider } from "@/lib/velio/data";
import type { UserLocation } from "@/lib/velio/geo";
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

function FitView({
  people,
  userLocation,
}: {
  people: Provider[];
  userLocation: UserLocation | null;
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = people.map((person) => {
      const c = coordsForArea(person.area);
      return [c.lat, c.lng];
    });
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
    if (!points.length) {
      map.setView([59.33, 18.068], 12);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], userLocation ? 15 : 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points).pad(0.35));
  }, [map, people, userLocation]);
  return null;
}

export function CityMap({
  people,
  locationOn,
  userLocation,
  activeId,
  onSelect,
}: {
  people: Provider[];
  locationOn: boolean;
  userLocation?: UserLocation | null;
  activeArea: string | null;
  activeId?: string | null;
  onArea: (area: string) => void;
  onProvider: (id: string) => void;
  onClear: () => void;
  onSelect?: (id: string) => void;
}) {
  const you = locationOn ? userLocation ?? null : null;

  const center = useMemo(() => {
    if (you) return [you.lat, you.lng] as [number, number];
    if (activeId) {
      const person = people.find((item) => item.id === activeId);
      if (person) {
        const c = coordsForArea(person.area);
        return [c.lat, c.lng] as [number, number];
      }
    }
    return [59.33, 18.068] as [number, number];
  }, [activeId, people, you]);

  return (
    <div className="relative h-full min-h-[16rem] w-full overflow-hidden rounded-[1.5rem] border border-line bg-[#dfe8d8]">
      <MapContainer center={center} zoom={you ? 15 : 12} className="h-full w-full" scrollWheelZoom attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitView people={people} userLocation={you} />
        {you ? (
          <>
            {you.accuracy && you.accuracy < 800 ? (
              <Circle
                center={[you.lat, you.lng]}
                radius={Math.max(25, you.accuracy)}
                pathOptions={{ color: "#3d8f4a", fillColor: "#3d8f4a", fillOpacity: 0.12, weight: 1 }}
              />
            ) : null}
            <CircleMarker
              center={[you.lat, you.lng]}
              radius={9}
              pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#3d8f4a", fillOpacity: 1 }}
            >
              <Popup>
                <span className="font-semibold">Du är här</span>
                <span className="mt-0.5 block text-xs text-[#5c564f]">{you.label}</span>
              </Popup>
            </CircleMarker>
          </>
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
                <button type="button" className="text-left text-sm font-semibold" onClick={() => onSelect?.(person.id)}>
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
      {you ? (
        <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-paper/95 px-3 py-1.5 text-xs font-semibold text-[#2f7a3c] shadow">
          <span className="mr-1.5 inline-block size-2 rounded-full bg-[#3d8f4a]" />
          {you.label}
        </div>
      ) : null}
      {!people.length && !you ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl bg-paper/95 px-3 py-2 text-center text-xs text-muted shadow">
          Dela din plats uppe till vänster för att se dig själv på kartan.
        </div>
      ) : null}
    </div>
  );
}
