import { Bell, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVelio } from "@/lib/velio/store";

export function AppHeader({ tone = "cream" }: { tone?: "cream" | "glass" }) {
  const go = useVelio((state) => state.go);
  const setSheet = useVelio((state) => state.setSheet);
  const allowLocation = useVelio((state) => state.allowLocation);
  const locationOn = useVelio((state) => state.locationOn);
  const locationBusy = useVelio((state) => state.locationBusy);
  const userLocation = useVelio((state) => state.userLocation);
  const unread = useVelio((state) => state.appNotifications.some((item) => !item.read));
  const glass = tone === "glass";

  const placeLabel = locationBusy
    ? "Hämtar…"
    : locationOn
      ? userLocation?.label || "Plats delad"
      : "Dela plats";

  const onPlaceClick = () => {
    if (locationOn) {
      setSheet("location");
      return;
    }
    // Request GPS immediately; sheet opens only if user needs to manage/deny.
    void allowLocation().then(() => {
      const state = useVelio.getState();
      if (!state.locationOn) setSheet("location");
    });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-3">
      <button
        type="button"
        aria-label={placeLabel}
        onClick={onPlaceClick}
        className={cn(
          "flex min-w-0 max-w-full items-center gap-1.5 justify-self-start rounded-full border px-2.5 py-2 text-left",
          glass ? "border-paper/40 bg-ink/20 text-paper backdrop-blur-sm" : "border-line bg-cream text-ink",
          locationOn && !glass && "border-[#3d8f4a]/45 bg-[#e8f5ea] text-[#1f5c2c]",
          locationOn && glass && "border-[#7dcea0]/55",
        )}
      >
        <MapPin
          className={cn(
            "size-4 shrink-0",
            locationOn ? (glass ? "text-[#9BE7B0]" : "text-[#2f7a3c]") : glass ? "text-paper" : "text-ink",
          )}
        />
        <span
          className={cn(
            "min-w-0 truncate text-[11px] leading-tight font-semibold",
            locationOn && !glass && "text-[#1f5c2c]",
          )}
        >
          {placeLabel}
        </span>
        {locationOn ? <span className="size-1.5 shrink-0 rounded-full bg-[#3d8f4a]" aria-hidden="true" /> : null}
      </button>

      <button
        type="button"
        onClick={() => go("home")}
        className={cn("px-1 text-center font-serif text-[1.85rem] leading-none font-medium tracking-[0.28em]", glass && "text-paper")}
      >
        VELIO
      </button>

      <button
        type="button"
        aria-label="Notiser"
        onClick={() => go("notifications")}
        className={cn(
          "relative grid size-10 place-items-center justify-self-end rounded-full",
          glass ? "border border-paper/40 bg-ink/20 text-paper backdrop-blur-sm" : "border border-line bg-cream",
        )}
      >
        <Bell className="size-5" />
        {unread ? <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-gold" /> : null}
      </button>
    </div>
  );
}
