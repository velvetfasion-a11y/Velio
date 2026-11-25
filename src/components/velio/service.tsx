import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  List,
  MapPin,
  MessageCircle,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import {
  areaLayout,
  filterProviders,
  isOpenAt,
  kr,
  providerById,
  ratingLabel,
  serviceById,
  sortLabels,
  type Provider,
  type ServiceId,
} from "@/lib/velio/data";
import { useVelio } from "@/lib/velio/store";
import { AppHeader } from "@/components/velio/header";
import { cn } from "@/lib/cn";
import { CityMap } from "@/components/velio/map";
import { asset } from "@/lib/velio/asset";

const intros: Record<ServiceId, string> = {
  sak: "Larm, bevakning och trygghet – aktivera professionella utförare nära dig.",
  el: "Installation, felsökning och belysning – boka en elektriker nära dig.",
  stad: "Hemstäd och flyttstäd – boka en städare nära dig.",
  trad: "Häck, plantering och skötsel – boka en trädgårdsmästare nära dig.",
  rep: "Det som gått sönder hemma – boka en reparatör nära dig.",
  ren: "Målning och mindre renovering – boka ett proffs nära dig.",
  per: "Tillfällig personal till hem och event – boka nära dig.",
  eko: "Bokföring och deklaration – boka en ekonom nära dig.",
  ank: "Förbered hemmet inför ankomst – boka hjälp nära dig.",
  til: "Tillsyn när du är borta – boka någon som tittar till bostaden.",
};

const heroes: Partial<Record<ServiceId, string>> = {
  sak: asset("/velio/hero-sak.jpg"),
  el: asset("/velio/el.jpg"),
  stad: asset("/velio/stad.jpg"),
  trad: asset("/velio/trad.jpg"),
  rep: asset("/velio/rep.jpg"),
  ren: asset("/velio/ren.jpg"),
  per: asset("/velio/per.jpg"),
  til: asset("/velio/til.jpg"),
};

const fallbackTags: Record<ServiceId, string[]> = {
  el: ["Installation", "Felsökning", "Belysning"],
  stad: ["Hemstäd", "Flyttstäd"],
  trad: ["Skötsel", "Häck"],
  rep: ["Reparation", "Montering"],
  sak: ["Larm", "Bevakning"],
  ren: ["Målning", "Renovering"],
  per: ["Personal", "Event"],
  eko: ["Bokföring", "Deklaration"],
  ank: ["Ankomst", "Förberedelse"],
  til: ["Tillsyn", "Växter"],
};

