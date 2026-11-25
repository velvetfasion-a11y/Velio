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
import { providerById, ratingLabel, serviceById, services, type ServiceIcon, type ServiceId } from "@/lib/velio/data";
import { useVelio } from "@/lib/velio/store";
import { AppHeader } from "@/components/velio/header";
import { cn } from "@/lib/cn";
import { BottomSheet, Btn } from "@/components/velio/ui";

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
  { id: "stad", label: "Städning", icon: SprayCan, image: "/velio/stad.jpg" },
  { id: "ren", label: "Renovering", icon: Paintbrush, image: "/velio/ren.jpg" },
  { id: "el", label: "Elektriker", icon: Lightbulb, image: "/velio/el.jpg" },
  { id: "trad", label: "Trädgård", icon: Flower2, image: "/velio/trad.jpg" },
  { id: "rep", label: "Reparationer", icon: Wrench, image: "/velio/rep.jpg" },
  { id: "per", label: "Personal", icon: Users, image: "/velio/per.jpg" },
  { id: "sak", label: "Säkerhet", icon: Shield, image: "/velio/sak.jpg" },
  { id: "til", label: "Tillsyn & Service", icon: ClipboardList, image: "/velio/til.jpg" },
];

const featured = [
  { id: "ren-ali", photo: "/velio/ali.jpg?v=3" },
  { id: "st-cleanpro", photo: "/velio/clean.jpg?v=3" },
  { id: "tr-gron", photo: "/velio/garden.jpg?v=3" },
];

