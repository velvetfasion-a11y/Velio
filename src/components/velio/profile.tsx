import { useState } from "react";
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
} from "lucide-react";
import { kr, publicDisplayName, serviceById } from "@/lib/velio/data";
import { HistoryCard } from "@/components/velio/history";
import { VerifyIdScreen } from "@/components/velio/verify-id";
import { ownBusiness, useVelio, type Booking } from "@/lib/velio/store";
import { cn } from "@/lib/cn";
import { Btn, Field, ProfilePhoto, ScreenHeader } from "@/components/velio/ui";
import { asset } from "@/lib/velio/asset";

const faqs = [
  {
    q: "Hur fungerar RUT-avdrag?",
    a: "På många hushållsnära tjänster kan RUT dras direkt på priset. Utföraren ser om jobbet kvalificerar innan ni startar.",
  },
  {
    q: "Är utförarna kontrollerade?",
    a: "Utförare måste verifiera sig med BankID eller pass innan VELIO Business aktiveras.",
  },
  {
    q: "Kan jag avboka?",
    a: "Ja. Öppna ett pågående uppdrag från hem och välj Avbryt. I den skarpa tjänsten kan sen avbokning kosta.",
  },
  {
    q: "Hur betalar jag?",
    a: "Apple Pay, kort, Swish eller kontant. Du hanterar metoderna under Jag och Betalningsmetoder.",
  },
];

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

