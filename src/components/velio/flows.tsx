import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, FileText, Star, Bell, ArrowLeft, Heart, BadgeCheck, Shield, Calendar, MessageCircle, Clock, ChevronDown, ChevronRight, MapPin, Camera, Wrench, Phone, Ellipsis, Plus, Navigation, ClipboardCheck, Car, Check, Coins, CreditCard, Mic, Send, Briefcase, Search, Pencil, Ban, ClipboardList, Headphones, X, type LucideIcon } from "lucide-react";
import {
  kr,
  providerById,
  ratingLabel,
  serviceById,
  sortLabels,
  whenOptions,
  type SortKey,
} from "@/lib/velio/data";
import { useVelio, bookingStatusLabel, type Booking, type ChatMsg } from "@/lib/velio/store";
import { cn } from "@/lib/cn";
import { AppHeader } from "@/components/velio/header";
import { CityMap } from "@/components/velio/osm-map";
import { Avatar, BottomSheet, Btn, FullScreen } from "@/components/velio/ui";
import { asset } from "@/lib/velio/asset";

const EMPTY_CHAT: ChatMsg[] = [];

function receiptText(booking: Booking) {
  const service = serviceById(booking.serviceId);
  const provider = providerById(booking.providerId);
  return [
    "VELIO",
    service?.name ?? "Tjänst",
    provider?.name ?? "",
    booking.whenLabel,
    booking.location,
    `Kostnad: ${kr(booking.cost)}`,
    booking.tip != null ? `Dricks: ${kr(booking.tip)}` : "",
    booking.rating != null ? `Betyg: ${ratingLabel(booking.rating)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function download(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const serviceLine: Record<string, string> = {
  sak: "Säkerhet & bevakning",
  el: "El & installation",
  stad: "Städning",
  trad: "Trädgård & skötsel",
  rep: "Reparationer",
  ren: "Renovering",
  per: "Personal",
  eko: "Ekonomi",
  ank: "Ankomstservice",
  til: "Tillsyn & service",
};

const tagIcon: Record<string, LucideIcon> = {
  Bevakning: Shield,
  Larm: Bell,
  Event: Calendar,
  Personskydd: Shield,
  Patrullering: MapPin,
  Trygghetsjour: Clock,
  Kamera: Camera,
  Installation: Wrench,
};

export function ProviderSheet() {
  const providerId = useVelio((state) => state.providerId);
  const closeSheet = useVelio((state) => state.closeSheet);
  const setSheet = useVelio((state) => state.setSheet);
  const openChat = useVelio((state) => state.openChat);
  const [saved, setSaved] = useState(false);
  const provider = providerById(providerId);
  if (!provider) return null;
  const service = serviceById(provider.serviceId);
  const available = provider.etaMin <= 20;
  const tags = provider.tags ?? [];

  return (
    <div className="sheet-in absolute inset-0 z-30 overflow-y-auto bg-cream">
      <section className="relative overflow-hidden">
        <img src={asset("/velio/hero-bookings.jpg")} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover object-center blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/10 to-cream" />
        <div className="relative text-paper">
          <AppHeader tone="glass" />
          <div className="mt-1 flex items-center justify-between px-4 pb-2">
            <button type="button" aria-label="Tillbaka" onClick={closeSheet} className="grid size-10 place-items-center rounded-full border border-paper/50">
              <ArrowLeft className="size-5" />
            </button>
            <div className="relative">
              {provider.photo ? (
                <img src={provider.photo} alt="" className="size-36 rounded-[1.6rem] border-4 border-paper object-cover shadow-lg" />
              ) : (
                <span className="grid size-36 place-items-center rounded-[1.6rem] border-4 border-paper bg-sand font-serif text-4xl shadow-lg">
                  {provider.initials}
                </span>
              )}
              <span className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full bg-gold text-paper">
                <BadgeCheck className="size-5 fill-gold text-paper" />
              </span>
            </div>
            <button
              type="button"
              aria-label={saved ? `Ta bort ${provider.name}` : `Spara ${provider.name}`}
              onClick={() => setSaved((value) => !value)}
              className="grid size-10 place-items-center rounded-full border border-paper/50"
            >
              <Heart className={saved ? "size-5 fill-paper" : "size-5"} />
            </button>
          </div>
        </div>
      </section>

      <div className="px-5 pt-2 pb-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-serif text-[2.4rem] leading-none font-medium">
              {provider.name}
              <BadgeCheck className="size-6 shrink-0 fill-gold text-paper" />
            </h2>
            <p className="mt-2 text-sm text-muted">
              {serviceLine[provider.serviceId] ?? service?.name} · {provider.place ?? provider.area}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <span className="mt-1 h-10 w-px bg-line" />
            <div className="text-right">
              <div className="text-lg font-semibold">fr. {kr(provider.price)}</div>
              <div className="mt-1 flex items-center justify-end gap-1.5 text-sm font-medium text-ok">
                <span className="size-2 rounded-full bg-ok" />
                {available ? "Tillgänglig nu" : `Om ${provider.etaMin} min`}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex gap-0.5" aria-label={`${provider.rating} av 5`}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} className={index < Math.round(provider.rating) ? "size-4 fill-ink text-ink" : "size-4 text-ink"} />
            ))}
          </span>
          <span className="font-semibold">{ratingLabel(provider.rating)}</span>
          <span className="text-muted">({provider.reviews} recensioner)</span>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-lg font-semibold">Om</h3>
          <p className="mt-1 text-sm leading-relaxed">{provider.about}</p>
        </div>

        {tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((label) => {
              const Icon = tagIcon[label] ?? Shield;
              return (
                <span key={label} className="flex items-center gap-1.5 rounded-full border border-line bg-paper/60 px-3 py-1.5 text-sm">
                  <Icon className="size-3.5" />
                  {label}
                </span>
              );
            })}
          </div>
        ) : null}

        <button type="button" onClick={() => setSheet("book")} className="mt-5 w-full rounded-full bg-bronze py-3.5 text-base font-semibold text-paper">
          Boka nu →
        </button>
        <button type="button" onClick={openChat} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 py-3.5 text-base font-semibold">
          <MessageCircle className="size-5" />
          Skicka meddelande
        </button>

        <div className="mt-4 rounded-2xl bg-sand/70 p-4">
          <span className="inline-flex gap-0.5">
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} className="size-4 fill-ink text-ink" />
            ))}
          </span>
          <p className="mt-2 text-sm leading-relaxed italic">“{provider.quote}”</p>
          <p className="mt-3 text-sm text-muted">
            {provider.reviewer} · {provider.reviewAgo}
          </p>
        </div>
      </div>
    </div>
  );
}

function presence(messages: ChatMsg[]) {
  const card = [...messages].reverse().find((message) => message.card)?.card;
  if (card?.kind === "enroute") return { label: "På väg", moving: true };
  if (card?.kind === "done") return { label: "På plats", moving: false };
  return { label: "Aktiv nu", moving: false };
}

export function ChatSheet() {
  const providerId = useVelio((state) => state.providerId);
  const chats = useVelio((state) => state.chats);
  const peers = useVelio((state) => state.peers);
  const sendChat = useVelio((state) => state.sendChat);
  const setSheet = useVelio((state) => state.setSheet);
  const closeSheet = useVelio((state) => state.closeSheet);
  const go = useVelio((state) => state.go);
  const showToast = useVelio((state) => state.showToast);
  const openReceipt = useVelio((state) => state.openReceipt);
  const appendChat = useVelio((state) => state.appendChat);
  const answerTakeRequest = useVelio((state) => state.answerTakeRequest);
  const cancelBooking = useVelio((state) => state.cancelBooking);
  const bookings = useVelio((state) => state.bookings);
  const accountMode = useVelio((state) => state.accountMode);
  const provider = providerById(providerId);
  const peer = providerId ? peers[providerId] : null;
  const service = provider ? serviceById(provider.serviceId) : null;
  const messages = providerId ? (chats[providerId] ?? []) : [];
  const [draft, setDraft] = useState("");
  const [help, setHelp] = useState<null | "menu" | "report" | "detail" | "change" | "rebook" | "problem" | "sure">(null);
  const [issue, setIssue] = useState("");
  const [note, setNote] = useState("");
  const [changeDate, setChangeDate] = useState<Date | null>(null);
  const [changeTime, setChangeTime] = useState("");
  const [rebookWhen, setRebookWhen] = useState<(typeof whenOptions)[number]>(whenOptions[0]);
  const scroller = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lastId, messages.length]);

  const backToInbox = () => {
    closeSheet();
    go("inbox");
  };

  if (accountMode === "business") return <WorkerChat onClose={backToInbox} />;
  if (!provider && !peer) return null;
  if (!provider && peer) {
    return <SyncedPeerChat peerName={peer.name} messages={messages} draft={draft} setDraft={setDraft} onSend={() => { if (!draft.trim()) return; sendChat(draft); setDraft(""); }} onClose={backToInbox} />;
  }
  if (!provider) return null;
  const status = presence(messages);
  const paid = messages.some((message) => message.card?.kind === "paid");
  const cancelled = messages.reduce((locked, message) => {
    if (message.card?.kind === "cancelled") return true;
    if (message.card?.kind === "rebook" && message.card.status === "accepted") return false;
    return locked;
  }, false);
  const live = bookings.find((item) => item.providerId === provider.id && item.status !== "done");
  const booking = live ?? bookings.find((item) => item.providerId === provider.id);
  const finished = !cancelled && paid && !live;
  const jobTitle = service?.id === "stad" ? "Hemstädning" : service?.name ?? "Uppdrag";
  const jobWhen = (booking?.whenLabel ?? "Idag, 14:00").replace(/\s*[–-]\s*\d{1,2}:\d{2}.*$/, "");
  const jobPlace = booking?.location ? (booking.location.includes(",") ? booking.location : `${booking.location}, Stockholm`) : `${provider.area}, Stockholm`;
  const issues = [
    { icon: Ban, label: "Utföraren kom inte", id: "noshow" },
    { icon: Clock, label: "Utföraren blev sen", id: "late" },
    { icon: Briefcase, label: "Arbetet utfördes inte som avtalat", id: "quality" },
    { icon: CreditCard, label: "Problem med pris eller betalning", id: "pay" },
    { icon: MessageCircle, label: "Annat problem", id: "other" },
    { icon: Headphones, label: "Kundtjänst", id: "support" },
  ];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f7f3ee]">
      <div className="px-4 pt-3">
        <div className="flex items-center">
          <button type="button" aria-label="Tillbaka" onClick={backToInbox} className="grid size-9 place-items-center">
            <ArrowLeft className="size-5" />
          </button>
          <button type="button" onClick={() => { closeSheet(); go("home"); }} className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</button>
          <button type="button" aria-label="Ring" onClick={() => showToast(`Ringer ${provider.name.split(" ")[0]}…`)} className="grid size-9 place-items-center">
            <Phone className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Notiser"
            onClick={() => {
              closeSheet();
              go("notifications");
            }}
            className="relative grid size-9 place-items-center"
          >
            <Bell className="size-5" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-gold" />
          </button>
          <button type="button" aria-label="Mer" onClick={() => setHelp("menu")} className="grid size-9 place-items-center">
            <Ellipsis className="size-5" />
          </button>
        </div>
        <button type="button" onClick={() => setSheet("provider")} className="mt-1 flex w-full items-center gap-3 py-1 text-left">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f3ece3] text-sm font-semibold">{provider.initials}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-lg font-semibold">
              {provider.name}
              <BadgeCheck className="size-4 fill-[#c4a15a] text-[#f7f3ee]" />
            </span>
            <span className="flex items-center gap-1.5 text-sm text-[#5c564f]">
              {service?.name}
              <span className="size-1.5 rounded-full bg-[#3d8f4a]" />
              <span className={cancelled ? "text-[#5c564f]" : "text-[#3d8f4a]"}>{cancelled ? "Avbokad" : finished ? "Klar" : status.label}</span>
            </span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </button>
        <div className="mt-2 rounded-[1.2rem] border border-[#efeae4] bg-white/80 p-2.5">
          <div className="flex gap-3">
            <img src={service?.id === "stad" ? asset("/velio/tile-stad.jpg") : asset(`/velio/${service?.id ?? "stad"}.jpg`)} alt="" className="size-16 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{jobTitle}</p>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs", finished ? "bg-[#e7f3e4] text-[#2f7a3a]" : cancelled ? "bg-[#f3ece3] text-[#5c564f]" : "bg-[#f3e6d4] text-[#6e5636]")}>{finished ? "Klar" : cancelled ? "Avbokad" : "Pågående"}</span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-[#5c564f]"><Calendar className="size-3.5" /> {jobWhen}</p>
              <p className="flex items-center gap-1 text-sm text-[#5c564f]"><MapPin className="size-3.5" /> {jobPlace}</p>
            </div>
          </div>
          {finished || cancelled ? (
            <button type="button" onClick={() => setHelp("rebook")} className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-[#6e5636] py-2.5 text-sm font-semibold text-white">
              {cancelled ? "Boka om" : "Boka igen"}
            </button>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setHelp("menu")} className="flex items-center justify-center gap-1 rounded-full border border-[#efeae4] bg-[#f7f3ee] py-2.5 text-sm font-medium">
                <Calendar className="size-4" /> Avboka
              </button>
              <button type="button" onClick={() => setHelp("change")} className="flex items-center justify-center gap-1 rounded-full border border-[#efeae4] bg-[#f7f3ee] py-2.5 text-sm font-medium">
                <ClipboardList className="size-4" /> Ändra bokning
              </button>
            </div>
          )}
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div key={message.id} className="mb-3">
            {message.day ? <p className="mb-3 text-center text-xs text-muted">{message.day}</p> : null}
            {message.card?.kind === "slot" ? (
              <TimeConfirmedCard when={message.card.when} place={message.card.place} service={message.card.service} time={message.time ?? ""} />
            ) : message.card?.kind === "reschedule" ? (
              <div className="rounded-[1.2rem] border border-[#efeae4] bg-white px-4 py-3">
                <p className="font-semibold">Ny förfrågan skickad</p>
                <p className="mt-1 text-sm text-[#5c564f]">{message.card.service} · {message.card.when}</p>
                <p className="text-sm text-[#5c564f]">{message.card.place}</p>
              </div>
            ) : message.card?.kind === "rebook" ? (
              <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Förfrågan skickad</h3>
                <div className="mt-2 space-y-1 text-[15px]">
                  <p><span className="font-semibold">Tjänst:</span> {message.card.service}</p>
                  <p><span className="font-semibold">Om jobbet:</span> {message.card.about}</p>
                  <p><span className="font-semibold">Tid:</span> {message.card.when}</p>
                  <p><span className="font-semibold">Plats:</span> {message.card.place}</p>
                  <p><span className="font-semibold">Pris:</span> {kr(message.card.price)}</p>
                </div>
                <p className="mt-3 text-sm text-[#5c564f]">{message.card.status === "accepted" ? "Godkänd" : message.card.status === "declined" ? "Nekad" : "Väntar på att arbetaren svarar"}</p>
              </div>
            ) : message.card?.kind === "cancelled" ? (
              <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Jobbet avbokat</h3>
                <p className="mt-2 text-[15px]">Reservera jobbet igen för att chatta med {provider.name}.</p>
              </div>
            ) : message.card?.kind === "quote" ? (
              <CustomerPayCard
                amount={message.card.amount}
                onPay={() => {
                  if (messages.some((item) => item.card?.kind === "paid")) {
                    showToast("Betalningen är redan gjord");
                    return;
                  }
                  setSheet("pay");
                }}
              />
            ) : message.card?.kind === "paid" ? (
              <div className="rounded-[1.2rem] border border-[#efeae4] bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-[#f6f1ea]"><CreditCard className="size-4" /></span>
                  <span>
                    <span className="block font-semibold">Betalning mottagen</span>
                    <span className="block text-sm text-[#5c564f]">{message.card.amount.toLocaleString("sv-SE")} kr har betalats av kunden.</span>
                  </span>
                </div>
              </div>
            ) : message.card ? (
              <ChatCardView
                message={message}
                onDetails={() => (booking ? openReceipt(booking.id) : showToast("Ingen bokning att visa"))}
                onCalendar={() => showToast("Tid tillagd i kalendern")}
                onFollow={() => showToast(`${provider.name.split(" ")[0]} är cirka 10 minuter bort`)}
                onPay={() => setSheet("pay")}
                onAnswerTake={
                  providerId
                    ? (status) => answerTakeRequest(providerId, message.id, status)
                    : undefined
                }
              />
            ) : (
              <div className={message.from === "me" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.from === "me" ? "max-w-[78%] rounded-[1.25rem] bg-[#f3ece3] px-4 py-3 text-[15px] leading-snug" : "max-w-[85%] rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-3 text-[15px] leading-snug"}>
                  <p>{message.text}</p>
                  {message.time ? <p className="mt-1 text-right text-xs text-muted">{message.time}</p> : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {cancelled ? (
        <p className="px-4 py-4 text-center text-[15px]">Reservera jobbet igen för att chatta med {provider.name}.</p>
      ) : (
      <form
        className="flex items-center gap-2 px-3 pt-2 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          sendChat(draft);
          setDraft("");
        }}
      >
        <button type="button" aria-label="Bifoga" onClick={() => showToast("Bifoga bild kommer snart")} className="grid size-11 shrink-0 place-items-center rounded-full border border-[#e6e1db] bg-white">
          <Plus className="size-5" />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Skriv ett meddelande..."
          className="min-w-0 flex-1 rounded-full border border-[#e6e1db] bg-white px-4 py-3 text-base outline-none"
        />
        <button type="submit" aria-label="Skicka" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#9a7b45] text-white">
          <ChevronRight className="size-5" />
        </button>
      </form>
      )}
      {help === "rebook" ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/30" onClick={() => setHelp(null)}>
          <div className="max-h-[88%] overflow-y-auto rounded-t-[1.7rem] bg-[#fffcfa] px-5 pt-2.5 pb-5" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-[3px] w-9 rounded-full bg-[#e3ddd6]" />
            <h2 className="font-serif text-[1.85rem] leading-none font-semibold tracking-tight">{service?.name ?? jobTitle}</h2>
            <p className="mt-1.5 text-[15px] text-[#8a847e]">{provider.name} · {provider.area}</p>
            <div className="mt-4 rounded-[1.15rem] bg-[#f3ece3] px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold">Minimibelopp</span>
                <span className="text-[17px] font-bold tracking-tight">{kr(provider.price)}</span>
              </div>
              <p className="mt-2.5 text-[14.5px] leading-[1.45] text-[#6e6964]">
                Beloppet reserveras på ditt kort. Inget dras om arbetet inte utförs — pengarna släpps automatiskt tillbaka. Förfrågan skickas till {provider.name.split(" ")[0]}, och ni kan chatta vidare om {subject(provider.name)} accepterar uppdraget.
              </p>
            </div>
            <label className="mt-4 mb-1.5 block text-[15px] font-semibold" htmlFor="rebook-when">När?</label>
            <div className="relative">
              <select
                id="rebook-when"
                value={rebookWhen}
                onChange={(event) => setRebookWhen(event.target.value as (typeof whenOptions)[number])}
                className="w-full appearance-none rounded-[1.15rem] border border-[#e6e1db] bg-white px-4 py-3 pr-10 text-[15px] outline-none"
              >
                {whenOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[#8a847e]" />
            </div>
            <button
              type="button"
              onClick={() => {
                appendChat(provider.id, {
                  id: `rebook-${Date.now()}`,
                  from: "me",
                  time: "21:45",
                  card: {
                    kind: "rebook",
                    service: service?.name ?? jobTitle,
                    when: rebookWhen,
                    place: jobPlace,
                    about: service?.desc ?? jobTitle,
                    price: provider.price,
                    status: "pending",
                  },
                });
                setHelp(null);
                showToast("Förfrågan skickad");
              }}
              className="mt-3.5 h-12 w-full rounded-full bg-[#2a211c] text-[16px] font-semibold text-white"
            >
              Reservera
            </button>
            <button type="button" onClick={() => setHelp(null)} className="mt-2.5 h-12 w-full rounded-full border border-[#e4dfd8] bg-white text-[16px] font-semibold">
              Avbryt
            </button>
          </div>
        </div>
      ) : help ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={() => setHelp(null)}>
          <div className="max-h-[85%] overflow-y-auto rounded-t-[1.6rem] bg-[#f7f3ee] px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e0d8cf]" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-[1.7rem] leading-none">
                {help === "change" ? "Ändra bokning" : help === "problem" ? "Beskriv problemet" : help === "sure" ? "Är du säker?" : help === "detail" ? issue : "Avboka"}
              </h3>
              <button type="button" aria-label="Stäng" onClick={() => setHelp(null)} className="grid size-8 place-items-center">
                <X className="size-5" />
              </button>
            </div>
            {help === "menu" || help === "report" ? (
              <div className="overflow-hidden rounded-[1.2rem] border border-[#efeae4] bg-white">
                {issues.filter((item) => help === "menu" || item.id !== "cancel").map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setIssue(item.label);
                        setNote("");
                        setHelp("sure");
                      }}
                      className={cn("flex w-full items-center gap-3 px-3 py-3 text-left", index > 0 && "border-t border-[#f0ebe6]")}
                    >
                      <Icon className="size-5" strokeWidth={1.6} />
                      <span className="flex-1 text-[15px]">{item.label}</span>
                      <ChevronRight className="size-4 text-muted" />
                    </button>
                  );
                })}
              </div>
            ) : null}
            {help === "sure" ? (
              <div>
                <p className="text-sm leading-snug text-[#5c564f]">Vill du avboka uppdraget på grund av: {issue}? Inget dras från kontot.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setNote(""); setHelp("problem"); }} className="rounded-full border border-[#e4dfd8] bg-white py-3 font-semibold">
                    Nej
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (booking) cancelBooking(booking.id);
                      if (!messages.some((message) => message.card?.kind === "cancelled")) {
                        appendChat(provider.id, { id: `cancel-${Date.now()}`, from: "system", time: "21:40", card: { kind: "cancelled" } });
                      }
                      setNote("");
                      setHelp("problem");
                    }}
                    className="rounded-full bg-[#2a211c] py-3 font-semibold text-white"
                  >
                    Avboka
                  </button>
                </div>
              </div>
            ) : null}
            {help === "problem" ? (
              <div>
                <p className="text-sm text-[#5c564f]">Berätta kort vad som hänt, om du vill.</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Beskriv problemet" className="mt-3 w-full rounded-2xl border border-[#efeae4] bg-white px-3 py-2 text-sm outline-none" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setHelp(null)} className="rounded-full border border-[#e4dfd8] bg-white py-3 font-semibold">
                    Hoppa över
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!note.trim()) return showToast("Skriv något, eller hoppa över");
                      showToast("Tack, vi har tagit emot det");
                      setNote("");
                      setHelp(null);
                    }}
                    className="rounded-full bg-[#2a211c] py-3 font-semibold text-white"
                  >
                    Skicka
                  </button>
                </div>
              </div>
            ) : null}
            {help === "detail" && issue !== "Avboka uppdraget" ? (
              <div>
                <p className="text-sm text-[#5c564f]">Berätta kort vad som hänt så att vi kan hjälpa dig.</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Beskriv problemet" className="mt-3 w-full rounded-2xl border border-[#efeae4] bg-white px-3 py-2 text-sm outline-none" />
                <button
                  type="button"
                  onClick={() => {
                    appendChat(provider.id, { id: `report-${Date.now()}`, from: "me", text: note.trim() ? `${issue}: ${note.trim()}` : issue, time: "21:40" });
                    setHelp(null);
                    showToast("Rapporten är skickad");
                  }}
                  className="mt-3 w-full rounded-full bg-[#6e5636] py-3 font-semibold text-white"
                >
                  Skicka rapport
                </button>
              </div>
            ) : null}
            {help === "change" ? (
              <ChangeWhen
                date={changeDate}
                time={changeTime}
                onDate={setChangeDate}
                onTime={setChangeTime}
                hint="Välj datum och tid. Utföraren får det som en ny förfrågan."
                submitLabel="Skicka förfrågan"
                onSend={() => {
                  if (!changeDate || !changeTime) return showToast("Välj datum och tid");
                  const label = `${changeDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "")}, ${changeTime}`;
                  appendChat(provider.id, {
                    id: `move-${Date.now()}`,
                    from: "me",
                    time: "21:45",
                    text: `Ny förfrågan: ${label}`,
                    card: { kind: "reschedule", when: label, place: jobPlace, service: jobTitle },
                  });
                  setHelp(null);
                  showToast("Förfrågan skickad till utföraren");
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChangeWhen({
  date,
  time,
  onDate,
  onTime,
  onSend,
  hint,
  submitLabel,
  dateLabel = "Datum",
}: {
  date: Date | null;
  time: string;
  onDate: (date: Date) => void;
  onTime: (time: string) => void;
  onSend: () => void;
  hint: string;
  submitLabel: string;
  dateLabel?: string;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const label = cursor.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [hour, setHour] = useState(() => Number(time.split(":")[0]) || 9);
  const [minute, setMinute] = useState(() => Number(time.split(":")[1]) || 0);

  useEffect(() => {
    onTime(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }, [hour, minute, onTime]);

  return (
    <div>
      {hint ? <p className="text-sm text-[#5c564f]">{hint}</p> : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-xs font-semibold">{dateLabel}</p>
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Föregående månad" onClick={() => setCursor(new Date(year, month - 1, 1))} className="grid size-6 place-items-center"><ChevronRight className="size-3.5 rotate-180" /></button>
            <p className="text-[11px] font-semibold capitalize">{label}</p>
            <button type="button" aria-label="Nästa månad" onClick={() => setCursor(new Date(year, month + 1, 1))} className="grid size-6 place-items-center"><ChevronRight className="size-3.5" /></button>
          </div>
          <div className="mt-1 grid grid-cols-7 text-center text-[9px] text-muted">
            {["M", "T", "O", "T", "F", "L", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 text-center text-[11px]">
            {Array.from({ length: pad }, (_, index) => <span key={`e-${index}`} />)}
            {Array.from({ length: count }, (_, index) => {
              const day = index + 1;
              const value = new Date(year, month, day);
              const past = value < today;
              const active = date?.toDateString() === value.toDateString();
              return (
                <button key={day} type="button" disabled={past} onClick={() => onDate(value)} className={cn("mx-auto grid size-5 place-items-center rounded-full", active && "bg-[#6e5636] text-white", past && "text-muted/40")}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold">Tid</p>
          <div className="relative mt-1 h-28 overflow-hidden rounded-2xl bg-[#f6f1ea]">
            <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-8 -translate-y-1/2 rounded-xl bg-white" />
            <span className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold">:</span>
            <div className="relative z-10 grid h-full grid-cols-2">
              <MiniWheel values={Array.from({ length: 24 }, (_, index) => index)} value={hour} onChange={setHour} />
              <MiniWheel values={Array.from({ length: 60 }, (_, index) => index)} value={minute} onChange={setMinute} />
            </div>
          </div>
        </div>
      </div>
      <button type="button" onClick={onSend} className="mt-3 w-full rounded-full bg-[#6e5636] py-3 font-semibold text-white">
        {submitLabel}
      </button>
    </div>
  );
}

function MiniWheel({ values, value, onChange }: { values: number[]; value: number; onChange: (value: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fromUser = useRef(false);
  const item = 32;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (fromUser.current) {
      fromUser.current = false;
      return;
    }
    node.scrollTop = Math.max(0, values.indexOf(value)) * item;
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
      <div className="h-8" />
      {values.map((itemValue) => (
        <button
          key={itemValue}
          type="button"
          onClick={() => onChange(itemValue)}
          className={cn("block h-8 w-full snap-center text-center text-sm", itemValue === value ? "font-semibold text-ink" : "text-muted")}
        >
          {String(itemValue).padStart(2, "0")}
        </button>
      ))}
      <div className="h-8" />
    </div>
  );
}

function SyncedPeerChat({
  peerName,
  messages,
  draft,
  setDraft,
  onSend,
  onClose,
}: {
  peerName: string;
  messages: ChatMsg[];
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lastId, messages.length]);
  const initials = peerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f7f3ee]">
      <div className="flex items-center px-3 pt-3">
        <button type="button" aria-label="Tillbaka" onClick={onClose} className="grid size-9 place-items-center">
          <ArrowLeft className="size-5" />
        </button>
        <p className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</p>
        <span className="size-9" />
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f3ece3] text-sm font-semibold">{initials}</span>
        <div>
          <p className="text-lg font-semibold">{peerName}</p>
          <p className="text-sm text-[#5c564f]">Synkad chatt</p>
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.map((message) =>
          message.card ? (
            <div key={message.id} className="mt-3">
              <ChatCardView
                message={message}
                onDetails={() => undefined}
                onCalendar={() => undefined}
                onFollow={() => undefined}
                onPay={() => undefined}
              />
            </div>
          ) : message.text ? (
            <div key={message.id} className={cn("mt-3 flex", message.from === "me" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-[1.2rem] px-4 py-2.5 text-[15px]",
                  message.from === "me" ? "rounded-br-md bg-[#6e5636] text-white" : "rounded-bl-md border border-[#efeae4] bg-white",
                )}
              >
                <p>{message.text}</p>
                <p className={cn("mt-1 text-right text-xs", message.from === "me" ? "text-white/80" : "text-muted")}>{message.time}</p>
              </div>
            </div>
          ) : null,
        )}
      </div>
      <form
        className="flex items-center gap-2 px-3 pt-2 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Skriv ett meddelande..."
          className="min-w-0 flex-1 rounded-full border border-[#e6e1db] bg-white px-4 py-3 text-base outline-none"
        />
        <button type="submit" aria-label="Skicka" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#6e5636] text-white">
          <Send className="size-5" />
        </button>
      </form>
    </div>
  );
}

function WorkerChat({ onClose }: { onClose: () => void }) {
  const showToast = useVelio((state) => state.showToast);
  const appendChat = useVelio((state) => state.appendChat);
  const sendChat = useVelio((state) => state.sendChat);
  const answerRebook = useVelio((state) => state.answerRebook);
  const providerId = useVelio((state) => state.providerId);
  const peers = useVelio((state) => state.peers);
  const threadKey = providerId || "";
  const peer = threadKey ? peers[threadKey] : null;
  const marketplace = threadKey ? providerById(threadKey) : null;
  const customerName = peer?.name || marketplace?.name || "kunden";
  const messages = useVelio((state) => (threadKey ? state.chats[threadKey] ?? EMPTY_CHAT : EMPTY_CHAT));
  const [panel, setPanel] = useState<"time" | "price" | null>("time");
  const [when, setWhen] = useState("Idag, 14:00");
  const [slotDate, setSlotDate] = useState<Date | null>(null);
  const [slotTime, setSlotTime] = useState("14:00");
  const [price, setPrice] = useState("1200");
  const [editingPrice, setEditingPrice] = useState(false);
  const [draft, setDraft] = useState("");
  const confirmed = messages.some((message) => message.card?.kind === "slot");
  const cancelled = messages.reduce((locked, message) => {
    if (message.card?.kind === "cancelled") return true;
    if (message.card?.kind === "rebook" && message.card.status === "accepted") return false;
    return locked;
  }, false);
  const step = messages.some((message) => message.card?.kind === "paid") ? 4 : messages.some((message) => message.text?.includes("fram")) ? 3 : messages.some((message) => message.text?.toLowerCase().includes("på väg")) ? 2 : confirmed ? 1 : 0;
  const stages = [
    { icon: Check, label: "Accepterad" },
    { icon: Calendar, label: "Tid" },
    { icon: Car, label: "På väg" },
    { icon: MapPin, label: "Framme" },
    { icon: CreditCard, label: "Betalning" },
  ];

  const say = (text: string) => {
    sendChat(text);
  };
  const pushLocal = (message: ChatMsg) => appendChat(threadKey, message);
  const thread = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  const initials = customerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useLayoutEffect(() => {
    const node = thread.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lastId, messages.length, panel]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f7f3ee]">
      <div className="flex items-center px-3 pt-3">
        <button type="button" aria-label="Tillbaka" onClick={onClose} className="grid size-9 place-items-center">
          <ArrowLeft className="size-5" />
        </button>
        <p className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</p>
        <button type="button" aria-label="Ring" onClick={() => showToast("Ringer kunden…")} className="grid size-9 place-items-center">
          <Phone className="size-5" />
        </button>
        <button type="button" aria-label="Mer" onClick={() => showToast("Fler val kommer")} className="grid size-9 place-items-center">
          <Ellipsis className="size-5" />
        </button>
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-[#f3ece3] text-sm font-semibold">
          {initials}
          <span className="absolute right-0.5 bottom-0.5 size-2.5 rounded-full border-2 border-[#f7f3ee] bg-[#3d8f4a]" />
        </span>
        <div>
          <p className="flex items-center gap-1 text-lg font-semibold">
            {customerName} <BadgeCheck className="size-4 fill-[#c4a15a] text-[#f7f3ee]" />
          </p>
          <p className="text-sm text-[#5c564f]">Kund</p>
        </div>
      </div>
      <div className="mx-4 mt-1 flex items-start">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const on = index <= step;
          return (
            <div key={stage.label} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={index === 0 ? "h-px flex-1" : cn("h-px flex-1", on ? "bg-[#6e5636]" : "bg-[#e6dfd6]")} />
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border", on ? "border-[#6e5636] bg-[#6e5636] text-white" : "border-[#e6dfd6] bg-white text-[#5c564f]")}>
                  <Icon className="size-3.5" />
                </span>
                <span className={index === stages.length - 1 ? "h-px flex-1" : cn("h-px flex-1", index < step ? "bg-[#6e5636]" : "bg-[#e6dfd6]")} />
              </div>
              <p className="mt-1 text-center text-[10px] leading-tight">{stage.label}</p>
            </div>
          );
        })}
      </div>

      <div ref={thread} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="rounded-[1.2rem] border border-[#efeae4] bg-white p-2.5">
          <div className="flex items-center gap-3">
          <img src={asset("/velio/tile-stad.jpg")} alt="" className="size-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Städning</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-[#5c564f]"><MapPin className="size-3.5" /> Södermalm</p>
            <p className="flex items-center gap-1 text-sm text-[#5c564f]"><Calendar className="size-3.5" /> {when}</p>
          </div>
          <span className="rounded-full bg-[#f6f1ea] px-3 py-1.5 text-sm font-semibold">1 200 kr</span>
          </div>
          {cancelled ? (
            <button type="button" onClick={() => showToast("Kunden kan boka om jobbet")} className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-[#6e5636] py-2.5 text-sm font-semibold text-white">
              Boka om
            </button>
          ) : null}
        </div>

        {messages.map((message) => (
          <div key={message.id} className="mt-3">
            {message.card?.kind === "request" ? (
              <ChatCardView
                message={message}
                onDetails={() => showToast(message.card?.kind === "request" ? message.card.about || message.card.service : "Detaljer")}
                onCalendar={() => showToast("Tid tillagd i kalendern")}
                onFollow={() => showToast("Kunden väntar")}
                onPay={() => showToast("Väntar på kundens betalning")}
              />
            ) : message.card?.kind === "slot" ? (
              <TimeConfirmedCard when={message.card.when} place={message.card.place} service={message.card.service} time={message.time ?? "14:05"} />
            ) : message.card?.kind === "rebook" ? (
              <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Ny förfrågan</h3>
                <div className="mt-2 space-y-1 text-[15px]">
                  <p><span className="font-semibold">Tjänst:</span> {message.card.service}</p>
                  <p><span className="font-semibold">Om jobbet:</span> {message.card.about}</p>
                  <p><span className="font-semibold">Tid:</span> {message.card.when}</p>
                  <p><span className="font-semibold">Plats:</span> {message.card.place}</p>
                  <p><span className="font-semibold">Pris:</span> {kr(message.card.price)}</p>
                </div>
                {message.card.status === "pending" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        answerRebook(threadKey, message.id, "declined");
                        pushLocal({ id: `no-${Date.now()}`, from: "me", text: "Jag kan tyvärr inte ta jobbet.", time: "21:50" });
                        showToast("Förfrågan nekad");
                      }}
                      className="rounded-full border border-[#e6dfd6] py-2.5 text-sm font-semibold"
                    >
                      Neka
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const job = message.card?.kind === "rebook" ? message.card : null;
                        answerRebook(threadKey, message.id, "accepted");
                        pushLocal({ id: `yes-${Date.now()}`, from: "me", text: `Jag tar uppdraget: ${job?.service ?? ""} ${job?.when ?? ""}.`, time: "21:50" });
                        showToast("Förfrågan godkänd");
                      }}
                      className="rounded-full bg-[#6e5636] py-2.5 text-sm font-semibold text-white"
                    >
                      Godkänn
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#5c564f]">{message.card.status === "accepted" ? "Godkänd" : "Nekad"}</p>
                )}
              </div>
            ) : message.card?.kind === "cancelled" ? (
              <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Jobbet avbokat</h3>
                <p className="mt-2 text-[15px]">Reservera jobbet igen för att chatta med {customerName}.</p>
              </div>
            ) : message.card?.kind === "quote" ? (
              <div className="flex justify-end">
                <div className="w-[92%]">
                  <FinalPriceCard
                    amount={message.card.amount}
                    service={message.card.service}
                    hours={message.card.hours}
                    when={message.card.when}
                    place={message.card.place}
                    sent
                    quiet
                    onEdit={() => showToast("Priset är redan skickat")}
                    onSend={() => showToast("Priset är redan skickat")}
                  />
                  <p className="mt-1 text-right text-xs text-[#5c564f]">{message.time} ✓✓</p>
                </div>
              </div>
            ) : message.card?.kind === "paid" ? (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-[1.2rem] border border-[#efeae4] bg-white px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-[#f6f1ea]"><CreditCard className="size-4" /></span>
                    <span>
                      <span className="block font-semibold">Betalning mottagen</span>
                      <span className="block text-sm text-[#5c564f]">{message.card.amount.toLocaleString("sv-SE")} kr har betalats av kunden.</span>
                    </span>
                  </div>
                  <p className="mt-1 text-right text-xs text-[#5c564f]">{message.time}</p>
                </div>
              </div>
            ) : message.card?.kind === "reschedule" ? (
              <div className="rounded-[1.2rem] border border-[#efeae4] bg-white px-3 py-3">
                <p className="font-semibold">Ny förfrågan</p>
                <p className="mt-1 text-sm">{message.card.service}</p>
                <p className="text-sm text-[#5c564f]">{message.card.when}</p>
                <p className="text-sm text-[#5c564f]">{message.card.place}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { pushLocal({ id: `no-${Date.now()}`, from: "me", text: "Jag kan tyvärr inte den tiden.", time: "21:50" }); showToast("Förfrågan avböjd"); }} className="rounded-full border border-[#e6dfd6] py-2 text-sm font-semibold">Avböj</button>
                  <button type="button" onClick={() => { pushLocal({ id: `yes-${Date.now()}`, from: "me", text: `Jag tar den nya tiden: ${message.card && message.card.kind === "reschedule" ? message.card.when : ""}.`, time: "21:50" }); showToast("Ny tid accepterad"); }} className="rounded-full bg-[#6e5636] py-2 text-sm font-semibold text-white">Acceptera</button>
                </div>
              </div>
            ) : (
              <div className={message.from === "me" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.from === "me" ? "max-w-[78%] rounded-[1.2rem] rounded-br-md bg-[#6e5636] px-4 py-2.5 text-[15px] text-white" : "max-w-[85%] rounded-[1.2rem] rounded-bl-md border border-[#efeae4] bg-white px-4 py-2.5 text-[15px]"}>
                  <p className="whitespace-pre-line">{message.text}</p>
                  <p className={message.from === "me" ? "mt-1 text-right text-xs text-white/80" : "mt-1 text-right text-xs text-muted"}>
                    {message.time} {message.from === "me" ? "✓✓" : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {cancelled ? null : (
      <>
      <div className="mx-3 grid grid-cols-2 gap-2 rounded-[1.2rem] border border-[#efeae4] bg-white p-2">
        <WorkerAction icon={Calendar} label="Bekräfta tid" active={panel === "time"} onClick={() => setPanel(panel === "time" ? null : "time")} />
        <WorkerAction icon={Coins} label="Skicka slutpris" active={panel === "price"} onClick={() => setPanel(panel === "price" ? null : "price")} />
      </div>

      {panel === "time" ? (
        <div className="mx-3 mt-2 rounded-[1.2rem] border border-[#efeae4] bg-white p-3">
          <div className="mb-2 flex items-start gap-2">
            <span className="grid size-9 place-items-center rounded-full border border-[#efeae4]"><Calendar className="size-4" /></span>
            <span>
              <span className="block font-semibold">Bekräfta tid</span>
              <span className="block text-sm text-[#5c564f]">Välj datum och starttid, och skicka till kunden.</span>
            </span>
          </div>
          <ChangeWhen
            date={slotDate}
            time={slotTime}
            onDate={setSlotDate}
            onTime={setSlotTime}
            hint=""
            submitLabel="Skicka bekräftelse"
            onSend={() => {
              if (!slotDate || !slotTime) return showToast("Välj datum och tid");
              const label = `${slotDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "")}, ${slotTime}`;
              setWhen(label);
              pushLocal({
                id: `slot-${Date.now()}`,
                from: "me",
                time: "14:05",
                card: { kind: "slot", when: label, place: "Södermalm", service: "Städning" },
              });
              sendChat("Tack, jag har skickat min tidsbekräftelse. Ser fram emot att hjälpa dig!");
              setPanel(null);
              showToast("Bekräftelse skickad");
            }}
          />
        </div>
      ) : null}

      {panel === "price" ? (
        <div className="mx-3 mt-2">
          <FinalPriceCard
            amount={Number(price) || 0}
            service="Städning"
            hours={hoursBetween(when)}
            when={when}
            place="Södermalm"
            editing={editingPrice}
            price={price}
            onPrice={setPrice}
            onEdit={() => setEditingPrice(!editingPrice)}
            onSend={() => {
              const amount = Number(price);
              if (!amount) return showToast("Ange ett slutpris");
              pushLocal({
                id: `quote-${Date.now()}`,
                from: "me",
                time: "14:08",
                card: { kind: "quote", amount, service: "Städning", hours: hoursBetween(when), when, place: "Södermalm" },
              });
              sendChat(`Slutpris: ${amount.toLocaleString("sv-SE")} kr`);
              setPanel(null);
              showToast("Pris skickat till kunden");
            }}
          />
        </div>
      ) : null}

      {confirmed ? (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2">
          <StatusChip icon={Car} label="Jag är på väg" onClick={() => say("Jag är på väg")} />
          <StatusChip icon={MapPin} label="Jag är framme" onClick={() => say("Jag är framme")} />
          <StatusChip icon={Search} label="Jag ser inte dig?" onClick={() => say("Jag ser inte dig?")} />
        </div>
      ) : null}
      </>
      )}

      {cancelled ? (
        <p className="px-4 py-4 text-center text-[15px]">Reservera jobbet igen för att chatta med {customerName}.</p>
      ) : (
      <form
        className="flex items-center gap-2 px-3 pt-2 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          say(draft.trim());
          setDraft("");
        }}
      >
        <button type="button" aria-label="Bifoga" onClick={() => showToast("Bifoga bild kommer snart")} className="grid size-11 shrink-0 place-items-center rounded-full border border-[#e6e1db] bg-white">
          <Plus className="size-5" />
        </button>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Skriv ett meddelande..." className="min-w-0 flex-1 rounded-full border border-[#e6e1db] bg-white px-4 py-3 text-base outline-none" />
        <button
          type="button"
          aria-label="Röst"
          onClick={() => {
            if (!draft.trim()) return showToast("Röstmeddelande kommer snart");
            say(draft.trim());
            setDraft("");
          }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#6e5636] text-white"
        >
          <Mic className="size-5" />
        </button>
      </form>
      )}
    </div>
  );
}

function CustomerPayCard({ amount, onPay }: { amount: number; onPay: () => void }) {
  return (
    <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard className="size-5" />
        <span>
          <span className="block text-lg font-semibold leading-tight">Betalning</span>
          <span className="text-sm text-[#5c564f]">Slutpris för uppdraget</span>
        </span>
      </div>
      <p className="mt-3 font-serif text-[2.6rem] leading-none">{amount.toLocaleString("sv-SE")} kr</p>
      <button type="button" onClick={onPay} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#6e5636] py-3.5 text-base font-semibold text-white">
        Välj betalningssätt
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function hoursBetween(when: string) {
  const match = when.match(/(\d{2}):\d{2}\s*[–-]\s*(\d{2}):\d{2}/);
  if (!match) return "2 timmar";
  const hours = Number(match[2]) - Number(match[1]);
  if (hours <= 0) return "2 timmar";
  return hours === 1 ? "1 timme" : `${hours} timmar`;
}

function FinalPriceCard({
  amount,
  service,
  when,
  place,
  sent,
  quiet,
  editing,
  price,
  onPrice,
  onEdit,
  onSend,
}: {
  amount: number;
  service: string;
  hours: string;
  when: string;
  place: string;
  sent?: boolean;
  quiet?: boolean;
  editing?: boolean;
  price?: string;
  onPrice?: (value: string) => void;
  onEdit?: () => void;
  onSend?: () => void;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
      <div className="mb-3 flex items-start gap-2">
        <Coins className="mt-0.5 size-5" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold leading-tight">Slutpris</span>
          <span className="block text-sm text-[#5c564f]">{service}</span>
        </span>
        {quiet ? null : (
          <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-full border border-[#e4dfd8] bg-white px-2.5 py-1 text-sm">
            <Pencil className="size-3.5" /> Ändra
          </button>
        )}
      </div>
      {editing ? (
        <input value={price} inputMode="numeric" onChange={(event) => onPrice?.(event.target.value.replace(/[^\d]/g, ""))} className="mt-1 w-full rounded-2xl border border-[#e4dfd8] bg-white px-3 py-2 text-2xl font-semibold outline-none" />
      ) : (
        <p className="text-3xl font-semibold tracking-tight">{amount.toLocaleString("sv-SE")} kr</p>
      )}
      <p className="text-sm text-[#5c564f]">Inkl. moms</p>
      <div className="mt-3 space-y-1 border-t border-[#efeae4] pt-3 text-[15px]">
        <p><span className="font-semibold">Tid:</span> {when.replace(/\s*[–-]\s*\d{1,2}:\d{2}\s*$/, "")}</p>
        <p><span className="font-semibold">Plats:</span> {place}</p>
      </div>
      {quiet ? null : (
        <button type="button" onClick={onSend} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[#e4dfd8] bg-white py-3 font-semibold">
          <Send className="size-4" /> Skicka pris till kund
        </button>
      )}
    </div>
  );
}

function StatusChip({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#efeae4] bg-white px-3 py-2 text-sm">
      <Icon className="size-4" /> {label}
    </button>
  );
}

function TimeConfirmedCard({ when, place, time }: { when: string; place: string; service: string; time: string }) {
  const showToast = useVelio((state) => state.showToast);
  const clock = when.match(/(\d{1,2}:\d{2})\s*$/)?.[1] ?? "";
  const date = clock ? when.replace(/,?\s*\d{1,2}:\d{2}\s*$/, "") : when;
  return (
    <div>
      <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="size-5" />
          <h3 className="text-lg font-semibold">Tid bekräftad</h3>
        </div>
        <div className="space-y-1 text-[15px]">
          <p><span className="font-semibold">Datum:</span> {date}</p>
          {clock ? <p><span className="font-semibold">Tid:</span> {clock}</p> : null}
          <p><span className="font-semibold">Plats:</span> {place}</p>
        </div>
        <button type="button" onClick={() => showToast("Tid tillagd i kalendern")} className="mt-4 w-full rounded-full border border-[#e4dfd8] py-3 text-[15px] font-semibold">
          Lägg i kalender
        </button>
      </div>
      {time ? <p className="mt-1 text-right text-xs text-muted">{time}</p> : null}
    </div>
  );
}

function WorkerAction({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-center text-[11px] leading-tight", active ? "border-[#2a211c] bg-white font-semibold" : "border-[#efeae4] bg-white")}>
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function ChatCardView({
  message,
  onDetails,
  onCalendar,
  onFollow,
  onPay,
  onAnswerTake,
}: {
  message: ChatMsg;
  onDetails: () => void;
  onCalendar: () => void;
  onFollow: () => void;
  onPay: () => void;
  onAnswerTake?: (status: "accepted" | "declined") => void;
}) {
  const card = message.card;
  if (!card) return null;
  const takePending = card.kind === "request" && card.intent === "take" && (card.status ?? "pending") === "pending";
  const takeDone = card.kind === "request" && card.intent === "take" && card.status && card.status !== "pending";
  const action =
    card.kind === "request"
      ? { label: "Visa detaljer", onClick: onDetails }
      : card.kind === "confirmed"
        ? { label: "Lägg i kalender", onClick: onCalendar }
        : card.kind === "enroute"
          ? { label: "Följ min resa", onClick: onFollow }
          : { label: "Gå till betalning", onClick: onPay };
  const title = card.kind === "request" ? "Bokningsförfrågan" : card.kind === "confirmed" ? "Tid bekräftad" : card.kind === "enroute" ? "På väg" : "Jobb slutfört";
  const Icon = card.kind === "done" ? ClipboardCheck : card.kind === "enroute" ? Navigation : Calendar;

  return (
    <div>
      <div className="rounded-[1.25rem] border border-[#efeae4] bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon className={card.kind === "enroute" ? "size-5 fill-[#2a211c] text-[#2a211c]" : "size-5"} />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {card.kind === "request" ? (
          <div className="space-y-1 text-[15px]">
            <p><span className="font-semibold">Tjänst:</span> {card.service}</p>
            {card.about ? <p><span className="font-semibold">Om jobbet:</span> {card.about}</p> : null}
            <p><span className="font-semibold">Tid:</span> {card.when}</p>
            <p><span className="font-semibold">Plats:</span> {card.place}</p>
            <p><span className="font-semibold">Pris (estimat):</span> {kr(card.price)}</p>
          </div>
        ) : null}
        {card.kind === "confirmed" ? (
          <div className="space-y-1 text-[15px]">
            <p><span className="font-semibold">Datum:</span> {card.date}</p>
            <p><span className="font-semibold">Tid:</span> {card.time}</p>
            <p><span className="font-semibold">Plats:</span> {card.place}</p>
          </div>
        ) : null}
        {card.kind === "enroute" ? (
          <div>
            <p className="text-[15px] text-muted">Beräknad ankomst</p>
            <p className="text-[15px] font-medium">{card.eta}</p>
            <div className="relative mt-3 h-36 overflow-hidden rounded-2xl">
              <img src={asset("/velio/map-stockholm.jpg")} alt="" className="h-full w-full object-cover" />
              <MapPin className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-full fill-[#2a211c] text-[#2a211c]" />
            </div>
          </div>
        ) : null}
        {card.kind === "done" ? (
          <div className="space-y-1 text-[15px]">
            <p><span className="font-semibold">Tjänst:</span> {card.service}</p>
            <p><span className="font-semibold">Beskrivning:</span> {card.desc}</p>
            <p><span className="font-semibold">Pris:</span> {kr(card.price)}</p>
          </div>
        ) : null}
        {takePending && message.from === "them" && onAnswerTake ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAnswerTake("declined")} className="rounded-full border border-[#e4dfd8] py-3 text-[15px] font-semibold">
              Avböj
            </button>
            <button type="button" onClick={() => onAnswerTake("accepted")} className="rounded-full bg-[#6e5636] py-3 text-[15px] font-semibold text-white">
              Godkänn
            </button>
          </div>
        ) : takeDone ? (
          <p className="mt-3 text-sm text-[#5c564f]">{card.status === "accepted" ? "Godkänd" : "Avböjd"}</p>
        ) : takePending && message.from === "me" ? (
          <p className="mt-3 text-sm text-[#5c564f]">Väntar på att kunden svarar</p>
        ) : (
          <button type="button" onClick={action.onClick} className="mt-4 w-full rounded-full border border-[#e4dfd8] py-3 text-[15px] font-semibold">
            {action.label}
          </button>
        )}
      </div>
      {message.time ? <p className="mt-1 text-right text-xs text-muted">{message.time}</p> : null}
    </div>
  );
}

export function PaySheet() {
  const providerId = useVelio((state) => state.providerId);
  const bookings = useVelio((state) => state.bookings);
  const cards = useVelio((state) => state.cards);
  const setSheet = useVelio((state) => state.setSheet);
  const showToast = useVelio((state) => state.showToast);
  const appendChat = useVelio((state) => state.appendChat);
  const provider = providerById(providerId);
  const booking = bookings.find((item) => item.providerId === providerId && item.status !== "done") ?? bookings.find((item) => item.providerId === providerId);
  const amount = booking?.cost ?? provider?.price ?? 0;
  const savedCard = cards.find((item) => item.id !== "swish") ?? cards[0];
  const [method, setMethod] = useState<"apple" | "card" | "swish" | "cash">("apple");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishPaid = (label: string) => {
    if (providerId) {
      appendChat(providerId, { id: `paid-${Date.now()}`, from: "them", time: "21:58", card: { kind: "paid", amount } });
      useVelio.setState({
        bookings: useVelio.getState().bookings.map((item) =>
          item.providerId === providerId && item.status !== "done" ? { ...item, status: "done" } : item,
        ),
      });
    }
    showToast(`${kr(amount)} betalt med ${label}`);
    setSheet("rate");
  };

  const payWithApple = async () => {
    setBusy(true);
    setError(null);
    try {
      const PaymentRequestCtor = window.PaymentRequest;
      if (!PaymentRequestCtor) {
        setError("Apple Pay / Payment Request stöds inte i den här webbläsaren. Välj kort eller Swish.");
        return;
      }
      const request = new PaymentRequestCtor(
        [
          {
            supportedMethods: "https://apple.com/apple-pay",
            data: {
              version: 3,
              merchantIdentifier: "merchant.se.velio.app",
              merchantCapabilities: ["supports3DS"],
              supportedNetworks: ["visa", "masterCard", "amex"],
              countryCode: "SE",
            },
          },
          { supportedMethods: "basic-card", data: { supportedNetworks: ["visa", "mastercard"] } },
        ],
        {
          id: `velio-${Date.now()}`,
          total: {
            label: "VELIO",
            amount: { currency: "SEK", value: amount.toFixed(2) },
          },
        },
      );
      const can = await request.canMakePayment().catch(() => null);
      if (!can) {
        setError("Ingen Apple Pay-plånbok tillgänglig här. Lägg till kort i Wallet eller betala med kort/Swish.");
        return;
      }
      const response = await request.show();
      await response.complete("success");
      finishPaid("Apple Pay");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Betalningen avbröts.");
      } else {
        setError("Apple Pay kunde inte slutföras. Prova kort eller Swish.");
      }
    } finally {
      setBusy(false);
    }
  };

  const payWithCard = () => {
    setError(null);
    const digits = cardNumber.replace(/\s+/g, "");
    if (savedCard && !digits) {
      finishPaid(savedCard.label);
      return;
    }
    if (!/^\d{13,19}$/.test(digits) || !luhnOk(digits)) {
      setError("Ange ett giltigt kortnummer.");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setError("Ange utgångsdatum som MM/ÅÅ.");
      return;
    }
    if (!/^\d{3,4}$/.test(cvc)) {
      setError("Ange CVC.");
      return;
    }
    finishPaid(`kort · ${digits.slice(-4)}`);
  };

  const payWithSwish = () => {
    finishPaid("Swish");
  };

  const payWithCash = () => {
    finishPaid("kontant");
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/30" onClick={() => setSheet("chat")}>
      <div role="dialog" aria-label="Betala" className="sheet-in rounded-t-[1.7rem] bg-[#fffcfa] px-5 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-[3px] w-9 rounded-full bg-[#e3ddd6]" />
        <h2 className="font-serif text-[1.8rem] font-medium">Betala</h2>
        <p className="mt-1 text-sm text-muted">{provider?.name} · jobbet är slutfört</p>
        <div className="mt-4 rounded-2xl bg-[#f3ece3] px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Att betala</span>
            <span className="text-lg font-bold">{kr(amount)}</span>
          </div>
          <p className="mt-2 text-sm text-muted">Reservationen på {kr(booking?.holdKr ?? amount)} växlas till en dragning nu.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              { id: "apple" as const, label: "Apple Pay" },
              { id: "card" as const, label: "Kort" },
              { id: "swish" as const, label: "Swish" },
              { id: "cash" as const, label: "Kontant" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMethod(item.id);
                setError(null);
              }}
              className={
                method === item.id
                  ? "rounded-full bg-[#2a211c] py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-[#e6dfd6] bg-white py-2 text-sm font-semibold text-[#2a211c]"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {method === "card" ? (
          <div className="mt-4 space-y-3">
            {savedCard ? <p className="text-sm text-muted">Sparat: {savedCard.label}. Eller ange ett nytt kort:</p> : null}
            <input
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="Kortnummer"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="h-12 w-full rounded-full border border-[#efeae4] bg-white px-4 text-[15px] outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/ÅÅ"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="h-12 w-full rounded-full border border-[#efeae4] bg-white px-4 text-[15px] outline-none"
              />
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                className="h-12 w-full rounded-full border border-[#efeae4] bg-white px-4 text-[15px] outline-none"
              />
            </div>
          </div>
        ) : null}

        {method === "swish" ? (
          <p className="mt-4 text-sm text-muted">Öppnar Swish-betalning till utföraren. Bekräfta i Swish-appen.</p>
        ) : null}

        {method === "apple" ? (
          <p className="mt-4 text-sm text-muted">Använder Apple Pay via webbläsarens Payment Request när det finns en plånbok.</p>
        ) : null}

        {method === "cash" ? (
          <p className="mt-4 text-sm text-muted">Betala kontant på plats till utföraren. Markera som betalt när ni är överens.</p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (method === "apple") void payWithApple();
            else if (method === "card") payWithCard();
            else if (method === "swish") payWithSwish();
            else payWithCash();
          }}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2a211c] font-semibold text-white disabled:opacity-60"
        >
          {method === "apple" ? (
            <>
              <svg viewBox="0 0 14 17" className="size-4 fill-white" aria-hidden="true">
                <path d="M11.4 8.9c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.4 0-2.6.8-3.3 2-1.4 2.5-.4 6.1 1 8.1.7 1 1.5 2.1 2.5 2 .1 0 1.4-.4 2.5-.4s1.5.4 2.6.4 1.8-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.2s-2-.8-2-3.2zM9.6 3.2c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.4 2.3-1.1z" />
              </svg>
              {busy ? "Öppnar Apple Pay…" : `Apple Pay ${kr(amount)}`}
            </>
          ) : method === "card" ? (
            `Betala ${kr(amount)} med kort`
          ) : method === "swish" ? (
            `Betala ${kr(amount)} med Swish`
          ) : (
            `Bekräfta kontant ${kr(amount)}`
          )}
        </button>
      </div>
    </div>
  );
}

function luhnOk(number: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let n = Number(number[i]);
    if (!Number.isFinite(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function RateSheet() {
  const providerId = useVelio((state) => state.providerId);
  const bookings = useVelio((state) => state.bookings);
  const setSheet = useVelio((state) => state.setSheet);
  const submitReview = useVelio((state) => state.submitReview);
  const provider = providerById(providerId);
  const service = provider ? serviceById(provider.serviceId) : null;
  const booking = bookings.find((item) => item.providerId === providerId && item.status !== "done") ?? bookings.find((item) => item.providerId === providerId);
  const price = booking?.cost ?? provider?.price ?? 0;
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState("Utmärkt jobb! Snabb, tydlig och väldigt proffsig.");
  const [tipKey, setTipKey] = useState<"10" | "15" | "20" | "custom">("15");
  const [custom, setCustom] = useState("");
  const tips = [
    { key: "10" as const, label: "10 %", amount: Math.round(price * 0.1) },
    { key: "15" as const, label: "15 %", amount: Math.round(price * 0.15) },
    { key: "20" as const, label: "20 %", amount: Math.round(price * 0.2) },
  ];
  const tip = tipKey === "custom" ? Math.max(0, Number(custom) || 0) : (tips.find((item) => item.key === tipKey)?.amount ?? 0);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black/20">
      <div className="h-16 shrink-0" />
      <div role="dialog" aria-label="Betygsätt arbetet" className="sheet-in flex min-h-0 flex-1 flex-col rounded-t-[1.7rem] bg-[#f7f3ee]">
        <div className="flex items-center gap-3 px-4 py-4">
          <button type="button" aria-label="Stäng" onClick={() => setSheet("chat")} className="grid size-8 place-items-center">
            ×
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold">Betygsätt arbetet</h2>
          <span className="size-8" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <div className="flex items-center gap-3">
            {provider?.photo ? (
              <img src={provider.photo} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span className="grid size-14 place-items-center rounded-full bg-sand font-semibold">{provider?.initials}</span>
            )}
            <div>
              <div className="flex items-center gap-1 text-lg font-semibold">
                {provider?.name}
                <BadgeCheck className="size-4 fill-[#c4a15a] text-[#f7f3ee]" />
              </div>
              <p className="text-sm text-muted">{service?.name}</p>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <button key={index} type="button" aria-label={`${index + 1} stjärnor`} onClick={() => setStars(index + 1)}>
                <Star className={index < stars ? "size-9 fill-[#b08948] text-[#b08948]" : "size-9 text-[#b08948]"} />
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="mt-5 w-full rounded-2xl border border-[#efeae4] bg-white px-4 py-3 text-[15px] outline-none"
          />
          <p className="mt-5 font-semibold">Lägg till dricks (valfritt)</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {tips.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTipKey(item.key)}
                className={tipKey === item.key ? "rounded-2xl border-2 border-[#b08948] bg-[#f3ece3] py-2 text-center" : "rounded-2xl border border-[#e6e1db] bg-white py-2 text-center"}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-muted">{kr(item.amount)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTipKey("custom")}
              className={tipKey === "custom" ? "rounded-2xl border-2 border-[#b08948] bg-[#f3ece3] py-2 text-center text-sm font-semibold" : "rounded-2xl border border-[#e6e1db] bg-white py-2 text-center text-sm font-semibold"}
            >
              Eget
              <span className="block text-xs font-normal text-muted">belopp</span>
            </button>
          </div>
          {tipKey === "custom" ? (
            <input
              inputMode="numeric"
              value={custom}
              onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="Belopp i kr"
              className="mt-3 w-full rounded-2xl border border-[#e6e1db] bg-white px-4 py-3 outline-none"
            />
          ) : null}
        </div>
        <div className="px-4 pb-5">
          <button type="button" onClick={() => submitReview(stars, tip)} className="h-12 w-full rounded-full bg-[#9a7b45] font-semibold text-white">
            Skicka betyg & dricks
          </button>
        </div>
      </div>
    </div>
  );
}

function subject(name: string) {
  const first = name.split(" ")[0];
  if (["Erik", "Olle", "Johan", "Ali"].includes(first)) return "han";
  if (["Karin", "Sofia", "Lisa", "Fatima"].includes(first)) return "hon";
  return "de";
}

export function BookSheet() {
  const providerId = useVelio((state) => state.providerId);
  const closeSheet = useVelio((state) => state.closeSheet);
  const confirmBook = useVelio((state) => state.confirmBook);
  const provider = providerById(providerId);
  const [when, setWhen] = useState<(typeof whenOptions)[number]>(whenOptions[0]);
  if (!provider) return null;
  const service = serviceById(provider.serviceId);
  const first = provider.name.split(" ")[0];

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/30" onClick={closeSheet}>
      <div
        role="dialog"
        aria-label={service?.name ?? "Boka"}
        className="sheet-in max-h-[88%] overflow-y-auto rounded-t-[1.7rem] bg-[#fffcfa] px-5 pt-2.5 pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-[3px] w-9 rounded-full bg-[#e3ddd6]" />
        <h2 className="font-serif text-[1.85rem] leading-none font-semibold tracking-tight">{service?.name ?? "Boka"}</h2>
        <p className="mt-1.5 text-[15px] text-[#8a847e]">
          {provider.name} · {provider.area}
        </p>
        <div className="mt-4 rounded-[1.15rem] bg-[#f3ece3] px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Minimibelopp</span>
            <span className="text-[17px] font-bold tracking-tight">{kr(provider.price)}</span>
          </div>
          <p className="mt-2.5 text-[14.5px] leading-[1.45] text-[#6e6964]">
            Beloppet reserveras på ditt kort. Inget dras om arbetet inte utförs — pengarna släpps automatiskt tillbaka. Förfrågan skickas till {first}, och ni kan chatta vidare om {subject(provider.name)} accepterar uppdraget.
          </p>
        </div>
        <label className="mt-4 mb-1.5 block text-[15px] font-semibold" htmlFor="when">
          När?
        </label>
        <div className="relative">
          <select
            id="when"
            value={when}
            onChange={(event) => setWhen(event.target.value as (typeof whenOptions)[number])}
            className="w-full appearance-none rounded-[1.15rem] border border-[#e6e1db] bg-white px-4 py-3 pr-10 text-[15px] outline-none"
          >
            {whenOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[#8a847e]" />
        </div>
        <button
          type="button"
          onClick={() => confirmBook(when)}
          className="mt-3.5 h-12 w-full rounded-full bg-[#2a211c] text-[16px] font-semibold text-white"
        >
          Reservera
        </button>
        <button
          type="button"
          onClick={closeSheet}
          className="mt-2.5 h-12 w-full rounded-full border border-[#e4dfd8] bg-white text-[16px] font-semibold"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}

export function RequestSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const openChat = useVelio((state) => state.openChat);
  const cancelActive = useVelio((state) => state.cancelActive);
  const booking = useVelio((state) => state.bookings.find((item) => item.id === state.activeBookingId) ?? null);
  if (!booking) return null;
  const provider = providerById(booking.providerId);
  const accepted = booking.status === "accepted" || booking.status === "enroute" || booking.status === "scheduled";
  const amount = booking.holdKr ?? booking.cost;
  const first = provider?.name.split(" ")[0] ?? "Personen";

  return (
    <BottomSheet title={accepted ? "Förfrågan accepterad" : "Förfrågan skickad"} onClose={closeSheet}>
      <p className="text-sm leading-relaxed text-muted">
        {kr(amount)} är reserverat på kortet. Inget dras från kontot om arbetet inte utförs — då släpps pengarna direkt.
      </p>
      <div className="mt-4 rounded-2xl bg-soft px-4 py-3">
        <div className="font-semibold">{provider?.name}</div>
        <p className="mt-1 text-sm text-muted">
          {accepted ? `${first} har accepterat. Nu kan ni chatta.` : `Väntar på att ${first} accepterar…`}
        </p>
      </div>
      {accepted ? (
        <Btn className="mt-4" onClick={openChat}>
          Öppna chatt
        </Btn>
      ) : (
        <p className="mt-4 text-center text-sm text-muted">Förfrågan är skickad.</p>
      )}
      <Btn variant="secondary" className="mt-2" onClick={cancelActive}>
        Avbryt — släpp reservationen
      </Btn>
    </BottomSheet>
  );
}

export function SortSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const setSort = useVelio((state) => state.setSort);
  const keys = Object.keys(sortLabels) as SortKey[];
  return (
    <BottomSheet title="Sortera" onClose={closeSheet}>
      <div className="space-y-2">
        {keys.map((key) => (
          <Btn key={key} variant="secondary" onClick={() => setSort(key)}>
            {sortLabels[key]}
          </Btn>
        ))}
      </div>
    </BottomSheet>
  );
}

export function CartSheet() {
  const cart = useVelio((state) => state.cart);
  const removeFromCart = useVelio((state) => state.removeFromCart);
  const checkoutCart = useVelio((state) => state.checkoutCart);
  const closeSheet = useVelio((state) => state.closeSheet);
  const openProvider = useVelio((state) => state.openProvider);

  return (
    <BottomSheet title="Kundvagn" onClose={closeSheet}>
      {cart.length === 0 ? (
        <p className="mb-4 text-sm text-muted">Inget sparat ännu. Lägg till en utförare från deras profil.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {cart.map((item) => {
            const provider = providerById(item.providerId);
            const service = serviceById(item.serviceId);
            if (!provider || !service) return null;
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <button type="button" onClick={() => openProvider(provider.id)} className="min-w-0 flex-1 text-left">
                  <span className="block font-semibold">{service.name}</span>
                  <span className="text-sm text-muted">
                    {provider.name} · fr. {kr(provider.price)}
                  </span>
                </button>
                <button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-semibold">
                  Ta bort
                </button>
              </div>
            );
          })}
        </div>
      )}
      <Btn disabled={!cart.length} onClick={checkoutCart}>
        Boka alla
      </Btn>
    </BottomSheet>
  );
}

export function ReceiptSheet() {
  const receiptId = useVelio((state) => state.receiptId);
  const bookings = useVelio((state) => state.bookings);
  const closeSheet = useVelio((state) => state.closeSheet);
  const go = useVelio((state) => state.go);
  const rebook = useVelio((state) => state.rebook);
  const booking = bookings.find((item) => item.id === receiptId);
  if (!booking) return null;
  const service = serviceById(booking.serviceId);
  const provider = providerById(booking.providerId);

  return (
    <FullScreen title="Bokningsdetaljer" onBack={closeSheet}>
      <div className="space-y-3 bg-soft px-5 py-5">
        <div className="flex items-center justify-between rounded-2xl bg-paper p-4">
          <div>
            <div className="font-display text-xl font-semibold">{service?.name}</div>
            <div className="text-sm text-muted">{provider?.name}</div>
          </div>
          <Avatar text={provider?.initials ?? "—"} />
        </div>
        <div className="rounded-2xl bg-paper px-4">
          <Row label="Plats" value={booking.location} />
          <Row label="Tid" value={booking.whenLabel} />
          {booking.holdKr ? (
            <Row label={booking.status === "done" ? "Draget" : "Reserverat"} value={kr(booking.holdKr)} />
          ) : (
            <Row label="Kostnad" value={kr(booking.cost)} />
          )}
          {booking.tip != null ? <Row label="Dricks" value={kr(booking.tip)} /> : null}
          <Row
            label="Status"
            value={bookingStatusLabel(booking.status)}
          />
          {booking.rating != null ? (
            <Row label="Betyg" value={`${ratingLabel(booking.rating)} ★`} last />
          ) : (
            <Row label="Betyg" value="Inte satt" last />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="secondary"
            onClick={() => download(`velio-kvitto-${booking.id.slice(0, 6)}.txt`, receiptText(booking))}
          >
            <Download className="size-4" /> Kvitto
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => download(`velio-faktura-${booking.id.slice(0, 6)}.txt`, `FAKTURA\n${receiptText(booking)}`)}
          >
            <FileText className="size-4" /> Faktura
          </Btn>
        </div>
        <Btn onClick={() => rebook(booking.id)}>Boka om</Btn>
        <Btn
          variant="secondary"
          onClick={() => {
            closeSheet();
            go("help");
          }}
        >
          Hjälp med bokningen
        </Btn>
      </div>
    </FullScreen>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? "flex items-center justify-between py-3.5" : "flex items-center justify-between border-b border-line py-3.5"}>
      <span className="text-muted">{label}</span>
      <strong className="text-right text-sm">{value}</strong>
    </div>
  );
}

export function TrackSheet() {
  const booking = useVelio((state) => state.bookings.find((item) => item.id === state.activeBookingId) ?? null);
  const closeSheet = useVelio((state) => state.closeSheet);
  const cancelActive = useVelio((state) => state.cancelActive);
  const completeActive = useVelio((state) => state.completeActive);
  const openChat = useVelio((state) => state.openChat);
  const openProvider = useVelio((state) => state.openProvider);
  const locationOn = useVelio((state) => state.locationOn);
  const userLocation = useVelio((state) => state.userLocation);
  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState(50);
  const [doneStep, setDoneStep] = useState(false);

  if (!booking) return null;
  const provider = providerById(booking.providerId);
  const service = serviceById(booking.serviceId);
  if (!provider) return null;

  return (
    <FullScreen title="På väg" onBack={closeSheet}>
      <div className="flex h-full min-h-[28rem] flex-col">
        <div className="min-h-64 flex-1">
          <CityMap
            people={[provider]}
            locationOn={locationOn}
            userLocation={userLocation}
            activeArea={provider.area}
            onArea={() => undefined}
            onClear={() => undefined}
            onProvider={openProvider}
          />
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <div className="font-display text-xl font-semibold">{provider.name}</div>
            <p className="text-sm text-muted">
              {service?.name} · ca {provider.etaMin} min · {booking.location}
            </p>
          </div>
          {doneStep ? (
            <>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, index) => (
                  <button key={index} type="button" aria-label={`${index + 1} stjärnor`} onClick={() => setRating(index + 1)}>
                    <Star className={index < rating ? "size-7 fill-ink text-ink" : "size-7 text-ink"} />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {[0, 20, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTip(amount)}
                    className={
                      tip === amount
                        ? "rounded-full bg-ink px-3 py-2 text-sm font-semibold text-paper"
                        : "rounded-full bg-soft px-3 py-2 text-sm font-semibold"
                    }
                  >
                    {amount === 0 ? "Ingen dricks" : kr(amount)}
                  </button>
                ))}
              </div>
              <Btn onClick={() => completeActive(rating, tip)}>Skicka betyg</Btn>
            </>
          ) : (
            <>
              <Btn
                variant="secondary"
                onClick={() => {
                  openProvider(provider.id);
                  openChat();
                }}
              >
                Skriv till {provider.name.split(" ")[0]}
              </Btn>
              <Btn onClick={() => setDoneStep(true)}>Markera som klar</Btn>
              <button type="button" onClick={cancelActive} className="w-full py-2 text-sm font-semibold text-muted">
                Avbryt uppdrag
              </button>
            </>
          )}
        </div>
      </div>
    </FullScreen>
  );
}

export function LocationSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const allowLocation = useVelio((state) => state.allowLocation);
  const clearLocation = useVelio((state) => state.clearLocation);
  const locationOn = useVelio((state) => state.locationOn);
  const locationBusy = useVelio((state) => state.locationBusy);
  const userLocation = useVelio((state) => state.userLocation);
  const showToast = useVelio((state) => state.showToast);
  return (
    <BottomSheet title="Dela plats" onClose={closeSheet}>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        VELIO hämtar din riktiga GPS-position från enheten och visar den som en grön markör på OpenStreetMap. Ingen låtsasadress
        används.
      </p>
      {locationOn && userLocation ? (
        <div className="mb-4 rounded-2xl bg-soft px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2f7a3c]">
            <span className="size-2 rounded-full bg-[#3d8f4a]" />
            Din plats är på
          </div>
          <p className="mt-1 font-semibold">{userLocation.label}</p>
          <p className="mt-1 text-xs text-muted">
            {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
            {userLocation.accuracy ? ` · ±${Math.round(userLocation.accuracy)} m` : ""}
          </p>
        </div>
      ) : null}
      <Btn disabled={locationBusy} onClick={() => void allowLocation()}>
        {locationBusy ? "Hämtar GPS…" : locationOn ? "Uppdatera min plats" : "Tillåt riktig plats"}
      </Btn>
      {locationOn ? (
        <Btn variant="secondary" className="mt-2" onClick={clearLocation}>
          Sluta dela plats
        </Btn>
      ) : (
        <Btn
          variant="secondary"
          className="mt-2"
          onClick={() => {
            closeSheet();
            showToast("Plats delas inte. Du kan slå på den senare.");
          }}
        >
          Inte nu
        </Btn>
      )}
    </BottomSheet>
  );
}

export function BankIdSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const applyMe = useVelio((state) => state.applyMe);
  const showToast = useVelio((state) => state.showToast);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Tryck för att öppna BankID-appen.");
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const openApp = (url: string) => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = url;
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Startar BankID…");
    try {
      const { isStaticHost } = await import("@/lib/velio/local-auth");
      if (isStaticHost()) {
        throw new Error("BankID kräver en aktiverad BankID-koppling som öppnar BankID-appen.");
      }
      const { startBankIdLogin, collectBankIdLogin, fetchMe } = await import("@/lib/velio/auth-api");
      const started = await startBankIdLogin();
      setLaunchUrl(started.launchUrl);
      setStatus("Öppna BankID-appen och identifiera dig.");
      openApp(started.launchUrl);
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        void (async () => {
          const result = await collectBankIdLogin({
            challengeId: started.challengeId,
            orderRef: started.orderRef,
          });
          if (result.status === "pending") {
            setStatus("Väntar på BankID-appen…");
            return;
          }
          if (pollRef.current) window.clearInterval(pollRef.current);
          if (result.status === "failed") {
            setStatus(result.message || "BankID misslyckades");
            return;
          }
          const me = await fetchMe();
          if (!me.authenticated) throw new Error("BankID-inloggning misslyckades");
          applyMe(me);
          closeSheet();
        })().catch((error) => {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStatus(error instanceof Error ? error.message : "BankID misslyckades");
        });
      }, 2000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "BankID misslyckades");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title="BankID" onClose={closeSheet}>
      <p className="mb-4 text-sm leading-relaxed text-muted">{status}</p>
      <Btn
        disabled={busy}
        onClick={() => {
          if (launchUrl) openApp(launchUrl);
          else void start();
        }}
      >
        {busy ? "Startar…" : "Öppna BankID"}
      </Btn>
      <Btn variant="secondary" className="mt-2" onClick={closeSheet}>
        Avbryt
      </Btn>
    </BottomSheet>
  );
}
