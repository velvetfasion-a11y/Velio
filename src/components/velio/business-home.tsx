import { useState } from "react";
import { ArrowLeft, ArrowLeftRight, Briefcase, Calendar, Check, ChevronLeft, ChevronRight, Clock, Coffee, MapPin, MessageCircle, SlidersHorizontal } from "lucide-react";
import { greetingName } from "@/lib/velio/data";
import { useVelio } from "@/lib/velio/store";
import { AppHeader } from "@/components/velio/header";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/velio/asset";

type Offer = {
  id: string;
  title: string;
  place: string;
  when: string;
  tag: string;
  price: string;
  image: string;
  status: "new" | "active" | "done";
  ownerId?: string;
};

const seedOffers: Offer[] = [];

const dayLabels = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const monthLabels = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const hourOptions = Array.from({ length: 16 }, (_, index) => `${String(index + 6).padStart(2, "0")}:00`);

type DayHours = { on: boolean; from: string; to: string };

function mondayOf(offset: number) {
  const now = new Date();
  const weekday = now.getDay();
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() + (weekday === 0 ? -6 : 1 - weekday) + offset * 7);
  return monday;
}

function weekKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDays(): DayHours[] {
  return dayLabels.map((_, index) => ({ on: index < 5, from: "08:00", to: "17:00" }));
}

function weekDays(offset: number) {
  const monday = mondayOf(offset);
  return dayLabels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, num: date.getDate(), month: monthLabels[date.getMonth()], date };
  });
}

function rangeLabel(offset: number) {
  const days = weekDays(offset);
  const first = days[0];
  const last = days[6];
  if (first.month === last.month) return `${first.num} – ${last.num} ${last.month}`;
  return `${first.num} ${first.month} – ${last.num} ${last.month}`;
}

