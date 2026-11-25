import { useEffect, useRef, useState } from "react";
import { Building2, Check, IdCard, Shield, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { services, type ServiceId } from "@/lib/velio/data";
import { formatOrg, lookupCompany, orgDigits, type CompanyRecord } from "@/lib/velio/company";
import { searchAddresses, type AddressHit } from "@/lib/velio/geo";
import { formatPerson, personDigits, validatePersonnummer } from "@/lib/velio/personnummer";
import { AddressSearch } from "@/components/velio/address-search";
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
type Step = "welcome" | "identity" | "doc" | "org" | "person" | "company" | "trades" | "price" | "area" | "photo" | "work" | "preview";
type Seller = "company" | "private" | null;

function stepsFor(seller: Seller): Step[] {
  const middle: Step[] = seller === "private" ? ["person"] : ["company"];
  return ["identity", "org", ...middle, "trades", "price", "area", "photo", "work", "preview"];
}

function ChoiceCard({
  icon: Icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex aspect-square flex-col justify-between rounded-[1.3rem] border-2 bg-paper p-3 text-left",
        selected ? "border-brown ring-2 ring-brown ring-offset-2 ring-offset-cream" : "border-line",
      )}
    >
      {selected ? (
        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-brown text-paper">
          <Check className="size-3.5" />
        </span>
      ) : null}
      <span className={cn("grid size-10 place-items-center rounded-2xl", selected ? "bg-brown text-paper" : "bg-sand text-brown")}>
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <span>
        <span className="block text-[15px] leading-tight font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-tight text-muted">{subtitle}</span>
      </span>
    </button>
  );
}

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
  const saveSetupDraft = useVelio((state) => state.saveSetupDraft);
  const setupDraft = useVelio((state) => state.setupDraft);
  const profile = useVelio((state) => state.profile);
  const bankIdPersonalNumber = useVelio((state) => state.bankIdPersonalNumber);
  const [step, setStep] = useState<Step>("welcome");
  const [identityVia, setIdentityVia] = useState<"bankid" | "document" | null>(null);
  const [seller, setSeller] = useState<Seller>(null);
  const [org, setOrg] = useState("");
  const [pn, setPn] = useState("");
  const [pnFromBank, setPnFromBank] = useState(false);
  const [revealPn, setRevealPn] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [trades, setTrades] = useState<ServiceId[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [area, setArea] = useState<AddressHit | null>(null);
  const [km, setKm] = useState(15);
  const [photos, setPhotos] = useState<string[]>([]);

  const flow = stepsFor(seller);
  const index = flow.indexOf(step);

  const back = () => {
    if (step === "welcome") closeSheet();
    else if (step === "doc") setStep("identity");
    else if (index <= 0) setStep("welcome");
    else setStep(flow[index - 1]);
  };

  const openPrivate = () => {
    setSeller("private");
    setCompany(null);
    const fromBank = personDigits(bankIdPersonalNumber ?? "");
    const valid = validatePersonnummer(fromBank);
    if (valid.ok) {
      setPn(valid.digits);
      setPnFromBank(true);
      setRevealPn(false);
    }
    setStep("person");
  };

  const seededArea = useRef(false);
  useEffect(() => {
    if (seededArea.current) return;
    seededArea.current = true;
    if (useVelio.getState().setupDraft?.place) return;
    const state = useVelio.getState();
    const saved = state.addresses.find((item) => item.id === state.activeAddressId);
    if (!saved) return;
    setArea({ id: saved.id, label: saved.line, detail: saved.label, lat: saved.lat, lng: saved.lng });
  }, []);

  useEffect(() => {
    if (!area || (area.lat != null && area.lng != null)) return;
    const controller = new AbortController();
    void searchAddresses(area.label, controller.signal)
      .then((hits) => {
        const hit = hits.find((item) => item.lat != null) ?? hits[0];
        if (hit && !controller.signal.aborted) setArea(hit);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [area]);

  useEffect(() => {
    if (step === "welcome") return;
    saveSetupDraft({
      step,
      identityVia,
      seller,
      org,
      pn,
      company,
      trades,
      offers,
      place: area?.label ?? "",
      detail: area?.detail ?? "",
      lat: area?.lat ?? null,
      lng: area?.lng ?? null,
      km,
    });
  }, [step, identityVia, seller, org, pn, company, trades, offers, area, km, saveSetupDraft]);

  const resumeSetup = () => {
    const draft = setupDraft;
    if (!draft) return;
    if (typeof draft.step === "string") setStep(draft.step as Step);
    if (draft.identityVia === "bankid" || draft.identityVia === "document") setIdentityVia(draft.identityVia);
    if (draft.seller === "company" || draft.seller === "private") setSeller(draft.seller);
    if (typeof draft.org === "string") setOrg(draft.org);
    if (typeof draft.pn === "string") setPn(draft.pn);
    if (draft.company && typeof draft.company === "object") setCompany(draft.company as CompanyRecord);
    if (Array.isArray(draft.trades)) setTrades(draft.trades as ServiceId[]);
    if (Array.isArray(draft.offers)) setOffers(draft.offers as Offer[]);
    if (typeof draft.km === "number") setKm(draft.km);
    if (typeof draft.place === "string" && draft.place) {
      setArea({
        id: "draft",
        label: draft.place,
        detail: typeof draft.detail === "string" ? draft.detail : "",
        lat: typeof draft.lat === "number" ? draft.lat : undefined,
        lng: typeof draft.lng === "number" ? draft.lng : undefined,
      });
    }
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
    const active = offers.filter((offer) => offer.on);
    if (!active.length) return showToast("Välj minst ett pris");
    if (!area) return showToast("Välj en adress i listan");
    const names = trades.map((id) => services.find((item) => item.id === id)?.name).filter(Boolean);
    const who = profile.name || "Jag";
    const where = area.label;
    const listing: Listing = {
      serviceId: trades[0],
      serviceIds: trades,
      title: seller === "private" ? "Privatperson" : company?.name || who,
      desc:
        seller === "private"
          ? `${who} tar uppdrag som privatperson inom ${names.join(", ")} kring ${where}.`
          : `${company?.name ?? who} tar uppdrag inom ${names.join(", ")} kring ${where}.`,
      price: Math.min(...active.map((offer) => offer.price)),
      photos,
      offers: active.map(({ name, hours, price }) => ({ name, hours, price })),
      areas: [`${where} · ${km} km`],
      sellerKind: seller === "private" ? "private" : "company",
      demo: true,
      nationalId: seller === "private" ? pn : undefined,
      ...(seller === "private" || !company
        ? {}
        : { companyName: company.name, orgNumber: company.orgNumber, fTax: company.fTax }),
    };
    if (seller !== "private" && !company) return showToast("Slå upp företaget först");
    publishDemoBusiness(listing);
    saveSetupDraft(null);
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
              ["Företag eller privat", "Organisationsnummer, eller personnummer om du inte har bolag."],
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
          {setupDraft && setupDraft.step !== "welcome" ? (
            <button type="button" onClick={resumeSetup} className="mt-2 h-12 w-full rounded-full border border-line text-sm font-semibold">
              Fortsätt där du slutade
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === "doc") {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-cream">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
          <IdentityFlow
            onBack={() => setStep("identity")}
            onContinue={() => {
              setIdentityVia("document");
              setStep("org");
            }}
          />
        </div>
      </div>
    );
  }

  const title =
    step === "identity"
      ? "Hur vill du identifiera dig?"
      : step === "org"
        ? "Har du ett företag?"
        : step === "person"
          ? "Ditt personnummer"
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
        ? "Bolag slår upp organisationsnummer. Utan bolag använder du personnummer i stället."
        : step === "person"
          ? "Numret behövs för att veta vem som ska få betalt. Det sparas bara på ditt privata konto, som bara du kan läsa, och visas inte på den publika profilen."
        : step === "company"
          ? "Uppgifterna kommer från demoregistret. F-skatt är inte kontrollerad mot Skatteverket."
          : step === "trades"
            ? "Välj upp till tre. Förslagen på nästa steg följer det du väljer."
            : step === "price"
              ? "Förvalen är på. Ändra priset om ditt skiljer sig."
              : step === "area"
                ? "Kunder inom radien kan hitta dig. Kartan är OpenStreetMap."
                : step === "photo"
                  ? "Valfritt. Förhandsvisning i den här webbläsaren. Uppladdning kommer snart."
                  : step === "work"
                    ? "Valfritt. Högst fyra bilder som förhandsvisning. De laddas inte upp. Kommer snart."
                    : "Demo betyder att identiteten inte är verifierad. Du kan ändå publicera och se resultatet.";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-cream">
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <button type="button" onClick={back} className="text-sm font-semibold text-brown">
            Tillbaka
          </button>
          <span>
            Steg {Math.max(index, 0) + 1} av {flow.length}
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-brown" style={{ width: `${((Math.max(index, 0) + 1) / flow.length) * 100}%` }} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4">
        <h1 className="ios-title text-[1.85rem] leading-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        <div className="mt-6">
          {step === "identity" ? (
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard icon={ShieldCheck} title="BankID" subtitle="Rekommenderas" selected={identityVia === "bankid"} onClick={() => setIdentityVia("bankid")} />
              <ChoiceCard icon={IdCard} title="ID-handling" subtitle="Pass eller kort" selected={identityVia === "document"} onClick={() => setIdentityVia("document")} />
            </div>
          ) : null}

          {step === "org" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard icon={Building2} title="Företag" subtitle="Organisationsnummer" selected={seller === "company"} onClick={() => setSeller("company")} />
                <ChoiceCard icon={UserRound} title="Privatperson" subtitle="Inget företag" selected={seller === "private"} onClick={() => setSeller("private")} />
              </div>
              {seller === "company" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-muted">Organisationsnummer</span>
                  <input
                    value={formatOrg(orgDigits(org))}
                    inputMode="numeric"
                    placeholder="556677-8899"
                    onChange={(event) => setOrg(orgDigits(event.target.value))}
                    className="h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg text-ink outline-none"
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {step === "person" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Personnummer</span>
                <input
                  value={revealPn || pn.length < 12 ? formatPerson(pn, false) : formatPerson(pn, true)}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Personnummer"
                  placeholder="ÅÅÅÅMMDD-XXXX"
                  onFocus={() => setRevealPn(true)}
                  onBlur={() => {
                    if (pn.length === 12) setRevealPn(false);
                  }}
                  onChange={(event) => {
                    if (!revealPn && pn.length === 12) return;
                    setPn(personDigits(event.target.value));
                    setPnFromBank(false);
                  }}
                  className="h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg tracking-wide outline-none"
                />
              </label>
              {pn.length === 12 ? (
                <button type="button" onClick={() => setRevealPn((value) => !value)} className="text-sm font-semibold text-brown">
                  {revealPn ? "Dölj siffror" : "Visa siffror"}
                </button>
              ) : null}
              <p className="rounded-2xl bg-sand px-3 py-3 text-sm leading-relaxed">
                {pnFromBank
                  ? "Ifyllt från BankID. Kontrollera att det stämmer. De fyra sista siffrorna är dolda tills du väljer att visa dem."
                  : identityVia === "bankid"
                    ? "När BankID svarar fylls personnumret i här. Det är inte kopplat, så du skriver det själv. De fyra sista siffrorna döljs när fältet är klart."
                    : "De fyra sista siffrorna döljs när fältet är klart. Numret sparas bara på ditt privata konto."}
              </p>
            </div>
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
            <div className="relative z-10 space-y-3">
              <RadiusMap km={km} lat={area?.lat ?? 59.3293} lng={area?.lng ?? 18.0686} />
              <AddressSearch picked={area} onPick={setArea} onClear={() => setArea(null)} />
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
                        void readPhoto(file).then((src) => {
                          setPhotos((current) => [...current, src].slice(0, 4));
                          showToast("Förhandsvisning här. Uppladdning kommer snart.");
                        });
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "preview" && (seller === "private" || company) ? (
            <div className="overflow-hidden rounded-[1.4rem] border border-line bg-paper">
              <div className="bg-sand px-4 py-3">
                <span className="rounded-full bg-brown px-2.5 py-1 text-xs font-semibold text-paper">Demo</span>
                <p className="mt-2 text-xs text-muted">Inte verifierad med BankID</p>
              </div>
              <div className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <ProfilePhoto />
                  <div>
                    <p className="font-serif text-2xl leading-none">{profile.name || company?.name}</p>
                    <p className="mt-1 text-sm text-muted">{seller === "private" ? "Privatperson" : company?.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm">fr. {Math.min(...offers.filter((offer) => offer.on).map((offer) => offer.price))} kr</p>
                <p className="mt-1 text-sm text-muted">
                  {trades.map((id) => services.find((item) => item.id === id)?.name).filter(Boolean).join(" · ")} · {area?.label ?? "Ingen adress"} · {km} km
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {offers.filter((offer) => offer.on).map((offer) => (
                    <li key={offer.name} className="flex justify-between">
                      <span>{offer.name}</span>
                      <span>fr. {offer.price} kr</span>
                    </li>
                  ))}
                </ul>
                {seller === "private" ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    Privatperson. Kunden kan behöva hantera skatt och RUT på ett annat sätt än mot ett företag. Texten är en platshållare, inte juridisk vägledning.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-muted">Org.nr {company?.orgNumber}</p>
                    <p className="text-sm text-muted">F-skatt: {company?.fTax === "yes" ? "Ja, enligt dig" : company?.fTax === "no" ? "Nej" : "Osäker"}</p>
                  </>
                )}
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
        {(step === "identity" && !identityVia) || (step === "org" && !seller) ? null : (
          <button
            type="button"
            disabled={lookupBusy}
            onClick={() => {
              if (step === "identity") {
                if (identityVia === "document") setStep("doc");
                else setStep("org");
                return;
              }
              if (step === "org") {
                if (seller === "private") openPrivate();
                else void loadCompany();
                return;
              }
              else if (step === "person") {
                const check = validatePersonnummer(pn);
                if (!check.ok) return showToast(check.message);
                setRevealPn(false);
                setStep("trades");
              } else if (step === "company") setStep("trades");
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
            {lookupBusy ? "Slår upp…" : step === "org" && seller === "company" ? "Hämta företag" : step === "work" && photos.length === 0 ? "Hoppa över" : step === "preview" ? "Publicera som Demo" : "Nästa"}
          </button>
        )}
      </div>
    </div>
  );
}
