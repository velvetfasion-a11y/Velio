import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Briefcase,
  Calendar,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Crown,
  Heart,
  HelpCircle,
  House,
  Layers,
  LogOut,
  Mail,
  MapPin,
  Settings,
  Shield,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { contactEmail, isSignInEmail, kr, providerTradeNames, publicDisplayName, serviceById } from "@/lib/velio/data";
import { HistoryCard } from "@/components/velio/history";
import { VerifyIdScreen } from "@/components/velio/verify-id";
import { GetPaidCard } from "@/components/velio/get-paid";
import { ownBusiness, useVelio, type Booking, type SavedAddress } from "@/lib/velio/store";
import { cn } from "@/lib/cn";
import { Btn, Field, ProfilePhoto, ScreenHeader, SecurePayNote } from "@/components/velio/ui";
import { asset } from "@/lib/velio/asset";
import type { AddressHit } from "@/lib/velio/geo";
import { AddressSearch } from "@/components/velio/address-search";

const faqs: { q: string; a: string; settings?: boolean }[] = [
  {
    q: "Hur raderar jag mitt konto?",
    a: "Öppna Profil och sedan Inställningar. Välj Radera konto. Skriv RADERA med stora bokstäver och bekräfta med Radera konto. Namn, kontaktuppgifter och VELIO Business tas bort från den här enheten, och du loggas ut.",
    settings: true,
  },
  {
    q: "Hur tar jag bort VELIO Business?",
    a: "Öppna Inställningar och välj Radera VELIO Business. Företagsprofilen och uppdrag du tar som utförare försvinner. Ditt kundkonto är kvar.",
    settings: true,
  },
    {
      q: "Hur ändrar jag namn eller e-post?",
      a: "Öppna Inställningar. Skriv i fältet och tryck Spara till höger om just det fältet.",
      settings: true,
    },
    {
      q: "Var finns favoriter och adresser?",
      a: "Öppna Profil. Under Snabbval finns Favoriter och Adresser. Tryck på hjärtat hos en utförare för att spara personen. Under Adresser skriver du namn och adress och trycker Spara.",
    },
    {
      q: "Hur sätter jag på notifikationer?",
      a: "Öppna Inställningar och tryck på Notifikationer. Välj Sätt på notifikationer och tillåt aviseringar när telefonen frågar. Står det att det inte gick, kontakta support.",
      settings: true,
    },
    {
      q: "Hur delar jag min plats?",
    a: "Tryck Dela plats högst upp, eller slå på Plats under Inställningar. Du kan också skriva en önskad plats i arbetsinformationen.",
  },
  {
    q: "Hur hittar jag uppdrag?",
    a: "I arbetsläget visas uppdrag inom ditt yrke under jobbtiderna. Från Meddelanden når du samma sida via Hitta uppdrag.",
  },
  {
    q: "Kan jag avboka?",
    a: "Öppna uppdraget och välj Avbryt. Gör det så tidigt du kan, så att den andra parten hinner se det.",
  },
  {
    q: "Hur betalar jag?",
    a: "När jobbet är klart betalar du med Apple Pay, kort, Swish eller kontant. Sparade kort finns under Profil och Betalningsmetoder.",
  },
  {
    q: "Hur fungerar RUT-avdrag?",
    a: "På många hushållsnära tjänster kan RUT dras på priset. Utföraren ser om jobbet kvalificerar innan ni startar.",
  },
];

function ProfileCompleteness({
  name,
  avatar,
  phone,
  email,
  verified,
  pending,
  onVerify,
}: {
  name: string;
  avatar: boolean;
  phone: boolean;
  email: boolean;
  verified: boolean;
  pending: boolean;
  onVerify: () => void;
}) {
  const checks = [
    { label: "Namn", ok: Boolean(name) },
    { label: "Profilbild", ok: avatar },
    { label: "Telefon", ok: phone },
    { label: "E-post", ok: email },
    { label: "Identitet", ok: verified, note: pending && !verified ? "Granskas" : undefined },
  ];
  const done = checks.filter((item) => item.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  return (
    <section className="mt-4 rounded-[1.3rem] border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Profilen är {pct}% klar</p>
        <span className={verified ? "rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok" : "rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-brown"}>
          {verified ? "Verifierad" : pending ? "Granskas" : "Inte verifierad"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-brown" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {checks.map((item) => (
          <li key={item.label} className="flex items-center justify-between">
            <span>{item.label}</span>
            <span className={item.ok ? "text-ok" : "text-muted"}>{item.ok ? "Klar" : "note" in item && item.note ? item.note : "Saknas"}</span>
          </li>
        ))}
      </ul>
      {verified ? null : (
        <button type="button" onClick={onVerify} className="mt-3 h-11 w-full rounded-full bg-brown text-sm font-semibold text-paper">
          {pending ? "Visa identitet" : "Identifiera dig"}
        </button>
      )}
    </section>
  );
}

export function BookingRows({ items, onOpen }: { items: Booking[]; onOpen: (id: string) => void }) {
  const rebook = useVelio((state) => state.rebook);
  if (!items.length) return <p className="text-sm text-muted">Inga bokningar ännu.</p>;
  return (
    <div className="space-y-3">
      {items.map((booking) => (
        <HistoryCard key={booking.id} booking={booking} onOpen={() => onOpen(booking.id)} onRebook={() => rebook(booking.id)} />
      ))}
    </div>
  );
}

