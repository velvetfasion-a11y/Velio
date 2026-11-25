import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Calculator,
  Check,
  ChevronDown,
  Clock,
  ClipboardList,
  Eye,
  Flower2,
  Hammer,
  Heart,
  KeyRound,
  LayoutGrid,
  Leaf,
  Lightbulb,
  MapPin,
  Navigation,
  Paintbrush,
  Paperclip,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SprayCan,
  Star,
  UserRound,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { greetingName, providerById, providerTradeNames, ratingLabel, serviceById, services, type ServiceIcon, type ServiceId } from "@/lib/velio/data";
import { useVelio } from "@/lib/velio/store";
import { AppHeader, PlaceLink } from "@/components/velio/header";
import { cn } from "@/lib/cn";
import { BottomSheet, Btn, StepProgress, TrustNote } from "@/components/velio/ui";
import { asset } from "@/lib/velio/asset";

const icons: Record<ServiceIcon, LucideIcon> = {
  zap: Zap,
  sparkles: Sparkles,
  leaf: Leaf,
  wrench: Wrench,
  shield: Shield,
  hammer: Hammer,
  user: UserRound,
  calculator: Calculator,
  key: KeyRound,
  eye: Eye,
};

const popular: { id: ServiceId; label: string; icon: LucideIcon; image: string }[] = [
  { id: "stad", label: "Städning", icon: SprayCan, image: asset("/velio/stad.jpg") },
  { id: "ren", label: "Renovering", icon: Paintbrush, image: asset("/velio/ren.jpg") },
  { id: "el", label: "Elektriker", icon: Lightbulb, image: asset("/velio/el.jpg") },
  { id: "trad", label: "Trädgård", icon: Flower2, image: asset("/velio/trad.jpg") },
  { id: "rep", label: "Reparationer", icon: Wrench, image: asset("/velio/rep.jpg") },
  { id: "per", label: "Personal", icon: Users, image: asset("/velio/per.jpg") },
  { id: "sak", label: "Säkerhet", icon: Shield, image: asset("/velio/sak.jpg") },
  { id: "til", label: "Tillsyn & Service", icon: ClipboardList, image: asset("/velio/til.jpg") },
];

export function ServiceIcon({ name, className }: { name: ServiceIcon; className?: string }) {
  const Icon = icons[name];
  return <Icon className={className} aria-hidden="true" />;
}

export function CategoryGrid({ compact = false, filter = true }: { compact?: boolean; filter?: boolean }) {
  const openService = useVelio((state) => state.openService);
  const search = useVelio((state) => state.search);
  const query = filter ? search.trim().toLowerCase() : "";
  const visible = services.filter(
    (service) => !query || service.name.toLowerCase().includes(query) || service.desc.toLowerCase().includes(query),
  );

  if (!visible.length) {
    return <p className="mb-6 text-sm text-muted">Inga tjänster matchar “{search.trim()}”.</p>;
  }

  return (
    <div className={cn(compact ? "mb-6 flex gap-3 overflow-x-auto pb-1" : "mb-7 grid grid-cols-4 gap-x-2 gap-y-4")}>
      {visible.map((service) => (
        <button
          key={service.id}
          type="button"
          onClick={() => openService(service.id)}
          className={cn("flex flex-col items-center gap-2 text-center", compact && "w-20 shrink-0")}
        >
          <span className="grid size-14 place-items-center rounded-full bg-ink text-paper">
            <ServiceIcon name={service.icon} className="size-6" />
          </span>
          <span className="text-xs leading-tight font-semibold">{service.name}</span>
        </button>
      ))}
    </div>
  );
}

