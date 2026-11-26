"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function Fit({ worker, job }: { worker: [number, number]; job: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const same = Math.abs(worker[0] - job[0]) < 0.0001 && Math.abs(worker[1] - job[1]) < 0.0001;
    if (same) {
      map.setView(worker, 15);
      return;
    }
    map.fitBounds([worker, job], { padding: [18, 18], maxZoom: 15 });
  }, [map, worker, job]);
  return null;
}

export function EnrouteMap({
  worker,
  job,
}: {
  worker: { lat: number; lng: number };
  job: { lat: number; lng: number };
}) {
  const a: [number, number] = [worker.lat, worker.lng];
  const b: [number, number] = [job.lat, job.lng];
  return (
    <div className="mt-3 h-32 overflow-hidden rounded-2xl">
      <MapContainer center={a} zoom={13} zoomControl={false} attributionControl={false} dragging={false} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit worker={a} job={b} />
        <CircleMarker center={b} radius={7} pathOptions={{ color: "#1A1A1A", fillColor: "#1A1A1A", fillOpacity: 1, weight: 2 }} />
        <CircleMarker center={a} radius={7} pathOptions={{ color: "#4A2C1D", fillColor: "#6B4226", fillOpacity: 1, weight: 2 }} />
      </MapContainer>
    </div>
  );
}
