import { useEffect, useRef, useState } from "react";
import { areaLayout, type Provider } from "@/lib/velio/data";

const labels = [
  { name: "Vasastan", x: 28, y: 10 },
  { name: "Östermalm", x: 68, y: 22 },
  { name: "Kungsholmen", x: 6, y: 52 },
  { name: "Stockholm", x: 38, y: 46, large: true },
  { name: "Södermalm", x: 40, y: 80 },
];

const MIN_SCALE = 1;
const MAX_SCALE = 4.5;

type View = { x: number; y: number; scale: number };

export function CityMap({
  people,
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
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });
  const [view, setView] = useState<View>(viewRef.current);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number; x: number; y: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);
  const seen = new Map<string, number>();

  const commit = (next: View) => {
    const frame = frameRef.current;
    const inner = innerRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    let x = next.x;
    let y = next.y;
    if (frame && inner) {
      const maxX = Math.max(0, (inner.offsetWidth * scale - frame.clientWidth) / 2);
      const maxY = Math.max(0, (inner.offsetHeight * scale - frame.clientHeight) / 2);
      x = Math.min(maxX, Math.max(-maxX, x));
      y = Math.min(maxY, Math.max(-maxY, y));
    }
    const clamped = { x, y, scale };
    viewRef.current = clamped;
    setView(clamped);
  };

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const px = clientX - rect.left - rect.width / 2;
    const py = clientY - rect.top - rect.height / 2;
    const current = viewRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
    const applied = scale / current.scale;
    commit({
      scale,
      x: px - (px - current.x) * applied,
      y: py - (py - current.y) * applied,
    });
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAt(event.clientX, event.clientY, factor);
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  const point = (event: React.PointerEvent) => ({ x: event.clientX, y: event.clientY });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-zoom]")) return;
    frameRef.current?.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point(event));
    moved.current = false;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && frameRef.current) {
      const rect = frameRef.current.getBoundingClientRect();
      const current = viewRef.current;
      pinch.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        scale: current.scale,
        x: current.x,
        y: current.y,
        cx: (pts[0].x + pts[1].x) / 2 - rect.left - rect.width / 2,
        cy: (pts[0].y + pts[1].y) / 2 - rect.top - rect.height / 2,
      };
      drag.current = null;
      return;
    }
    pinch.current = null;
    drag.current = { x: event.clientX, y: event.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, point(event));
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && pinch.current) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * (dist / pinch.current.dist)));
      const applied = scale / pinch.current.scale;
      moved.current = true;
      commit({
        scale,
        x: pinch.current.cx - (pinch.current.cx - pinch.current.x) * applied,
        y: pinch.current.cy - (pinch.current.cy - pinch.current.y) * applied,
      });
      return;
    }
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 5) moved.current = true;
    commit({ scale: viewRef.current.scale, x: drag.current.ox + dx, y: drag.current.oy + dy });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  return (
    <div
      ref={frameRef}
      className="relative h-full w-full touch-none overflow-hidden bg-[#efe6d8]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) => zoomAt(event.clientX, event.clientY, view.scale < 2 ? 2 : 0.5)}
    >
      <div
        ref={innerRef}
        className="absolute top-1/2 left-1/2 h-full min-w-full"
        style={{
          aspectRatio: "1536 / 1280",
          transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        <img src="/velio/map-stockholm.jpg" alt="" draggable={false} className="h-full w-full object-cover" />
        {labels.map((label) => (
          <span
            key={label.name}
            className={label.large ? "font-serif text-2xl text-ink/80" : "text-[13px] text-ink/70"}
            style={{ position: "absolute", left: `${label.x}%`, top: `${label.y}%` }}
          >
            {label.name}
          </span>
        ))}
        {people.map((person) => {
          const base = areaLayout[person.area];
          if (!base) return null;
          const index = seen.get(person.area) ?? 0;
          seen.set(person.area, index + 1);
          const left = base.x + (index % 2) * 7;
          const top = Math.min(base.y + Math.floor(index / 2) * 6, 58);
          const active = person.id === activeId;
          return (
            <button
              key={person.id}
              type="button"
              aria-label={person.name}
              onClick={() => {
                if (moved.current) return;
                onSelect?.(person.id);
              }}
              className="absolute z-20 -translate-x-1/2 -translate-y-[88%]"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <span className="absolute top-5 left-1/2 size-8 -translate-x-1/2 rounded-full bg-gold/50 blur-md" />
              <svg viewBox="0 0 40 52" className={active ? "h-14 w-11" : "h-12 w-9"} aria-hidden="true">
                <path d="M20 50C20 50 3 31.5 3 18a17 17 0 1 1 34 0C37 31.5 20 50 20 50Z" className="fill-ink" />
                <text x="20" y="23" textAnchor="middle" className="fill-paper text-[11px] font-semibold">
                  {person.initials}
                </text>
              </svg>
            </button>
          );
        })}
      </div>
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
        <button
          type="button"
          data-zoom
          aria-label="Zooma in"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            const frame = frameRef.current;
            if (!frame) return;
            const rect = frame.getBoundingClientRect();
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.4);
          }}
          className="grid size-9 place-items-center rounded-full bg-paper text-lg font-semibold shadow-md"
        >
          +
        </button>
        <button
          type="button"
          data-zoom
          aria-label="Zooma ut"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            const frame = frameRef.current;
            if (!frame) return;
            const rect = frame.getBoundingClientRect();
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.4);
          }}
          className="grid size-9 place-items-center rounded-full bg-paper text-lg font-semibold shadow-md"
        >
          −
        </button>
      </div>
    </div>
  );
}
