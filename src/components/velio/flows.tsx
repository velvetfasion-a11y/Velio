import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FileText, Star, Bell, ArrowLeft, Heart, BadgeCheck, Shield, Calendar, MessageCircle, Clock, ChevronDown, ChevronRight, MapPin, Camera, Wrench, Phone, Ellipsis, Plus, Navigation, ClipboardCheck, Car, Check, Coins, CreditCard, Mic, Send, Briefcase, Pencil, Ban, ClipboardList, Headphones, X, Lock, ShieldCheck, Receipt, type LucideIcon } from "lucide-react";
import { kr, providerById, providerDescription, providerTradeNames, ratingLabel, serviceById, sortLabels, whenOptions, type SortKey } from "@/lib/velio/data";
import { ownBusiness, useVelio, bookingStatusLabel, type Booking, type ChatCard, type ChatMsg } from "@/lib/velio/store";
import { priceOrQuote, formatKr, normalizeJobPrice, jobPriceCard } from "@/lib/velio/price";
import { displayMessage } from "@/lib/velio/chat-codec";
import { capturePosition } from "@/lib/velio/geo";
import { etaFromArea, geocodePlace, routeEta } from "@/lib/velio/route-eta";
import { isCloudActive } from "@/lib/firebase/session";
import { BookingChangeCard, FinalPriceMessage, OnTheWayCard, TimeConfirmationCard } from "@/components/velio/chat-cards";
import { cn } from "@/lib/cn";
import { AppHeader, PlaceLink } from "@/components/velio/header";
import { CityMap } from "@/components/velio/osm-map";
import { BottomSheet, Btn, FullScreen } from "@/components/velio/ui";
import { asset } from "@/lib/velio/asset";
import { openCallSheet } from "@/components/velio/call-host";
import { openSupportSheet } from "@/components/velio/support-sheet";
import { MissedCallCard } from "@/components/velio/call-screen";
import { MISSED_CALL_TEXT } from "@/lib/calls/ice";

const EMPTY_CHAT: ChatMsg[] = [];

function useChatBottom(scroller: RefObject<HTMLDivElement | null>, threadKey: string, revision: string) {
  const stick = useRef(true);
  const pinning = useRef(false);

  const pin = () => {
    const node = scroller.current;
    if (!node || !stick.current) return;
    pinning.current = true;
    node.scrollTop = node.scrollHeight;
    window.requestAnimationFrame(() => {
      pinning.current = false;
    });
  };

  useLayoutEffect(() => {
    stick.current = true;
    pin();
    // Opening a thread always starts on the latest message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey]);

  useLayoutEffect(() => {
    pin();
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      pin();
      inner = window.requestAnimationFrame(pin);
    });
    return () => {
      window.cancelAnimationFrame(outer);
      if (inner) window.cancelAnimationFrame(inner);
    };
    // Follow new messages only while the reader is already near the bottom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey, revision]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const onScroll = () => {
      if (pinning.current) return;
      const gap = node.scrollHeight - node.scrollTop - node.clientHeight;
      stick.current = gap < 96;
    };
    const onLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement) pin();
    };
    const observer = new ResizeObserver(() => pin());
    const watch = () => {
      observer.observe(node);
      for (const child of node.children) observer.observe(child);
    };
    watch();
    const mutations = new MutationObserver(() => {
      watch();
      pin();
    });
    mutations.observe(node, { childList: true, subtree: true });
    node.addEventListener("scroll", onScroll, { passive: true });
    node.addEventListener("load", onLoad, true);
    const late = window.setTimeout(pin, 280);
    return () => {
      window.clearTimeout(late);
      observer.disconnect();
      mutations.disconnect();
      node.removeEventListener("scroll", onScroll);
      node.removeEventListener("load", onLoad, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey, revision]);
}