export function BusinessHome() {
  const profile = useVelio((state) => state.profile);
  const setAccountMode = useVelio((state) => state.setAccountMode);
  const showToast = useVelio((state) => state.showToast);
  const go = useVelio((state) => state.go);
  const takePostedJob = useVelio((state) => state.takePostedJob);
  const accountId = useVelio((state) => state.accountId);
  const posted = useVelio((state) => state.posted);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>(seedOffers);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [weeks, setWeeks] = useState<Record<string, DayHours[]>>({});
  const [breakOn, setBreakOn] = useState(true);
  const [breakFrom, setBreakFrom] = useState("12:00");
  const [breakTo, setBreakTo] = useState("13:00");
  const openJobs = posted.filter((job) => !skipped.includes(job.id) && job.ownerId !== accountId);
  const first = greetingName(profile.name);
  const current = weeks[weekKey(mondayOf(0))] ?? defaultDays();
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayHours = current[todayIndex];

  const newCount = offers.filter((offer) => offer.status === "new").length + openJobs.length;

  if (offersOpen) {
    return (
      <OffersPage
        offers={offers}
        posted={openJobs.map((job) => ({
          id: job.id,
          title: job.text,
          place: job.address,
          when: job.when,
          tag: job.ownerName || "Kund",
          price: `${job.price.toLocaleString("sv-SE")} kr`,
          image: job.serviceId === "ren" ? asset("/velio/tile-ren.jpg") : job.serviceId === "el" ? asset("/velio/tile-el.jpg") : job.serviceId === "trad" ? asset("/velio/tile-trad.jpg") : asset("/velio/tile-stad.jpg"),
          status: "new" as const,
          ownerId: job.ownerId,
        }))}
        onBack={() => setOffersOpen(false)}
        onTake={(id) => {
          if (offers.some((offer) => offer.id === id)) {
            setOffers(offers.map((offer) => (offer.id === id ? { ...offer, status: "active" } : offer)));
            showToast("Uppdraget är taget");
            return;
          }
          const job = posted.find((entry) => entry.id === id);
          if (!job?.ownerId) {
            showToast("Kunde inte hitta kunden");
            return;
          }
          setSkipped([...skipped, id]);
          setOffersOpen(false);
          takePostedJob(job);
        }}
        onDecline={(id) => {
          if (offers.some((offer) => offer.id === id)) setOffers(offers.filter((offer) => offer.id !== id));
          else setSkipped([...skipped, id]);
          showToast("Uppdraget är avböjt");
        }}
      />
    );
  }

  if (editing) {
    return (
      <HoursEditor
        weeks={weeks}
        setWeeks={setWeeks}
        breakOn={breakOn}
        breakFrom={breakFrom}
        breakTo={breakTo}
        setBreakOn={setBreakOn}
        setBreakFrom={setBreakFrom}
        setBreakTo={setBreakTo}
        onBack={() => setEditing(false)}
        onSave={() => {
          showToast("Jobbtider sparade");
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="bg-cream pb-4">
      <AppHeader />
      <div className="px-4">
      <div className="mt-1 flex items-center gap-3">
        <img src={asset("/velio/profile.jpg")} alt="" className="size-14 shrink-0 rounded-full object-cover object-[center_20%]" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[1.65rem] leading-none">{first ? `Hej ${first}` : "Hej"}</h1>
          <p className="mt-1 text-sm text-[#5c564f]">Arbetsläge · VELIO Business</p>
        </div>
        <button
          type="button"
          onClick={() => setAccountMode("customer")}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#e6dfd6] bg-white/80 px-3 py-2 text-left text-xs leading-tight"
        >
          <ArrowLeftRight className="size-4" />
          <span>
            Byt till
            <br />
            VELIO Customer
          </span>
        </button>
      </div>

      <button type="button" onClick={() => showToast("Inget saldo att ta ut ännu")} className="relative mt-4 block w-full overflow-hidden rounded-[1.35rem] text-left text-white">
        <img src={asset("/velio/business-home.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#3a2a1c]/85 via-[#3a2a1c]/45 to-transparent" />
        <div className="relative px-5 py-6">
          <p className="text-lg">VELIO-saldo</p>
          <p className="mt-1 flex items-center gap-1 font-serif text-5xl leading-none">
            0 kr <ChevronRight className="size-6" />
          </p>
        </div>
      </button>

      <div className="mt-3 rounded-[1.3rem] border border-[#efeae4] bg-white/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Tillgänglig för uppdrag</span>
          <button type="button" aria-pressed={open} onClick={() => setOpen(!open)} className={cn("relative h-7 w-12 rounded-full", open ? "bg-[#8a6a3d]" : "bg-[#e6dfd6]")}>
            <span className={cn("absolute top-0.5 size-6 rounded-full bg-white", open ? "right-0.5" : "left-0.5")} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-[#f0ebe6] pt-3 text-sm">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1", open ? "bg-[#e7f3e4] text-[#2f7a3a]" : "bg-[#f3ece3] text-muted")}>
            <span className={cn("size-2 rounded-full", open ? "bg-[#2f7a3a]" : "bg-muted")} />
            {open ? "Aktiv för arbete" : "Inte tillgänglig"}
          </span>
          <span className="h-5 w-px bg-[#e6dfd6]" />
          <span className="flex items-center gap-1.5 text-[#5c564f]">
            <Calendar className="size-4" />
            {todayHours?.on ? `Idag ${todayHours.from}–${todayHours.to}` : "Ledig idag"}
          </span>
        </div>
      </div>

      <button type="button" onClick={() => setOffersOpen(true)} className="mt-3 flex w-full items-center gap-3 rounded-[1.2rem] bg-[#6e5636] px-4 py-3 text-left text-white">
        <Briefcase className="size-6" strokeWidth={1.5} />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Se uppdrag</span>
          <span className="text-sm text-white/80">Nya jobb från kunder</span>
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-white/15 text-sm font-semibold">{newCount}</span>
        <ChevronRight className="size-5" />
      </button>

      <section className="mt-3 rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
        <button type="button" onClick={() => setOffersOpen(true)} className="flex w-full items-center gap-2 px-1 pb-2 text-left">
          <Briefcase className="size-4" />
          <span className="font-semibold">Pågående arbeten</span>
          <span className="ml-auto text-sm text-[#5c564f]">{offers.filter((offer) => offer.status === "active").length} aktiva</span>
          <ChevronRight className="size-4 text-muted" />
        </button>
        {offers.filter((offer) => offer.status === "active").map((job, index) => (
          <div key={job.id} className="mt-2 flex items-center gap-3 border-t border-[#f3eee8] pt-2">
            <img src={job.image} alt="" className="size-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{job.title}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#5c564f]">
                <Calendar className="size-3.5" /> {job.when}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs">
                <span className="text-[#8a6a3d]">▣</span> {job.price} · {index === 0 ? "Betald" : "Delbetald"}
                {index === 0 ? <Check className="size-3.5 text-[#2f7a3a]" /> : <Clock className="size-3.5 text-[#8a6a3d]" />}
              </p>
            </div>
            <button type="button" aria-label="Meddelanden" onClick={() => go("inbox")} className="grid size-9 place-items-center rounded-xl border border-[#efeae4]">
              <MessageCircle className="size-4" />
            </button>
          </div>
        ))}
      </section>

      <section className="mt-3 rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
        <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-2 px-1 pb-3 text-left">
          <Calendar className="size-4" />
          <span className="font-semibold">Jobb tider</span>
          <span className="ml-auto text-sm text-[#5c564f]">Denna vecka</span>
          <ChevronRight className="size-4 text-muted" />
        </button>
        <div className="grid grid-cols-7 gap-1">
          {weekDays(0).map((day, index) => (
            <button key={day.label} type="button" onClick={() => setEditing(true)} className={cn("rounded-xl py-2 text-center", current[index]?.on ? "bg-[#6e5636] text-white" : "bg-[#d9cfc3] text-[#6b645c]")}>
              <p className="text-[10px]">{day.label}</p>
              <p className="text-sm font-semibold leading-none">{day.num}</p>
              <p className="mt-0.5 text-[9px] leading-tight">{current[index]?.on ? `${current[index].from.slice(0, 2)}–${current[index].to.slice(0, 2)}` : "–"}</p>
            </button>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

function OffersPage({
  offers,
  posted,
  onBack,
  onTake,
  onDecline,
}: {
  offers: Offer[];
  posted: Offer[];
  onBack: () => void;
  onTake: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const showToast = useVelio((state) => state.showToast);
  const [tab, setTab] = useState<"new" | "active" | "done">("new");
  const fresh = [...posted, ...offers.filter((offer) => offer.status === "new")];
  const active = offers.filter((offer) => offer.status === "active");
  const done = offers.filter((offer) => offer.status === "done");
  const list = tab === "new" ? fresh : tab === "active" ? active : done;

  return (
    <div className="bg-[#f7f2eb] pb-6">
      <AppHeader />
      <div className="px-4">
      <div className="mt-1 flex items-start gap-2">
        <button type="button" aria-label="Tillbaka" onClick={onBack} className="grid size-9 shrink-0 place-items-center">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl leading-none">Se uppdrag</h1>
          <p className="mt-1 text-sm text-[#5c564f]">Nya jobb från kunder som matchar din profil.</p>
        </div>
        <button type="button" aria-label="Filter" onClick={() => showToast("Visar jobb som matchar din profil")} className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#efeae4] bg-white">
          <SlidersHorizontal className="size-5" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1 rounded-full bg-white p-1 text-sm">
        <button type="button" onClick={() => setTab("new")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 font-semibold", tab === "new" ? "bg-[#6e5636] text-white" : "")}>
          Nya uppdrag
          <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-xs", tab === "new" ? "bg-white text-[#6e5636]" : "bg-[#f3ece3]")}>{fresh.length}</span>
        </button>
        <button type="button" onClick={() => setTab("active")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2", tab === "active" ? "bg-[#6e5636] font-semibold text-white" : "")}>
          Pågående
          <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-xs", tab === "active" ? "bg-white text-[#6e5636]" : "bg-[#f3ece3]")}>{active.length}</span>
        </button>
        <span className="h-5 w-px bg-[#e6dfd6]" />
        <button type="button" onClick={() => setTab("done")} className={cn("flex-1 rounded-full px-2 py-2", tab === "done" ? "bg-[#6e5636] font-semibold text-white" : "")}>
          Avslutade
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {list.length ? list.map((job) => (
          <article key={job.id} className="rounded-[1.3rem] border border-[#efeae4] bg-white/90 p-3">
            <div className="flex gap-3">
              <img src={job.image} alt="" className="size-[4.6rem] rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{job.title}</p>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f6f1ea] px-2.5 py-1 text-sm">
                    {job.price} <ChevronRight className="size-3.5" />
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-sm text-[#5c564f]">
                  <MapPin className="size-3.5" /> {job.place}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-[#5c564f]">
                  <Calendar className="size-3.5" /> {job.when}
                </p>
                <span className="mt-1 inline-flex rounded-full bg-[#f6f1ea] px-2.5 py-0.5 text-xs">{job.tag}</span>
              </div>
            </div>
            {tab === "new" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onDecline(job.id)} className="rounded-full border border-[#e6dfd6] py-2.5 text-sm font-semibold">Avböj</button>
                <button type="button" onClick={() => onTake(job.id)} className="rounded-full bg-[#6e5636] py-2.5 text-sm font-semibold text-white">Ta uppdrag</button>
              </div>
            ) : null}
          </article>
        )) : (
          <p className="py-10 text-center text-sm text-[#5c564f]">Inga uppdrag här.</p>
        )}
      </div>
      </div>
    </div>
  );
}

function HoursEditor(props: {
  weeks: Record<string, DayHours[]>;
  setWeeks: (weeks: Record<string, DayHours[]>) => void;
  breakOn: boolean;
  breakFrom: string;
  breakTo: string;
  setBreakOn: (on: boolean) => void;
  setBreakFrom: (value: string) => void;
  setBreakTo: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const showToast = useVelio((state) => state.showToast);
  const [offset, setOffset] = useState(0);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [breakOpen, setBreakOpen] = useState(false);
  const monday = mondayOf(offset);
  const key = weekKey(monday);
  const days = props.weeks[key] ?? defaultDays();
  const dates = weekDays(offset);
  const title = offset === 0 ? "Denna vecka" : offset === 1 ? "Nästa vecka" : offset === -1 ? "Förra veckan" : rangeLabel(offset);

  const update = (index: number, patch: Partial<DayHours>) => {
    const next = days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day));
    props.setWeeks({ ...props.weeks, [key]: next });
  };

  return (
    <div className="bg-cream pb-6">
      <AppHeader />
      <div className="px-4">
      <button type="button" aria-label="Tillbaka" onClick={props.onBack} className="mt-1 grid size-9 place-items-center">
        <ArrowLeft className="size-5" />
      </button>
      <h1 className="font-serif text-4xl leading-none">Jobbtider</h1>
      <p className="mt-2 text-sm text-[#5c564f]">Välj vilka dagar och tider du är tillgänglig för uppdrag.</p>

      <div className="mt-4 flex items-center justify-between rounded-full border border-[#efeae4] bg-white/80 px-2 py-2">
        <button type="button" aria-label="Föregående vecka" onClick={() => setOffset(offset - 1)} className="grid size-8 place-items-center">
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 font-semibold">
            <Calendar className="size-4" /> {title}
          </p>
          <p className="text-sm text-[#5c564f]">{rangeLabel(offset)}</p>
        </div>
        <button type="button" aria-label="Nästa vecka" onClick={() => setOffset(offset + 1)} className="grid size-8 place-items-center">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {dates.map((date, index) => {
          const day = days[index];
          return (
            <div key={date.label} className="rounded-2xl border border-[#efeae4] bg-white/80 px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="w-14">
                  <p className="font-semibold">{date.label}</p>
                  <p className="text-xs text-[#5c564f]">
                    {date.num} {date.month}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={day.on}
                  onClick={() => update(index, { on: !day.on })}
                  className={cn("relative h-7 w-12 shrink-0 rounded-full", day.on ? "bg-[#8a6a3d]" : "bg-[#e6dfd6]")}
                >
                  <span className={cn("absolute top-0.5 size-6 rounded-full bg-white", day.on ? "right-0.5" : "left-0.5")} />
                </button>
                {day.on ? (
                  <button type="button" onClick={() => setOpenDay(openDay === index ? null : index)} className="ml-auto flex items-center gap-2 rounded-full border border-[#efeae4] px-3 py-2 text-sm">
                    {day.from} – {day.to}
                    <ChevronRight className={cn("size-4 text-muted", openDay === index && "rotate-90")} />
                  </button>
                ) : (
                  <span className="ml-auto text-sm text-[#5c564f]">Ej tillgänglig</span>
                )}
              </div>
              {day.on && openDay === index ? (
                <div className="mt-3 flex items-center gap-2">
                  <HourSelect value={day.from} onChange={(from) => update(index, { from })} />
                  <span>–</span>
                  <HourSelect value={day.to} onChange={(to) => update(index, { to })} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl border border-[#efeae4] bg-white/80 px-3 py-3">
        <div className="flex items-center gap-3">
          <Coffee className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Rast (valfritt)</span>
            <span className="block text-xs text-[#5c564f]">Lägg till en rasttid som gäller dina arbetsdagar.</span>
          </span>
          <button type="button" aria-pressed={props.breakOn} onClick={() => props.setBreakOn(!props.breakOn)} className={cn("relative h-7 w-12 shrink-0 rounded-full", props.breakOn ? "bg-[#8a6a3d]" : "bg-[#e6dfd6]")}>
            <span className={cn("absolute top-0.5 size-6 rounded-full bg-white", props.breakOn ? "right-0.5" : "left-0.5")} />
          </button>
        </div>
        {props.breakOn ? (
          <>
            <button type="button" onClick={() => setBreakOpen(!breakOpen)} className="mt-3 flex items-center gap-2 rounded-full border border-[#efeae4] px-3 py-2 text-sm">
              {props.breakFrom} – {props.breakTo}
              <span className="text-muted">✎</span>
            </button>
            {breakOpen ? (
              <div className="mt-2 flex items-center gap-2">
                <HourSelect value={props.breakFrom} onChange={props.setBreakFrom} />
                <span>–</span>
                <HourSelect value={props.breakTo} onChange={props.setBreakTo} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <button type="button" onClick={props.onSave} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#6e5636] py-3.5 font-semibold text-white">
        Spara jobbtider <Check className="size-4" />
      </button>
      </div>
    </div>
  );
}

function HourSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="flex-1 rounded-full border border-[#efeae4] bg-white px-3 py-2 text-sm">
      {hourOptions.map((hour) => (
        <option key={hour}>{hour}</option>
      ))}
    </select>
  );
}