function shiftDate(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function dayStamp(date: Date) {
  const month = date.toLocaleDateString("sv-SE", { month: "short" }).replace(".", "");
  return `${date.getDate()} ${month}`;
}

function tagsOf(person: Provider) {
  return person.tags?.length ? person.tags : fallbackTags[person.serviceId];
}

export function ServiceScreen() {
  const serviceId = useVelio((state) => state.serviceId);
  const mapMode = useVelio((state) => state.mapMode);
  const setMapMode = useVelio((state) => state.setMapMode);
  const sort = useVelio((state) => state.sort);
  const time = useVelio((state) => state.time);
  const area = useVelio((state) => state.area);
  const setArea = useVelio((state) => state.setArea);
  const setSheet = useVelio((state) => state.setSheet);
  const openProvider = useVelio((state) => state.openProvider);
  const bookings = useVelio((state) => state.bookings);
  const openThread = useVelio((state) => state.openThread);
  const locationOn = useVelio((state) => state.locationOn);
  const showToast = useVelio((state) => state.showToast);
  const service = serviceById(serviceId);
  const [menu, setMenu] = useState<"time" | "place" | "tags" | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [quick, setQuick] = useState<"today" | "tomorrow" | null>(null);
  const [picked, setPicked] = useState<Date | null>(null);
  const [hour, setHour] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const chosenDate = quick === "today" ? shiftDate(0) : quick === "tomorrow" ? shiftDate(1) : picked;
  const people = filterProviders({ serviceId, time, sort, area }).filter((person) => isOpenAt(person, chosenDate, hour));
  const visible = tag ? people.filter((person) => tagsOf(person).includes(tag)) : people;
  const ordered =
    serviceId === "stad" && sort === "best"
      ? [...visible].sort((a, b) => {
          const rank = ["st-cleanpro", "st-leila"];
          const ai = rank.indexOf(a.id);
          const bi = rank.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        })
      : visible;
  const live = bookings.find(
    (item) => item.serviceId === serviceId && (item.status === "accepted" || item.status === "enroute" || item.status === "scheduled"),
  );
  const acceptedBy = live ? providerById(live.providerId) : null;
  const allTags = [...new Set(people.flatMap((person) => tagsOf(person)))];
  const areas = Object.keys(areaLayout);

  if (!service) return null;
  const hero = heroes[service.id] ?? asset("/velio/hero.jpg");

  const book = (id: string) => {
    useVelio.setState({ providerId: id, sheet: "book" });
  };

  return (
    <div className={cn("bg-cream", mapMode && "flex h-full min-h-0 flex-col")}>
      <section className="relative overflow-hidden text-paper">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover object-[72%_center]" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/20 to-cream" />
        <div className="relative">
          <AppHeader tone="glass" />
          <div className="px-4">
          <h1 className="mt-1 font-serif text-[2.7rem] leading-none font-medium">{service.name}</h1>
          <p className="mt-2 max-w-[16rem] text-sm leading-snug text-paper/95">{intros[service.id]}</p>

          <div className="mt-3 flex items-center gap-3 pb-3">
            <div className="flex rounded-full bg-ink/30 p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setMapMode(false)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold",
                  !mapMode && "bg-paper text-ink",
                )}
              >
                <List className="size-4" /> Lista
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapMode(true);
                  setMenu(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold",
                  mapMode && "bg-paper text-ink",
                )}
              >
                <MapPin className="size-4" /> Karta
              </button>
            </div>
            {!mapMode ? (
              <button type="button" onClick={() => setSheet("sort")} className="ml-auto flex items-center gap-1 text-sm font-medium">
                {sortLabels[sort]}
                <ChevronDown className="size-4" />
              </button>
            ) : null}
          </div>
          </div>
        </div>
      </section>

      <div className="relative px-4 pt-3">
        <div className="flex items-center gap-2">
          <Chip icon={Calendar} label="Datum & tid" open={menu === "time"} onClick={() => setMenu(menu === "time" ? null : "time")} />
          <Chip
            icon={MapPin}
            label={area ?? "Plats"}
            open={menu === "place"}
            onClick={() => setMenu(menu === "place" ? null : "place")}
          />
          <button
            type="button"
            onClick={() => setMenu(menu === "tags" ? null : "tags")}
            className={cn(
              "ml-auto flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-sm font-medium",
              tag && "border-bronze text-bronze",
            )}
          >
            <SlidersHorizontal className="size-4" />
            Filter
          </button>
        </div>
        {menu === "time" && !mapMode ? (
          <DateTimeCard
            quick={quick}
            picked={picked}
            hour={hour}
            custom={custom}
            onQuick={(next) => {
              setQuick(next);
              setPicked(null);
            }}
            onPicked={(date) => {
              setPicked(date);
              setQuick(null);
            }}
            onHour={(next) => {
              setHour(next);
              setCustom(false);
            }}
            onCustom={(next) => {
              setHour(next);
              setCustom(true);
            }}
            onReset={() => {
              setQuick(null);
              setPicked(null);
              setHour(null);
              setCustom(false);
            }}
          />
        ) : null}
        {menu === "place" ? (
          <MenuPanel>
            <MenuItem
              label="Hela Stockholm"
              active={!area}
              onClick={() => {
                setArea(null);
                setMenu(null);
              }}
            />
            {areas.map((name) => (
              <MenuItem
                key={name}
                label={name}
                active={area === name}
                onClick={() => {
                  setArea(name);
                  setMenu(null);
                }}
              />
            ))}
          </MenuPanel>
        ) : null}
        {menu === "tags" ? (
          <MenuPanel>
            <MenuItem
              label="Alla"
              active={!tag}
              onClick={() => {
                setTag(null);
                setMenu(null);
              }}
            />
            {allTags.map((name) => (
              <MenuItem
                key={name}
                label={name}
                active={tag === name}
                onClick={() => {
                  setTag(name);
                  setMenu(null);
                }}
              />
            ))}
          </MenuPanel>
        ) : null}
      </div>

      {acceptedBy && live ? (
        <button type="button" onClick={() => openThread(acceptedBy.id)} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f3ece3] text-sm font-semibold">{acceptedBy.initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{acceptedBy.name} har accepterat</span>
            <span className="block truncate text-xs text-muted">{live.whenLabel}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#6e5636] px-3 py-1.5 text-xs font-semibold text-white">
            <MessageCircle className="size-3.5" /> Chatt
          </span>
        </button>
      ) : null}

      {mapMode ? (
        <div className="relative mt-3 min-h-0 flex-1">
          <CityMap
            people={visible}
            locationOn={locationOn}
            activeArea={area}
            activeId={focusId}
            onClear={() => setArea(null)}
            onArea={(next) => {
              setArea(next);
              const count = visible.filter((person) => person.area === next || person.place === "Hela Stockholm").length;
              showToast(`${count} utförare i ${next}`);
            }}
            onProvider={openProvider}
            onSelect={(id) => {
              setFocusId(id);
              document.getElementById(`map-card-${id}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
            }}
          />
          <div className="absolute inset-x-0 bottom-20 z-10 flex gap-3 overflow-x-auto px-3 pb-1">
            {visible.map((person) => (
              <article
                key={person.id}
                id={`map-card-${person.id}`}
                className={cn(
                  "w-[78%] shrink-0 rounded-2xl bg-paper p-2.5 shadow-md",
                  focusId === person.id && "ring-1 ring-ink/15",
                )}
              >
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => openProvider(person.id)} className="shrink-0">
                    {person.photo ? (
                      <img src={person.photo} alt="" className="size-16 rounded-xl object-cover" />
                    ) : (
                      <span className="grid size-16 place-items-center rounded-xl bg-sand font-serif text-xl">{person.initials}</span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => openProvider(person.id)} className="min-w-0 text-left">
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          <span className="truncate">{person.name}</span>
                          <BadgeCheck className="size-3.5 shrink-0 fill-gold text-paper" />
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                          <Star className="size-3 fill-gold text-gold" />
                          {ratingLabel(person.rating)} ({person.reviews}) · {person.etaMin} min
                        </span>
                      </button>
                      <span className="shrink-0 text-xs font-semibold">fr. {kr(person.price)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <MapPin className="size-3" />
                        {person.place ?? person.area}
                      </span>
                      <button
                        type="button"
                        onClick={() => (live?.providerId === person.id ? openThread(person.id) : book(person.id))}
                        className="rounded-full bg-bronze px-3 py-1 text-xs font-semibold text-paper"
                      >
                        {live?.providerId === person.id ? "Chatt" : "Boka →"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 px-4 pt-3 pb-4">
          {visible.length === 0 ? (
            <p className="rounded-2xl bg-paper px-4 py-6 text-sm text-muted">
              Ingen är ledig den dagen och tiden. Prova ett annat datum eller en annan tid.
            </p>
          ) : (
            ordered.map((person) => (
              <article key={person.id} className="rounded-[1.35rem] bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <button type="button" onClick={() => openProvider(person.id)} className="shrink-0">
                    <span className="grid size-[4.6rem] place-items-center rounded-2xl bg-[#f3ece3] font-serif text-2xl">
                      {person.initials}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => openProvider(person.id)} className="min-w-0 text-left font-semibold">
                        <span className="flex items-center gap-1">
                          <span className="truncate">{person.name}</span>
                          <BadgeCheck className="size-4 shrink-0 fill-[#c4a15a] text-white" />
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={saved[person.id] ? `Ta bort ${person.name}` : `Spara ${person.name}`}
                        onClick={() => setSaved((current) => ({ ...current, [person.id]: !current[person.id] }))}
                      >
                        <Heart className={cn("size-5", saved[person.id] && "fill-ink")} />
                      </button>
                    </div>
                    <div className="mt-0.5 flex items-start justify-between gap-2">
                      <button type="button" onClick={() => openProvider(person.id)} className="min-w-0 text-left">
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Star className="size-3.5 fill-[#c4a15a] text-[#c4a15a]" />
                          {ratingLabel(person.rating)} ({person.reviews}) · {person.etaMin} min
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <MapPin className="size-3.5" />
                          {person.place ?? person.area}
                        </span>
                      </button>
                      <span className="shrink-0 text-sm font-semibold">fr. {kr(person.price)}</span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap gap-1">
                        {tagsOf(person).slice(0, 2).map((label) => (
                          <span key={label} className="rounded-full bg-cream px-2.5 py-1 text-[11px] text-muted">
                            {label}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => (live?.providerId === person.id ? openThread(person.id) : book(person.id))}
                        className="shrink-0 rounded-full bg-[#8d7044] px-3.5 py-1.5 text-sm font-semibold text-white"
                      >
                        {live?.providerId === person.id ? "Chatt" : "Boka →"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DateTimeCard({
  quick,
  picked,
  hour,
  custom,
  onQuick,
  onPicked,
  onHour,
  onCustom,
  onReset,
}: {
  quick: "today" | "tomorrow" | null;
  picked: Date | null;
  hour: string | null;
  custom: boolean;
  onQuick: (day: "today" | "tomorrow") => void;
  onPicked: (date: Date) => void;
  onHour: (hour: string) => void;
  onCustom: (hour: string) => void;
  onReset: () => void;
}) {
  const [calendar, setCalendar] = useState(false);
  const [clock, setClock] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [draftHour, setDraftHour] = useState(9);
  const [draftMinute, setDraftMinute] = useState(0);
  const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  const dateLabel = picked && !quick ? dayStamp(picked) : "Välj datum";
  const timeLabel = custom && hour ? hour : "Annan tid";

  return (
    <div className="mt-3 rounded-[1.35rem] border border-[#efeae4] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Calendar className="size-4" />
          Välj datum
        </div>
        <button type="button" onClick={onReset} className="text-sm font-medium text-muted">
          Nollställ
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <DateChoice label="Idag" sub={dayStamp(shiftDate(0))} active={quick === "today"} onClick={() => onQuick("today")} />
        <DateChoice label="Imorgon" sub={dayStamp(shiftDate(1))} active={quick === "tomorrow"} onClick={() => onQuick("tomorrow")} />
        <button
          type="button"
          onClick={() => {
            setCalendar((open) => !open);
            setClock(false);
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-2xl border px-2 py-2 text-sm font-semibold",
            picked && !quick ? "border-[#8d7044] bg-[#8d7044] text-white" : "border-[#e6e1db] bg-white",
          )}
        >
          <Calendar className="size-4" />
          {dateLabel}
        </button>
      </div>
      {calendar ? (
        <MonthCalendar
          month={month}
          selected={picked}
          onMonth={setMonth}
          onSelect={(date) => {
            onPicked(date);
            setCalendar(false);
          }}
        />
      ) : null}
      <div className="mt-4 flex items-center gap-2 font-semibold">
        <Clock className="size-4" />
        Välj starttid
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {hours.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onHour(item)}
            className={cn(
              "rounded-2xl border py-2.5 text-sm font-medium",
              !custom && hour === item ? "border-[#8d7044] bg-[#8d7044] text-white" : "border-[#e6e1db] bg-white",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          if (hour) {
            const [nextHour, nextMinute] = hour.split(":").map(Number);
            const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
            setDraftHour(Math.min(22, Math.max(6, nextHour)));
            setDraftMinute(minutes.reduce((best, value) => (Math.abs(value - nextMinute) < Math.abs(best - nextMinute) ? value : best)));
          }
          setClock((open) => !open);
          setCalendar(false);
        }}
        className={cn(
          "mt-3 flex w-full items-center justify-between rounded-full border px-4 py-3 text-sm font-medium",
          custom ? "border-[#8d7044] bg-[#8d7044] text-white" : "border-[#e6e1db]",
        )}
      >
        {timeLabel}
        <ChevronRight className="size-4" />
      </button>
      {clock ? (
        <div className="mt-3">
          <TimeWheel hour={draftHour} minute={draftMinute} onHour={setDraftHour} onMinute={setDraftMinute} />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onCustom(`${String(draftHour).padStart(2, "0")}:${String(draftMinute).padStart(2, "0")}`);
                setClock(false);
              }}
              className="px-2 text-sm font-semibold text-[#8d7044]"
            >
              Klar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthCalendar({
  month,
  selected,
  onMonth,
  onSelect,
}: {
  month: Date;
  selected: Date | null;
  onMonth: (date: Date) => void;
  onSelect: (date: Date) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1).getDay();
  const lead = first === 0 ? 6 : first - 1;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, index) => index + 1)];
  const title = month.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  const today = shiftDate(0);

  return (
    <div className="mt-3 rounded-2xl bg-[#f6f1ea] p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Föregående månad" onClick={() => onMonth(new Date(year, monthIndex - 1, 1))} className="px-2 text-lg">
          ‹
        </button>
        <span className="text-sm font-semibold capitalize">{title}</span>
        <button type="button" aria-label="Nästa månad" onClick={() => onMonth(new Date(year, monthIndex + 1, 1))} className="px-2 text-lg">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted">
        {["M", "T", "O", "T", "F", "L", "S"].map((label, index) => (
          <span key={`${label}-${index}`} className="py-1">{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((day, index) => {
          if (!day) return <span key={`e-${index}`} />;
          const date = new Date(year, monthIndex, day);
          const active = selected && date.toDateString() === selected.toDateString();
          const isToday = date.toDateString() === today.toDateString();
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(date)}
              className={cn(
                "mx-auto my-0.5 grid size-8 place-items-center rounded-full",
                active && "bg-[#8d7044] text-white",
                !active && isToday && "ring-1 ring-[#8d7044]",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeWheel({
  hour,
  minute,
  onHour,
  onMinute,
}: {
  hour: number;
  minute: number;
  onHour: (value: number) => void;
  onMinute: (value: number) => void;
}) {
  const hours = Array.from({ length: 17 }, (_, index) => index + 6);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  return (
    <div className="relative h-44 overflow-hidden rounded-2xl bg-[#f6f1ea]">
      <div className="pointer-events-none absolute inset-x-2 top-1/2 z-0 h-9 -translate-y-1/2 rounded-xl bg-white" />
      <span className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-base font-semibold">:</span>
      <div className="relative z-10 grid h-full grid-cols-2">
        <Wheel values={hours} value={hour} onChange={onHour} />
        <Wheel values={minutes} value={minute} onChange={onMinute} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-[#f6f1ea]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-[#f6f1ea]" />
    </div>
  );
}

function Wheel({ values, value, onChange }: { values: number[]; value: number; onChange: (value: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fromUser = useRef(false);
  const item = 36;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (fromUser.current) {
      fromUser.current = false;
      return;
    }
    const index = Math.max(0, values.indexOf(value));
    node.scrollTop = index * item;
  }, [value, values]);

  return (
    <div
      ref={ref}
      onScroll={(event) => {
        const index = Math.round(event.currentTarget.scrollTop / item);
        const next = values[Math.min(values.length - 1, Math.max(0, index))];
        if (next !== undefined && next !== value) {
          fromUser.current = true;
          onChange(next);
        }
      }}
      className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="h-[70px]" />
      {values.map((itemValue) => (
        <button
          key={itemValue}
          type="button"
          onClick={() => onChange(itemValue)}
          className={cn("block h-9 w-full snap-center text-center text-base", itemValue === value ? "font-semibold text-ink" : "text-muted")}
        >
          {String(itemValue).padStart(2, "0")}
        </button>
      ))}
      <div className="h-[70px]" />
    </div>
  );
}

function DateChoice({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-2 py-2 text-center",
        active ? "border-[#8d7044] bg-[#8d7044] text-white" : "border-[#e6e1db] bg-[#fbf8f4]",
      )}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className={cn("block text-xs", active ? "text-white/80" : "text-muted")}>{sub}</span>
    </button>
  );
}

function Chip({
  icon: Icon,
  label,
  open,
  onClick,
}: {
  icon: typeof Calendar;
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex max-w-[46%] items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-2 text-sm font-medium",
        open && "border-ink",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <ChevronDown className="size-4 shrink-0 text-muted" />
    </button>
  );
}

function MenuPanel({ children }: { children: ReactNode }) {
  return <div className="absolute inset-x-4 z-10 mt-2 max-h-64 overflow-y-auto rounded-2xl bg-paper p-1 shadow-lg">{children}</div>;
}

function MenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("block w-full rounded-xl px-3 py-2.5 text-left text-sm", active ? "bg-sand font-semibold" : "hover:bg-cream")}
    >
      {label}
    </button>
  );
}