const moreProviders = ["el-erik", "st-sofia", "tr-johan"];

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
  const profile = useVelio((state) => state.profile);
  const firstName = profile.name.split(" ")[0] || "Anna";
  const [showAll, setShowAll] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const query = search.trim().toLowerCase();
  const cards = popular.filter((item) => !query || item.label.toLowerCase().includes(query));
  const extra = services.filter((service) => !popular.some((item) => item.id === service.id));
  const people = [...featured, ...(showMore ? moreProviders.map((id) => ({ id, photo: "" })) : [])];

  return (
    <div className="bg-cream">
      <section className="relative overflow-hidden text-paper">
        <img src="/velio/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/35 via-ink/10 to-cream" />
        <div className="relative pb-2">
          <AppHeader tone="glass" />
          <div className="px-4">
          <h1 className="mt-2 font-serif text-[2.55rem] leading-none font-medium tracking-tight">Hej {firstName}</h1>
          <p className="mt-2 max-w-[15.5rem] text-sm leading-snug text-paper/95">
            Hitta rätt person för jobbet – snabbt, säkert och enkelt.
          </p>

          <label className="mt-4 flex items-center gap-2 rounded-full bg-paper px-4 py-3 text-ink shadow-lg">
            <Search className="size-5 shrink-0 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Sök tjänst, t.ex. städning, elektriker, renovering..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
            <button type="button" aria-label="Filter" onClick={() => setSheet("filters")} className="text-ink">
              <SlidersHorizontal className="size-5" />
            </button>
          </label>

          <div className="mt-3 grid grid-cols-3 gap-1 pb-3 text-[11px] text-paper">
            <Trust icon={Zap} label="Snabbt & enkelt" />
            <Trust icon={ShieldCheck} label="Trygga tjänsteutövare" split />
            <Trust icon={Star} label="Betyg & omdömen" />
          </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-1">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-[1.55rem] leading-none font-medium">Populära tjänster</h2>
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
          className="relative block h-36 w-full overflow-hidden rounded-[1.4rem] bg-ink text-left text-paper"
        >
          <img src="/velio/notebook.jpg" alt="" className="absolute top-0 right-0 h-full w-[62%] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/88 to-ink/10" />
          <div className="relative flex h-full max-w-[15rem] flex-col justify-center px-5">
            <div className="font-serif text-[1.45rem] leading-none font-medium">Behöver du hjälp redan idag?</div>
            <p className="mt-2 text-xs leading-snug text-paper/80">
              Posta ditt uppdrag och få svar från tillgängliga proffs direkt.
            </p>
            <span className="mt-3 inline-flex w-fit items-center rounded-full bg-wheat px-3.5 py-2 text-xs font-semibold text-ink">
              Skapa uppdrag →
            </span>
          </div>
        </button>
      </section>

      <section className="px-4 pt-4 pb-2">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="min-w-0 font-serif text-[1.35rem] leading-tight font-medium">Rekommenderade tjänsteutövare</h2>
          <button type="button" onClick={() => setShowMore(true)} className="shrink-0 text-sm text-muted">
            Visa fler →
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {people.map((item) => {
            const provider = providerById(item.id);
            if (!provider) return null;
            return (
              <ProviderCard
                key={item.id}
                name={provider.name}
                rating={provider.rating}
                reviews={provider.reviews}
                photo={item.photo}
                saved={Boolean(saved[item.id])}
                onSave={() => setSaved((current) => ({ ...current, [item.id]: !current[item.id] }))}
                onOpen={() => useVelio.getState().openProvider(item.id)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Trust({ icon: Icon, label, split = false }: { icon: LucideIcon; label: string; split?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5 px-1 text-center", split && "border-x border-paper/30")}>
      <Icon className="size-3.5 shrink-0" />
      <span className="leading-tight">{label}</span>
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
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/5 to-transparent" />
      <span className="absolute right-1.5 bottom-2 left-1.5 flex flex-col items-start gap-1 text-[13px] leading-tight font-semibold text-paper">
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
    <div className="relative w-[7.15rem] shrink-0 overflow-hidden rounded-2xl bg-sand">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {photo ? (
          <img src={photo} alt="" className="aspect-[4/5] w-full object-cover object-[center_18%]" />
        ) : (
          <div className="grid aspect-[4/5] w-full place-items-center bg-sand font-serif text-3xl">{name.slice(0, 1)}</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cream via-cream/95 to-transparent px-2.5 pt-8 pb-2.5">
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
      <h1 className="mb-3 font-serif text-4xl font-medium">Sök</h1>
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
  if (!query) return null;
  const hits = ["ren-ali", "st-cleanpro", "tr-gron", "el-erik", "st-sofia", "tr-johan"]
    .map((id) => providerById(id))
    .filter((provider) => provider && (provider.name.toLowerCase().includes(query) || serviceById(provider.serviceId)?.name.toLowerCase().includes(query)));
  if (!hits.length) return <p className="mt-4 text-sm text-muted">Inga träffar.</p>;
  return (
    <div className="mt-4 space-y-2">
      {hits.map((provider) =>
        provider ? (
          <button
            key={provider.id}
            type="button"
            onClick={() => onOpen(provider.id)}
            className="flex w-full items-center justify-between rounded-2xl bg-paper px-4 py-3 text-left"
          >
            <span>
              <span className="block font-semibold">{provider.name}</span>
              <span className="text-sm text-muted">{serviceById(provider.serviceId)?.name}</span>
            </span>
            <span className="text-sm">{ratingLabel(provider.rating)}</span>
          </button>
        ) : null,
      )}
    </div>
  );
}

export function InboxScreen() {
  const chats = useVelio((state) => state.chats);
  const peers = useVelio((state) => state.peers);
  const openThread = useVelio((state) => state.openThread);
  const threads = Object.entries(chats).filter(([, messages]) => messages.length);

  return (
    <div className="bg-cream">
      <AppHeader />
      <div className="px-4 pt-5">
        <h1 className="mb-5 font-serif text-[2.6rem] leading-none font-medium">Meddelanden</h1>
        {threads.length === 0 ? <p className="text-sm text-muted">Inga meddelanden ännu.</p> : null}
        <div className="space-y-3">
          {threads.map(([providerId, messages]) => {
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
            const last = messages[messages.length - 1];
            const card = [...messages].reverse().find((message) => message.card)?.card;
            const active = (provider?.etaMin ?? 99) <= 20;
            const presence = card?.kind === "enroute" ? "På väg" : card?.kind === "done" ? "På plats" : active ? "Aktiv nu" : provider ? `Om ${provider.etaMin} min` : "Synkad";
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
                  <span className="mt-0.5 block truncate text-sm text-muted">{last?.text}</span>
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
  if (sheet === "notes") return <NotesSheet />;
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
  const [serviceId, setServiceId] = useState<ServiceId>("stad");
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [time, setTime] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const featured: { id: ServiceId; name: string; image: string }[] = [
    { id: "stad", name: "Städning", image: "/velio/tile-stad.jpg" },
    { id: "ren", name: "Renovering", image: "/velio/tile-ren.jpg" },
    { id: "el", name: "Elektriker", image: "/velio/tile-el.jpg" },
    { id: "trad", name: "Trädgård", image: "/velio/tile-trad.jpg" },
  ];
  const extra = services.filter((service) => !featured.some((item) => item.id === service.id));
  const hours = Array.from({ length: 14 }, (_, index) => `${String(index + 7).padStart(2, "0")}:00`);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(closeSheet, 1200);
    return () => window.clearTimeout(timer);
  }, [done, closeSheet]);

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-[#f7f2eb] pb-8">
      <div className="relative px-4 pt-4">
        <img src="/velio/post-hero.jpg" alt="" className="pointer-events-none absolute top-0 right-0 h-36 w-[58%] object-cover" />
        <div className="pointer-events-none absolute top-0 right-0 h-36 w-[58%] bg-gradient-to-l from-transparent to-[#f7f2eb]" />
        <div className="relative flex items-center">
          <button type="button" aria-label="Tillbaka" onClick={closeSheet} className="grid size-9 place-items-center">
            <ArrowLeft className="size-5" />
          </button>
          <p className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</p>
          <span className="size-9" />
        </div>
        <h1 className="relative mt-4 max-w-[16rem] font-serif text-4xl leading-none">Lägg upp ett uppdrag</h1>
        <p className="relative mt-2 max-w-[16rem] text-sm leading-snug">Beskriv vad du behöver hjälp med så matchar vi dig med tillgängliga tjänsteutövare.</p>
      </div>

      <div className="relative mt-4 space-y-3 px-4">
        <section className="rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
          <div className="mb-3 flex items-start gap-2">
            <LayoutGrid className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Tjänst</p>
              <p className="text-sm text-[#5c564f]">Välj vilken typ av hjälp du behöver.</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {featured.map((item) => (
              <button key={item.id} type="button" onClick={() => setServiceId(item.id)} className={cn("relative w-[4.6rem] shrink-0 overflow-hidden rounded-2xl text-white", serviceId === item.id ? "ring-2 ring-[#6e5636]" : "")}>
                <img src={item.image} alt="" className="h-[5.4rem] w-full object-cover" />
                <span className={cn("absolute inset-0", serviceId === item.id ? "bg-[#6e5636]/50" : "bg-gradient-to-t from-black/55 to-transparent")} />
                {serviceId === item.id ? (
                  <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-white text-[#6e5636]">
                    <Check className="size-3" />
                  </span>
                ) : null}
                <span className="absolute inset-x-1 bottom-1.5 text-center text-[11px] font-semibold">{item.name}</span>
              </button>
            ))}
            <button type="button" onClick={() => setMore(!more)} className="grid h-[5.4rem] w-[4.6rem] shrink-0 place-items-center rounded-2xl border border-[#efeae4] bg-[#f7f2eb] text-center text-[11px] leading-tight">
              <LayoutGrid className="size-5" />
              Fler
              <br />
              tjänster
            </button>
          </div>
          {more ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {extra.map((service) => (
                <button key={service.id} type="button" onClick={() => setServiceId(service.id)} className={cn("rounded-full border px-3 py-1.5 text-sm", serviceId === service.id ? "border-[#6e5636] bg-[#6e5636] text-white" : "border-[#efeae4]")}>
                  {service.name}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
          <div className="mb-2 flex items-start gap-2">
            <ClipboardList className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Beskriv uppdraget</p>
              <p className="text-sm text-[#5c564f]">Berätta kort vad som ska göras.</p>
            </div>
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="T.ex. flyttstädning av 3 rum och kök." className="w-full rounded-2xl border border-[#efeae4] px-3 py-3 text-sm outline-none" />
        </section>

        <section className="rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
          <div className="mb-2 flex items-start gap-2">
            <Calendar className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Datum & tid</p>
              <p className="text-sm text-[#5c564f]">När vill du att uppdraget utförs?</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setDateOpen(!dateOpen); setTimeOpen(false); }} className="flex items-center gap-2 rounded-full border border-[#efeae4] px-3 py-2.5 text-sm">
              <Calendar className="size-4" />
              <span className="flex-1 truncate text-left">{dateLabel || "Välj datum"}</span>
              <ChevronDown className="size-4 text-muted" />
            </button>
            <button type="button" onClick={() => { setTimeOpen(!timeOpen); setDateOpen(false); }} className="flex items-center gap-2 rounded-full border border-[#efeae4] px-3 py-2.5 text-sm">
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
                <button key={hour} type="button" onClick={() => { setTime(hour); setTimeOpen(false); }} className={cn("rounded-full py-1.5 text-sm", time === hour ? "bg-[#6e5636] text-white" : "bg-[#f6f1ea]")}>
                  {hour}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
          <div className="mb-2 flex items-start gap-2">
            <MapPin className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">Plats</p>
              <p className="text-sm text-[#5c564f]">Var ska uppdraget utföras?</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#efeae4] px-3">
            <MapPin className="size-4 shrink-0 text-[#5c564f]" />
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Ange adress" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" />
            <button type="button" aria-label="Använd plats" onClick={() => setAddress("Strandvägen 12, Stockholm")} className="text-[#5c564f]">
              <Navigation className="size-4" />
            </button>
          </div>
        </section>

        <section className="flex items-center gap-2 rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
          <Paperclip className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Bifoga (valfritt)</span>
            <span className="block text-sm text-[#5c564f]">{files.length ? files.join(", ") : "Lägg till bilder eller filer som hjälper."}</span>
          </span>
          <label className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#efeae4] text-lg">
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

        <button
          type="button"
          onClick={() => {
            if (text.trim().length < 8) return showToast("Beskriv uppdraget lite till");
            if (!dateLabel || !time) return showToast("Välj datum och tid");
            if (address.trim().length < 3) return showToast("Ange en adress");
            addPosted({
              serviceId,
              text: text.trim(),
              when: `${dateLabel}, ${time}`,
              address: address.trim(),
              rate: "hour",
              price: 0,
            });
            setDone(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6e5636] py-3.5 text-base font-semibold text-white"
        >
          Publicera uppdrag <span aria-hidden>→</span>
        </button>
      </div>
      {done ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#f7f2eb]/80">
          <div className="velio-klart flex flex-col items-center gap-3">
            <span className="grid size-24 place-items-center rounded-full bg-[#6e5636] text-white shadow-lg">
              <Check className="size-12" strokeWidth={2.4} />
            </span>
            <span className="font-serif text-3xl">Klart</span>
          </div>
        </div>
      ) : null}
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
    <div className="mt-2 rounded-2xl bg-[#f6f1ea] p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Föregående månad">‹</button>
        <span className="capitalize">{names[month]} {year}</span>
        <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Nästa månad">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-[#5c564f]">
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

function NotesSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const openThread = useVelio((state) => state.openThread);
  const chats = useVelio((state) => state.chats);
  const last = chats["st-cleanpro"]?.[chats["st-cleanpro"].length - 1];
  return (
    <BottomSheet title="Notiser" onClose={closeSheet}>
      {last ? (
        <button
          type="button"
          onClick={() => openThread("st-cleanpro")}
          className="w-full rounded-2xl bg-soft px-4 py-3 text-left"
        >
          <span className="block font-semibold">CleanPro</span>
          <span className="text-sm text-muted">{last.text}</span>
        </button>
      ) : (
        <p className="text-sm text-muted">Inga nya notiser.</p>
      )}
    </BottomSheet>
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