function clockNow() {
  return new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function progressStep(messages: ChatMsg[]) {
  const shown = messages.map(displayMessage);
  const paid = shown.some((message) => message.card?.kind === "paid" || (message.card?.kind === "final_price" && message.card.status === "paid"));
  let resetAt = -1;
  shown.forEach((message, index) => {
    if (message.card?.kind === "booking_change" && message.card.status === "accepted") resetAt = index;
  });
  const relevant = resetAt >= 0 ? shown.slice(resetAt) : shown;
  const arrived = relevant.some((message) => message.card?.kind === "on_the_way" && message.card.status === "arrived") || relevant.some((message) => /framme/i.test(message.text || ""));
  const enroute = relevant.some((message) => message.card?.kind === "on_the_way" && message.card.status === "enroute") || relevant.some((message) => /på väg/i.test(message.text || ""));
  const timeSet = relevant.some((message) => message.card?.kind === "time_confirmation" || message.card?.kind === "slot" || (message.card?.kind === "booking_change" && message.card.status === "accepted"));
  if (paid) return 4;
  if (arrived) return 3;
  if (enroute) return 2;
  if (timeSet) return 1;
  return 0;
}

async function linkedJobId(peerId: string) {
  const { chatForPeer } = await import("@/lib/firebase/cloud");
  const fromChat = chatForPeer(peerId)?.jobId;
  if (fromChat) return fromChat;
  const state = useVelio.getState();
  const uid = state.accountId;
  const offer = state.jobOffers.find(
    (item) =>
      item.jobId &&
      item.status !== "declined" &&
      item.status !== "withdrawn" &&
      ((item.ownerId === uid && item.jobOwnerId === peerId) || (item.jobOwnerId === uid && item.ownerId === peerId)),
  );
  if (offer) return offer.jobId;
  return state.posted.find((job) => job.ownerId === uid && job.status !== "completed" && job.status !== "cancelled")?.id || "";
}

async function publishCard(peerId: string, card: ChatCard, jobId?: string) {
  if (!peerId) return;
  useVelio.getState().appendChat(peerId, { id: `card-${Date.now()}`, from: "me", time: clockNow(), card });
  if (!isCloudActive()) return;
  try {
    const { sendStructuredMessage } = await import("@/lib/firebase/cloud");
    if (card.kind === "time_confirmation") {
      await sendStructuredMessage(peerId, { type: "time_confirmation", date: card.date, time: card.time, place: card.place, service: card.service }, jobId);
    } else if (card.kind === "final_price") {
      await sendStructuredMessage(peerId, {
        type: "final_price",
        service: card.service,
        amount: card.amount,
        when: card.when,
        place: card.place,
        hours: card.hours,
        rate: card.rate,
      }, jobId);
    } else if (card.kind === "booking_change") {
      await sendStructuredMessage(peerId, {
        type: "booking_change",
        date: card.date,
        time: card.time,
        place: card.place,
        description: card.description,
        service: card.service,
      }, jobId);
    } else if (card.kind === "on_the_way" && card.status === "enroute") {
      await sendStructuredMessage(
        peerId,
        {
          type: "on_the_way",
          place: card.place,
          etaMin: card.etaMin,
          etaMax: card.etaMax,
          distanceM: card.distanceM,
          approximate: card.approximate,
          lat: card.lat,
          lng: card.lng,
          jobLat: card.jobLat,
          jobLng: card.jobLng,
        },
        jobId,
      );
    }
  } catch (error) {
    const { cloudErrorSv } = await import("@/lib/firebase/cloud");
    useVelio.getState().showToast(cloudErrorSv(error));
  }
}

async function patchCard(peerId: string, messageId: string, patch: Record<string, unknown>, remote = true) {
  const state = useVelio.getState();
  const prev = state.chats[peerId] ?? [];
  useVelio.setState({
    chats: {
      ...state.chats,
      [peerId]: prev.map((message) => (message.id === messageId && message.card ? { ...message, card: { ...message.card, ...patch } as ChatCard } : message)),
    },
  });
  if (!remote || !isCloudActive() || messageId.startsWith("card-") || messageId.startsWith("local-")) return;
  try {
    const { patchStructuredMessage } = await import("@/lib/firebase/cloud");
    await patchStructuredMessage(peerId, messageId, patch);
  } catch (error) {
    const { cloudErrorSv } = await import("@/lib/firebase/cloud");
    useVelio.getState().showToast(cloudErrorSv(error));
  }
}

async function answerBookingChange(peerId: string, message: ChatMsg, status: "accepted" | "declined") {
  if (message.card?.kind !== "booking_change") return;
  const card = message.card;
  if (status === "declined") {
    await patchCard(peerId, message.id, { status: "declined" });
    useVelio.getState().showToast("Förslaget är avböjt");
    return;
  }
  const jobId = await linkedJobId(peerId);
  let remotePatched = false;
  if (jobId && isCloudActive() && !message.id.startsWith("card-")) {
    try {
      const { acceptCloudBookingChange } = await import("@/lib/stripe/api");
      await acceptCloudBookingChange(jobId, message.id);
      remotePatched = true;
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      if (!/finns inte|inte kopplad|Failed to fetch|NetworkError|Load failed|Not found|Okänd väg/i.test(text)) {
        useVelio.getState().showToast(text || "Tiden kunde inte ändras");
        return;
      }
    }
  }
  if (!remotePatched && jobId && isCloudActive()) {
    try {
      const { applyBookingOnJob } = await import("@/lib/firebase/cloud");
      await applyBookingOnJob(jobId, { when: `${card.date}, ${card.time}`, place: card.place, description: card.description });
    } catch (error) {
      const { cloudErrorSv } = await import("@/lib/firebase/cloud");
      useVelio.getState().showToast(cloudErrorSv(error));
      return;
    }
  }
  await patchCard(peerId, message.id, { status: "accepted" }, !remotePatched);
  const label = `${card.date}, ${card.time}`;
  const state = useVelio.getState();
  useVelio.setState({
    bookings: state.bookings.map((item) => (item.providerId === peerId && item.status !== "done" ? { ...item, whenLabel: label, location: card.place || item.location } : item)),
  });
  useVelio.getState().showToast("Ny tid är bekräftad");
}

async function cancelThread(peerId: string, reason: string) {
  const jobId = await linkedJobId(peerId);
  if (jobId && isCloudActive()) {
    try {
      const { cancelCloudJob } = await import("@/lib/stripe/api");
      await cancelCloudJob(jobId, reason);
      useVelio.getState().showToast("Uppdraget är avbokat");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/finns inte|inte kopplad|Failed to fetch|NetworkError|Load failed/i.test(message)) {
        useVelio.getState().showToast(message || "Kunde inte avboka");
        return;
      }
    }
  }
  const booking = useVelio.getState().bookings.find((item) => item.providerId === peerId && item.status !== "done");
  if (booking) useVelio.getState().cancelBooking(booking.id);
  useVelio.getState().appendChat(peerId, { id: `cancel-${Date.now()}`, from: "system", time: clockNow(), card: { kind: "cancelled" } });
  useVelio.getState().showToast("Uppdraget är avbokat. En reserverad betalning släpps.");
}

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
  const accountId = useVelio((state) => state.accountId);
  const directory = useVelio((state) => state.directory);
  const loggedIn = useVelio((state) => state.loggedIn);
  const go = useVelio((state) => state.go);
  const setAccountMode = useVelio((state) => state.setAccountMode);
  const favorites = useVelio((state) => state.favorites);
  const toggleFavorite = useVelio((state) => state.toggleFavorite);
  const provider = providerById(providerId);
  const saved = provider ? favorites.includes(provider.id) : false;
  if (!provider) return null;
  const own = ownBusiness({ accountId, directory, loggedIn });
  const mine = own?.id === provider.id;
  const service = serviceById(provider.serviceId);
  const available = provider.etaMin <= 20;
  const tags = provider.tags ?? [];

  return (
    <div className="sheet-in absolute inset-0 z-30 flex flex-col bg-cream">
      <div className="relative shrink-0">
        {provider.photo ? (
          <img src={provider.photo} alt="" className="h-56 w-full object-cover object-[center_20%]" />
        ) : (
          <div className="grid h-44 place-items-center bg-sand text-5xl font-semibold text-brown">{provider.initials}</div>
        )}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 text-paper">
          <AppHeader tone="glass" />
        </div>
        <button
          type="button"
          aria-label={saved ? `Ta bort ${provider.name}` : `Spara ${provider.name}`}
          onClick={() => toggleFavorite(provider.id)}
          className="glass absolute right-4 bottom-4 grid size-11 place-items-center rounded-full text-ink"
        >
          <Heart className={saved ? "size-5 fill-brown text-brown" : "size-5"} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-28">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="ios-title flex items-center gap-2 text-[1.85rem]">
              {provider.name}
              {provider.demo ? (
                <span className="rounded-full bg-brown px-2 py-0.5 text-xs font-semibold tracking-wide text-paper">Demo</span>
              ) : (
                <BadgeCheck className="size-6 shrink-0 fill-gold text-paper" aria-label="Verifierad profil" />
              )}
            </h2>
            {provider.title || provider.experience ? (
              <p className="mt-2 text-sm font-medium">
                {[provider.title, provider.experience].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-muted">
              {providerTradeNames(provider).join(" · ") || service?.name}
              {provider.place || provider.area ? ` · ${provider.place ?? provider.area}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <span className="mt-1 h-10 w-px bg-line" />
            <div className="text-right">
              <div className="text-lg font-semibold">fr. {kr(provider.price)}</div>
              <p className="text-[11px] text-muted">Minsta summa</p>
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
          {providerDescription(provider) ? (
            <p className="mt-1 text-left text-sm leading-relaxed whitespace-pre-line">{providerDescription(provider)}</p>
          ) : (
            <p className="mt-1 text-sm text-muted">Ingen beskrivning ännu.</p>
          )}
          {provider.photos?.some((src) => src.startsWith("data:")) ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {provider.photos.filter((src) => src.startsWith("data:")).map((src) => (
                <img key={src.slice(0, 48)} src={src} alt="" className="h-28 w-36 shrink-0 rounded-2xl object-cover" />
              ))}
            </div>
          ) : null}
        </div>

        {provider.offers?.length ? (
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="text-lg font-semibold">Boka en tjänst</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {provider.offers.slice(0, 8).map((offer) => (
                <button
                  key={`${offer.name}-${offer.price}`}
                  type="button"
                  onClick={() => {
                    useVelio.getState().setBookOffer({ name: offer.name, price: offer.price });
                  }}
                  className="rounded-2xl border border-line bg-paper px-3 py-3 text-left"
                >
                  <span className="block font-semibold leading-tight">{offer.name}</span>
                  <span className="mt-1 block text-sm text-muted">fr. {kr(offer.price)}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => useVelio.getState().setBookOffer(null)}
              className="mt-2 h-11 w-full rounded-full border border-line text-sm font-semibold"
            >
              Beskriv ditt jobb
            </button>
            {provider.qualifications?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {provider.qualifications.map((item) => (
                  <span key={item} className="rounded-full border border-line px-3 py-1 text-sm">{item}</span>
                ))}
              </div>
            ) : null}
            {provider.includes?.length ? <p className="mt-2 text-sm text-muted">Ingår: {provider.includes.join(", ")}</p> : null}
            {provider.extras?.length ? (
              <p className="mt-1 text-sm text-muted">Tillval: {provider.extras.map((extra) => `${extra.name} + ${kr(extra.price)}`).join(", ")}</p>
            ) : null}
          </div>
        ) : null}

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

        {provider.sellerKind === "private" ? (
          <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
            <p className="font-semibold">Privatperson</p>
            <p className="mt-1 leading-relaxed text-muted">
              Kunden kan behöva hantera skatt och RUT på ett annat sätt än mot ett företag. Texten är en platshållare, inte juridisk vägledning.
            </p>
          </div>
        ) : provider.orgNumber || provider.companyName || provider.fTax ? (
          <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
            <p className="font-semibold">Företagsuppgifter</p>
            <p className="mt-1 text-muted">Angivet av utföraren. VELIO har inte kontrollerat bolaget.</p>
            {provider.companyName ? <p className="mt-2">{provider.companyName}</p> : null}
            {provider.orgNumber ? <p>Org.nr {provider.orgNumber}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-cream/90 px-4 py-3 backdrop-blur-xl">
        {mine ? (
          <button
            type="button"
            onClick={() => {
              setAccountMode("business");
              closeSheet();
              go("business");
            }}
            className="h-12 w-full rounded-full bg-brown text-base font-semibold text-paper"
          >
            Öppna min businessprofil
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={openChat} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-paper text-sm font-semibold">
              <MessageCircle className="size-5" />
              Meddelande
            </button>
            <button type="button" onClick={() => useVelio.getState().setBookOffer(null)} className="h-12 flex-[1.4] rounded-full bg-brown text-base font-semibold text-paper">
              Boka
            </button>
          </div>
        )}
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
  const [help, setHelp] = useState<null | "menu" | "report" | "detail" | "change" | "rebook" | "problem" | "sure" | "cancel">(null);
  const [cancelReason, setCancelReason] = useState("");
  const [issue, setIssue] = useState("");
  const [note, setNote] = useState("");
  const [changeDate, setChangeDate] = useState<Date | null>(null);
  const [changeTime, setChangeTime] = useState("");
  const [changePlace, setChangePlace] = useState("");
  const [changeAbout, setChangeAbout] = useState("");
  const [rebookWhen, setRebookWhen] = useState<(typeof whenOptions)[number]>(whenOptions[0]);
  const scroller = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  useChatBottom(scroller, providerId || "customer", `${lastId ?? ""}:${messages.length}`);

  const backToInbox = () => {
    closeSheet();
    go("inbox");
  };

  if (accountMode === "business") return <WorkerChat onClose={backToInbox} />;
  if (!provider && !peer) return null;
  if (!provider && peer) {
    return <SyncedPeerChat peerId={peer.id} peerName={peer.name} messages={messages} draft={draft} setDraft={setDraft} onSend={() => { if (!draft.trim()) return; sendChat(draft); setDraft(""); }} onClose={backToInbox} />;
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
    <div className="absolute inset-0 z-30 flex flex-col bg-cream">
      <div className="sticky top-0 z-10 bg-cream/90 px-4 pt-3 backdrop-blur-xl">
        <PlaceLink />
        <div className="mt-1 flex items-center">
          <button type="button" aria-label="Tillbaka" onClick={backToInbox} className="grid size-9 place-items-center">
            <ArrowLeft className="size-5" />
          </button>
          <button type="button" onClick={() => { closeSheet(); go("home"); }} className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</button>
          <button type="button" aria-label="Ring" onClick={() => openCallSheet({ peerId: provider.id, peerName: provider.name })} className="grid size-9 place-items-center">
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
          {provider.photo ? (
            <img src={provider.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sand text-sm font-semibold">{provider.initials}</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-lg font-semibold">
              {provider.name}
              <BadgeCheck className="size-4 fill-gold text-[#f7f3ee]" />
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted">
              {service?.name}
              <span className="size-1.5 rounded-full bg-ok" />
              <span className={cancelled ? "text-muted" : "text-ok"}>{cancelled ? "Avbokad" : finished ? "Klar" : status.label}</span>
            </span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </button>
        <div className="mt-2 mb-2 rounded-[1.2rem] border border-line bg-paper p-2.5 shadow-soft">
          <div className="flex gap-3">
            <img src={service?.imageThumb ?? asset("/velio/categories/stad-thumb.webp")} alt="" className="size-16 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{jobTitle}</p>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs", finished ? "bg-ok/15 text-ok" : cancelled ? "bg-sand text-muted" : "bg-wheat text-brown")}>{finished ? "Klar" : cancelled ? "Avbokad" : "Pågående"}</span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted"><Calendar className="size-3.5" /> {jobWhen}</p>
              <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" /> {jobPlace}</p>
            </div>
          </div>
          {finished || cancelled ? (
            <button type="button" onClick={() => setHelp("rebook")} className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-brown py-2.5 text-sm font-semibold text-white">
              {cancelled ? "Boka om" : "Boka igen"}
            </button>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setCancelReason(""); setHelp("cancel"); }} className="flex items-center justify-center gap-1 rounded-full border border-line bg-cream py-2.5 text-sm font-medium">
                <Calendar className="size-4" /> Avboka
              </button>
              <button type="button" onClick={() => setHelp("change")} className="flex items-center justify-center gap-1 rounded-full border border-line bg-cream py-2.5 text-sm font-medium">
                <ClipboardList className="size-4" /> Ändra bokning
              </button>
            </div>
          )}
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [overflow-anchor:none]">
        {messages.map((raw) => {
          const message = displayMessage(raw);
          return (
          <div key={message.id} className="mb-3">
            {message.day ? <p className="mb-3 text-center text-xs text-muted">{message.day}</p> : null}
            {message.text === MISSED_CALL_TEXT ? (
              <MissedCallCard time={message.time} />
            ) : message.card?.kind === "time_confirmation" ? (
              <TimeConfirmationCard
                card={message.card}
                mine={message.from === "me"}
                time={message.time}
                onAccept={() => void patchCard(provider.id, message.id, { status: "confirmed" })}
                onPropose={() => setHelp("change")}
              />
            ) : message.card?.kind === "booking_change" ? (
              <BookingChangeCard
                card={message.card}
                mine={message.from === "me"}
                time={message.time}
                onAccept={() => void answerBookingChange(provider.id, message, "accepted")}
                onDecline={() => void answerBookingChange(provider.id, message, "declined")}
              />
            ) : message.card?.kind === "final_price" ? (
              <FinalPriceMessage
                card={message.card}
                mine={message.from === "me"}
                time={message.time}
                onPay={() => {
                  if (message.card?.kind !== "final_price" || message.card.status === "paid") return;
                  const priceCard = message.card;
                  const state = useVelio.getState();
                  const offer = state.jobOffers.find((item) => item.jobOwnerId === state.accountId && item.ownerId === provider.id && item.status !== "declined");
                  useVelio.setState({
                    checkoutOpen: true,
                    checkout: {
                      offerId: offer?.id || "demo",
                      jobId: offer?.jobId || "chat",
                      jobTitle: priceCard.service,
                      workerName: provider.name,
                      workerId: offer?.ownerId || provider.id,
                      whenLabel: priceCard.when,
                      priceSek: priceCard.amount,
                    },
                    checkoutAfter: () => {
                      void patchCard(provider.id, message.id, { status: "paid" });
                    },
                  });
                }}
              />
            ) : message.card?.kind === "on_the_way" ? (
              <OnTheWayCard card={message.card} time={message.time} />
            ) : message.card?.kind === "reschedule" ? (
              <div className="rounded-[1.2rem] border border-line bg-white px-4 py-3">
                <p className="font-semibold">Ny förfrågan skickad</p>
                <p className="mt-1 text-sm text-muted">{message.card.service} · {message.card.when}</p>
                <p className="text-sm text-muted">{message.card.place}</p>
              </div>
            ) : message.card?.kind === "rebook" ? (
              <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Förfrågan skickad</h3>
                <div className="mt-2 space-y-1 text-[15px]">
                  <p><span className="font-semibold">Tjänst:</span> {message.card.service}</p>
                  <p><span className="font-semibold">Om jobbet:</span> {message.card.about}</p>
                  <p><span className="font-semibold">Tid:</span> {message.card.when}</p>
                  <p><span className="font-semibold">Plats:</span> {message.card.place}</p>
                  <p><span className="font-semibold">Pris:</span> {priceOrQuote(message.card.price)}</p>
                </div>
                <p className="mt-3 text-sm text-muted">{message.card.status === "accepted" ? "Godkänd" : message.card.status === "declined" ? "Nekad" : "Väntar på att arbetaren svarar"}</p>
              </div>
            ) : message.card?.kind === "cancelled" ? (
              <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Jobbet avbokat</h3>
                <p className="mt-2 text-[15px]">Reservera jobbet igen för att chatta med {provider.name}.</p>
              </div>
            ) : message.card?.kind === "paid" ? (
              <div className="rounded-[1.2rem] border border-line bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-sand"><CreditCard className="size-4" /></span>
                  <span>
                    <span className="block font-semibold">Betalning mottagen</span>
                    <span className="block text-sm text-muted">{message.card.amount.toLocaleString("sv-SE")} kr har betalats av kunden.</span>
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
                <div className={message.from === "me" ? "max-w-[78%] rounded-[1.25rem] rounded-br-md bg-brown px-4 py-3 text-[15px] leading-snug text-paper" : "max-w-[85%] rounded-[1.25rem] rounded-bl-md border border-line bg-paper px-4 py-3 text-[15px] leading-snug"}>
                  <p>{message.text}</p>
                  <p className={message.from === "me" ? "mt-1 text-right text-[11px] text-paper/80" : "mt-1 text-right text-[11px] text-muted"}>
                    {message.time ? message.time : ""}
                    {message.from === "me"
                      ? ` · ${messages.slice(messages.indexOf(raw) + 1).some((later) => later.from === "them") ? "Läst" : "Skickat"}`
                      : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
      {cancelled ? (
        <p className="px-4 py-4 text-center text-[15px]">Reservera jobbet igen för att chatta med {provider.name}.</p>
      ) : (
      <div className="border-t border-line bg-cream/95 px-3 pt-2 pb-3 backdrop-blur-xl">
        <p className="mb-2 flex items-start gap-1.5 px-1 text-[11px] leading-snug text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brown" aria-hidden="true" />
          Håll kontakten i VELIO. Dela inte personnummer och betala inte utanför appen.
        </p>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendChat(draft);
          setDraft("");
        }}
      >
        <button type="button" aria-label="Bifoga" onClick={() => showToast("Bifoga bild kommer snart")} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-paper">
          <Plus className="size-5" />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Skriv ett meddelande..."
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-3 text-base outline-none"
        />
        <button type="submit" aria-label="Skicka" className="grid size-11 shrink-0 place-items-center rounded-full bg-brown text-white">
          <Send className="size-5" />
        </button>
      </form>
      </div>
      )}
      {help === "rebook" ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/30" onClick={() => setHelp(null)}>
          <div className="max-h-[88%] overflow-y-auto rounded-t-[1.7rem] bg-paper px-5 pt-2.5 pb-5" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-[3px] w-9 rounded-full bg-line" />
            <h2 className="font-serif text-[1.85rem] leading-none font-semibold tracking-tight">{service?.name ?? jobTitle}</h2>
            <p className="mt-1.5 text-[15px] text-muted">{provider.name} · {provider.area}</p>
            <div className="mt-4 rounded-[1.15rem] bg-sand px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold">Minimibelopp</span>
                <span className="text-[17px] font-bold tracking-tight">{kr(provider.price)}</span>
              </div>
              <p className="mt-2.5 text-[14.5px] leading-[1.45] text-muted">
                Beloppet reserveras på ditt kort. Inget dras om arbetet inte utförs — pengarna släpps automatiskt tillbaka. Förfrågan skickas till {provider.name.split(" ")[0]}, och ni kan chatta vidare om {subject(provider.name)} accepterar uppdraget.
              </p>
            </div>
            <label className="mt-4 mb-1.5 block text-[15px] font-semibold" htmlFor="rebook-when">När?</label>
            <div className="relative">
              <select
                id="rebook-when"
                value={rebookWhen}
                onChange={(event) => setRebookWhen(event.target.value as (typeof whenOptions)[number])}
                className="w-full appearance-none rounded-[1.15rem] border border-line bg-white px-4 py-3 pr-10 text-[15px] outline-none"
              >
                {whenOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" />
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
              className="mt-3.5 h-12 w-full rounded-full bg-brown text-[16px] font-semibold text-white"
            >
              Reservera
            </button>
            <button type="button" onClick={() => setHelp(null)} className="mt-2.5 h-12 w-full rounded-full border border-line bg-white text-[16px] font-semibold">
              Avbryt
            </button>
          </div>
        </div>
      ) : help ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={() => setHelp(null)}>
          <div className="max-h-[85%] overflow-y-auto rounded-t-[1.6rem] bg-cream px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-[1.7rem] leading-none">
                {help === "change" ? "Ändra bokning" : help === "menu" ? "Mer" : help === "problem" ? "Beskriv problemet" : help === "sure" ? "Är du säker?" : help === "detail" ? issue : "Avboka"}
              </h3>
              <button type="button" aria-label="Stäng" onClick={() => setHelp(null)} className="grid size-8 place-items-center">
                <X className="size-5" />
              </button>
            </div>
            {help === "menu" ? (
              <button type="button" onClick={() => { setChangePlace(jobPlace); setChangeAbout(""); setHelp("change"); }} className="mb-3 flex w-full items-center gap-3 rounded-[1.2rem] border border-line bg-white px-3 py-3.5 text-left">
                <Calendar className="size-5" strokeWidth={1.6} />
                <span className="flex-1 text-[15px]">Ändra bokning</span>
                <ChevronRight className="size-4 text-muted" />
              </button>
            ) : null}
            {help === "cancel" ? (
              <CancelJobSheet
                locked={paid || finished}
                reason={cancelReason}
                onReason={setCancelReason}
                onClose={() => setHelp(null)}
                onConfirm={() => {
                  void cancelThread(provider.id, cancelReason.trim());
                  setHelp(null);
                }}
              />
            ) : null}
            {help === "menu" || help === "report" ? (
              <div className="overflow-hidden rounded-[1.2rem] border border-line bg-white">
                {issues.filter((item) => help === "menu" || item.id !== "cancel").map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.id === "support") {
                          setHelp(null);
                          openSupportSheet(item.label);
                          return;
                        }
                        setIssue(item.label);
                        setNote("");
                        setHelp("sure");
                      }}
                      className={cn("flex w-full items-center gap-3 px-3 py-3 text-left", index > 0 && "border-t border-line")}
                    >
                      <Icon className="size-5" strokeWidth={1.6} />
                      <span className="flex-1 text-[15px]">{item.label}</span>
                      <ChevronRight className="size-4 text-muted" />
                    </button>
                  );
                })}
              </div>
            ) : null}
            {help === "menu" ? (
              <button type="button" onClick={() => { setCancelReason(""); setHelp("cancel"); }} className="mt-3 flex w-full items-center gap-3 rounded-[1.2rem] border border-line bg-white px-3 py-3.5 text-left text-red-800">
                <Ban className="size-5" strokeWidth={1.6} />
                <span className="flex-1 text-[15px] font-semibold">Avboka</span>
              </button>
            ) : null}
            {help === "sure" ? (
              <div>
                <p className="text-sm leading-snug text-muted">Vill du avboka uppdraget på grund av: {issue}? Inget dras från kontot.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setNote(""); setHelp("problem"); }} className="rounded-full border border-line bg-white py-3 font-semibold">
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
                    className="rounded-full bg-brown py-3 font-semibold text-white"
                  >
                    Avboka
                  </button>
                </div>
              </div>
            ) : null}
            {help === "problem" ? (
              <div>
                <p className="text-sm text-muted">Berätta kort vad som hänt, om du vill.</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Beskriv problemet" className="mt-3 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setHelp(null)} className="rounded-full border border-line bg-white py-3 font-semibold">
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
                    className="rounded-full bg-brown py-3 font-semibold text-white"
                  >
                    Skicka
                  </button>
                </div>
              </div>
            ) : null}
            {help === "detail" && issue !== "Avboka uppdraget" ? (
              <div>
                <p className="text-sm text-muted">Berätta kort vad som hänt så att vi kan hjälpa dig.</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Beskriv problemet" className="mt-3 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none" />
                <button
                  type="button"
                  onClick={() => {
                    appendChat(provider.id, { id: `report-${Date.now()}`, from: "me", text: note.trim() ? `${issue}: ${note.trim()}` : issue, time: "21:40" });
                    setHelp(null);
                    openSupportSheet(issue);
                    showToast("Rapporten är skickad");
                  }}
                  className="mt-3 w-full rounded-full bg-brown py-3 font-semibold text-white"
                >
                  Skicka rapport
                </button>
              </div>
            ) : null}
            {help === "change" ? (
              paid || finished ? (
                <p className="text-sm leading-relaxed text-muted">Bokningen är betald eller klar och kan inte ändras.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm leading-relaxed text-muted">Föreslå en ny tid. Adress och beskrivning kan du också ändra. Utföraren godkänner innan bokningen ändras.</p>
                  <label className="mb-1 block text-xs font-semibold" htmlFor="change-place">Adress</label>
                  <input id="change-place" value={changePlace} onChange={(event) => setChangePlace(event.target.value.slice(0, 200))} placeholder="Valfritt" className="mb-3 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none" />
                  <label className="mb-1 block text-xs font-semibold" htmlFor="change-about">Beskrivning</label>
                  <textarea id="change-about" value={changeAbout} onChange={(event) => setChangeAbout(event.target.value.slice(0, 2000))} rows={2} placeholder="Valfritt" className="mb-2 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none" />
                  <ChangeWhen
                    date={changeDate}
                    time={changeTime}
                    onDate={setChangeDate}
                    onTime={setChangeTime}
                    hint=""
                    submitLabel="Skicka förslag"
                    onSend={() => {
                      if (!changeDate || !changeTime) return showToast("Välj datum och tid");
                      const dateLabel = changeDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "");
                      void linkedJobId(provider.id).then((jobId) => publishCard(provider.id, {
                        kind: "booking_change",
                        date: dateLabel,
                        time: changeTime,
                        place: changePlace.trim(),
                        description: changeAbout.trim() || undefined,
                        service: jobTitle,
                        status: "pending",
                      }, jobId));
                      setHelp(null);
                      showToast("Förslag skickat");
                    }}
                  />
                </>
              )
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
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
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
                <button key={day} type="button" disabled={past} onClick={() => onDate(value)} className={cn("mx-auto grid size-5 place-items-center rounded-full", active && "bg-brown text-white", past && "text-muted/40")}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold">Tid</p>
          <div className="relative mt-1 overflow-hidden rounded-2xl bg-sand" style={{ height: WHEEL_H }}>
            <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 -translate-y-1/2 rounded-xl bg-white" style={{ height: ITEM_H }} />
            <span className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-sm leading-none font-semibold">:</span>
            <div className="relative z-10 grid min-h-0 grid-cols-2" style={{ height: WHEEL_H }}>
              <MiniWheel values={Array.from({ length: 24 }, (_, index) => index)} value={hour} onChange={setHour} />
              <MiniWheel values={Array.from({ length: 60 }, (_, index) => index)} value={minute} onChange={setMinute} />
            </div>
          </div>
        </div>
      </div>
      <button type="button" onClick={onSend} className="mt-3 w-full rounded-full bg-brown py-3 font-semibold text-white">
        {submitLabel}
      </button>
    </div>
  );
}

const WHEEL_H = 112;
const ITEM_H = 32;
const WHEEL_PAD = (WHEEL_H - ITEM_H) / 2;

function MiniWheel({ values, value, onChange }: { values: number[]; value: number; onChange: (value: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fromUser = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (fromUser.current) {
      fromUser.current = false;
      return;
    }
    const index = Math.max(0, values.indexOf(value));
    node.scrollTop = index * ITEM_H;
  }, [value, values]);

  return (
    <div
      ref={ref}
      onScroll={(event) => {
        const index = Math.round(event.currentTarget.scrollTop / ITEM_H);
        const next = values[Math.min(values.length - 1, Math.max(0, index))];
        if (next !== undefined && next !== value) {
          fromUser.current = true;
          onChange(next);
        }
      }}
      className="min-h-0 snap-y snap-mandatory overflow-y-auto overscroll-contain [overflow-anchor:none] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: WHEEL_H, scrollSnapType: "y mandatory" }}
    >
      <div style={{ height: WHEEL_PAD }} />
      {values.map((itemValue) => (
        <button
          key={itemValue}
          type="button"
          onClick={() => onChange(itemValue)}
          className={cn("flex w-full items-center justify-center text-sm leading-none font-semibold", itemValue === value ? "text-ink" : "text-muted")}
          style={{ height: ITEM_H, scrollSnapAlign: "center" }}
        >
          {String(itemValue).padStart(2, "0")}
        </button>
      ))}
      <div style={{ height: WHEEL_PAD }} />
    </div>
  );
}

function SyncedPeerChat({
  peerId,
  peerName,
  messages,
  draft,
  setDraft,
  onSend,
  onClose,
}: {
  peerId: string;
  peerName: string;
  messages: ChatMsg[];
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const showToast = useVelio((state) => state.showToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeDate, setChangeDate] = useState<Date | null>(null);
  const [changeTime, setChangeTime] = useState("");
  const [changePlace, setChangePlace] = useState("");
  const [changeAbout, setChangeAbout] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const lastId = messages[messages.length - 1]?.id;
  useChatBottom(scroller, peerId, `${lastId ?? ""}:${messages.length}`);
  const initials = peerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-cream">
      <div className="flex items-center px-3 pt-3">
        <button type="button" aria-label="Tillbaka" onClick={onClose} className="grid size-9 place-items-center">
          <ArrowLeft className="size-5" />
        </button>
        <p className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</p>
        <button type="button" aria-label="Ring" onClick={() => openCallSheet({ peerId, peerName })} className="grid size-9 place-items-center">
          <Phone className="size-5" />
        </button>
        <button type="button" aria-label="Mer" onClick={() => setMenuOpen(true)} className="grid size-9 place-items-center">
          <Ellipsis className="size-5" />
        </button>
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sand text-sm font-semibold">{initials}</span>
        <div>
          <p className="text-lg font-semibold">{peerName}</p>
          <p className="text-sm text-muted">Synkad chatt</p>
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [overflow-anchor:none]">
        {messages.map((raw) => {
          const message = displayMessage(raw);
          if (message.text === MISSED_CALL_TEXT) {
            return <div key={message.id} className="mt-3"><MissedCallCard time={message.time} /></div>;
          }
          if (message.card?.kind === "time_confirmation") {
            return (
              <div key={message.id} className="mt-3">
                <TimeConfirmationCard
                  card={message.card}
                  mine={message.from === "me"}
                  time={message.time}
                  onAccept={() => void patchCard(peerId, message.id, { status: "confirmed" })}
                  onPropose={() => { setChangePlace(""); setChangeAbout(""); setChangeOpen(true); }}
                />
              </div>
            );
          }
          if (message.card?.kind === "booking_change") {
            return (
              <div key={message.id} className="mt-3">
                <BookingChangeCard
                  card={message.card}
                  mine={message.from === "me"}
                  time={message.time}
                  onAccept={() => void answerBookingChange(peerId, message, "accepted")}
                  onDecline={() => void answerBookingChange(peerId, message, "declined")}
                />
              </div>
            );
          }
          if (message.card?.kind === "final_price") {
            return (
              <div key={message.id} className="mt-3">
                <FinalPriceMessage
                  card={message.card}
                  mine={message.from === "me"}
                  time={message.time}
                  onPay={() => {
                    if (message.card?.kind !== "final_price") return;
                    const priceCard = message.card;
                    const state = useVelio.getState();
                    const offer = state.jobOffers.find((item) => item.ownerId === peerId && item.status !== "declined");
                    useVelio.setState({
                      checkoutOpen: true,
                      checkout: {
                        offerId: offer?.id || "demo",
                        jobId: offer?.jobId || "chat",
                        jobTitle: priceCard.service,
                        workerName: peerName,
                        workerId: offer?.ownerId || peerId,
                        whenLabel: priceCard.when,
                        priceSek: priceCard.amount,
                      },
                      checkoutAfter: () => {
                        void patchCard(peerId, message.id, { status: "paid" });
                      },
                    });
                  }}
                />
              </div>
            );
          }
          if (message.card?.kind === "on_the_way") {
            return <div key={message.id} className="mt-3"><OnTheWayCard card={message.card} time={message.time} /></div>;
          }
          if (message.card?.kind === "cancelled") {
            return (
              <div key={message.id} className="mt-3 rounded-[1.25rem] border border-line bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Jobbet avbokat</h3>
                <p className="mt-2 text-[15px]">Uppdraget är avbokat.</p>
              </div>
            );
          }
          if (message.card) {
            return (
            <div key={message.id} className="mt-3">
              <ChatCardView
                message={message}
                onDetails={() => undefined}
                onCalendar={() => undefined}
                onFollow={() => undefined}
                onPay={() => undefined}
              />
            </div>
            );
          }
          return message.text ? (
            <div key={message.id} className={cn("mt-3 flex", message.from === "me" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-[1.2rem] px-4 py-2.5 text-[15px]",
                  message.from === "me" ? "rounded-br-md bg-brown text-white" : "rounded-bl-md border border-line bg-white",
                )}
              >
                <p>{message.text}</p>
                <p className={cn("mt-1 text-right text-xs", message.from === "me" ? "text-white/80" : "text-muted")}>{message.time}</p>
              </div>
            </div>
          ) : null;
        })}
      </div>
      {menuOpen ? (
        <JobMenu
          onChange={() => { setChangePlace(""); setChangeAbout(""); setMenuOpen(false); setChangeOpen(true); }}
          onCancel={() => { setCancelReason(""); setMenuOpen(false); setCancelOpen(true); }}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
      {changeOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={() => setChangeOpen(false)}>
          <div className="max-h-[88%] overflow-y-auto rounded-t-[1.6rem] bg-cream px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h3 className="font-serif text-[1.7rem] leading-none">Ändra bokning</h3>
            <BookingChangeForm
              role="customer"
              locked={messages.some((message) => (message.card?.kind === "final_price" && message.card.status === "paid") || message.card?.kind === "paid")}
              date={changeDate}
              time={changeTime}
              place={changePlace}
              about={changeAbout}
              onDate={setChangeDate}
              onTime={setChangeTime}
              onPlace={setChangePlace}
              onAbout={setChangeAbout}
              onClose={() => setChangeOpen(false)}
              onSend={() => {
                if (!changeDate || !changeTime) return showToast("Välj datum och tid");
                const dateLabel = changeDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "");
                void linkedJobId(peerId).then((jobId) => publishCard(peerId, {
                  kind: "booking_change",
                  date: dateLabel,
                  time: changeTime,
                  place: changePlace.trim(),
                  description: changeAbout.trim() || undefined,
                  service: "Uppdrag",
                  status: "pending",
                }, jobId));
                setChangeOpen(false);
                showToast("Förslag skickat");
              }}
            />
          </div>
        </div>
      ) : null}
      {cancelOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={() => setCancelOpen(false)}>
          <div className="rounded-t-[1.6rem] bg-cream px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h3 className="mb-2 font-serif text-[1.7rem] leading-none">Avboka</h3>
            <CancelJobSheet
              locked={messages.some((message) => (message.card?.kind === "final_price" && message.card.status === "paid") || message.card?.kind === "paid")}
              reason={cancelReason}
              onReason={setCancelReason}
              onClose={() => setCancelOpen(false)}
              onConfirm={() => {
                void cancelThread(peerId, cancelReason.trim());
                setCancelOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
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
          className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-3 text-base outline-none"
        />
        <button type="submit" aria-label="Skicka" className="grid size-11 shrink-0 place-items-center rounded-full bg-brown text-white">
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
  const postedJobs = useVelio((state) => state.posted);
  const linkedJob = postedJobs.find((job) => job.ownerId === threadKey);
  const linkedPrice = normalizeJobPrice(linkedJob ?? { price: 0 });
  const hourlyJob = linkedPrice.priceType === "hourly";
  const [billHours, setBillHours] = useState("");
  const [billRate, setBillRate] = useState("");
  const [price, setPrice] = useState("");
  const [editingPrice, setEditingPrice] = useState(false);
  const [draft, setDraft] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeDate, setChangeDate] = useState<Date | null>(null);
  const [changeTime, setChangeTime] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [etaOpen, setEtaOpen] = useState(false);
  const [etaHint, setEtaHint] = useState<number | null>(null);
  const [busyRoute, setBusyRoute] = useState(false);
  const accountId = useVelio((state) => state.accountId);
  const directory = useVelio((state) => state.directory);
  const jobPlace = "Södermalm";
  const jobService = "Städning";
  const shownMessages = messages.map(displayMessage);
  const enrouteLive = shownMessages.find((message) => message.card?.kind === "on_the_way" && message.from === "me" && message.card.status === "enroute" && !message.card.approximate);
  const cancelled = shownMessages.reduce((locked, message) => {
    if (message.card?.kind === "cancelled") return true;
    if (message.card?.kind === "rebook" && message.card.status === "accepted") return false;
    return locked;
  }, false);
  const step = progressStep(messages);
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
  useChatBottom(thread, threadKey || "worker", `${lastId ?? ""}:${messages.length}:${panel ?? ""}`);
  const initials = customerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!hourlyJob) return;
    if (!billRate && linkedPrice.price > 0) setBillRate(String(linkedPrice.price));
    if (!billHours && linkedPrice.estHours) setBillHours(String(linkedPrice.estHours));
  }, [hourlyJob, linkedPrice.price, linkedPrice.estHours, billRate, billHours]);

  const enrouteId = enrouteLive?.id ?? "";
  const enroutePoint = enrouteLive?.card?.kind === "on_the_way" && enrouteLive.card.jobLat != null ? `${enrouteLive.card.jobLat},${enrouteLive.card.jobLng}` : "";
  useEffect(() => {
    if (!enrouteId || !enroutePoint || !threadKey) return;
    const [jobLat, jobLng] = enroutePoint.split(",").map(Number);
    const key = `velio-enroute:${enrouteId}`;
    const started = Number(sessionStorage.getItem(key) || Date.now());
    sessionStorage.setItem(key, String(started));
    let stop = false;
    const tick = async () => {
      if (stop || Date.now() - started > 60 * 60 * 1000) return;
      try {
        const here = await capturePosition(12000);
        const eta = await routeEta(here, { lat: jobLat, lng: jobLng });
        await patchCard(threadKey, enrouteId, { etaMin: eta.minutes, distanceM: eta.distanceM, lat: here.lat, lng: here.lng, approximate: false, status: "enroute" });
        const jobId = await linkedJobId(threadKey);
        if (jobId && isCloudActive()) {
          const { shareJobPosition } = await import("@/lib/firebase/cloud");
          await shareJobPosition(jobId, { lat: here.lat, lng: here.lng, etaMin: eta.minutes }).catch(() => undefined);
        }
      } catch {
        /* Keep the last position already on the card. */
      }
    };
    const id = window.setInterval(() => void tick(), 45000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [enrouteId, enroutePoint, threadKey]);

  const shareLive = async () => {
    if (!threadKey) return showToast("Öppna en chatt med kunden först");
    setBusyRoute(true);
    try {
      const here = await capturePosition(20000);
      const { coordsForArea } = await import("@/lib/velio/data");
      const job = await geocodePlace(jobPlace.includes(",") ? jobPlace : `${jobPlace}, Stockholm`);
      const dest = job ?? coordsForArea(jobPlace);
      const eta = await routeEta(here, dest);
      const jobId = await linkedJobId(threadKey);
      await publishCard(threadKey, {
        kind: "on_the_way",
        place: jobPlace,
        etaMin: eta.minutes,
        distanceM: eta.distanceM,
        approximate: false,
        status: "enroute",
        lat: here.lat,
        lng: here.lng,
        jobLat: dest.lat,
        jobLng: dest.lng,
      }, jobId);
      if (jobId && isCloudActive()) {
        const { shareJobPosition } = await import("@/lib/firebase/cloud");
        await shareJobPosition(jobId, { lat: here.lat, lng: here.lng, etaMin: eta.minutes }).catch(() => undefined);
      }
      setPanel(null);
    } catch {
      const own = ownBusiness({ accountId, directory, loggedIn: true });
      const area = own?.area || own?.areas?.[0] || "Stockholm";
      setEtaHint(await etaFromArea(area, `${jobPlace}, Stockholm`));
      setEtaOpen(true);
    } finally {
      setBusyRoute(false);
    }
  };

  const sendApprox = async (min: number, max?: number) => {
    if (!threadKey) return showToast("Öppna en chatt med kunden först");
    const jobId = await linkedJobId(threadKey);
    await publishCard(threadKey, {
      kind: "on_the_way",
      place: jobPlace,
      etaMin: min,
      etaMax: max,
      approximate: true,
      status: "enroute",
    }, jobId);
    setEtaOpen(false);
    setPanel(null);
  };

  const markArrived = async () => {
    if (!threadKey) return;
    const current = (useVelio.getState().chats[threadKey] ?? []).map(displayMessage).find((message) => message.card?.kind === "on_the_way" && message.card.status === "enroute");
    if (current?.card?.kind === "on_the_way") {
      await patchCard(threadKey, current.id, { status: "arrived", lat: undefined, lng: undefined });
    } else {
      await publishCard(threadKey, { kind: "on_the_way", place: jobPlace, etaMin: 0, approximate: true, status: "arrived" });
    }
    const jobId = await linkedJobId(threadKey);
    if (jobId && isCloudActive()) {
      const { shareJobPosition } = await import("@/lib/firebase/cloud");
      await shareJobPosition(jobId, null).catch(() => undefined);
    }
    showToast("Markerat som framme");
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-cream">
      <div className="flex items-center px-3 pt-3">
        <button type="button" aria-label="Tillbaka" onClick={onClose} className="grid size-9 place-items-center">
          <ArrowLeft className="size-5" />
        </button>
        <p className="flex-1 text-center font-serif text-[1.7rem] tracking-[0.28em]">VELIO</p>
        <button type="button" aria-label="Ring" onClick={() => threadKey && openCallSheet({ peerId: threadKey, peerName: customerName })} className="grid size-9 place-items-center">
          <Phone className="size-5" />
        </button>
        <button type="button" aria-label="Mer" onClick={() => { setCancelReason(""); setMoreOpen(true); }} className="grid size-9 place-items-center">
          <Ellipsis className="size-5" />
        </button>
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-sand text-sm font-semibold">
          {initials}
          <span className="absolute right-0.5 bottom-0.5 size-2.5 rounded-full border-2 border-[#f7f3ee] bg-ok" />
        </span>
        <div>
          <p className="flex items-center gap-1 text-lg font-semibold">
            {customerName} <BadgeCheck className="size-4 fill-gold text-[#f7f3ee]" />
          </p>
          <p className="text-sm text-muted">Kund</p>
        </div>
      </div>
      <div className="mx-4 mt-1 flex items-start">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const on = index <= step;
          return (
            <div key={stage.label} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={index === 0 ? "h-px flex-1" : cn("h-px flex-1", on ? "bg-brown" : "bg-line")} />
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border", on ? "border-brown bg-brown text-white" : "border-line bg-white text-muted")}>
                  <Icon className="size-3.5" />
                </span>
                <span className={index === stages.length - 1 ? "h-px flex-1" : cn("h-px flex-1", index < step ? "bg-brown" : "bg-line")} />
              </div>
              <p className="mt-1 text-center text-[10px] leading-tight">{stage.label}</p>
            </div>
          );
        })}
      </div>

      <div ref={thread} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [overflow-anchor:none]">
        <div className="rounded-[1.2rem] border border-line bg-white p-2.5">
          <div className="flex items-center gap-3">
          <img src={asset("/velio/categories/stad-thumb.webp")} alt="" className="size-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Städning</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" /> Södermalm</p>
            <p className="flex items-center gap-1 text-sm text-muted"><Calendar className="size-3.5" /> {when}</p>
          </div>
          <span className="rounded-full bg-sand px-3 py-1.5 text-sm font-semibold">{linkedJob ? jobPriceCard(linkedJob) : "1 200 kr"}</span>
          </div>
          {cancelled ? (
            <button type="button" onClick={() => showToast("Kunden kan boka om jobbet")} className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-brown py-2.5 text-sm font-semibold text-white">
              Boka om
            </button>
          ) : null}
        </div>

        {messages.map((raw) => {
          const message = displayMessage(raw);
          return (
          <div key={message.id} className="mt-3">
            {message.text === MISSED_CALL_TEXT ? (
              <MissedCallCard time={message.time} />
            ) : message.card?.kind === "time_confirmation" ? (
              <TimeConfirmationCard card={message.card} mine time={message.time} />
            ) : message.card?.kind === "booking_change" ? (
              <BookingChangeCard
                card={message.card}
                mine={message.from === "me"}
                time={message.time}
                onAccept={() => {
                  void answerBookingChange(threadKey, message, "accepted").then(() => {
                    if (message.card?.kind === "booking_change") setWhen(`${message.card.date}, ${message.card.time}`);
                  });
                }}
                onDecline={() => void answerBookingChange(threadKey, message, "declined")}
              />
            ) : message.card?.kind === "final_price" ? (
              <FinalPriceMessage card={message.card} mine time={message.time} />
            ) : message.card?.kind === "on_the_way" ? (
              <OnTheWayCard card={message.card} time={message.time} />
            ) : message.card?.kind === "request" ? (
              <ChatCardView
                message={message}
                onDetails={() => showToast(message.card?.kind === "request" ? message.card.about || message.card.service : "Detaljer")}
                onCalendar={() => showToast("Tid tillagd i kalendern")}
                onFollow={() => showToast("Kunden väntar")}
                onPay={() => showToast("Väntar på kundens betalning")}
              />
            ) : message.card?.kind === "rebook" ? (
              <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Ny förfrågan</h3>
                <div className="mt-2 space-y-1 text-[15px]">
                  <p><span className="font-semibold">Tjänst:</span> {message.card.service}</p>
                  <p><span className="font-semibold">Om jobbet:</span> {message.card.about}</p>
                  <p><span className="font-semibold">Tid:</span> {message.card.when}</p>
                  <p><span className="font-semibold">Plats:</span> {message.card.place}</p>
                  <p><span className="font-semibold">Pris:</span> {priceOrQuote(message.card.price)}</p>
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
                      className="rounded-full border border-line py-2.5 text-sm font-semibold"
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
                      className="rounded-full bg-brown py-2.5 text-sm font-semibold text-white"
                    >
                      Godkänn
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">{message.card.status === "accepted" ? "Godkänd" : "Nekad"}</p>
                )}
              </div>
            ) : message.card?.kind === "cancelled" ? (
              <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
                <h3 className="text-lg font-semibold">Jobbet avbokat</h3>
                <p className="mt-2 text-[15px]">Reservera jobbet igen för att chatta med {customerName}.</p>
              </div>
            ) : message.card?.kind === "paid" ? (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-[1.2rem] border border-line bg-white px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-sand"><CreditCard className="size-4" /></span>
                    <span>
                      <span className="block font-semibold">Betalning mottagen</span>
                      <span className="block text-sm text-muted">{message.card.amount.toLocaleString("sv-SE")} kr har betalats av kunden.</span>
                    </span>
                  </div>
                  <p className="mt-1 text-right text-xs text-muted">{message.time}</p>
                </div>
              </div>
            ) : message.card?.kind === "reschedule" ? (
              <div className="rounded-[1.2rem] border border-line bg-white px-3 py-3">
                <p className="font-semibold">Ny förfrågan</p>
                <p className="mt-1 text-sm">{message.card.service}</p>
                <p className="text-sm text-muted">{message.card.when}</p>
                <p className="text-sm text-muted">{message.card.place}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { pushLocal({ id: `no-${Date.now()}`, from: "me", text: "Jag kan tyvärr inte den tiden.", time: "21:50" }); showToast("Förfrågan avböjd"); }} className="rounded-full border border-line py-2 text-sm font-semibold">Avböj</button>
                  <button type="button" onClick={() => { pushLocal({ id: `yes-${Date.now()}`, from: "me", text: `Jag tar den nya tiden: ${message.card && message.card.kind === "reschedule" ? message.card.when : ""}.`, time: "21:50" }); showToast("Ny tid accepterad"); }} className="rounded-full bg-brown py-2 text-sm font-semibold text-white">Acceptera</button>
                </div>
              </div>
            ) : (
              <div className={message.from === "me" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.from === "me" ? "max-w-[78%] rounded-[1.2rem] rounded-br-md bg-brown px-4 py-2.5 text-[15px] text-white" : "max-w-[85%] rounded-[1.2rem] rounded-bl-md border border-line bg-white px-4 py-2.5 text-[15px]"}>
                  <p className="whitespace-pre-line">{message.text}</p>
                  <p className={message.from === "me" ? "mt-1 text-right text-xs text-white/80" : "mt-1 text-right text-xs text-muted"}>
                    {message.time} {message.from === "me" ? "✓✓" : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {cancelled ? null : (
      <>
      <div className="mx-3 grid grid-cols-4 gap-1 rounded-[1.2rem] border border-line bg-sand p-1">
        <WorkerAction icon={Calendar} label="Bekräfta tid" active={panel === "time"} onClick={() => setPanel(panel === "time" ? null : "time")} />
        <WorkerAction icon={Car} label="Jag är på väg" active={Boolean(enrouteLive)} busy={busyRoute} onClick={() => { if (!busyRoute) void shareLive(); }} />
        <WorkerAction icon={MapPin} label="Jag är framme" active={step >= 3} onClick={() => void markArrived()} />
        <WorkerAction icon={Receipt} label="Skicka slutpris" active={panel === "price"} onClick={() => setPanel(panel === "price" ? null : "price")} />
      </div>

      {panel === "time" ? (
        <div className="mx-3 mt-2 rounded-[1.2rem] border border-line bg-white p-3">
          <div className="mb-2 flex items-start gap-2">
            <span className="grid size-9 place-items-center rounded-full border border-line"><Calendar className="size-4" /></span>
            <span>
              <span className="block font-semibold">Bekräfta tid</span>
              <span className="block text-sm text-muted">Välj datum och starttid, och skicka till kunden.</span>
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
              const dateLabel = slotDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "");
              void linkedJobId(threadKey).then((jobId) => publishCard(threadKey, {
                kind: "time_confirmation",
                date: dateLabel,
                time: slotTime,
                place: jobPlace,
                service: jobService,
                status: "waiting",
              }, jobId));
              setPanel(null);
              showToast("Bekräftelse skickad");
            }}
          />
        </div>
      ) : null}

      {panel === "price" ? (
        <div className="mx-3 mt-2">
          <FinalPriceCard
            amount={hourlyJob ? Math.round((Number(billHours.replace(",", ".")) || 0) * (Number(billRate) || 0)) : Number(price) || 0}
            service={jobService}
            hours={hoursBetween(when)}
            when={when}
            place={jobPlace}
            hourly={hourlyJob}
            hoursValue={billHours}
            rateValue={billRate}
            onHours={setBillHours}
            onRate={setBillRate}
            editing={editingPrice}
            price={price}
            onPrice={setPrice}
            onEdit={() => setEditingPrice(!editingPrice)}
            onSend={() => {
              const hours = Number(billHours.replace(",", "."));
              const rate = Number(billRate);
              const amount = hourlyJob ? Math.round(hours * rate) : Number(price);
              if (!amount) return showToast(hourlyJob ? "Fyll i timmar och timpris" : "Ange ett slutpris");
              void linkedJobId(threadKey).then((jobId) => publishCard(threadKey, {
                kind: "final_price",
                service: jobService,
                amount,
                when,
                place: jobPlace,
                status: "waiting",
                ...(hourlyJob ? { hours, rate } : {}),
              }, jobId));
              setPanel(null);
              showToast("Pris skickat till kunden");
            }}
          />
        </div>
      ) : null}
      </>
      )}

      {cancelled ? (
        <p className="px-4 py-4 text-center text-[15px]">Reservera jobbet igen för att chatta med {customerName}.</p>
      ) : (
      <div className="border-t border-line px-3 pt-2 pb-3">
        <p className="mb-2 flex items-start gap-1.5 px-1 text-[11px] leading-snug text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brown" aria-hidden="true" />
          Håll kontakten i VELIO. Dela inte personnummer och betala inte utanför appen.
        </p>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          say(draft.trim());
          setDraft("");
        }}
      >
        <button type="button" aria-label="Bifoga" onClick={() => showToast("Bifoga bild kommer snart")} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-white">
          <Plus className="size-5" />
        </button>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Skriv ett meddelande..." className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-3 text-base outline-none" />
        <button
          type="button"
          aria-label="Röst"
          onClick={() => {
            if (!draft.trim()) return showToast("Röstmeddelande kommer snart");
            say(draft.trim());
            setDraft("");
          }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brown text-white"
        >
          <Mic className="size-5" />
        </button>
      </form>
      </div>
      )}
      {moreOpen ? (
        <JobMenu
          onChange={() => { setMoreOpen(false); setChangeOpen(true); }}
          onCancel={() => { setCancelReason(""); setMoreOpen(false); setCancelOpen(true); }}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
      {changeOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={() => setChangeOpen(false)}>
          <div className="max-h-[88%] overflow-y-auto rounded-t-[1.6rem] bg-cream px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h3 className="font-serif text-[1.7rem] leading-none">Ändra bokning</h3>
            <BookingChangeForm
              role="worker"
              locked={step >= 4}
              date={changeDate}
              time={changeTime}
              onDate={setChangeDate}
              onTime={setChangeTime}
              onClose={() => setChangeOpen(false)}
              onSend={() => {
                if (!changeDate || !changeTime) return showToast("Välj datum och tid");
                const dateLabel = changeDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "");
                void linkedJobId(threadKey).then((jobId) => publishCard(threadKey, {
                  kind: "booking_change",
                  date: dateLabel,
                  time: changeTime,
                  place: "",
                  service: jobService,
                  status: "pending",
                }, jobId));
                setChangeOpen(false);
                showToast("Förslag skickat");
              }}
            />
          </div>
        </div>
      ) : null}
      {cancelOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={() => setCancelOpen(false)}>
          <div className="rounded-t-[1.6rem] bg-cream px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h3 className="font-serif text-[1.7rem] leading-none">Avboka</h3>
            <CancelJobSheet
              locked={step >= 4}
              reason={cancelReason}
              onReason={setCancelReason}
              onClose={() => setCancelOpen(false)}
              onConfirm={() => {
                void cancelThread(threadKey, cancelReason.trim());
                setCancelOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
      {etaOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={() => setEtaOpen(false)}>
          <div className="rounded-t-[1.6rem] bg-cream px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h3 className="font-serif text-[1.7rem] leading-none">Ungefärlig tid</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Vi kan inte använda din position. Välj ungefär hur lång tid det tar. Kunden ser det som ungefär, utan karta.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {etaHint ? (
                <button type="button" onClick={() => void sendApprox(Math.max(5, etaHint - 5), etaHint + 5)} className="col-span-2 rounded-full border border-line bg-white py-3 text-sm font-semibold">
                  Ungefär {etaHint} min från ditt område
                </button>
              ) : null}
              <button type="button" onClick={() => void sendApprox(5, 10)} className="rounded-full bg-brown py-3 text-sm font-semibold text-white">5–10 min</button>
              <button type="button" onClick={() => void sendApprox(10, 20)} className="rounded-full bg-brown py-3 text-sm font-semibold text-white">10–20 min</button>
              <button type="button" onClick={() => void sendApprox(20, 30)} className="rounded-full bg-brown py-3 text-sm font-semibold text-white">20–30 min</button>
              <button type="button" onClick={() => void sendApprox(30)} className="rounded-full bg-brown py-3 text-sm font-semibold text-white">30+ min</button>
            </div>
            <button type="button" onClick={() => setEtaOpen(false)} className="mt-3 w-full rounded-full border border-line bg-white py-3 font-semibold">Avbryt</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function JobMenu({ onChange, onCancel, onClose }: { onChange: () => void; onCancel: () => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/25" onClick={onClose}>
      <div className="rounded-t-[1.6rem] bg-cream px-4 pt-3 pb-6" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="overflow-hidden rounded-[1.2rem] border border-line bg-white">
          <button type="button" onClick={onChange} className="flex w-full items-center gap-3 px-3 py-3.5 text-left">
            <Calendar className="size-5" strokeWidth={1.6} />
            <span className="flex-1 text-[15px]">Ändra bokning</span>
            <ChevronRight className="size-4 text-muted" />
          </button>
          <button type="button" onClick={onCancel} className="flex w-full items-center gap-3 border-t border-line px-3 py-3.5 text-left text-red-800">
            <Ban className="size-5" strokeWidth={1.6} />
            <span className="flex-1 text-[15px] font-semibold">Avboka</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingChangeForm({
  role,
  locked,
  date,
  time,
  place,
  about,
  onDate,
  onTime,
  onPlace,
  onAbout,
  onClose,
  onSend,
}: {
  role: "customer" | "worker";
  locked: boolean;
  date: Date | null;
  time: string;
  place?: string;
  about?: string;
  onDate: (date: Date) => void;
  onTime: (time: string) => void;
  onPlace?: (value: string) => void;
  onAbout?: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  if (locked) {
    return <p className="mt-2 text-sm leading-relaxed text-muted">Bokningen är betald eller klar och kan inte ändras.</p>;
  }
  return (
    <div className="mt-2">
      <p className="text-sm leading-relaxed text-muted">
        {role === "customer"
          ? "Föreslå en ny tid. Adress och beskrivning kan du också ändra. Utföraren godkänner innan bokningen ändras."
          : "Föreslå en ny tid. Kunden godkänner innan bokningen ändras."}
      </p>
      {role === "customer" ? (
        <>
          <label className="mt-3 mb-1 block text-xs font-semibold" htmlFor="peer-change-place">Adress</label>
          <input id="peer-change-place" value={place ?? ""} onChange={(event) => onPlace?.(event.target.value.slice(0, 200))} placeholder="Valfritt" className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none" />
          <label className="mt-3 mb-1 block text-xs font-semibold" htmlFor="peer-change-about">Beskrivning</label>
          <textarea id="peer-change-about" value={about ?? ""} onChange={(event) => onAbout?.(event.target.value.slice(0, 2000))} rows={2} placeholder="Valfritt" className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none" />
        </>
      ) : null}
      <ChangeWhen date={date} time={time || "14:00"} onDate={onDate} onTime={onTime} hint="" submitLabel="Skicka förslag" onSend={onSend} />
      <button type="button" onClick={onClose} className="mt-2 w-full rounded-full border border-line bg-white py-3 font-semibold">Avbryt</button>
    </div>
  );
}

function CancelJobSheet({
  locked,
  reason,
  onReason,
  onClose,
  onConfirm,
}: {
  locked: boolean;
  reason: string;
  onReason: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <p className="text-sm leading-relaxed text-muted">
        {locked
          ? "Uppdraget är betalt eller klart och kan inte avbokas."
          : "Uppdraget avbokas. Den andra parten får ett meddelande. En reserverad betalning släpps. Det går inte att avboka när jobbet är klart eller utbetalt."}
      </p>
      {locked ? null : (
        <textarea
          value={reason}
          onChange={(event) => onReason(event.target.value.slice(0, 500))}
          rows={3}
          placeholder="Anledning, valfritt"
          className="mt-3 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none"
        />
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="rounded-full border border-line bg-white py-3 font-semibold">
          Avbryt
        </button>
        {locked ? null : (
          <button type="button" onClick={onConfirm} className="rounded-full bg-red-800 py-3 font-semibold text-white">
            Avboka uppdrag
          </button>
        )}
      </div>
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
  quiet,
  editing,
  price,
  onPrice,
  onEdit,
  onSend,
  hourly,
  hoursValue,
  rateValue,
  onHours,
  onRate,
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
  hourly?: boolean;
  hoursValue?: string;
  rateValue?: string;
  onHours?: (value: string) => void;
  onRate?: (value: string) => void;
}) {
  return (
    <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
      <div className="mb-3 flex items-start gap-2">
        <Coins className="mt-0.5 size-5" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold leading-tight">Slutpris</span>
          <span className="block text-sm text-muted">{service}</span>
        </span>
        {quiet || hourly ? null : (
          <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-sm">
            <Pencil className="size-3.5" /> Ändra
          </button>
        )}
      </div>
      {hourly ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">
            Antal timmar
            <input value={hoursValue} inputMode="decimal" onChange={(event) => onHours?.(event.target.value.replace(/[^\d.,]/g, "").slice(0, 5))} className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-lg font-semibold text-ink outline-none" />
          </label>
          <label className="text-xs font-semibold text-muted">
            Timpris
            <input value={rateValue} inputMode="numeric" onChange={(event) => onRate?.(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-lg font-semibold text-ink outline-none" />
          </label>
        </div>
      ) : editing ? (
        <input value={price} inputMode="numeric" onChange={(event) => onPrice?.(event.target.value.replace(/[^\d]/g, ""))} className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-2xl font-semibold outline-none" />
      ) : (
        <p className="text-3xl font-semibold tracking-tight">{amount > 0 ? formatKr(amount) : "Ange ett pris"}</p>
      )}
      {hourly && amount > 0 ? <p className="mt-3 text-2xl font-semibold tracking-tight">{formatKr(amount)}</p> : null}
      <p className="text-sm text-muted">Serviceavgift VELIO läggs till.</p>
      <div className="mt-3 space-y-1 border-t border-line pt-3 text-[15px]">
        <p><span className="font-semibold">Tid:</span> {when.replace(/\s*[–-]\s*\d{1,2}:\d{2}\s*$/, "")}</p>
        <p><span className="font-semibold">Plats:</span> {place}</p>
      </div>
      {quiet ? null : (
        <button type="button" onClick={onSend} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3 font-semibold">
          <Send className="size-4" /> Skicka pris till kund
        </button>
      )}
    </div>
  );
}

function TimeConfirmedCard({ when, place, time }: { when: string; place: string; service: string; time: string }) {
  const showToast = useVelio((state) => state.showToast);
  const clock = when.match(/(\d{1,2}:\d{2})\s*$/)?.[1] ?? "";
  const date = clock ? when.replace(/,?\s*\d{1,2}:\d{2}\s*$/, "") : when;
  return (
    <div>
      <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="size-5" />
          <h3 className="text-lg font-semibold">Tid bekräftad</h3>
        </div>
        <div className="space-y-1 text-[15px]">
          <p><span className="font-semibold">Datum:</span> {date}</p>
          {clock ? <p><span className="font-semibold">Tid:</span> {clock}</p> : null}
          <p><span className="font-semibold">Plats:</span> {place}</p>
        </div>
        <button type="button" onClick={() => showToast("Tid tillagd i kalendern")} className="mt-4 w-full rounded-full border border-line py-3 text-[15px] font-semibold">
          Lägg i kalender
        </button>
      </div>
      {time ? <p className="mt-1 text-right text-xs text-muted">{time}</p> : null}
    </div>
  );
}

function WorkerAction({ icon: Icon, label, active, busy, onClick }: { icon: LucideIcon; label: string; active?: boolean; busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-busy={busy || undefined}
      disabled={busy}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[0.85rem] px-0.5 py-1.5 text-center text-[10px] leading-[1.15] font-semibold disabled:opacity-60",
        active ? "bg-brown text-paper" : "text-ink",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
      <span className="max-w-full">{label}</span>
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
      <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon className={card.kind === "enroute" ? "size-5 fill-[#2a211c] text-ink" : "size-5"} />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {card.kind === "request" ? (
          <div className="space-y-1 text-[15px]">
            <p><span className="font-semibold">Tjänst:</span> {card.service}</p>
            {card.about ? <p><span className="font-semibold">Om jobbet:</span> {card.about}</p> : null}
            <p><span className="font-semibold">Tid:</span> {card.when}</p>
            <p><span className="font-semibold">Plats:</span> {card.place}</p>
            <p><span className="font-semibold">Pris (estimat):</span> {priceOrQuote(card.price)}</p>
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
              <MapPin className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-full fill-[#2a211c] text-ink" />
            </div>
          </div>
        ) : null}
        {card.kind === "done" ? (
          <div className="space-y-1 text-[15px]">
            <p><span className="font-semibold">Tjänst:</span> {card.service}</p>
            <p><span className="font-semibold">Beskrivning:</span> {card.desc}</p>
            <p><span className="font-semibold">Pris:</span> {priceOrQuote(card.price)}</p>
          </div>
        ) : null}
        {takePending && message.from === "them" && onAnswerTake ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAnswerTake("declined")} className="rounded-full border border-line py-3 text-[15px] font-semibold">
              Avböj
            </button>
            <button type="button" onClick={() => onAnswerTake("accepted")} className="rounded-full bg-brown py-3 text-[15px] font-semibold text-white">
              Godkänn
            </button>
          </div>
        ) : takeDone ? (
          <p className="mt-3 text-sm text-muted">{card.status === "accepted" ? "Godkänd" : "Avböjd"}</p>
        ) : takePending && message.from === "me" ? (
          <p className="mt-3 text-sm text-muted">Väntar på att kunden svarar</p>
        ) : (
          <button type="button" onClick={action.onClick} className="mt-4 w-full rounded-full border border-line py-3 text-[15px] font-semibold">
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
      <div role="dialog" aria-label="Betala" className="sheet-in rounded-t-[1.7rem] bg-paper px-5 pt-3 pb-8 shadow-soft" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-[3px] w-9 rounded-full bg-line" />
        <h2 className="font-serif text-[1.8rem] font-medium">Betala</h2>
        <p className="mt-1 text-sm text-muted">{provider?.name} · jobbet är slutfört</p>
        <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3 text-sm shadow-soft">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted">Tjänst</span>
            <span>{kr(booking?.cost ?? amount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line py-1.5">
            <span className="text-muted">Reserverat tidigare</span>
            <span>{kr(booking?.holdKr ?? amount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line py-2">
            <span className="font-semibold">Att betala nu</span>
            <span className="text-lg font-semibold">{kr(amount)}</span>
          </div>
          <p className="flex items-start gap-2 border-t border-line pt-2 text-xs leading-snug text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-brown" aria-hidden="true" />
            Säker betalning. Beloppet dras när jobbet är klart. Inget extra läggs på utöver raderna ovan.
          </p>
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
                  ? "rounded-full bg-brown py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-line bg-white py-2 text-sm font-semibold text-ink"
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
              className="h-12 w-full rounded-full border border-line bg-white px-4 text-[15px] outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/ÅÅ"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="h-12 w-full rounded-full border border-line bg-white px-4 text-[15px] outline-none"
              />
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                className="h-12 w-full rounded-full border border-line bg-white px-4 text-[15px] outline-none"
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
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brown font-semibold text-white disabled:opacity-60"
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
      <div role="dialog" aria-label="Betygsätt arbetet" className="sheet-in flex min-h-0 flex-1 flex-col rounded-t-[1.7rem] bg-cream">
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
                <BadgeCheck className="size-4 fill-gold text-[#f7f3ee]" />
              </div>
              <p className="text-sm text-muted">{service?.name}</p>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <button key={index} type="button" aria-label={`${index + 1} stjärnor`} onClick={() => setStars(index + 1)}>
                <Star className={index < stars ? "size-9 fill-gold text-gold" : "size-9 text-gold"} />
              </button>
            ))}
          </div>
          <p className="mt-5 font-semibold">Lägg till dricks (valfritt)</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {tips.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTipKey(item.key)}
                className={tipKey === item.key ? "rounded-2xl border-2 border-gold bg-sand py-2 text-center" : "rounded-2xl border border-line bg-white py-2 text-center"}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-muted">{kr(item.amount)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTipKey("custom")}
              className={tipKey === "custom" ? "rounded-2xl border-2 border-gold bg-sand py-2 text-center text-sm font-semibold" : "rounded-2xl border border-line bg-white py-2 text-center text-sm font-semibold"}
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
              className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none"
            />
          ) : null}
        </div>
        <div className="px-4 pb-5">
          <button type="button" onClick={() => submitReview(stars, tip)} className="h-12 w-full rounded-full bg-bronze font-semibold text-white">
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
  const addresses = useVelio((state) => state.addresses);
  const go = useVelio((state) => state.go);
  const provider = providerById(providerId);
  const bookOffer = useVelio((state) => state.bookOffer);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<(typeof whenOptions)[number]>(whenOptions[0]);
  const primary = addresses.find((item) => item.primary) ?? addresses[0];
  const [placeId, setPlaceId] = useState(primary?.id ?? "");
  if (!provider) return null;
  const service = serviceById(provider.serviceId);
  const first = provider.name.split(" ")[0];

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-ink/45" onClick={closeSheet}>
      <div
        role="dialog"
        aria-label={service?.name ?? "Boka"}
        className="sheet-in max-h-[88%] overflow-y-auto rounded-t-[1.7rem] bg-paper px-5 pt-2.5 pb-6 shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-[3px] w-9 rounded-full bg-line" />
        <h2 className="font-serif text-[1.85rem] leading-none font-semibold tracking-tight">{bookOffer?.name ?? "Beskriv ditt jobb"}</h2>
        <p className="mt-1.5 text-[15px] text-muted">
          {provider.name} · {provider.area}
        </p>
        {bookOffer ? null : (
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Beskriv vad du behöver hjälp med"
            className="mt-4 h-24 w-full rounded-2xl border border-line px-3 py-3 text-sm outline-none"
          />
        )}
        <div className="mt-4 rounded-[1.15rem] bg-sand px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">{bookOffer ? "Från" : "Minimibelopp"}</span>
            <span className="text-[17px] font-bold tracking-tight">fr. {kr(bookOffer?.price || provider.price)}</span>
          </div>
          <p className="mt-2.5 text-[14.5px] leading-[1.45] text-ink">
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
            className="w-full appearance-none rounded-[1.15rem] border border-line bg-white px-4 py-3 pr-10 text-[15px] outline-none"
          >
            {whenOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" />
        </div>
        <p className="mt-4 mb-1.5 text-[15px] font-semibold">Adress</p>
        {addresses.length ? (
          <div className="space-y-2">
            {addresses.map((item) => {
              const active = (placeId || primary?.id) === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPlaceId(item.id)}
                  className={cn("block w-full rounded-[1.15rem] border px-4 py-3 text-left text-sm", active ? "border-bronze bg-sand" : "border-line bg-white")}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-muted">{item.line}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <button type="button" onClick={() => go("addresses")} className="h-11 w-full rounded-full border border-line text-sm font-semibold">
            Lägg till en adress
          </button>
        )}
        <button
          type="button"
          onClick={() => confirmBook(when, addresses.find((item) => item.id === (placeId || primary?.id))?.line)}
          className="mt-3.5 h-12 w-full rounded-full bg-brown text-[16px] font-semibold text-white"
        >
          Reservera
        </button>
        <button
          type="button"
          onClick={closeSheet}
          className="mt-2.5 h-12 w-full rounded-full border border-line bg-white text-[16px] font-semibold"
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
  const directory = useVelio((state) => state.directory);
  const showToast = useVelio((state) => state.showToast);
  if (!booking) return null;
  const service = serviceById(booking.serviceId);
  const provider = providerById(booking.providerId) ?? directory.find((item) => item.id === booking.providerId);

  const work = booking.cost;
  const fee = Math.round(work * 0.1);
  const total = work + fee;
  const paid = booking.status === "done";

  return (
    <FullScreen title="Kvitto" onBack={closeSheet}>
      <div className="space-y-3 bg-soft px-5 py-5">
        <div className="rounded-[1.4rem] border border-line bg-paper px-5 py-5">
          <p className="font-serif text-[1.8rem] tracking-[0.22em] text-brown">VELIO</p>
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted">KVITTO</p>
          <div className="mt-3 space-y-2 text-[15px]">
            <p className="flex justify-between"><span className="text-muted">Nummer</span><span>{booking.id.slice(0, 8).toUpperCase()}</span></p>
            <p className="flex justify-between"><span className="text-muted">Datum</span><span>{booking.whenLabel}</span></p>
            <p className="flex justify-between"><span className="text-muted">Status</span><span className="font-semibold">{paid ? "Betald" : bookingStatusLabel(booking.status)}</span></p>
          </div>
          <div className="mt-4 border-t border-line pt-3 text-[15px]">
            <p className="font-semibold">Uppdrag</p>
            <p className="mt-1">{service?.name || "Uppdrag"}</p>
            <p className="text-muted">{booking.whenLabel}</p>
            <p className="text-muted">{booking.location}</p>
            <p className="mt-2"><span className="text-muted">Utförare </span>{provider?.name || "Utförare"}</p>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[15px]">
            <p className="flex justify-between"><span>Jobbpris</span><span>{kr(work)}</span></p>
            <p className="flex justify-between text-muted"><span>Serviceavgift VELIO</span><span>{kr(fee)}</span></p>
            <p className="flex justify-between border-t border-line pt-2 font-semibold"><span>Totalt</span><span>{kr(total)}</span></p>
          </div>
          <p className="mt-3 text-sm text-muted">Betalsätt Kort</p>
        </div>
        <Btn onClick={() => showToast("Kvittot sparas när betalningen är registrerad. Det ligger under Historik.")}>
          <FileText className="size-4" /> Ladda ner kvitto
        </Btn>
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
  const closeSheet = useVelio((state) => state.closeAddressSheet);
  const allowLocation = useVelio((state) => state.allowLocation);
  const locationBusy = useVelio((state) => state.locationBusy);
  const locationError = useVelio((state) => state.locationError);
  const addresses = useVelio((state) => state.addresses);
  const activeAddressId = useVelio((state) => state.activeAddressId);
  const selectAddress = useVelio((state) => state.selectAddress);
  const go = useVelio((state) => state.go);
  return (
    <BottomSheet title="Adress" onClose={closeSheet}>
      <p className="mb-3 text-sm leading-relaxed text-muted">Välj vart uppdraget ska utgå ifrån. Den aktiva adressen används för utförare nära dig.</p>
      {locationError ? <p className="mb-3 text-sm leading-relaxed text-red-800">{locationError}</p> : null}
      <div className="space-y-2">
        {addresses.map((item) => {
          const active = item.id === activeAddressId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectAddress(item.id)}
              className={cn("flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left", active ? "border-brown bg-sand" : "border-line bg-paper")}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-brown" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {item.label}
                  {item.primary ? <span className="ml-2 text-xs font-medium text-muted">Standard</span> : null}
                </span>
                <span className="block text-sm text-muted">{item.line}</span>
              </span>
              {active ? <Check className="size-4 text-brown" /> : null}
            </button>
          );
        })}
      </div>
      <Btn
        className="mt-3"
        disabled={locationBusy}
        onClick={() => {
          void allowLocation().then(() => {
            if (useVelio.getState().locationOn) useVelio.setState({ activeAddressId: null });
          });
        }}
      >
        {locationBusy ? "Hämtar din plats…" : "Använd min plats"}
      </Btn>
      <Btn
        variant="secondary"
        className="mt-2"
        onClick={() => {
          closeSheet();
          go("addresses");
        }}
      >
        Hantera adresser
      </Btn>
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
