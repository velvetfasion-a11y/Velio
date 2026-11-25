import { Bell, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVelio } from "@/lib/velio/store";

export function AppHeader({ tone = "cream" }: { tone?: "cream" | "glass" }) {
  const go = useVelio((state) => state.go);
  const setSheet = useVelio((state) => state.setSheet);
  const locationOn = useVelio((state) => state.locationOn);
  const userLocation = useVelio((state) => state.userLocation);
  const unread = useVelio((state) => state.appNotifications.some((item) => !item.read));
  const glass = tone === "glass";

  return (
    <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 py-3">
      <button
        type="button"
        aria-label={locationOn ? `Din plats: ${userLocation?.label ?? "delad"}` : "Dela plats"}
        title={locationOn ? userLocation?.label ?? "Plats delad" : "Dela plats"}
        onClick={() => setSheet("location")}
        className={cn(
          "relative grid size-10 place-items-center rounded-full",
          glass ? "border border-paper/40 bg-ink/20 text-paper backdrop-blur-sm" : "border border-line bg-cream",
          locationOn && !glass && "border-[#3d8f4a]/40 bg-[#e8f5ea]",
          locationOn && glass && "border-[#7dcea0]/50",
        )}
      >
        <MapPin className={cn("size-5", locationOn ? (glass ? "text-[#9BE7B0]" : "text-[#2f7a3c]") : undefined)} />
        {locationOn ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#3d8f4a]" aria-hidden="true" />
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => go("home")}
        className={cn("text-center font-serif text-[2rem] leading-none font-medium tracking-[0.28em]", glass && "text-paper")}
      >
        VELIO
      </button>
      <button
        type="button"
        aria-label="Notiser"
        onClick={() => go("notifications")}
        className={cn(
          "relative grid size-10 place-items-center rounded-full",
          glass ? "border border-paper/40 bg-ink/20 text-paper backdrop-blur-sm" : "border border-line bg-cream",
        )}
      >
        <Bell className="size-5" />
        {unread ? <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-gold" /> : null}
      </button>
    </div>
  );
}
