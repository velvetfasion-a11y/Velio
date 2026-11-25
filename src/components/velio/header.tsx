import { ArrowLeft, Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVelio } from "@/lib/velio/store";

export function PlaceLink({ tone = "cream" }: { tone?: "cream" | "glass" }) {
  const locationOn = useVelio((state) => state.locationOn);
  const locationBusy = useVelio((state) => state.locationBusy);
  const userLocation = useVelio((state) => state.userLocation);
  const addresses = useVelio((state) => state.addresses);
  const activeAddressId = useVelio((state) => state.activeAddressId);
  const glass = tone === "glass";
  const active = addresses.find((item) => item.id === activeAddressId);
  const street = active?.line.split(",")[0]?.trim();
  const placeLabel = locationBusy
    ? "Hämtar…"
    : active
      ? `${active.label} · ${street || active.line}`
      : locationOn
        ? userLocation?.label || "Plats delad"
        : "Välj adress";

  const sheet = useVelio((state) => state.sheet);
  const openAddressSheet = useVelio((state) => state.openAddressSheet);
  if (sheet === "onboard" || sheet === "job") return null;

  const onPlaceClick = () => {
    openAddressSheet();
  };

  return (
    <button
      type="button"
      aria-label={placeLabel}
      onClick={onPlaceClick}
      className={cn(
        "inline-flex max-w-[16rem] truncate rounded-full px-2.5 py-1 text-left text-[11px] leading-none font-medium tracking-wide",
        glass ? "glass-dark text-paper" : "text-muted",
        locationOn && (glass ? "text-[#d7f5df]" : "text-ok"),
      )}
    >
      {placeLabel}
    </button>
  );
}

export function AppHeader({ tone = "cream", onBack }: { tone?: "cream" | "glass"; onBack?: () => void }) {
  const go = useVelio((state) => state.go);
  const goBack = useVelio((state) => state.goBack);
  const closeSheet = useVelio((state) => state.closeSheet);
  const sheet = useVelio((state) => state.sheet);
  const unread = useVelio((state) => state.appNotifications.some((item) => !item.read));
  const glass = tone === "glass";

  const back = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (sheet) {
      closeSheet();
      return;
    }
    goBack();
  };

  return (
    <div className="px-4 pt-3 pb-1">
      <PlaceLink tone={tone} />
      <div className="mt-1 grid grid-cols-[2.25rem_1fr_2.25rem] items-center">
        <button
          type="button"
          aria-label="Tillbaka"
          onClick={back}
          className={cn(
            "grid size-10 place-items-center justify-self-start rounded-full",
            glass ? "glass-dark text-paper" : "text-ink",
          )}
        >
          <ArrowLeft className="size-5" strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (sheet === "onboard" || sheet === "job") return;
            go("home");
          }}
          className={cn(
            "justify-self-center text-center font-serif text-[1.7rem] leading-none font-medium tracking-[0.28em]",
            glass && "text-paper",
          )}
        >
          VELIO
        </button>

        <button
          type="button"
          aria-label="Notiser"
          onClick={() => go("notifications")}
          className={cn(
            "relative grid size-10 place-items-center justify-self-end rounded-full",
            glass ? "glass-dark text-paper" : "text-ink",
          )}
        >
          <Bell className="size-[1.15rem]" strokeWidth={1.8} />
          {unread ? <span className="absolute top-1 right-1 size-1.5 rounded-full bg-gold" /> : null}
        </button>
      </div>
    </div>
  );
}
