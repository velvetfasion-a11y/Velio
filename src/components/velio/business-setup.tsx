import { useState } from "react";
import { Check, MapPin, Shield } from "lucide-react";
import { services, type ServiceId } from "@/lib/velio/data";
import { formatOrg, lookupCompany, orgDigits, type CompanyRecord } from "@/lib/velio/company";
import { useVelio, type Listing } from "@/lib/velio/store";
import dynamic from "next/dynamic";
import { IdentityFlow } from "@/components/velio/identity";
import { ProfilePhoto } from "@/components/velio/ui";

const RadiusMap = dynamic(() => import("@/components/velio/radius-map").then((mod) => mod.RadiusMap), {
  ssr: false,
  loading: () => <div className="h-52 rounded-[1.3rem] bg-sand" />,
});
import { cn } from "@/lib/cn";

const presets: Record<ServiceId, { name: string; hours: string; price: number }[]> = {
  stad: [
    { name: "Hemstädning", hours: "2–4 timmar", price: 650 },
    { name: "Flyttstäd", hours: "En dag", price: 2490 },
    { name: "Fönsterputs", hours: "1–2 timmar", price: 490 },
  ],
  el: [
    { name: "Felsökning", hours: "1 timme", price: 750 },
    { name: "Byte av uttag", hours: "Efter överenskommelse", price: 890 },
  ],
  trad: [
    { name: "Gräsklippning", hours: "1–2 timmar", price: 450 },
    { name: "Häckklippning", hours: "Halvdag", price: 980 },
  ],
  rep: [
    { name: "Småfix hemma", hours: "1 timme", price: 550 },
    { name: "Montering", hours: "1–2 timmar", price: 690 },
  ],
  sak: [
    { name: "Låsbyte", hours: "1 timme", price: 890 },
    { name: "Bevakning", hours: "Pass", price: 420 },
  ],
  ren: [
    { name: "Målning av rum", hours: "En dag", price: 3200 },
    { name: "Tapetsering", hours: "En dag", price: 2800 },
  ],
  per: [
    { name: "Extra personal", hours: "Halvdag", price: 1600 },
    { name: "Heldag", hours: "8 timmar", price: 2900 },
  ],
  eko: [
    { name: "Löpande bokföring", hours: "Per månad", price: 1490 },
    { name: "Deklaration", hours: "En gång", price: 2200 },
  ],
  ank: [
    { name: "Inflyttning", hours: "Halvdag", price: 1800 },
    { name: "Välkomststäd", hours: "2–3 timmar", price: 790 },
  ],
  til: [
    { name: "Tillsyn av hem", hours: "Besök", price: 350 },
    { name: "Vattna och vädra", hours: "Besök", price: 290 },
  ],
};

type Offer = { name: string; hours: string; price: number; on: boolean };
type Step = "welcome" | "identity" | "doc" | "org" | "company" | "trades" | "price" | "area" | "photo" | "work" | "preview";

const counted: Step[] = ["identity", "org", "company", "trades", "price", "area", "photo", "work", "preview"];

function readPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function BusinessSetup() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const showToast = useVelio((state) => state.showToast);
  const publishDemoBusiness = useVelio((state) => state.publishDemoBusiness);
  const profile = useVelio((state) => state.profile);
  const allowLocation = useVelio((state) => state.allowLocation);
  const userLocation = useVelio((state) => state.userLocation);
  const [step, setStep] = useState<Step>("welcome");
  const [org, setOrg] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [trades, setTrades] = useState<ServiceId[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [place, setPlace] = useState("Södermalm, Stockholm");
  const [km, setKm] = useState(15);
  const [photos, setPhotos] = useState<string[]>([]);

  const index = counted.indexOf(step);

  const back = () => {
    if (step === "welcome") closeSheet();
    else if (step === "doc") setStep("identity");
    else if (index <= 0) setStep("welcome");
    else setStep(counted[index - 1]);
  };

  const toggleTrade = (id: ServiceId) => {
    setTrades((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        showToast("Välj högst tre tjänster");
        return current;
      }
      return [...current, id];
    });
  };

  const loadCompany = async () => {
    setLookupBusy(true);
    try {
      const found = await lookupCompany(org);
      setCompany(found);
      setStep("company");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Kunde inte slå upp numret");
    } finally {
      setLookupBusy(false);
    }
  };

  const goPrice = () => {
    if (!trades.length) return showToast("Välj minst en tjänst");
    setOffers(
      trades.flatMap((id) => presets[id].map((item) => ({ ...item, on: true }))),
    );
    setStep("price");
  };

  const publish = () => {
    if (!company) return showToast("Slå upp företaget först");
    const active = offers.filter((offer) => offer.on);
    if (!active.length) return showToast("Välj minst ett pris");
    if (place.trim().length < 2) return showToast("Skriv ett område");
    const names = trades.map((id) => services.find((item) => item.id === id)?.name).filter(Boolean);
    const listing: Listing = {
      serviceId: trades[0],
      serviceIds: trades,
      title: company.name,
      desc: `${company.name} tar uppdrag inom ${names.join(", ")} kring ${place.trim()}.`,
      price: Math.min(...active.map((offer) => offer.price)),
      photos,
      offers: active.map(({ name, hours, price }) => ({ name, hours, price })),
      areas: [`${place.trim()} · ${km} km`],
      companyName: company.name,
      orgNumber: company.orgNumber,
      fTax: company.fTax,
      demo: true,
    };
    publishDemoBusiness(listing);
  };

  if (step === "welcome") {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-cream">
        <div className="px-5 pt-4">
          <button type="button" onClick={closeSheet} className="text-sm font-semibold text-brown">
            Stäng
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-4">
          <p className="text-xs font-semibold tracking-[0.22em] text-brown">VELIO BUSINESS</p>
          <h1 className="ios-title mt-3 text-[2.15rem] leading-none">Ta emot uppdrag. Få betalt när jobbet är klart.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Några korta steg. Du ser profilen innan den publiceras. Utan BankID blir den märkt Demo, inte verifierad.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Identitet", "BankID om det finns, annars ID-handling som platshållare."],
              ["Företag", "Organisationsnummer fyller i namn och adress från ett demoregister."],
              ["Syns för kunder", "Tjänster, pris, område och en förhandsvisning."],
            ].map(([title, body]) => (
              <li key={title} className="rounded-[1.2rem] border border-line bg-paper/80 px-4 py-3 backdrop-blur-xl">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 pt-2 pb-4">
          <button type="button" onClick={() => setStep("identity")} className="h-14 w-full rounded-full bg-brown text-base font-semibold text-paper">
            Kom igång
          </button>
        </div>
      </div>
    );
  }

  if (step === "doc") {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-cream">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
          <IdentityFlow onBack={() => setStep("identity")} onContinue={() => setStep("org")} />
        </div>
      </div>
    );
  }

  const title =
    step === "identity"
      ? "Hur vill du identifiera dig?"
      : step === "org"
        ? "Vad är organisationsnumret?"
        : step === "company"
          ? "Stämmer företaget?"
          : step === "trades"
            ? "Vad erbjuder du?"
            : step === "price"
              ? "Vad kostar det från?"
              : step === "area"
                ? "Var jobbar du?"
                : step === "photo"
                  ? "En bild på dig"
                  : step === "work"
                    ? "Bilder från jobb"
                    : "Så här ser profilen ut";

  const subtitle =
    step === "identity"
      ? "BankID är vägen när en leverantör är kopplad. ID-handling granskas inte i den här versionen."
      : step === "org"
        ? "Tio siffror. Demoregistret fyller i namn och adress. Det är inte Bolagsverket."
        : step === "company"
          ? "Uppgifterna kommer från demoregistret. F-skatt är inte kontrollerad mot Skatteverket."
          : step === "trades"
            ? "Välj upp till tre. Förslagen på nästa steg följer det du väljer."
            : step === "price"
              ? "Förvalen är på. Ändra priset om ditt skiljer sig."
              : step === "area"
                ? "Kunder inom radien kan hitta dig. Kartan är OpenStreetMap."
                : step === "photo"
                  ? "Valfritt. Bilden stannar i den här webbläsaren."
                  : step === "work"
                    ? "Valfritt. Högst fyra bilder, bara lokalt."
                    : "Demo betyder att identiteten inte är verifierad. Du kan ändå publicera och se resultatet.";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-cream">
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <button type="button" onClick={back} className="text-sm font-semibold text-brown">
            Tillbaka
          </button>
          <span>
            Steg {index + 1} av {counted.length}
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-brown" style={{ width: `${((index + 1) / counted.length) * 100}%` }} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4">
        <h1 className="ios-title text-[1.85rem] leading-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        <div className="mt-6">
          {step === "identity" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStep("org")}
                className="w-full rounded-[1.3rem] bg-[#F7C948] px-4 py-4 text-left"
              >
                <span className="block text-base font-semibold text-[#1a1a1a]">BankID</span>
                <span className="mt-1 block text-sm text-[#1a1a1a]/80">Rekommenderas. Inte kopplat här, så profilen blir Demo.</span>
              </button>
              <button
                type="button"
                onClick={() => setStep("doc")}
                className="w-full rounded-[1.3rem] border border-line bg-paper px-4 py-4 text-left"
              >
                <span className="block text-base font-semibold">ID-handling</span>
                <span className="mt-1 block text-sm text-muted">Pass, nationellt id-kort eller körkort. Platshållare.</span>
              </button>
            </div>
          ) : null}

          {step === "org" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">Organisationsnummer</span>
              <input
                value={formatOrg(orgDigits(org))}
                inputMode="numeric"
                placeholder="556677-8899"
                onChange={(event) => setOrg(orgDigits(event.target.value))}
                className="h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg outline-none"
              />
            </label>
          ) : null}

          {step === "company" && company ? (
            <div className="space-y-3">
              <p className="rounded-2xl bg-sand px-3 py-2 text-xs leading-snug">Demoregister. En Bolagsverket- eller Roaring-koppling kan ersätta det här.</p>
              <label className="block text-sm font-medium">
                Namn
                <input value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} className="mt-1 h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg font-normal outline-none" />
              </label>
              <label className="block text-sm font-medium">
                Adress
                <input
                  value={`${company.street}, ${company.city}`}
                  onChange={(event) => {
                    const [street, city] = event.target.value.split(",");
                    setCompany({ ...company, street: (street ?? "").trim(), city: (city ?? company.city).trim() });
                  }}
                  className="mt-1 h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg font-normal outline-none"
                />
              </label>
              <div>
                <p className="text-sm font-medium">F-skatt</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["yes", "Ja"],
                      ["no", "Nej"],
                      ["unsure", "Vet inte"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCompany({ ...company, fTax: value })}
                      className={cn("h-12 rounded-full text-sm font-semibold", company.fTax === value ? "bg-brown text-paper" : "border border-line bg-paper")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === "trades" ? (
            <div className="grid grid-cols-2 gap-2">
              {services.map((service) => {
                const on = trades.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTrade(service.id)}
                    className={cn("min-h-16 rounded-2xl border px-3 py-3 text-left", on ? "border-brown bg-brown text-paper" : "border-line bg-paper")}
                  >
                    <span className="block font-semibold">{service.name}</span>
                    <span className={cn("mt-0.5 block text-xs", on ? "text-paper/80" : "text-muted")}>{service.desc}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === "price" ? (
            <div className="space-y-2">
              {offers.map((offer, index) => (
                <div key={`${offer.name}-${index}`} className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-3 py-2">
                  <button
                    type="button"
                    aria-label={offer.on ? "Ta bort" : "Lägg till"}
                    onClick={() => setOffers(offers.map((item, itemIndex) => (itemIndex === index ? { ...item, on: !item.on } : item)))}
                    className={cn("grid size-7 place-items-center rounded-full", offer.on ? "bg-brown text-paper" : "border border-line")}
                  >
                    {offer.on ? <Check className="size-4" /> : null}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{offer.name}</span>
                    <span className="block text-xs text-muted">{offer.hours}</span>
                  </span>
                  <label className="flex items-center gap-1 text-sm font-semibold">
                    <input
                      inputMode="numeric"
                      value={offer.price}
                      aria-label={`Pris ${offer.name}`}
                      onChange={(event) => {
                        const price = Number(event.target.value.replace(/\D/g, "").slice(0, 6)) || 0;
                        setOffers(offers.map((item, itemIndex) => (itemIndex === index ? { ...item, price } : item)));
                      }}
                      className="h-10 w-20 rounded-full border border-line bg-cream px-2 text-right outline-none"
                    />
                    kr
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          {step === "area" ? (
            <div className="space-y-3">
              <RadiusMap km={km} />
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-3">
                <MapPin className="size-4 text-brown" />
                <input value={place} onChange={(event) => setPlace(event.target.value)} aria-label="Område" className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none" />
              </label>
              <button
                type="button"
                onClick={() => {
                  void allowLocation().then(() => {
                    const label = useVelio.getState().userLocation?.label;
                    if (label) setPlace(label);
                  });
                }}
                className="h-11 w-full rounded-full border border-line text-sm font-semibold"
              >
                {userLocation?.label ? "Använd min plats" : "Använd min plats"}
              </button>
              <div>
                <div className="mb-1 flex justify-between text-sm font-semibold">
                  <span>Radie</span>
                  <span>{km} km</span>
                </div>
                <input type="range" min={5} max={50} value={km} onChange={(event) => setKm(Number(event.target.value))} className="w-full accent-[#4A2C1D]" />
              </div>
            </div>
          ) : null}

          {step === "photo" ? (
            <div className="flex flex-col items-center py-6">
              <ProfilePhoto large prompt />
              <p className="mt-3 text-sm text-muted">{profile.avatar ? "Tryck för att byta." : "Tryck för att lägga till. Du kan hoppa över."}</p>
            </div>
          ) : null}

          {step === "work" ? (
            <div>
              <div className="grid grid-cols-2 gap-2">
                {photos.map((src) => (
                  <img key={src.slice(0, 32)} src={src} alt="" className="h-28 w-full rounded-2xl object-cover" />
                ))}
                {photos.length < 4 ? (
                  <label className="grid h-28 cursor-pointer place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">
                    Lägg till
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        void readPhoto(file).then((src) => setPhotos((current) => [...current, src].slice(0, 4)));
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "preview" && company ? (
            <div className="overflow-hidden rounded-[1.4rem] border border-line bg-paper">
              <div className="bg-sand px-4 py-3">
                <span className="rounded-full bg-brown px-2.5 py-1 text-xs font-semibold text-paper">Demo</span>
                <p className="mt-2 text-xs text-muted">Inte verifierad med BankID</p>
              </div>
              <div className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <ProfilePhoto />
                  <div>
                    <p className="font-serif text-2xl leading-none">{profile.name || company.name}</p>
                    <p className="mt-1 text-sm text-muted">{company.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm">fr. {Math.min(...offers.filter((offer) => offer.on).map((offer) => offer.price))} kr</p>
                <p className="mt-1 text-sm text-muted">
                  {trades.map((id) => services.find((item) => item.id === id)?.name).filter(Boolean).join(" · ")} · {place} · {km} km
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {offers.filter((offer) => offer.on).map((offer) => (
                    <li key={offer.name} className="flex justify-between">
                      <span>{offer.name}</span>
                      <span>fr. {offer.price} kr</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted">Org.nr {company.orgNumber}</p>
                <p className="text-sm text-muted">F-skatt: {company.fTax === "yes" ? "Ja, enligt dig" : company.fTax === "no" ? "Nej" : "Osäker"}</p>
                <p className="mt-4 flex gap-2 rounded-2xl bg-sand px-3 py-3 text-sm leading-snug">
                  <Shield className="mt-0.5 size-4 shrink-0" />
                  Pengarna blir tillgängliga 3 timmar efter att jobbet är klart. Sedan tar du ut dem under Saldo.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="px-5 pt-2 pb-4">
        {step === "identity" ? null : (
          <button
            type="button"
            disabled={lookupBusy}
            onClick={() => {
              if (step === "org") void loadCompany();
              else if (step === "company") setStep("trades");
              else if (step === "trades") goPrice();
              else if (step === "price") {
                if (!offers.some((offer) => offer.on)) return showToast("Behåll minst ett pris");
                setStep("area");
              } else if (step === "area") setStep("photo");
              else if (step === "photo") setStep("work");
              else if (step === "work") setStep("preview");
              else if (step === "preview") publish();
            }}
            className="h-14 w-full rounded-full bg-brown text-base font-semibold text-paper disabled:opacity-50"
          >
            {lookupBusy ? "Slår upp…" : step === "org" ? "Hämta företag" : step === "work" && photos.length === 0 ? "Hoppa över" : step === "preview" ? "Publicera som Demo" : "Nästa"}
          </button>
        )}
      </div>
    </div>
  );
}