export function Home() {
  const search = useVelio((state) => state.search);
  const setSearch = useVelio((state) => state.setSearch);
  const setSheet = useVelio((state) => state.setSheet);
  const openService = useVelio((state) => state.openService);
  const go = useVelio((state) => state.go);
  const profile = useVelio((state) => state.profile);
  const directory = useVelio((state) => state.directory);
  const favorites = useVelio((state) => state.favorites);
  const toggleFavorite = useVelio((state) => state.toggleFavorite);
  const firstName = greetingName(profile.name);
  const [showAll, setShowAll] = useState(false);
  const query = search.trim().toLowerCase();
  const cards = popular.filter((item) => !query || item.label.toLowerCase().includes(query));
  const extra = services.filter((service) => !popular.some((item) => item.id === service.id));
  const people = directory.filter(
    (person) =>
      !query ||
      person.name.toLowerCase().includes(query) ||
      person.area.toLowerCase().includes(query) ||
      serviceById(person.serviceId)?.name.toLowerCase().includes(query) ||
      person.serviceIds?.some((id) => serviceById(id)?.name.toLowerCase().includes(query)) ||
      person.otherTrade?.toLowerCase().includes(query),
  );

  return (
    <div className="bg-cream">
      <section className="relative">
        <div className="relative h-52 overflow-hidden text-paper">
          <img src={asset("/velio/hero.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/25 to-ink/60" />
          <div className="relative">
            <AppHeader tone="glass" />
            <div className="px-5 pt-2 pb-8">
              <h1 className="ios-title scrim-text text-[2.15rem] text-paper">
                {firstName ? `Hej ${firstName}` : "Hej"}
              </h1>
              <p className="scrim-text mt-2 max-w-[18rem] text-[15px] leading-snug text-paper">
                Hitta rätt person för jobbet – snabbt, säkert och enkelt.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 -mt-6 px-4">
          <label className="glass flex min-h-14 items-center gap-2 rounded-full px-4 text-ink">
            <Search className="size-5 shrink-0 text-brown" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Sök tjänst, t.ex. städning, elektriker..."
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
            <button type="button" aria-label="Filter" onClick={() => setSheet("filters")} className="grid size-10 place-items-center rounded-full text-ink">
              <SlidersHorizontal className="size-5" />
            </button>
          </label>
          <button
            type="button"
            onClick={() => setSheet("job")}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brown text-[15px] font-semibold text-paper shadow-soft"
          >
            Skapa uppdrag
          </button>
          <div className="mt-3 grid grid-cols-3 gap-2 pb-1 text-[11px] text-ink">
            <Trust icon={Zap} label="Snabbt & enkelt" />
            <Trust icon={ShieldCheck} label="Trygga tjänsteutövare" />
            <Trust icon={Star} label="Betyg & omdömen" />
          </div>
        </div>
      </section>

      <section className="px-4 pt-1">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="ios-section text-[1.35rem]">Populära tjänster</h2>
          <button type="button" onClick={() => setShowAll((value) => !value)} className="text-sm text-muted">
            {showAll ? "Visa färre" : "Visa alla →"}
          </button>
        </div>
        {cards.length ? (
          <div className="grid grid-cols-4 gap-2.5">
            {cards.map((item) => (
              <PhotoTile key={item.id} label={item.label} image={item.image} icon={item.icon} onClick={() => openService(item.id)} />
            ))}
            {showAll
              ? extra
                  .filter((service) => !query || service.name.toLowerCase().includes(query))
                  .map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => openService(service.id)}
                      className="flex aspect-[4/5] flex-col items-start justify-end rounded-2xl bg-sand p-2 text-left"
                    >
                      <ServiceIcon name={service.icon} className="mb-2 size-6" />
                      <span className="text-sm leading-tight font-semibold">{service.name}</span>
                    </button>
                  ))
              : null}
          </div>
        ) : (
          <p className="text-sm text-muted">Inga tjänster matchar “{search.trim()}”.</p>
        )}
      </section>

      <section className="px-4 pt-4">
        <button
          type="button"
          onClick={() => setSheet("job")}
          className="flex w-full items-center gap-3 rounded-[1.4rem] border border-line bg-paper p-3 text-left shadow-soft"
        >
          <img src={asset("/velio/notebook.jpg")} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
          <span className="min-w-0">
            <span className="ios-section block text-[1.05rem]">Behöver du hjälp redan idag?</span>
            <span className="mt-1 block text-[13px] leading-snug text-muted">
              Posta ditt uppdrag och få svar från tillgängliga proffs direkt.
            </span>
          </span>
        </button>
      </section>

      <section className="px-4 pt-4 pb-2">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="ios-section min-w-0 text-[1.2rem]">Tjänsteutövare nära dig</h2>
          <button type="button" onClick={() => go("profile")} className="shrink-0 text-sm text-muted">
            Bli utförare →
          </button>
        </div>
        {people.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-line bg-paper/60 px-4 py-5">
            <p className="font-semibold">Inga publicerade profiler ännu</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              VELIO visar bara riktiga personer. Skapa ett konto, verifiera dig och publicera din profil — eller posta ett uppdrag så att utförare kan hitta dig.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => go("profile")} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                Skapa profil
              </button>
              <button type="button" onClick={() => setSheet("job")} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">
                Posta uppdrag
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {people.map((provider) => (
              <ProviderCard
                key={provider.id}
                name={provider.name}
                rating={provider.rating}
                reviews={provider.reviews}
                photo={provider.photo ?? ""}
                saved={favorites.includes(provider.id)}
                onSave={() => toggleFavorite(provider.id)}
                onOpen={() => useVelio.getState().openProvider(provider.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Trust({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-paper px-1.5 py-2 text-center shadow-soft">
      <Icon className="size-3.5 shrink-0 text-brown" />
      <span className="leading-tight font-medium">{label}</span>
    </div>
  );
}

function PhotoTile({
  label,
  image,
  icon: Icon,
  onClick,
}: {
  label: string;
  image: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="relative aspect-[4/5] overflow-hidden rounded-2xl text-left">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/80 via-ink/35 to-transparent" />
      <span className="scrim-text absolute right-1.5 bottom-2 left-1.5 flex flex-col items-start gap-1 text-[13px] leading-tight font-semibold text-paper">
        <Icon className="size-5 shrink-0" />
        {label}
      </span>
    </button>
  );
}

function ProviderCard({
  name,
  rating,
  reviews,
  photo,
  saved,
  onSave,
  onOpen,
}: {
  name: string;
  rating: number;
  reviews: number;
  photo: string;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="relative w-[10.5rem] shrink-0 overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-soft">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {photo ? (
          <img src={photo} alt="" className="h-24 w-full object-cover object-[center_18%]" />
        ) : (
          <div className="grid h-24 w-full place-items-center bg-sand text-2xl font-semibold text-brown">{name.slice(0, 1)}</div>
        )}
        <div className="px-2.5 py-2.5">
          <div className="truncate text-sm font-semibold text-ink">{name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <Star className="size-3 fill-gold text-gold" />
            {ratingLabel(rating)} ({reviews})
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label={saved ? `Ta bort ${name}` : `Spara ${name}`}
        onClick={onSave}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-paper/85 text-ink"
      >
        <Heart className={cn("size-3.5", saved && "fill-ink")} />
      </button>
    </div>
  );
}

export function SearchScreen() {
  const search = useVelio((state) => state.search);
  const setSearch = useVelio((state) => state.setSearch);
  const openService = useVelio((state) => state.openService);
  const openProvider = useVelio((state) => state.openProvider);
  const query = search.trim().toLowerCase();
  const matched = popular.filter((item) => !query || item.label.toLowerCase().includes(query));

  return (
    <div className="bg-cream px-4 pt-4">
      <h1 className="ios-title mb-3 text-[2.15rem]">Sök</h1>
      <label className="mb-5 flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-3">
        <Search className="size-5 text-muted" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Sök tjänst, t.ex. städning, elektriker, renovering..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      <div className="grid grid-cols-4 gap-2.5">
        {matched.map((item) => (
          <PhotoTile key={item.id} label={item.label} image={item.image} icon={item.icon} onClick={() => openService(item.id)} />
        ))}
      </div>
      <ProviderHits query={query} onOpen={openProvider} />
    </div>
  );
}

function ProviderHits({ query, onOpen }: { query: string; onOpen: (id: string) => void }) {
  const directory = useVelio((state) => state.directory);
  if (!query) return null;
  const hits = directory.filter(
    (provider) =>
      provider.name.toLowerCase().includes(query) ||
      serviceById(provider.serviceId)?.name.toLowerCase().includes(query) ||
      provider.serviceIds?.some((id) => serviceById(id)?.name.toLowerCase().includes(query)) ||
      provider.otherTrade?.toLowerCase().includes(query),
  );
  if (!hits.length) return <p className="mt-4 text-sm text-muted">Inga träffar bland publicerade profiler.</p>;
  return (
    <div className="mt-4 space-y-2">
      {hits.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => onOpen(provider.id)}
          className="flex w-full items-center justify-between rounded-2xl bg-paper px-4 py-3 text-left"
        >
          <span>
            <span className="block font-semibold">{provider.name}</span>
            <span className="text-sm text-muted">{providerTradeNames(provider).join(" · ")}</span>
          </span>
          <span className="text-sm">{ratingLabel(provider.rating)}</span>
        </button>
      ))}
    </div>
  );
}

export function InboxScreen() {
  const chats = useVelio((state) => state.chats);
  const peers = useVelio((state) => state.peers);
  const bookings = useVelio((state) => state.bookings);
  const openThread = useVelio((state) => state.openThread);
  const closeSheet = useVelio((state) => state.closeSheet);
  const go = useVelio((state) => state.go);

  useEffect(() => {
    // Meddelanden is always the conversation list — never keep a chat sheet open here.
    closeSheet();
  }, [closeSheet]);

  // Include booked providers even if a thread was never seeded (e.g. older sessions).
  const bookingPeerIds = bookings
    .filter((item) => item.status === "accepted" || item.status === "enroute" || item.status === "scheduled" || item.status === "requested")
    .map((item) => item.providerId);

  const threadIds = Array.from(
    new Set([...Object.keys(chats), ...Object.keys(peers), ...bookingPeerIds].filter(Boolean)),
  ).filter((id) => (chats[id]?.length ?? 0) > 0 || bookingPeerIds.includes(id));

  const threads = threadIds
    .map((providerId) => {
      const messages = chats[providerId] ?? [];
      const last = messages[messages.length - 1];
      const booking = bookings.find((item) => item.providerId === providerId);
      return { providerId, messages, last, booking };
    })
    .sort((a, b) => {
      const aTime = a.last?.time || "";
      const bTime = b.last?.time || "";
      if (aTime || bTime) return bTime.localeCompare(aTime);
      return (b.booking?.whenLabel || "").localeCompare(a.booking?.whenLabel || "");
    });

  return (
    <div className="bg-cream">
      <AppHeader />
      <div className="px-4 pt-5 pb-8">
        <h1 className="ios-title mb-2 text-[2.15rem]">Meddelanden</h1>
        <p className="mb-4 text-sm text-muted">Håll kontakten i VELIO. Dela inte personnummer och betala inte utanför appen.</p>
        {threads.length === 0 ? (
          <div>
            <p className="text-sm text-muted">Inga meddelanden ännu.</p>
            <button type="button" onClick={() => go("home")} className="mt-4 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper">
              Hitta uppdrag
            </button>
          </div>
        ) : null}
        <div className="space-y-3">
          {threads.map(({ providerId, messages, last, booking }) => {
            const provider = providerById(providerId);
            const peer = peers[providerId];
            const name = provider?.name ?? peer?.name ?? "Kontakt";
            const initials =
              provider?.initials ??
              name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
            const card = [...messages].reverse().find((message) => message.card)?.card;
            const active = (provider?.etaMin ?? 99) <= 20;
            const presence =
              card?.kind === "enroute"
                ? "På väg"
                : card?.kind === "done"
                  ? "På plats"
                  : active
                    ? "Aktiv nu"
                    : provider
                      ? `Om ${provider.etaMin} min`
                      : "Chatt";
            const preview =
              last?.text ||
              (last?.card?.kind === "request"
                ? "Bokningsförfrågan"
                : last?.card
                  ? "Uppdatering i chatten"
                  : booking
                    ? booking.status === "accepted"
                      ? "Bokning accepterad — öppna chatten"
                      : "Bokningsförfrågan"
                    : "Öppna konversationen");
            return (
              <button
                key={providerId}
                type="button"
                onClick={() => openThread(providerId, peer && !provider ? { accountId: peer.id } : undefined)}
                className="flex w-full items-start gap-3 rounded-[1.4rem] border border-line bg-paper/50 px-3 py-3 text-left"
              >
                {provider?.photo ? (
                  <img src={provider.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sand text-sm font-semibold">
                    {initials || "—"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 font-semibold">
                      <span className="truncate">{name}</span>
                      {provider ? <BadgeCheck className="size-4 shrink-0 fill-gold text-paper" /> : null}
                    </span>
                    <span className={cn("flex shrink-0 items-center gap-1.5 text-sm font-medium", active ? "text-ok" : "text-muted")}>
                      <span className={cn("size-2 rounded-full", active ? "bg-ok" : "bg-muted")} />
                      {presence}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{preview}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function HomeSheets() {
  const sheet = useVelio((state) => state.sheet);
  if (sheet === "menu") return <MenuSheet />;
  if (sheet === "job") return <JobSheet />;
  if (sheet === "filters") return <FilterSheet />;
  return null;
}

function MenuSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const setSheet = useVelio((state) => state.setSheet);
  const go = useVelio((state) => state.go);
  return (
    <BottomSheet title="Meny" onClose={closeSheet}>
      <div className="space-y-2">
        <Btn variant="secondary" onClick={() => setSheet("location")}>Dela plats</Btn>
        <Btn variant="secondary" onClick={() => go("history")}>Bokningar</Btn>
        <Btn variant="secondary" onClick={() => go("profile")}>Profil</Btn>
        <Btn variant="secondary" onClick={() => go("help")}>Hjälp</Btn>
      </div>
    </BottomSheet>
  );
}

function JobSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const showToast = useVelio((state) => state.showToast);
  const addPosted = useVelio((state) => state.addPosted);
  const userLocation = useVelio((state) => state.userLocation);
  const locationOn = useVelio((state) => state.locationOn);
  const [serviceId, setServiceId] = useState<ServiceId>("stad");
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [time, setTime] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const stepNames = ["Tjänst", "Beskrivning", "Tid", "Plats", "Budget", "Granska"];
  const featured: { id: ServiceId; name: string; image: string }[] = [
    { id: "stad", name: "Städning", image: asset("/velio/tile-stad.jpg") },
    { id: "ren", name: "Renovering", image: asset("/velio/tile-ren.jpg") },
    { id: "el", name: "Elektriker", image: asset("/velio/tile-el.jpg") },
    { id: "trad", name: "Trädgård", image: asset("/velio/tile-trad.jpg") },
  ];
  const extra = services.filter((service) => !featured.some((item) => item.id === service.id));
  const hours = Array.from({ length: 14 }, (_, index) => `${String(index + 7).padStart(2, "0")}:00`);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(closeSheet, 1200);
    return () => window.clearTimeout(timer);
  }, [done, closeSheet]);

  const advance = () => {
    if (step === 1 && text.trim().length < 8) return showToast("Beskriv uppdraget lite till");
    if (step === 2 && (!dateLabel || !time)) return showToast("Välj datum och tid");
    if (step === 3 && address.trim().length < 3) return showToast("Ange en adress");
    if (step === 4 && budget && !/^\d+$/.test(budget)) return showToast("Skriv budget i hela kronor, eller lämna tomt");
    setStep((current) => Math.min(5, current + 1));
  };

  const publish = () => {
    if (text.trim().length < 8) return showToast("Beskriv uppdraget lite till");
    if (!dateLabel || !time) return showToast("Välj datum och tid");
    if (address.trim().length < 3) return showToast("Ange en adress");
    const price = budget ? Number(budget) : 0;
    const attached = files.length ? `\n\nBifogat: ${files.join(", ")}` : "";
    addPosted({
      serviceId,
      text: `${text.trim()}${attached}`,
      when: `${dateLabel}, ${time}`,
      address: address.trim(),
      rate: price > 0 ? "fixed" : "hour",
      price,
    });
    setDone(true);
  };

  const serviceName = services.find((item) => item.id === serviceId)?.name ?? "Tjänst";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-cream">
      <div className="px-4 pt-3">
        <PlaceLink />
        <div className="mt-1 flex items-center">
          <button
            type="button"
            aria-label="Tillbaka"
            onClick={() => (step === 0 ? closeSheet() : setStep(step - 1))}
            className="grid size-10 place-items-center rounded-full"
          >
            <ArrowLeft className="size-5" />
          </button>
          <p className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</p>
          <span className="size-10" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <StepProgress step={step + 1} total={6} label={stepNames[step]} />
        <h1 className="ios-title text-[1.85rem]">
          {step === 0 ? "Vad behöver du hjälp med?" : step === 1 ? "Beskriv uppdraget" : step === 2 ? "När ska det göras?" : step === 3 ? "Var ska det utföras?" : step === 4 ? "Ungefärlig budget" : "Granska och publicera"}
        </h1>
        <p className="mt-2 text-sm leading-snug text-muted">
          {step === 4
            ? "Budgeten är en riktlinje. Du betalar när jobbet är klart, och inget dras om arbetet inte utförs."
            : "Kort steg för steg. Du kan gå tillbaka och ändra innan du publicerar."}
        </p>
        <div className="mt-4 space-y-3">
        {step === 0 ? (
        <section className="rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
          <div className="mb-3 flex items-start gap-2">
            <LayoutGrid className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Tjänst</p>
              <p className="text-sm text-muted">Välj vilken typ av hjälp du behöver.</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {featured.map((item) => (
              <button key={item.id} type="button" onClick={() => setServiceId(item.id)} className={cn("relative w-[4.6rem] shrink-0 overflow-hidden rounded-2xl text-white", serviceId === item.id ? "ring-2 ring-brown" : "")}>
                <img src={item.image} alt="" className="h-[5.4rem] w-full object-cover" />
                <span className={cn("absolute inset-0", serviceId === item.id ? "bg-brown/50" : "bg-gradient-to-t from-black/55 to-transparent")} />
                {serviceId === item.id ? (
                  <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-white text-brown">
                    <Check className="size-3" />
                  </span>
                ) : null}
                <span className="absolute inset-x-1 bottom-1.5 text-center text-[11px] font-semibold">{item.name}</span>
              </button>
            ))}
            <button type="button" onClick={() => setMore(!more)} className="grid h-[5.4rem] w-[4.6rem] shrink-0 place-items-center rounded-2xl border border-line bg-cream text-center text-[11px] leading-tight">
              <LayoutGrid className="size-5" />
              Fler
              <br />
              tjänster
            </button>
          </div>
          {more ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {extra.map((service) => (
                <button key={service.id} type="button" onClick={() => setServiceId(service.id)} className={cn("rounded-full border px-3 py-1.5 text-sm", serviceId === service.id ? "border-brown bg-brown text-white" : "border-line")}>
                  {service.name}
                </button>
              ))}
            </div>
          ) : null}
        </section>
        ) : null}

        {step === 1 ? (
        <section className="rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
          <div className="mb-2 flex items-start gap-2">
            <ClipboardList className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Beskriv uppdraget</p>
              <p className="text-sm text-muted">Berätta kort vad som ska göras.</p>
            </div>
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} placeholder="T.ex. flyttstädning av 3 rum och kök." className="w-full rounded-2xl border border-line px-3 py-3 text-sm outline-none" />
        </section>
        ) : null}

        {step === 2 ? (
        <section className="rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
          <div className="mb-2 flex items-start gap-2">
            <Calendar className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Datum & tid</p>
              <p className="text-sm text-muted">När vill du att uppdraget utförs?</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setDateOpen(!dateOpen); setTimeOpen(false); }} className="flex items-center gap-2 rounded-full border border-line px-3 py-2.5 text-sm">
              <Calendar className="size-4" />
              <span className="flex-1 truncate text-left">{dateLabel || "Välj datum"}</span>
              <ChevronDown className="size-4 text-muted" />
            </button>
            <button type="button" onClick={() => { setTimeOpen(!timeOpen); setDateOpen(false); }} className="flex items-center gap-2 rounded-full border border-line px-3 py-2.5 text-sm">
              <Clock className="size-4" />
              <span className="flex-1 text-left">{time || "Välj tid"}</span>
              <ChevronDown className="size-4 text-muted" />
            </button>
          </div>
          {dateOpen ? (
            <MiniDate
              onPick={(label) => {
                setDateLabel(label);
                setDateOpen(false);
              }}
            />
          ) : null}
          {timeOpen ? (
            <div className="mt-2 grid max-h-40 grid-cols-4 gap-1 overflow-y-auto">
              {hours.map((hour) => (
                <button key={hour} type="button" onClick={() => { setTime(hour); setTimeOpen(false); }} className={cn("rounded-full py-1.5 text-sm", time === hour ? "bg-brown text-white" : "bg-sand")}>
                  {hour}
                </button>
              ))}
            </div>
          ) : null}
        </section>
        ) : null}

        {step === 3 ? (
        <section className="rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
          <div className="mb-2 flex items-start gap-2">
            <MapPin className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Plats</p>
              <p className="text-sm text-muted">Var ska uppdraget utföras?</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line px-3">
            <MapPin className="size-4 shrink-0 text-muted" />
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Ange adress" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" />
            <button
              type="button"
              aria-label="Använd delad plats"
              onClick={() => {
                if (locationOn && userLocation?.label) setAddress(userLocation.label);
                else showToast("Dela plats högst upp, eller skriv adressen");
              }}
              className="text-muted"
            >
              <Navigation className="size-4" />
            </button>
          </div>
        </section>
        ) : null}

        {step === 1 ? (
        <section className="flex items-center gap-2 rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
          <Paperclip className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Bifoga (valfritt)</span>
            <span className="block text-sm text-muted">{files.length ? files.join(", ") : "Lägg till bilder eller filer som hjälper."}</span>
          </span>
          <label className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-line text-lg">
            +
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(event) => {
                const name = event.target.files?.[0]?.name;
                if (name) setFiles((current) => [...current, name]);
                event.target.value = "";
              }}
            />
          </label>
        </section>
        ) : null}

        {step === 4 ? (
          <section className="rounded-[1.3rem] border border-line bg-paper p-3 shadow-soft">
            <p className="font-semibold">Budget</p>
            <p className="text-sm text-muted">Valfritt. Lämna tomt om ni ska komma överens i chatten.</p>
            <label className="mt-3 flex items-center gap-2 rounded-2xl border border-line px-4">
              <input
                inputMode="numeric"
                value={budget}
                onChange={(event) => setBudget(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="1500"
                aria-label="Budget i kronor"
                className="h-12 min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
              />
              <span className="text-sm font-semibold text-muted">kr</span>
            </label>
            <div className="mt-3">
              <TrustNote>Betalningen hålls tills jobbet är klart. Kvitto sparas i appen.</TrustNote>
            </div>
          </section>
        ) : null}
        {step === 5 ? (
          <section className="space-y-2 rounded-[1.3rem] border border-line bg-paper p-4 text-sm shadow-soft">
            <ReviewRow label="Tjänst" value={serviceName} />
            <ReviewRow label="Beskrivning" value={text.trim()} />
            <ReviewRow label="När" value={dateLabel && time ? `${dateLabel}, ${time}` : "—"} />
            <ReviewRow label="Plats" value={address.trim() || "—"} />
            <ReviewRow label="Budget" value={budget ? `${budget} kr` : "Enligt överenskommelse"} />
            <ReviewRow label="Bilder" value={files.length ? files.join(", ") : "Inga"} />
          </section>
        ) : null}
        </div>
      </div>
      <div className="flex gap-2 border-t border-line bg-cream/90 px-4 py-3 backdrop-blur-xl">
        {step < 5 ? (
          <button type="button" onClick={advance} className="h-12 flex-1 rounded-full bg-brown text-base font-semibold text-paper">
            Nästa
          </button>
        ) : (
          <button type="button" onClick={publish} className="h-12 flex-1 rounded-full bg-brown text-base font-semibold text-paper">
            Publicera uppdrag
          </button>
        )}
      </div>
      {done ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-cream/80">
          <div className="velio-klart flex flex-col items-center gap-3">
            <span className="grid size-24 place-items-center rounded-full bg-brown text-white shadow-lg">
              <Check className="size-12" strokeWidth={2.4} />
            </span>
            <span className="font-serif text-3xl">Klart</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="max-w-[14rem] text-right font-medium">{value}</span>
    </div>
  );
}

function MiniDate({ onPick }: { onPick: (label: string) => void }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const start = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(start).fill(0), ...Array.from({ length: count }, (_, index) => index + 1)];
  const names = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  const short = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return (
    <div className="mt-2 rounded-2xl bg-sand p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Föregående månad">‹</button>
        <span className="capitalize">{names[month]} {year}</span>
        <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Nästa månad">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted">
        {["M", "T", "O", "T", "F", "L", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-sm">
        {cells.map((day, index) => (
          <button key={index} type="button" disabled={!day} onClick={() => onPick(`${day} ${short[month]}`)} className="py-1.5 disabled:opacity-0">
            {day || ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const openService = useVelio((state) => state.openService);
  return (
    <BottomSheet title="Filtrera" onClose={closeSheet}>
      <div className="grid grid-cols-2 gap-2">
        {popular.map((item) => (
          <Btn key={item.id} variant="secondary" onClick={() => openService(item.id)}>
            {item.label}
          </Btn>
        ))}
      </div>
    </BottomSheet>
  );
}