export function ProfileScreens() {
  const screen = useVelio((state) => state.screen);
  const go = useVelio((state) => state.go);
  const loggedIn = useVelio((state) => state.loggedIn);
  const logout = useVelio((state) => state.logout);
  const profile = useVelio((state) => state.profile);
  const setProfile = useVelio((state) => state.setProfile);
  const saveProfile = useVelio((state) => state.saveProfile);
  const cards = useVelio((state) => state.cards);
  const addCard = useVelio((state) => state.addCard);
  const bookings = useVelio((state) => state.bookings);
  const posted = useVelio((state) => state.posted);
  const accountId = useVelio((state) => state.accountId);
  const directory = useVelio((state) => state.directory);
  const openReceipt = useVelio((state) => state.openReceipt);
  const listing = useVelio((state) => state.listing);
  const accountMode = useVelio((state) => state.accountMode);
  const idVerified = useVelio((state) => state.idVerified);
  const idMethod = useVelio((state) => state.idMethod);
  const setAccountMode = useVelio((state) => state.setAccountMode);
  const setSheet = useVelio((state) => state.setSheet);
  const notifications = useVelio((state) => state.notifications);
  const setNotifications = useVelio((state) => state.setNotifications);
  const locationOn = useVelio((state) => state.locationOn);
  const userLocation = useVelio((state) => state.userLocation);
  const showToast = useVelio((state) => state.showToast);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [issue, setIssue] = useState("");
  const [last4, setLast4] = useState("");
  const [exp, setExp] = useState("");
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);

  if (screen === "payments") {
    return (
      <div className="px-5 pt-4">
        <ScreenHeader title="Betalningsmetoder" />
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
                <article key={job.id} className="flex gap-3 rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-3">
                  <img src={images[job.serviceId] || `/velio/${job.serviceId}.jpg`} alt="" className="size-16 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{service?.name}</p>
                      <span className="shrink-0 rounded-full bg-[#e7f3e4] px-2 py-0.5 text-[11px] text-[#2f7a3a]">Publicerad</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-[#5c564f]">{job.text}</p>
                    <p className="mt-1 text-xs text-[#5c564f]">{job.when}</p>
                    <p className="text-xs text-[#5c564f]">{job.address}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.3rem] border border-[#efeae4] bg-white/80 px-4 py-8 text-center">
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
    const verifyLabel =
      idMethod === "passport" ? "Verifierad\nmed pass" : "Verifierad\nmed BankID";
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
            <p className="text-[11px] tracking-[0.28em] text-[#e6d3a1]">VELIO BUSINESS</p>
            <h3 className="mt-2 font-serif text-[2rem] leading-none">Arbeta med VELIO</h3>
            <p className="mt-2 max-w-[16rem] text-sm leading-snug text-white/90">
              Bli utförare, ta emot uppdrag och bygg ditt professionella nätverk.
            </p>
          </div>
        </div>
        {!idVerified && !own ? (
          <div className="mt-5 rounded-[1.2rem] border border-[#efeae4] bg-[#fbf8f4] p-4">
            <p className="text-sm leading-relaxed text-[#5c564f]">
              Business kräver identifiering. Verifiera dig med BankID eller pass innan du lägger upp jobb.
            </p>
            <button
              type="button"
              onClick={() => go("verify-id")}
              className="mt-3 h-11 w-full rounded-full bg-[#6e5636] text-sm font-semibold text-white"
            >
              Verifiera nu
            </button>
          </div>
        ) : null}
        <div className="mt-6 grid grid-cols-3">
          {points.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={index === 0 ? "px-1 text-center" : "border-l border-[#e6dfd6] px-1 text-center"}>
                <Icon className="mx-auto size-7 text-[#9a7b45]" strokeWidth={1.4} />
                <p className="mt-2 text-xs leading-snug whitespace-pre-line">{item.label}</p>
              </div>
            );
          })}
        </div>
        {activeListing && listed ? (
          <div className="mt-5 rounded-[1.2rem] border border-[#efeae4] bg-white p-4">
            <p className="text-xs tracking-wide text-[#9a7b45]">PUBLICERAD</p>
            <p className="mt-1 font-semibold">{own?.name || listed.name}</p>
            <p className="mt-1 text-sm text-muted">fr. {kr(activeListing.price)} · syns på hemsidan</p>
            <button
              type="button"
              onClick={() => {
                if (own) useVelio.getState().openProvider(own.id);
              }}
              className="mt-3 h-11 w-full rounded-full bg-[#6e5636] text-sm font-semibold text-white"
            >
              Öppna min profil
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountMode("business");
                go("home");
              }}
              className="mt-2 h-11 w-full rounded-full border border-[#e6dfd6] text-sm font-semibold"
            >
              Gå till arbetsläget
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => (idVerified || own ? setSheet("onboard") : go("verify-id"))}
          className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#1c1917] text-base font-semibold text-white"
        >
          <Briefcase className="size-5" strokeWidth={1.6} />
          {!idVerified && !own ? "Verifiera för att fortsätta" : activeListing ? "Uppdatera jobb" : "Lägg upp ditt jobb"}
        </button>
      </div>
    );
  }

  if (screen === "settings") {
    return (
      <div className="px-5 pt-4">
        <ScreenHeader title="Inställningar" />
        {legal ? (
          <div>
            <button type="button" onClick={() => setLegal(null)} className="mb-3 text-sm font-semibold">
              Tillbaka
            </button>
            <p className="text-sm leading-relaxed text-muted">
            {legal === "privacy"
              ? "VELIO lagrar namn, bokningar och chatt endast i den här webbläsaren under demon. Ingen riktig betalning eller identifiering sker. Rensa webbplatsdata om du vill ta bort det."
              : "Tjänsten i den här vyn är en prototyp. Priser är exempel. Ett uppdrag blir bindande först när både du och utföraren bekräftat i den skarpa tjänsten."}
            </p>
          </div>
        ) : (
          <div>
            <Field label="Namn" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
            <Field label="Telefon" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
            <Field
              label="E-post"
              type="email"
              value={profile.email}
              onChange={(event) => setProfile({ ...profile, email: event.target.value })}
            />
            <Btn
              onClick={() => {
                void (async () => {
                  const ok = await saveProfile(profile);
                  if (!ok) return;
                  showToast("Profil sparad");
                })();
              }}
            >
              Spara namn och kontakt
            </Btn>
            <button
              type="button"
              role="switch"
              aria-checked={notifications}
              onClick={() => setNotifications(!notifications)}
              className="flex w-full items-center justify-between border-b border-line py-4 text-left"
            >
              <span>Notifikationer</span>
              <span className={notifications ? "rounded-full bg-ink px-3 py-1 text-sm text-paper" : "rounded-full bg-soft px-3 py-1 text-sm"}>
                {notifications ? "På" : "Av"}
              </span>
            </button>
            <button type="button" onClick={() => setSheet("location")} className="flex w-full items-center justify-between border-b border-line py-4 text-left">
              <span>Plats</span>
              <span className={cn("max-w-[55%] truncate text-sm", locationOn ? "font-medium text-[#2f7a3c]" : "text-muted")}>
                {locationOn ? userLocation?.label || "GPS på" : "Av"}
              </span>
            </button>
            <button type="button" onClick={() => setLegal("privacy")} className="flex w-full items-center justify-between border-b border-line py-4">
              <span>Integritetspolicy</span>
              <ChevronRight className="size-4 text-muted" />
            </button>
            <button type="button" onClick={() => setLegal("terms")} className="flex w-full items-center justify-between border-b border-line py-4">
              <span>Användarvillkor</span>
              <ChevronRight className="size-4 text-muted" />
            </button>
            <div className="flex items-center justify-between py-4">
              <span>Version</span>
              <span className="text-sm text-muted">1.0.0</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === "help") {
    return (
      <div className="px-5 pt-4">
        <ScreenHeader title="Hjälp och support" />
        <div className="mb-5 divide-y divide-line rounded-2xl border border-line px-4">
          {faqs.map((faq, index) => (
            <button key={faq.q} type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full py-3 text-left">
              <span className="block font-medium">{faq.q}</span>
              {openFaq === index ? <span className="mt-1 block text-sm leading-relaxed text-muted">{faq.a}</span> : null}
            </button>
          ))}
        </div>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium">Rapportera ett problem</span>
          <textarea
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
            className="h-24 w-full rounded-xl border border-line px-3 py-3 text-base outline-none focus:border-ink"
            placeholder="Vad gick fel?"
          />
        </label>
        <Btn
          onClick={() => {
            if (issue.trim().length < 4) {
              showToast("Beskriv problemet kort");
              return;
            }
            setIssue("");
            showToast("Tack, vi har tagit emot det");
          }}
        >
          Skicka
        </Btn>
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
    { icon: Heart, label: "Favoriter", onClick: () => showToast("Inga sparade favoriter ännu") },
    { icon: MapPin, label: "Adresser", onClick: () => showToast("Lägg till en adress under Redigera profil snart") },
  ];
  const rows = [
    { icon: User, label: "Redigera profil", onClick: () => go("settings") },
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
      <section className="relative overflow-hidden rounded-[1.4rem] border border-[#efeae4] bg-white/80 px-4 py-4">
        <svg viewBox="0 0 180 220" className="pointer-events-none absolute top-0 right-0 h-full w-36 text-[#f6f1ea]" aria-hidden="true">
          <path d="M70 0c-30 50 40 70-10 130-30 36 40 90 120 90V0H70Z" fill="currentColor" />
        </svg>
        <div className="relative flex items-center gap-4">
          <ProfilePhoto large />
          <div>
            <h2 className="font-serif text-[1.7rem] leading-none font-medium">{publicDisplayName(profile.name) || "Din profil"}</h2>
            <p className="mt-2 flex items-center gap-1 text-sm font-medium text-[#3d8f4a]">
              <span className="grid size-4 place-items-center rounded-full border border-[#3d8f4a] text-[10px]">✓</span>
              {verifyLabel}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#f3ece3] px-3 py-1 text-xs font-medium">
              <Crown className="size-3.5" />
              {roleLabel}
            </span>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-t border-[#efeae4] pt-3">
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-xs text-muted">Telefon</p>
              <p className="text-sm leading-snug">{profile.phone || "Ingen telefon"}</p>
            </div>
          </div>
          <span className="mt-1 h-8 w-px bg-[#efeae4]" />
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

      <h3 className="mt-6 font-serif text-[1.7rem] font-medium">Snabbval</h3>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {quick.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" onClick={item.onClick} className="rounded-2xl border border-[#efeae4] bg-white/80 px-0.5 py-3">
              <span className="relative mx-auto grid size-8 place-items-center">
                <Icon className="size-5" strokeWidth={1.6} />
                {item.badge ? (
                  <span className="absolute -top-1 -right-2 grid size-4 place-items-center rounded-full bg-[#eadccb] text-[10px] font-semibold">{item.badge}</span>
                ) : null}
              </span>
              <span className="mt-1 block text-[10px] leading-tight whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => go("business")} className="relative mt-4 block w-full overflow-hidden rounded-[1.4rem] text-left text-white">
        <img src={asset("/velio/business-home.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#3a2a1c]/92 via-[#3a2a1c]/72 to-[#3a2a1c]/10" />
        <div className="relative max-w-[16.5rem] px-5 py-5">
          <p className="font-serif text-[1.85rem] leading-none">VELIO Business</p>
          <p className="mt-2 text-[15px] leading-snug">Erbjud dina tjänster och få jobb direkt från kunder.</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>✓ Välj dina arbetstider</li>
            <li>✓ Ta emot uppdrag</li>
            <li>✓ Få säkra utbetalningar</li>
          </ul>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#f3eee6] px-4 py-2.5 text-sm font-semibold text-ink">
            Börja jobba med VELIO <span aria-hidden>→</span>
          </span>
        </div>
      </button>

      <h3 className="mt-6 font-serif text-[1.7rem] font-medium">Konto och inställningar</h3>
      <div className="mt-3 overflow-hidden rounded-[1.4rem] border border-[#efeae4] bg-white/80">
        {rows.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={index === 0 ? "flex w-full items-center gap-3 px-4 py-3.5 text-left" : "flex w-full items-center gap-3 border-t border-[#f0ebe6] px-4 py-3.5 text-left"}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{item.label}</span>
                {"note" in item && item.note ? <span className="block text-xs leading-snug text-[#5c564f]">{item.note}</span> : null}
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
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#e7f3e4] px-3 py-1 text-sm text-[#2f7a3a]">
            <span className="grid size-4 place-items-center rounded-full bg-[#2f7a3a] text-[10px] text-white">✓</span>
            {badge}
          </span>
        </div>
      </div>
      <div className="mt-5 rounded-[1.35rem] border border-[#efeae4] bg-white/75 p-3">
        <p className="text-center text-[15px] font-semibold">Välj hur du vill använda VELIO</p>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <ModeCard active={mode === "customer"} icon={House} title="VELIO Customer" text="Boka tjänster och få hjälp" onClick={() => pick("customer")} />
          <button
            type="button"
            aria-label="Byt läge"
            onClick={() => pick(mode === "customer" ? "business" : "customer")}
            className="absolute top-1/2 left-1/2 z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#efeae4] bg-white shadow-sm"
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
    <button type="button" onClick={onClick} className={cn("relative min-h-[8.4rem] rounded-2xl px-2 py-4 text-center", active ? "bg-[#6e5636] text-white" : "border border-[#efeae4] bg-[#fbf8f4]")}>
      <span className={cn("absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full text-[11px]", active ? "bg-white text-[#6e5636]" : "border border-[#d9d1c7]")}>
        {active ? "✓" : ""}
      </span>
      <Icon className="mx-auto size-7" strokeWidth={1.4} />
      <span className="mt-2 block text-sm font-bold">{title}</span>
      <span className={cn("mt-1 block text-xs leading-snug", active ? "text-white/85" : "text-[#3c3834]")}>{text}</span>
    </button>
  );
}

export { OnboardSheet } from "@/components/velio/onboard";
