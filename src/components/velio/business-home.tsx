import { useEffect, useState } from "react";
import { ArrowLeftRight, Briefcase, Calendar, Check, ChevronLeft, ChevronRight, Clock, Coffee, MapPin, MessageCircle, SlidersHorizontal } from "lucide-react";
import { greetingName, serviceById, type ServiceId } from "@/lib/velio/data";
import { hoursOn, loadSchedule, sameLocalDay, saveSchedule, weekDates, withDateHours, type DayHours, type WorkSchedule } from "@/lib/velio/schedule";
import { ownBusiness, useVelio, type PostedJob } from "@/lib/velio/store";
import { AppHeader } from "@/components/velio/header";
import { ProfilePhoto } from "@/components/velio/ui";
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

function jobImage(serviceId: string) {
  if (serviceId === "el") return asset("/velio/tile-el.jpg");
  if (serviceId === "trad") return asset("/velio/tile-trad.jpg");
  if (serviceId === "ren") return asset("/velio/tile-ren.jpg");
  if (serviceId === "stad") return asset("/velio/tile-stad.jpg");
  return asset("/velio/hero.jpg");
}

const dayLabels = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const hourOptions = Array.from({ length: 16 }, (_, index) => `${String(index + 6).padStart(2, "0")}:00`);

function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function monthName(date: Date) {
  return date.toLocaleDateString("sv-SE", { month: "short" }).replace(".", "");
}

function rangeLabel(now: Date, offset: number) {
  const days = weekDates(now, offset);
  const first = days[0];
  const last = days[6];
  if (first.getMonth() === last.getMonth()) return `${first.getDate()}–${last.getDate()} ${monthName(last)}`;
  return `${first.getDate()} ${monthName(first)}–${last.getDate()} ${monthName(last)}`;
}

