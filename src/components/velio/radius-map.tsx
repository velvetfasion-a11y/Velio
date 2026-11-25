import { useEffect } from "react";
import { Circle, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const center: [number, number] = [59.3293, 18.0686];

function SyncZoom({ km }: { km: number }) {
  const map = useMap();
  useEffect(() => {
    const zoom = km >= 40 ? 10 : km >= 20 ? 11 : km >= 10 ? 12 : 13;
    map.setView(center, zoom);
  }, [km, map]);
  return null;
}

export function RadiusMap({ km }: { km: number }) {
  return (
    <div className="h-52 overflow-hidden rounded-[1.3rem] border border-line">
      <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom={false} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SyncZoom km={km} />
        <Circle center={center} radius={km * 1000} pathOptions={{ color: "#4A2C1D", weight: 2, fillColor: "#4A2C1D", fillOpacity: 0.14 }} />
      </MapContainer>
    </div>
  );
}