function AddressScreen({
  addresses,
  activeId,
  onAdd,
  onUpdate,
  onRemove,
  onPrimary,
  onSelect,
}: {
  addresses: SavedAddress[];
  activeId: string | null;
  onAdd: (input: { label: string; line: string; lat?: number; lng?: number }) => boolean;
  onUpdate: (id: string, input: { label: string; line: string; lat?: number; lng?: number }) => boolean;
  onRemove: (id: string) => void;
  onPrimary: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [label, setLabel] = useState("Hem");
  const [picked, setPicked] = useState<AddressHit | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const showToast = useVelio((state) => state.showToast);
  const names = ["Hem", "Jobb", "Annan"];
  const save = () => {
    if (!picked) {
      showToast("Välj en adress i listan, eller använd din plats");
      return;
    }
    const input = { label, line: picked.label, lat: picked.lat, lng: picked.lng };
    const ok = editing ? onUpdate(editing, input) : onAdd(input);
    if (!ok) return;
    setPicked(null);
    setEditing(null);
    setLabel("Hem");
  };
  return (
    <div className="px-4 pt-4 pb-6">
      <ScreenHeader title="Adresser" />
      <div className="rounded-[1.3rem] border border-line bg-paper/80 p-4 backdrop-blur-xl">
        <p className="text-sm text-muted">Spara hem, jobb eller en annan plats. Den valda adressen används för uppdrag nära dig.</p>
        <p className="mt-3 text-sm font-medium">Namn</p>
        <div className="mt-2 flex gap-2">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={label === name}
              onClick={() => setLabel(name)}
              className={cn("h-9 rounded-full px-3 text-sm font-semibold", label === name ? "bg-brown text-paper" : "border border-line")}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm font-medium">Adress</p>
        <div className="mt-2">
          <AddressSearch picked={picked} onPick={setPicked} onClear={() => setPicked(null)} />
        </div>
        <button type="button" onClick={save} className="mt-3 h-11 rounded-full bg-brown px-5 text-sm font-semibold text-white">
          {editing ? "Spara ändring" : "Spara"}
        </button>
      </div>
      {addresses.length ? (
        <div className="mt-4 space-y-3">
          {addresses.map((item) => (
            <article key={item.id} className="rounded-[1.3rem] border border-line bg-paper/80 p-4 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm text-muted">{item.line}</p>
                </div>
                <span className="flex shrink-0 gap-1">
                  {item.id === activeId ? <span className="rounded-full bg-brown px-2 py-0.5 text-[11px] text-paper">Aktiv</span> : null}
                  {item.primary ? <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">Standard</span> : null}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.id === activeId ? null : (
                  <button type="button" onClick={() => onSelect(item.id)} className="h-9 rounded-full bg-brown px-3 text-sm font-semibold text-paper">
                    Använd
                  </button>
                )}
                {item.primary ? null : (
                  <button type="button" onClick={() => onPrimary(item.id)} className="h-9 rounded-full border border-line px-3 text-sm font-semibold">
                    Gör till standard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(item.id);
                    setLabel(item.label);
                    setPicked({ id: item.id, label: item.line, detail: item.label, lat: item.lat, lng: item.lng });
                  }}
                  className="h-9 rounded-full border border-line px-3 text-sm font-semibold"
                >
                  Redigera
                </button>
                <button type="button" onClick={() => onRemove(item.id)} className="h-9 rounded-full border border-line px-3 text-sm font-semibold">
                  Ta bort
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Ingen adress sparad ännu.</p>
      )}
    </div>
  );
}

export function ProfileScreens() {
  const screen = useVelio((state) => state.screen);
  const go = useVelio((state) => state.go);
  const loggedIn = useVelio((state) => state.loggedIn);
  const logout = useVelio((state) => state.logout);
  const profile = useVelio((state) => state.profile);
  const saveProfile = useVelio((state) => state.saveProfile);
  const cards = useVelio((state) => state.cards);
  const addCard = useVelio((state) => state.addCard);
  const bookings = useVelio((state) => state.bookings);
  const posted = useVelio((state) => state.posted);
  const jobOffers = useVelio((state) => state.jobOffers);
  const openCheckout = useVelio((state) => state.openCheckout);
  const markJobDone = useVelio((state) => state.markJobDone);
  const declineOffer = useVelio((state) => state.declineOffer);
  const accountId = useVelio((state) => state.accountId);
  const directory = useVelio((state) => state.directory);
  const favorites = useVelio((state) => state.favorites);
  const addresses = useVelio((state) => state.addresses);
  const openProvider = useVelio((state) => state.openProvider);
  const toggleFavorite = useVelio((state) => state.toggleFavorite);
  const addAddress = useVelio((state) => state.addAddress);
  const updateAddress = useVelio((state) => state.updateAddress);
  const selectAddress = useVelio((state) => state.selectAddress);
  const activeAddressId = useVelio((state) => state.activeAddressId);
  const removeAddress = useVelio((state) => state.removeAddress);
  const makePrimaryAddress = useVelio((state) => state.makePrimaryAddress);
  const openReceipt = useVelio((state) => state.openReceipt);
  const listing = useVelio((state) => state.listing);
  const accountMode = useVelio((state) => state.accountMode);
  const idVerified = useVelio((state) => state.idVerified);
  const kycPending = useVelio((state) => state.kycPending);
  const idMethod = useVelio((state) => state.idMethod);
  const setAccountMode = useVelio((state) => state.setAccountMode);
  const setSheet = useVelio((state) => state.setSheet);
  const notifications = useVelio((state) => state.notifications);
  const setNotifications = useVelio((state) => state.setNotifications);
  const enableNotifications = useVelio((state) => state.enableNotifications);
  const locationOn = useVelio((state) => state.locationOn);
  const userLocation = useVelio((state) => state.userLocation);
  const clearLocation = useVelio((state) => state.clearLocation);
  const removeBusiness = useVelio((state) => state.removeBusiness);
  const deleteAccount = useVelio((state) => state.deleteAccount);
  const showToast = useVelio((state) => state.showToast);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [issue, setIssue] = useState("");
  const [last4, setLast4] = useState("");
  const [exp, setExp] = useState("");
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const [confirm, setConfirm] = useState<"business" | "account" | null>(null);
  const [deleteWord, setDeleteWord] = useState("");
  const [noticeAsk, setNoticeAsk] = useState(false);
  const [noticeFailed, setNoticeFailed] = useState(false);
  const [noticeBusy, setNoticeBusy] = useState(false);
  useEffect(() => {
    if (screen !== "settings") {
      setConfirm(null);
      setDeleteWord("");
    }
  }, [screen]);

  if (screen === "payments") {
    return (
      <div className="px-5 pt-4">
        <ScreenHeader title="Betalningsmetoder" />
        <div className="mb-4">
          <SecurePayNote />
        </div>
        <div className="mb-4 space-y-2">
          <div className="rounded-2xl border border-line p-4">
            <div className="font-semibold">Apple Pay</div>
            <div className="text-sm text-muted">Används vid betalning när Wallet finns i webbläsaren</div>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <div className="font-semibold">Kontant</div>
            <div className="text-sm text-muted">Betala på plats till utföraren</div>
          </div>
          {cards.map((card) => (
            <div key={card.id} className="rounded-2xl border border-line p-4">
              <div className="font-semibold">{card.label}</div>
              <div className="text-sm text-muted">{card.detail}</div>
            </div>
          ))}
        </div>
        <Field label="Kortnummer (sista fyra räcker)" inputMode="numeric" maxLength={19} value={last4} onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(-4))} />
        <Field label="Utgång MM/ÅÅ" placeholder="12/28" value={exp} onChange={(event) => setExp(event.target.value)} />
        <Btn
          onClick={() => {
            if (!/^\d{4}$/.test(last4) || !/^\d{2}\/\d{2}$/.test(exp)) {
              showToast("Ange fyra siffror och datum som 12/28");
              return;
            }
            addCard({ id: crypto.randomUUID(), label: `Kort · ${last4}`, detail: `Utgår ${exp}` });
            setLast4("");
            setExp("");
            showToast("Kort tillagt");
          }}
        >
          Lägg till kort
        </Btn>
      </div>
    );
  }

  if (screen === "bookings") {
    return (
      <div className="px-5 pt-4">
        <ScreenHeader title="Bokningshistorik" />
        <BookingRows items={bookings} onOpen={openReceipt} />
      </div>
    );
  }

  if (screen === "favorites") {
    const people = favorites
      .map((id) => directory.find((person) => person.id === id))
      .filter((person): person is NonNullable<typeof person> => Boolean(person));
    return (
      <div className="px-4 pt-4">
        <ScreenHeader title="Favoriter" />
        {people.length ? (
          <div className="space-y-3">
            {people.map((person) => (
              <article key={person.id} className="flex items-center gap-3 rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
                <button type="button" onClick={() => openProvider(person.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {person.photo ? (
                    <img src={person.photo} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sand font-serif text-xl">{person.initials}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{person.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{providerTradeNames(person).join(" · ") || serviceById(person.serviceId)?.name}</span>
                    <span className="mt-0.5 block text-sm">fr. {kr(person.price)}</span>
                  </span>
                </button>
                <button type="button" aria-label={`Ta bort ${person.name}`} onClick={() => toggleFavorite(person.id)} className="grid size-10 shrink-0 place-items-center">
                  <Heart className="size-5 fill-ink" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl px-4 py-8 text-center">
            <p className="font-semibold">Inga favoriter ännu</p>
            <p className="mt-1 text-sm text-muted">Öppna en utförare och tryck på hjärtat. Personen hamnar här.</p>
            <button type="button" onClick={() => go("home")} className="mt-4 h-11 rounded-full bg-brown px-5 text-sm font-semibold text-white">
              Hitta utförare
            </button>
          </div>
        )}
      </div>
    );
  }

  if (screen === "addresses") {
    return (
      <AddressScreen
        addresses={addresses}
        activeId={activeAddressId}
        onAdd={addAddress}
        onUpdate={updateAddress}
        onRemove={removeAddress}
        onPrimary={makePrimaryAddress}
        onSelect={selectAddress}
      />
    );
  }

  if (screen === "posted") {
    const mine = posted.filter((job) => !accountId || job.ownerId === accountId);
    const images: Record<string, string> = {
      stad: asset("/velio/tile-stad.jpg"),
      ren: asset("/velio/tile-ren.jpg"),
      el: asset("/velio/tile-el.jpg"),
      trad: asset("/velio/tile-trad.jpg"),
    };
    return (
      <div className="px-4 pt-4">
        <ScreenHeader title="Mina uppdrag" />
        {mine.length ? (
          <div className="space-y-3">
            {mine.map((job) => {
              const service = serviceById(job.serviceId);
              return (
                <article key={job.id} className="flex gap-3 rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
                  <img src={images[job.serviceId] || `/velio/${job.serviceId}.jpg`} alt="" className="size-16 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{service?.name}</p>
                      <span className="shrink-0 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">Publicerad</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{job.text}</p>
                    <p className="mt-1 text-xs text-muted">{job.when}</p>
                    <p className="text-xs text-muted">{job.address}</p>
                    {job.status && job.status !== "open" ? (
                      <p className="mt-1 text-xs font-semibold text-brown">{job.status === "assigned" ? "Tilldelat" : job.status === "completed" ? "Klart" : job.status === "cancelled" ? "Avbrutet" : job.status}</p>
                    ) : null}
                    {job.status === "assigned" ? (
                      <button type="button" onClick={() => markJobDone(job.id)} className="mt-2 h-9 rounded-full border border-line px-3 text-sm font-semibold">
                        Markera som klart
                      </button>
                    ) : null}
                    <div className="mt-2 space-y-2">
                      {jobOffers
                        .filter((offer) => offer.jobId === job.id)
                        .map((offer) => (
                          <div key={offer.id} className="rounded-2xl bg-sand px-3 py-2">
                            <p className="text-sm font-semibold">
                              Offert {offer.amount.toLocaleString("sv-SE")} kr
                              <span className="ml-2 font-medium text-muted">
                                {offer.status === "pending" ? "Väntar" : offer.status === "accepted" ? "Accepterad" : offer.status === "declined" ? "Avböjd" : "Tillbakadragen"}
                              </span>
                            </p>
                            {offer.message ? <p className="mt-1 text-sm text-muted">{offer.message}</p> : null}
                            {offer.status === "pending" && offer.jobOwnerId === accountId ? (
                              <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => openCheckout(offer.id)} className="h-9 rounded-full bg-brown px-3 text-sm font-semibold text-paper">
                                  Acceptera och betala
                                </button>
                                <button type="button" onClick={() => declineOffer(offer.id)} className="h-9 rounded-full border border-line px-3 text-sm font-semibold">
                                  Avböj
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.3rem] border border-line bg-paper/80 backdrop-blur-xl px-4 py-8 text-center">
            <p className="font-semibold">Inga publicerade uppdrag ännu</p>
            <p className="mt-1 text-sm text-muted">När du lägger upp ett uppdrag syns det här.</p>
          </div>
        )}
      </div>
    );
  }

  if (screen === "verify-id") {
    return <VerifyIdScreen />;
  }

  if (screen === "business") {
    const own = ownBusiness({ accountId, directory, loggedIn: true });
    const activeListing = listing ?? (own ? { serviceId: own.serviceId, desc: own.about, price: own.price } : null);
    const listed = activeListing ? serviceById(activeListing.serviceId) : null;
    const demo = Boolean(own?.demo || idMethod === "demo");
    const verifyLabel = demo
      ? "Demo\ninte verifierad"
      : !idVerified
        ? "Identitet\nkrävs"
        : idMethod === "passport"
          ? "Verifierad\nmed pass"
          : "Verifierad\nmed BankID";
    const points = [
      { icon: ShieldCheck, label: verifyLabel },
      { icon: Layers, label: "Få uppdrag\ndirekt i appen" },
      { icon: TrendingUp, label: "Bygg ditt\nyrke & företag" },
    ];
    return (
      <div className="px-4 pt-4">
        <ScreenHeader title="Velio Business" />
        <div className="relative overflow-hidden rounded-[1.35rem]">
          <img src={asset("/velio/business.jpg")} alt="" className="h-52 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-5 text-white">
            <p className="scrim-text text-[11px] tracking-[0.28em] text-wheat">VELIO BUSINESS</p>
            <h3 className="ios-section scrim-text mt-2 text-[1.7rem] text-white">Arbeta med VELIO</h3>
            <p className="scrim-text mt-2 max-w-[16rem] text-sm leading-snug text-white">
              Bli utförare, ta emot uppdrag och bygg ditt professionella nätverk.
            </p>
          </div>
        </div>
        {!own ? (
          <div className="mt-5 rounded-[1.2rem] border border-line bg-soft p-4">
            <p className="text-sm leading-relaxed text-muted">
              Identiteten ingår i stegen. Utan BankID publiceras profilen som Demo, inte som verifierad.
            </p>
          </div>
        ) : null}
        <div className="mt-6 grid grid-cols-3">
          {points.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={index === 0 ? "px-1 text-center" : "border-l border-line px-1 text-center"}>
                <Icon className="mx-auto size-7 text-brown" strokeWidth={1.4} />
                <p className="mt-2 text-xs leading-snug whitespace-pre-line">{item.label}</p>
              </div>
            );
          })}
        </div>
        {activeListing && listed ? (
          <div className="mt-5 rounded-[1.2rem] border border-line bg-white p-4">
            <p className="text-xs tracking-wide text-brown">PUBLICERAD</p>
            <p className="mt-1 font-semibold">{own?.name || listed.name}</p>
            <p className="mt-1 text-sm text-muted">fr. {kr(activeListing.price)} · syns på hemsidan</p>
            <button
              type="button"
              onClick={() => {
                if (own) useVelio.getState().openProvider(own.id);
              }}
              className="mt-3 h-11 w-full rounded-full bg-brown text-sm font-semibold text-white"
            >
              Öppna min profil
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountMode("business");
                go("home");
              }}
              className="mt-2 h-11 w-full rounded-full border border-line text-sm font-semibold"
            >
              Gå till arbetsläget
            </button>
          </div>
        ) : null}
        <GetPaidCard />
        <button
          type="button"
          onClick={() => setSheet("onboard")}
          className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink text-base font-semibold text-white"
        >
          <Briefcase className="size-5" strokeWidth={1.6} />
          {activeListing ? "Uppdatera profil" : "Kom igång"}
        </button>
      </div>
    );
  }

  if (screen === "settings") {
    const own = ownBusiness({ accountId, directory, loggedIn });
    const knownName =
      publicDisplayName(profile.name) || publicDisplayName(own?.name) || publicDisplayName(listing?.title) || publicDisplayName(own?.title);
    const knownEmail = contactEmail(profile.email);
    const saveContact = async (patch: Partial<typeof profile>, toast: string) => {
      const next = { ...profile, ...patch, name: publicDisplayName(patch.name ?? profile.name) || knownName };
      const ok = await saveProfile(next);
      if (!ok) return;
      showToast(toast);
    };
    return (
      <div className="px-5 pt-2 pb-8">
        <ScreenHeader title="Inställningar" />
        {legal ? (
          <div className="rounded-[1.4rem] border border-line bg-white px-4 py-4">
            <button type="button" onClick={() => setLegal(null)} className="text-sm font-semibold text-muted">
              Tillbaka
            </button>
            <h2 className="mt-3 font-serif text-[1.7rem] leading-none">{legal === "privacy" ? "Integritetspolicy" : "Användarvillkor"}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {legal === "privacy"
                ? "VELIO använder namn, telefon och e-post för att visa din profil och koppla dig till uppdrag. Plats används bara när du själv delar den, för att hitta jobb i ditt område. Under Inställningar kan du ta bort VELIO Business eller radera hela kontot från den här enheten."
                : "Ett uppdrag gäller den tid och det pris som båda har bekräftat. Avbokning görs från uppdraget. Betalning sker med den metod som valts för jobbet. Du kan avsluta VELIO Business eller radera kontot när du vill, under Inställningar."}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted">KONTAKT</h2>
              <div className="divide-y divide-[#f0ebe6] overflow-hidden rounded-[1.4rem] border border-line bg-white">
                <ContactRow
                  label="Namn"
                  value={knownName}
                  placeholder="För- och efternamn"
                  onSave={(name) => {
                    if (name.length < 2) {
                      showToast("Skriv ditt namn");
                      return;
                    }
                    return saveContact({ name }, "Namn sparat");
                  }}
                />
                <ContactRow
                  label="Telefon"
                  value={profile.phone}
                  type="tel"
                  placeholder="07X XXX XX XX"
                  onSave={(phone) => saveContact({ phone }, "Telefon sparad")}
                />
                <ContactRow
                  label="E-post"
                  value={knownEmail}
                  type="email"
                  placeholder="namn@.com"
                  onSave={(email) => {
                    const chosen = isSignInEmail(email);
                    if (!chosen) {
                      showToast("Skriv en e-postadress, till exempel namn@.com");
                      return;
                    }
                    return saveContact({ email: chosen }, "E-post sparad");
                  }}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted">ENHETEN</h2>
              <div className="divide-y divide-[#f0ebe6] overflow-hidden rounded-[1.4rem] border border-line bg-white">
                <div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications}
                    onClick={() => {
                      if (notifications) {
                        setNotifications(false);
                        setNoticeAsk(false);
                        setNoticeFailed(false);
                        return;
                      }
                      setNoticeFailed(false);
                      setNoticeAsk(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px]">Notifikationer</span>
                      <span className="mt-0.5 block text-xs text-muted">{notifications ? "På" : "Av"}</span>
                    </span>
                    <SettingSwitch on={notifications} />
                  </button>
                  {noticeAsk ? (
                    <div className="border-t border-line px-4 py-3.5">
                      <p className="text-[15px] font-semibold">Sätt på notifikationer</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">Du får aviseringar om uppdrag och meddelanden. Telefonen frågar om lov.</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setNoticeAsk(false)} className="h-10 flex-1 rounded-full border border-line text-sm font-semibold">
                          Inte nu
                        </button>
                        <button
                          type="button"
                          disabled={noticeBusy}
                          onClick={() => {
                            setNoticeBusy(true);
                            void enableNotifications()
                              .then((result) => {
                                setNoticeAsk(false);
                                if (result === "granted") {
                                  setNoticeFailed(false);
                                  showToast("Notifikationer är på");
                                  return;
                                }
                                setNoticeFailed(true);
                              })
                              .finally(() => setNoticeBusy(false));
                          }}
                          className="h-10 flex-1 rounded-full bg-brown text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Sätt på
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {noticeFailed && !notifications ? (
                    <div className="border-t border-line px-4 py-3.5">
                      <p className="text-sm leading-relaxed text-red-800">Det gick inte att slå på notifikationer.</p>
                      <button type="button" onClick={() => go("help")} className="mt-2 text-sm font-semibold text-brown">
                        Kontakta support
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={locationOn}
                  onClick={() => (locationOn ? clearLocation() : useVelio.getState().openAddressSheet())}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">Plats</span>
                    <span className={cn("mt-0.5 block truncate text-xs", locationOn ? "text-ok" : "text-muted")}>
                      {locationOn ? userLocation?.label || "Plats delad" : "Inte delad"}
                    </span>
                  </span>
                  <SettingSwitch on={locationOn} />
                </button>
              </div>
            </section>

            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted">OM VELIO</h2>
              <div className="overflow-hidden rounded-[1.4rem] border border-line bg-white">
                <button type="button" onClick={() => go("help")} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">Hjälp och support</span>
                    <span className="mt-0.5 block text-xs text-muted">Vanliga frågor, till exempel hur du raderar kontot</span>
                  </span>
                  <ChevronRight className="size-4 text-muted" />
                </button>
                <button type="button" onClick={() => setLegal("privacy")} className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left">
                  <span className="min-w-0 flex-1 text-[15px]">Integritetspolicy</span>
                  <ChevronRight className="size-4 text-muted" />
                </button>
                <button type="button" onClick={() => setLegal("terms")} className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left">
                  <span className="min-w-0 flex-1 text-[15px]">Användarvillkor</span>
                  <ChevronRight className="size-4 text-muted" />
                </button>
              </div>
            </section>

            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted">KONTO</h2>
              {confirm ? (
                <div className="rounded-[1.4rem] border border-line bg-white px-4 py-4">
                  <h3 className="font-serif text-[1.45rem] leading-none">{confirm === "business" ? "Ta bort VELIO Business?" : "Radera konto"}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {confirm === "business"
                      ? "Företagsprofilen tas bort. Du är kvar som kund och kan logga in som vanligt."
                      : "Kontot, profilen, uppdragen, offerterna och adresserna raderas. Chattar kan inte tas bort helt med de här reglerna. Skriv RADERA med stora bokstäver för att bekräfta."}
                  </p>
                  {confirm === "account" ? (
                    <label className="mt-3 block">
                      <span className="mb-1.5 block text-xs font-medium text-muted">Skriv RADERA</span>
                      <input
                        value={deleteWord}
                        onChange={(event) => setDeleteWord(event.target.value)}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="RADERA"
                        className="h-11 w-full rounded-full border border-line px-4 text-sm tracking-wide outline-none"
                      />
                    </label>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirm(null);
                        setDeleteWord("");
                      }}
                      className="h-11 flex-1 rounded-full border border-line text-sm font-semibold"
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      disabled={confirm === "account" && deleteWord !== "RADERA"}
                      onClick={() => {
                        if (confirm === "business") removeBusiness();
                        else if (deleteWord === "RADERA") deleteAccount();
                        setConfirm(null);
                        setDeleteWord("");
                      }}
                      className="h-11 flex-1 rounded-full bg-red-800 text-sm font-semibold text-white disabled:bg-sand disabled:text-muted"
                    >
                      {confirm === "business" ? "Ta bort" : "Radera konto"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[1.4rem] border border-line bg-white">
                  <button type="button" onClick={logout} className="flex w-full items-center px-4 py-3.5 text-left text-[15px]">
                    Logga ut
                  </button>
                  {accountMode === "business" || own ? (
                    <button type="button" onClick={() => setConfirm("business")} className="flex w-full items-center border-t border-line px-4 py-3.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-red-800">Radera VELIO Business</span>
                        <span className="mt-0.5 block text-xs text-muted">Företagskontot tas bort. Kundkontot är kvar.</span>
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteWord("");
                      setConfirm("account");
                    }}
                    className="flex w-full items-center border-t border-line px-4 py-3.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-red-800">Radera konto</span>
                      <span className="mt-0.5 block text-xs text-muted">Allt på den här enheten tas bort och du loggas ut.</span>
                    </span>
                  </button>
                </div>
              )}
              <p className="mt-4 text-center text-xs text-muted">VELIO 1.0.0</p>
            </section>
          </div>
        )}
      </div>
    );
  }

  if (screen === "help") {
    return (
      <div className="px-5 pt-2 pb-8">
        <ScreenHeader title="Hjälp och support" />
        <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted">VANLIGA FRÅGOR</h2>
        <div className="overflow-hidden rounded-[1.4rem] border border-line bg-white">
          {faqs.map((faq, index) => {
            const open = openFaq === index;
            return (
              <div key={faq.q} className={index === 0 ? "" : "border-t border-line"}>
                <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? null : index)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <span className="min-w-0 flex-1 text-[15px]">{faq.q}</span>
                  <ChevronRight className={cn("size-4 shrink-0 text-muted transition", open && "rotate-90")} />
                </button>
                {open ? (
                  <div className="px-4 pb-4">
                    <p className="text-sm leading-relaxed text-muted">{faq.a}</p>
                    {faq.settings ? (
                      <button type="button" onClick={() => go("settings")} className="mt-3 text-sm font-semibold text-brown">
                        Öppna inställningar
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <h2 className="mt-5 mb-2 px-1 text-xs font-semibold tracking-wide text-muted">KONTAKTA OSS</h2>
        <div className="rounded-[1.4rem] border border-line bg-white px-4 py-4">
          <label className="block">
            <span className="text-[15px]">Rapportera ett problem</span>
            <textarea
              value={issue}
              onChange={(event) => setIssue(event.target.value)}
              className="mt-2 h-24 w-full resize-none rounded-2xl border border-line bg-soft px-3 py-3 text-sm outline-none"
              placeholder="Beskriv vad som hände"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (issue.trim().length < 4) {
                showToast("Beskriv problemet kort");
                return;
              }
              setIssue("");
              showToast("Tack, vi har tagit emot det");
            }}
            className="mt-3 h-10 rounded-full bg-brown px-4 text-sm font-semibold text-white"
          >
            Skicka
          </button>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center px-6 pt-16 text-center">
        <div className="font-display text-4xl font-bold tracking-tight">VELIO</div>
        <h2 className="mt-3 font-display text-2xl font-semibold">Välkommen</h2>
        <p className="mt-2 mb-6 max-w-xs text-sm leading-relaxed text-muted">
          Logga in med BankID, Google, e-post eller mobil. Utförare verifieras med BankID eller pass.
        </p>
        <Btn variant="bank" onClick={() => setSheet("bankid")}>
          <Shield className="size-4" /> Öppna BankID
        </Btn>
      </div>
    );
  }

  const own = ownBusiness({ accountId, directory, loggedIn });
  const email = profile.email;
  const verifyLabel = idVerified ? "ID verifierat" : "Konto aktivt";
  const roleLabel = accountMode === "business" ? "Utförare" : "Kund";
  const quick = [
    { icon: Calendar, label: "Bokningar", badge: bookings.length, onClick: () => go("bookings") },
    { icon: ClipboardList, label: "Mina uppdrag", badge: posted.filter((job) => !accountId || job.ownerId === accountId).length, onClick: () => go("posted") },
    { icon: Heart, label: "Favoriter", badge: favorites.length, onClick: () => go("favorites") },
    { icon: MapPin, label: "Adresser", badge: addresses.length, onClick: () => go("addresses") },
  ];
  const rows = [
    { icon: User, label: "Redigera profil", onClick: () => go("settings") },
    { icon: Wallet, label: "Utbetalningar", note: "Saldo, väntande belopp och uttag.", onClick: () => go("wallet") },
    { icon: CreditCard, label: "Betalningsmetoder", onClick: () => go("payments") },
    { icon: Clock, label: "Bokningshistorik", onClick: () => go("bookings") },
    { icon: Briefcase, label: "VELIO Business", note: own ? "Din profil är publicerad. Öppna den här." : "Erbjud dina tjänster, få uppdrag och tjäna pengar.", onClick: () => go("business") },
    { icon: Settings, label: "Inställningar", onClick: () => go("settings") },
    { icon: HelpCircle, label: "Hjälp och support", onClick: () => go("help") },
    { icon: LogOut, label: "Logga ut", onClick: logout },
  ];

  return (
    <div className="bg-cream px-4 pt-4 pb-4">
      {listing || own ? (
        <ModeSwitch
          name={profile.name}
          mode={accountMode}
          idVerified={idVerified}
          idMethod={idMethod}
          onMode={setAccountMode}
        />
      ) : (
      <section className="relative overflow-hidden rounded-[1.4rem] border border-line bg-paper/80 backdrop-blur-xl px-4 py-4">
        <svg viewBox="0 0 180 220" className="pointer-events-none absolute top-0 right-0 h-full w-36 text-sand" aria-hidden="true">
          <path d="M70 0c-30 50 40 70-10 130-30 36 40 90 120 90V0H70Z" fill="currentColor" />
        </svg>
        <div className="relative flex items-center gap-4">
          <ProfilePhoto large />
          <div>
            <h2 className="font-serif text-[1.7rem] leading-none font-medium">{publicDisplayName(profile.name) || "Din profil"}</h2>
            <p className="mt-2 flex items-center gap-1 text-sm font-medium text-ok">
              <span className="grid size-4 place-items-center rounded-full border border-[#3d8f4a] text-[10px]">✓</span>
              {verifyLabel}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs font-medium">
              <Crown className="size-3.5" />
              {roleLabel}
            </span>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-t border-line pt-3">
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-xs text-muted">Telefon</p>
              <p className="text-sm leading-snug">{profile.phone || "Ingen telefon"}</p>
            </div>
          </div>
          <span className="mt-1 h-8 w-px bg-sand" />
          <div className="flex gap-2">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted">E-post</p>
              <p className="truncate text-sm">{email || "Ingen e-post"}</p>
            </div>
          </div>
        </div>
      </section>
      )}

      <ProfileCompleteness
        name={publicDisplayName(profile.name)}
        avatar={Boolean(profile.avatar)}
        phone={Boolean(profile.phone)}
        email={Boolean(contactEmail(profile.email))}
        verified={idVerified}
        pending={Boolean(kycPending) && !idVerified}
        onVerify={() => go("verify-id")}
      />

      <h3 className="ios-section mt-6 text-[1.45rem]">Snabbval</h3>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {quick.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" onClick={item.onClick} className="rounded-2xl border border-line bg-paper/80 backdrop-blur-xl px-0.5 py-3">
              <span className="relative mx-auto grid size-8 place-items-center">
                <Icon className="size-5" strokeWidth={1.6} />
                {item.badge ? (
                  <span className="absolute -top-1 -right-2 grid size-4 place-items-center rounded-full bg-wheat text-[10px] font-semibold">{item.badge}</span>
                ) : null}
              </span>
              <span className="mt-1 block text-[10px] leading-tight whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => go("business")} className="relative mt-4 block w-full overflow-hidden rounded-[1.4rem] text-left text-white">
        <img src={asset("/velio/business-home.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-brown/92 via-brown/72 to-brown/10" />
        <div className="relative max-w-[16.5rem] px-5 py-5">
          <p className="font-serif text-[1.85rem] leading-none">VELIO Business</p>
          <p className="mt-2 text-[15px] leading-snug">Erbjud dina tjänster och få jobb direkt från kunder.</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>✓ Välj dina arbetstider</li>
            <li>✓ Ta emot uppdrag</li>
            <li>✓ Få säkra utbetalningar</li>
          </ul>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2.5 text-sm font-semibold text-ink">
            Börja jobba med VELIO <span aria-hidden>→</span>
          </span>
        </div>
      </button>

      <h3 className="ios-section mt-6 text-[1.45rem]">Konto och inställningar</h3>
      <div className="mt-3 overflow-hidden rounded-[1.4rem] border border-line bg-paper/80 backdrop-blur-xl">
        {rows.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={index === 0 ? "flex w-full items-center gap-3 px-4 py-3.5 text-left" : "flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left"}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{item.label}</span>
                {"note" in item && item.note ? <span className="block text-xs leading-snug text-muted">{item.note}</span> : null}
              </span>
              <ChevronRight className="size-4 text-muted" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModeSwitch({
  name,
  mode,
  idVerified,
  idMethod,
  onMode,
}: {
  name: string;
  mode: "customer" | "business";
  idVerified: boolean;
  idMethod: string | null;
  onMode: (mode: "customer" | "business") => void;
}) {
  const go = useVelio((state) => state.go);
  const accountId = useVelio((state) => state.accountId);
  const directory = useVelio((state) => state.directory);
  const ownsListing = Boolean(ownBusiness({ accountId, directory, loggedIn: true }));
  const pick = (next: "customer" | "business") => {
    if (next === "business" && !idVerified && !ownsListing) {
      go("verify-id");
      return;
    }
    onMode(next);
    if (next === "business" && ownsListing) {
      go("business");
      return;
    }
    go("home");
  };
  const badge = idVerified
    ? idMethod === "passport"
      ? "Verifierad med pass"
      : "Verifierad med BankID"
    : "Konto aktivt";
  return (
    <div>
      <h2 className="font-serif text-[2.35rem] leading-none font-medium">Min profil</h2>
      <div className="mt-5 flex items-center gap-4">
        <ProfilePhoto large />
        <div className="min-w-0">
          <h3 className="font-serif text-[1.85rem] leading-tight">{name}</h3>
          <p className="mt-1 text-sm">Medlem sedan nov 2026</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1 text-sm text-ok">
            <span className="grid size-4 place-items-center rounded-full bg-ok text-[10px] text-white">✓</span>
            {badge}
          </span>
        </div>
      </div>
      <div className="mt-5 rounded-[1.35rem] border border-line bg-paper/80 backdrop-blur-xl p-3">
        <p className="text-center text-[15px] font-semibold">Välj hur du vill använda VELIO</p>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <ModeCard active={mode === "customer"} icon={House} title="VELIO Customer" text="Boka tjänster och få hjälp" onClick={() => pick("customer")} />
          <button
            type="button"
            aria-label="Byt läge"
            onClick={() => pick(mode === "customer" ? "business" : "customer")}
            className="absolute top-1/2 left-1/2 z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-white shadow-sm"
          >
            <ArrowLeftRight className="size-4" />
          </button>
          <ModeCard
            active={mode === "business"}
            icon={Briefcase}
            title="VELIO Business"
            text={idVerified || ownsListing ? "Erbjud tjänster och ta emot uppdrag" : "Kräver BankID eller pass"}
            onClick={() => pick("business")}
          />
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  icon: Icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: typeof House;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cn("relative min-h-[8.4rem] rounded-2xl px-2 py-4 text-center", active ? "bg-brown text-white" : "border border-line bg-soft")}>
      <span className={cn("absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full text-[11px]", active ? "bg-white text-brown" : "border border-[#d9d1c7]")}>
        {active ? "✓" : ""}
      </span>
      <Icon className="mx-auto size-7" strokeWidth={1.4} />
      <span className="mt-2 block text-sm font-bold">{title}</span>
      <span className={cn("mt-1 block text-xs leading-snug", active ? "text-white/85" : "text-[#3c3834]")}>{text}</span>
    </button>
  );
}

function ContactRow({
  label,
  value,
  type = "text",
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const dirty = draft.trim() !== value.trim();
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <label className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted">{label}</span>
        <input
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-0.5 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </label>
      <button
        type="button"
        disabled={!dirty || busy}
        onClick={() => {
          setBusy(true);
          void Promise.resolve(onSave(draft.trim())).finally(() => setBusy(false));
        }}
        className="shrink-0 rounded-full bg-brown px-3 py-1.5 text-xs font-semibold text-white disabled:bg-sand disabled:text-muted"
      >
        Spara
      </button>
    </div>
  );
}

function SettingSwitch({ on }: { on: boolean }) {
  return (
    <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-[#2f7a3c]" : "bg-[#e7e0d8]")} aria-hidden>
      <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition", on ? "left-5" : "left-0.5")} />
    </span>
  );
}

export { OnboardSheet } from "@/components/velio/onboard";
