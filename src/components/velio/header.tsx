import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVelio } from "@/lib/velio/store";

export function AppHeader({ tone = "cream" }: { tone?: "cream" | "glass" }) {
  const setSheet = useVelio((state) => state.setSheet);
  const go = useVelio((state) => state.go);
  const glass = tone === "glass";

  return (
    <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 py-3">
      <span aria-hidden="true" className="size-10" />
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
        onClick={() => setSheet("notes")}
        className={cn(
          "relative grid size-10 place-items-center rounded-full",
          glass ? "border border-paper/40 bg-ink/20 text-paper backdrop-blur-sm" : "border border-line bg-cream",
        )}
      >
        <Bell className="size-5" />
        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-gold" />
      </button>
    </div>
  );
}