export function BusinessHome() {
  const profile = useVelio((state) => state.profile);
  const setAccountMode = useVelio((state) => state.setAccountMode);
  const showToast = useVelio((state) => state.showToast);
  const go = useVelio((state) => state.go);
  const takePostedJob = useVelio((state) => state.takePostedJob);
  const accountId = useVelio((state) => state.accountId);
  const loggedIn = useVelio((state) => state.loggedIn);
  const directory = useVelio((state) => state.directory);
  const listing = useVelio((state) => state.listing);
  const posted = useVelio((state) => state.posted);
  const wallet = useVelio((state) => state.wallet);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>(seedOffers);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule>({ days: [0, 1, 2, 3, 4], from: "08:00", to: "17:00", dates: {} });
  const [now, setNow] = useState<Date | null>(null);
  const [breakOn, setBreakOn] = useState(true);
  const [breakFrom, setBreakFrom] = useState("12:00");
  const [breakTo, setBreakTo] = useState("13:00");
  useEffect(() => {
    setSchedule(loadSchedule());
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 30_000);
    const onShow = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const updateSchedule = (next: WorkSchedule) => {
    setSchedule(next);
    saveSchedule(next);
  };
  const own = ownBusiness({ accountId, directory, loggedIn });
  const tradeIds: ServiceId[] = own?.serviceIds
    ? own.serviceIds
    : listing?.serviceIds
      ? listing.serviceIds
      : own?.serviceId
        ? [own.serviceId]
        : listing?.serviceId
          ? [listing.serviceId]
          : [];
  const tradeNames: string[] = tradeIds.map((id) => serviceById(id)?.name ?? "").filter((name) => name.length > 0);
  const otherTrade = own?.otherTrade || listing?.otherTrade;
  if (otherTrade) tradeNames.push(otherTrade);
  const openJobs = posted.filter((job) => !skipped.includes(job.id) && job.ownerId !== accountId && tradeIds.includes(job.serviceId));
  const first = greetingName(profile.name);
  const thisWeek = now ? weekDates(now, 0) : [];

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
          image: jobImage(job.serviceId),
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

  if (editing && now) {
    return (
      <HoursEditor
        now={now}
        schedule={schedule}
        setSchedule={updateSchedule}
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
        <ProfilePhoto />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[1.65rem] leading-none">{first ? `Hej ${first}` : "Hej"}</h1>
          <p className="mt-1 text-sm text-muted">Arbetsläge · VELIO Business</p>
        </div>
        <button
          type="button"
          onClick={() => setAccountMode("customer")}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper/80 backdrop-blur-xl px-3 py-2 text-left text-xs leading-tight"
        >
          <ArrowLeftRight className="size-4" />
          <span>
            Byt till
            <br />
            VELIO Customer
          </span>
        </button>
      </div>

      <button type="button" onClick={() => go("wallet")} className="relative mt-4 block w-full overflow-hidden rounded-[1.35rem] text-left text-white">
        <img src={asset("/velio/business-home.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-brown/85 via-brown/45 to-transparent" />
        <div className="relative px-5 py-6">
          <p className="text-lg">VELIO-saldo</p>
          <p className="mt-1 flex items-center gap-1 font-serif text-5xl leading-none">
            {wallet.available.toLocaleString("sv-SE")} kr <ChevronRight className="size-6" />
          </p>
          <p className="mt-2 max-w-[16rem] text-sm text-white/85">Öppna utbetalningar. Väntande belopp släpps 3 timmar efter jobbet.</p>
        </div>
      </button>

      <button type="button" onClick={() => setOffersOpen(true)} className="mt-3 flex w-full items-center gap-3 rounded-[1.2rem] bg-brown px-4 py-3 text-left text-white">
        <Briefcase className="size-6" strokeWidth={1.5} />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Se uppdrag</span>
          <span className="text-sm text-white/80">Nya jobb från kunder</span>
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-white/15 text-sm font-semibold">{newCount}</span>
        <ChevronRight className="size-5" />
      </button>

      <section className="mt-3 rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
        <button type="button" onClick={() => setOffersOpen(true)} className="flex w-full items-center gap-2 px-1 pb-2 text-left">
          <Briefcase className="size-4" />
          <span className="font-semibold">Pågående arbeten</span>
          <span className="ml-auto text-sm text-muted">{offers.filter((offer) => offer.status === "active").length} aktiva</span>
          <ChevronRight className="size-4 text-muted" />
        </button>
        {offers.filter((offer) => offer.status === "active").map((job, index) => (
          <div key={job.id} className="mt-2 flex items-center gap-3 border-t border-line pt-2">
            <img src={job.image} alt="" className="size-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{job.title}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Calendar className="size-3.5" /> {job.when}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs">
                <span className="text-bronze">▣</span> {job.price} · {index === 0 ? "Betald" : "Delbetald"}
                {index === 0 ? <Check className="size-3.5 text-ok" /> : <Clock className="size-3.5 text-bronze" />}
              </p>
            </div>
            <button type="button" aria-label="Meddelanden" onClick={() => go("inbox")} className="grid size-9 place-items-center rounded-xl border border-line">
              <MessageCircle className="size-4" />
            </button>
          </div>
        ))}
      </section>

      <section className="mt-3 rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
        <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-2 px-1 pb-3 text-left">
          <Calendar className="size-4" />
          <span className="font-semibold">Jobb tider</span>
          <span className="ml-auto text-sm text-muted">{now ? rangeLabel(now, 0) : "Denna vecka"}</span>
          <ChevronRight className="size-4 text-muted" />
        </button>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", open ? "bg-ok/15 text-ok" : "bg-sand text-muted")}>
            <span className={cn("size-2 rounded-full", open ? "bg-ok" : "bg-muted")} />
            {open ? "Aktiv för arbete" : "Inte tillgänglig"}
          </span>
          <button
            type="button"
            aria-label="Tillgänglig för uppdrag"
            aria-pressed={open}
            onClick={() => setOpen(!open)}
            className={cn("relative h-7 w-12 shrink-0 rounded-full", open ? "bg-bronze" : "bg-line")}
          >
            <span className={cn("absolute top-0.5 size-6 rounded-full bg-white", open ? "right-0.5" : "left-0.5")} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {thisWeek.map((date) => {
            const hours = hoursOn(schedule, date);
            const isToday = now ? sameLocalDay(date, now) : false;
            return (
              <button
                key={date.toDateString()}
                type="button"
                onClick={() => now && setEditing(true)}
                className={cn(
                  "rounded-xl py-2 text-center",
                  hours.on ? "bg-brown text-white" : "bg-sand text-muted",
                  isToday && "ring-2 ring-ok ring-offset-1",
                )}
              >
                <p className="text-[10px]">{isToday ? "Idag" : dayLabels[weekdayIndex(date)]}</p>
                <p className="text-sm font-semibold leading-none">{date.getDate()}</p>
                <p className="mt-0.5 text-[9px] leading-tight">{hours.on ? `${hours.from.slice(0, 2)}–${hours.to.slice(0, 2)}` : "–"}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <h2 className="min-w-0 font-serif text-[1.35rem] leading-tight font-medium">
            {tradeNames.length === 1 ? `Uppdrag inom ${tradeNames[0]}` : "Uppdrag i dina yrken"}
          </h2>
          {openJobs.length ? (
            <button type="button" onClick={() => setOffersOpen(true)} className="shrink-0 text-sm text-muted">
              Visa alla →
            </button>
          ) : null}
        </div>
        {tradeNames.length > 1 ? <p className="mb-2 px-1 text-sm text-muted">{tradeNames.join(" · ")}</p> : null}
        {tradeNames.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-line bg-paper/75 backdrop-blur-xl px-4 py-5">
            <p className="font-semibold">Publicera ditt yrke</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Uppdrag inom el, städning och dina andra yrken visas här när profilen är publicerad.</p>
          </div>
        ) : openJobs.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-line bg-paper/75 backdrop-blur-xl px-4 py-5">
            <p className="font-semibold">Inga uppdrag inom {tradeNames.join(", ") || "ditt yrke"} just nu</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">När en kund postar ett jobb i ditt yrke syns det här.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {openJobs.map((job) => (
              <JobMiniCard key={job.id} job={job} onOpen={() => setOffersOpen(true)} />
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function JobMiniCard({ job, onOpen }: { job: PostedJob; onOpen: () => void }) {
  const trade = serviceById(job.serviceId)?.name ?? "Uppdrag";
  return (
    <button type="button" onClick={onOpen} className="relative w-[8.6rem] shrink-0 overflow-hidden rounded-2xl bg-sand text-left">
      <img src={jobImage(job.serviceId)} alt="" className="aspect-[4/5] w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sand via-sand/95 to-transparent px-2.5 pt-8 pb-2.5">
        <span className="line-clamp-2 block text-sm leading-tight font-semibold">{job.text}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted">{trade}</span>
      </span>
    </button>
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
    <div className="bg-cream pb-6">
      <AppHeader onBack={onBack} />
      <div className="px-4">
      <div className="mt-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl leading-none">Se uppdrag</h1>
          <p className="mt-1 text-sm text-muted">Nya jobb från kunder som matchar din profil.</p>
        </div>
        <button type="button" aria-label="Filter" onClick={() => showToast("Visar jobb som matchar din profil")} className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line bg-white">
          <SlidersHorizontal className="size-5" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1 rounded-full bg-white p-1 text-sm">
        <button type="button" onClick={() => setTab("new")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 font-semibold", tab === "new" ? "bg-brown text-white" : "")}>
          Nya uppdrag
          <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-xs", tab === "new" ? "bg-white text-brown" : "bg-sand")}>{fresh.length}</span>
        </button>
        <button type="button" onClick={() => setTab("active")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2", tab === "active" ? "bg-brown font-semibold text-white" : "")}>
          Pågående
          <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-xs", tab === "active" ? "bg-white text-brown" : "bg-sand")}>{active.length}</span>
        </button>
        <span className="h-5 w-px bg-line" />
        <button type="button" onClick={() => setTab("done")} className={cn("flex-1 rounded-full px-2 py-2", tab === "done" ? "bg-brown font-semibold text-white" : "")}>
          Avslutade
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {list.length ? list.map((job) => (
          <article key={job.id} className="rounded-[1.3rem] border border-line bg-paper/90 backdrop-blur-xl p-3">
            <div className="flex gap-3">
              <img src={job.image} alt="" className="size-[4.6rem] rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{job.title}</p>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-sm">
                    {job.price} <ChevronRight className="size-3.5" />
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="size-3.5" /> {job.place}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                  <Calendar className="size-3.5" /> {job.when}
                </p>
                <span className="mt-1 inline-flex rounded-full bg-sand px-2.5 py-0.5 text-xs">{job.tag}</span>
              </div>
            </div>
            {tab === "new" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onDecline(job.id)} className="rounded-full border border-line py-2.5 text-sm font-semibold">Avböj</button>
                <button type="button" onClick={() => onTake(job.id)} className="rounded-full bg-brown py-2.5 text-sm font-semibold text-white">Skicka offert</button>
              </div>
            ) : null}
          </article>
        )) : (
          <p className="py-10 text-center text-sm text-muted">Inga uppdrag här.</p>
        )}
      </div>
      </div>
    </div>
  );
}

function HoursEditor(props: {
  now: Date;
  schedule: WorkSchedule;
  setSchedule: (schedule: WorkSchedule) => void;
  breakOn: boolean;
  breakFrom: string;
  breakTo: string;
  setBreakOn: (on: boolean) => void;
  setBreakFrom: (value: string) => void;
  setBreakTo: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [breakOpen, setBreakOpen] = useState(false);
  const dates = weekDates(props.now, offset);
  const title = offset === 0 ? "Denna vecka" : offset === 1 ? "Nästa vecka" : offset === -1 ? "Förra veckan" : rangeLabel(props.now, offset);

  const update = (date: Date, patch: Partial<DayHours>) => {
    const current = hoursOn(props.schedule, date);
    props.setSchedule(withDateHours(props.schedule, date, { ...current, ...patch }));
  };

  return (
    <div className="bg-cream pb-6">
      <AppHeader onBack={props.onBack} />
      <div className="px-4">
      <h1 className="mt-2 font-serif text-4xl leading-none">Jobbtider</h1>
      <p className="mt-2 text-sm text-muted">Välj vilka dagar och tider du är tillgänglig för uppdrag.</p>

      <div className="mt-4 flex items-center justify-between rounded-full border border-line bg-paper/80 backdrop-blur-xl px-2 py-2">
        <button type="button" aria-label="Föregående vecka" onClick={() => setOffset(offset - 1)} className="grid size-8 place-items-center">
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 font-semibold">
            <Calendar className="size-4" /> {title}
          </p>
          <p className="text-sm text-muted">{rangeLabel(props.now, offset)}</p>
        </div>
        <button type="button" aria-label="Nästa vecka" onClick={() => setOffset(offset + 1)} className="grid size-8 place-items-center">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {dates.map((date, index) => {
          const day = hoursOn(props.schedule, date);
          const isToday = sameLocalDay(date, props.now);
          return (
            <div key={date.toDateString()} className={cn("rounded-2xl border bg-paper/80 backdrop-blur-xl px-3 py-3", isToday ? "border-ok" : "border-line")}>
              <div className="flex items-center gap-3">
                <div className="w-16">
                  <p className="font-semibold">{isToday ? "Idag" : dayLabels[weekdayIndex(date)]}</p>
                  <p className="text-xs text-muted">
                    {date.getDate()} {monthName(date)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={day.on}
                  onClick={() => update(date, { on: !day.on })}
                  className={cn("relative h-7 w-12 shrink-0 rounded-full", day.on ? "bg-bronze" : "bg-line")}
                >
                  <span className={cn("absolute top-0.5 size-6 rounded-full bg-white", day.on ? "right-0.5" : "left-0.5")} />
                </button>
                {day.on ? (
                  <button type="button" onClick={() => setOpenDay(openDay === index ? null : index)} className="ml-auto flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm">
                    {day.from} – {day.to}
                    <ChevronRight className={cn("size-4 text-muted", openDay === index && "rotate-90")} />
                  </button>
                ) : (
                  <span className="ml-auto text-sm text-muted">Ej tillgänglig</span>
                )}
              </div>
              {day.on && openDay === index ? (
                <div className="mt-3 flex items-center gap-2">
                  <HourSelect value={day.from} onChange={(from) => update(date, { from })} />
                  <span>–</span>
                  <HourSelect value={day.to} onChange={(to) => update(date, { to })} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-paper/80 backdrop-blur-xl px-3 py-3">
        <div className="flex items-center gap-3">
          <Coffee className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Rast (valfritt)</span>
            <span className="block text-xs text-muted">Lägg till en rasttid som gäller dina arbetsdagar.</span>
          </span>
          <button type="button" aria-pressed={props.breakOn} onClick={() => props.setBreakOn(!props.breakOn)} className={cn("relative h-7 w-12 shrink-0 rounded-full", props.breakOn ? "bg-bronze" : "bg-line")}>
            <span className={cn("absolute top-0.5 size-6 rounded-full bg-white", props.breakOn ? "right-0.5" : "left-0.5")} />
          </button>
        </div>
        {props.breakOn ? (
          <>
            <button type="button" onClick={() => setBreakOpen(!breakOpen)} className="mt-3 flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm">
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

      <button type="button" onClick={props.onSave} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brown py-3.5 font-semibold text-white">
        Spara jobbtider <Check className="size-4" />
      </button>
      </div>
    </div>
  );
}

function HourSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="flex-1 rounded-full border border-line bg-white px-3 py-2 text-sm">
      {hourOptions.map((hour) => (
        <option key={hour}>{hour}</option>
      ))}
    </select>
  );
}
