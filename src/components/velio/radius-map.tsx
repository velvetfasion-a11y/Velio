import { useEffect } from "react";
import { Circle, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function FitCircle({ lat, lng, km }: { lat: number; lng: number; km: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.circle([lat, lng], { radius: Math.max(1, km) * 1000 }).getBounds();
    map.fitBounds(bounds, { padding: [18, 18], animate: false });
    map.invalidateSize();
  }, [km, lat, lng, map]);
  return null;
}

export function RadiusMap({ km, lat, lng }: { km: number; lat: number; lng: number }) {
  return (
    <div className="relative z-0 h-52 overflow-hidden rounded-[1.3rem] border border-line">
      <MapContainer key={`${lat.toFixed(4)}-${lng.toFixed(4)}`} center={[lat, lng]} zoom={12} className="h-full w-full" scrollWheelZoom={false} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitCircle lat={lat} lng={lng} km={km} />
        <Circle center={[lat, lng]} radius={km * 1000} pathOptions={{ color: "#4A2C1D", weight: 2, fillColor: "#4A2C1D", fillOpacity: 0.18 }} />
      </MapContainer>
    </div>
  );
}
