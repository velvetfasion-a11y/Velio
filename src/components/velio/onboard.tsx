import { useEffect, useRef, useState } from "react";
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Info,
  Landmark,
  Layers,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Shield,
  Star,
  Type,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { kr, services, type ServiceId } from "@/lib/velio/data";
import { useVelio, type BusinessForm } from "@/lib/velio/store";
import { AppHeader } from "@/components/velio/header";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/velio/asset";

const photoPool = [asset("/velio/stad.jpg"), asset("/velio/rep.jpg"), asset("/velio/ren.jpg"), asset("/velio/trad.jpg"), asset("/velio/garden.jpg"), asset("/velio/clean.jpg")];
const levels = ["Välj erfarenhetsnivå", "Nybörjare", "1–3 år", "3–5 år", "5–10 år", "10+ år"];
const hours = Array.from({ length: 16 }, (_, index) => `${String(index + 6).padStart(2, "0")}:00`);
const dayNames = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const blurbs = [
  "Fyll i dina uppgifter så att kunder kan hitta, boka och anlita dig.",
  "Fyll i vilka tjänster du erbjuder, vad som ingår och dina villkor.",
  "Välj var du arbetar, din räckvidd och när du är tillgänglig.",
  "Sätt dina priser, hantera betalning och välj hur du får dina utbetalningar.",
];

type Offer = { id: string; name: string; hours: string; price: number; on: boolean };

const packs: Record<ServiceId, { offers: Offer[]; includes: string[]; extras: { name: string; price: number }[] }> = {
  el: {
    offers: [
      { id: "felsok", name: "Felsökning", hours: "1 – 2 timmar", price: 890, on: true },
      { id: "uttag", name: "Installation av uttag", hours: "1 – 3 timmar", price: 1290, on: true },
      { id: "belysning", name: "Belysning & armaturer", hours: "2 – 4 timmar", price: 1490, on: true },
    ],
    includes: ["Auktoriserad elektriker", "Material enligt offert", "ROT-avdrag (vid behov)", "Säkerhetskontroll efter jobbet"],
    extras: [
      { name: "Jordfelsbrytare", price: 890 },
      { name: "Dimmer", price: 450 },
      { name: "Akut utryckning", price: 600 },
    ],
  },
  stad: {
    offers: [
      { id: "hem", name: "Hemstädning", hours: "2 – 4 timmar", price: 640, on: true },
      { id: "flytt", name: "Flyttstädning", hours: "4 – 8 timmar", price: 1490, on: true },
      { id: "stor", name: "Storstädning", hours: "3 – 6 timmar", price: 990, on: true },
    ],
    includes: ["Städmaterial och utrustning", "Noggrann och pålitlig service", "RUT-avdrag (vid behov)", "Flexibla tider"],
    extras: [
      { name: "Fönsterputs", price: 300 },
      { name: "Kylskåpsrengöring", price: 250 },
      { name: "Ugnsrengöring", price: 250 },
    ],
  },
  trad: {
    offers: [
      { id: "gras", name: "Gräsklippning", hours: "1 – 2 timmar", price: 490, on: true },
      { id: "hack", name: "Häck & rabatt", hours: "2 – 4 timmar", price: 890, on: true },
      { id: "sasong", name: "Säsongsskötsel", hours: "Halvdag", price: 1490, on: true },
    ],
    includes: ["Egen utrustning", "Bortforsling av trädgårdsavfall", "RUT-avdrag (vid behov)", "Återkommande skötsel"],
    extras: [
      { name: "Häckklippning", price: 450 },
      { name: "Lövrensning", price: 350 },
      { name: "Plantering", price: 600 },
    ],
  },
  rep: {
    offers: [
      { id: "montera", name: "Montering", hours: "1 – 2 timmar", price: 690, on: true },
      { id: "liten", name: "Mindre reparation", hours: "1 – 3 timmar", price: 890, on: true },
      { id: "akut", name: "Akut åtgärd", hours: "1 timme", price: 1190, on: true },
    ],
    includes: ["Verktyg ingår", "Genomgång av felet", "ROT-avdrag (vid behov)", "Uppföljning vid behov"],
    extras: [
      { name: "Reservdelar", price: 400 },
      { name: "Extra hantverkare", price: 650 },
      { name: "Kvällsbesök", price: 300 },
    ],
  },
  sak: {
    offers: [
      { id: "las", name: "Låsbyte", hours: "1 – 2 timmar", price: 1490, on: true },
      { id: "larm", name: "Larm & sensorer", hours: "2 – 4 timmar", price: 2490, on: true },
      { id: "kamera", name: "Kameror", hours: "Halvdag", price: 3290, on: true },
    ],
    includes: ["Licensierad tekniker", "Genomgång av systemet", "Material enligt offert", "Support efter installation"],
    extras: [
      { name: "Extra sensor", price: 490 },
      { name: "Kodlås", price: 890 },
      { name: "Serviceavtal", price: 199 },
    ],
  },
  ren: {
    offers: [
      { id: "malning", name: "Målning", hours: "1 rum", price: 1890, on: true },
      { id: "spackel", name: "Spackling & tapet", hours: "1 – 2 dagar", price: 2490, on: true },
      { id: "mindre", name: "Mindre renovering", hours: "Efter offert", price: 890, on: true },
    ],
    includes: ["Skydd av golv och möbler", "Material enligt offert", "ROT-avdrag (vid behov)", "Städning efter jobbet"],
    extras: [
      { name: "Extra rum", price: 1400 },
      { name: "Takmålning", price: 900 },
      { name: "Färgprover", price: 250 },
    ],
  },
  per: {
    offers: [
      { id: "dag", name: "Dagsbemanning", hours: "8 timmar", price: 3200, on: true },
      { id: "kvall", name: "Kvällspass", hours: "4 timmar", price: 1800, on: true },
      { id: "event", name: "Eventpersonal", hours: "Enligt schema", price: 450, on: true },
    ],
    includes: ["Kontrollerad personal", "Försäkring ingår", "Ersättare vid sjukdom", "Kort varsel när det går"],
    extras: [
      { name: "Extra person", price: 450 },
      { name: "Helgdag", price: 300 },
      { name: "Uniform", price: 150 },
    ],
  },
  eko: {
    offers: [
      { id: "bok", name: "Löpande bokföring", hours: "Per månad", price: 1490, on: true },
      { id: "dekl", name: "Deklaration", hours: "Engång", price: 2490, on: true },
      { id: "rad", name: "Ekonomirådgivning", hours: "1 timme", price: 990, on: true },
    ],
    includes: ["Auktoriserad redovisning", "Digital inlämning", "Månadsavstämning", "Säker hantering av underlag"],
    extras: [
      { name: "Momsredovisning", price: 490 },
      { name: "Löner", price: 790 },
      { name: "Extra möte", price: 690 },
    ],
  },
  ank: {
    offers: [
      { id: "forbered", name: "Förbered hemmet", hours: "2 – 3 timmar", price: 890, on: true },
      { id: "inkop", name: "Inköp & påfyllning", hours: "1 – 2 timmar", price: 490, on: true },
      { id: "valkomst", name: "Välkomststäd", hours: "2 timmar", price: 790, on: true },
    ],
    includes: ["Incheckning av hemmet", "Påfyllning av basvaror", "Rapport med bilder", "Flexibel ankomsttid"],
    extras: [
      { name: "Blommor", price: 250 },
      { name: "Matkasse", price: 400 },
      { name: "Extra sängkläder", price: 150 },
    ],
  },
  til: {
    offers: [
      { id: "vecka", name: "Veckotillsyn", hours: "30 – 45 min", price: 390, on: true },
      { id: "resa", name: "Tillsyn under resa", hours: "Per besök", price: 450, on: true },
      { id: "vaxter", name: "Växter & post", hours: "20 – 30 min", price: 290, on: true },
    ],
    includes: ["Rond med checklista", "Bilder efter besöket", "Larm och lås kontrolleras", "Avvikelse rapporteras direkt"],
    extras: [
      { name: "Extra besök", price: 250 },
      { name: "Vattning", price: 100 },
      { name: "Posthämtning", price: 80 },
    ],
  },
};

export function OnboardSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const finishOnboard = useVelio((state) => state.finishOnboard);
  const saveBusinessForm = useVelio((state) => state.saveBusinessForm);
  const showToast = useVelio((state) => state.showToast);
  const saved = useRef(useVelio.getState().businessForm).current;
  const listing = useRef(useVelio.getState().listing).current;
  const bankIdName = useRef(useVelio.getState().profile.name).current || "Anna Karlsson";
  const savedTitle = saved?.title || bankIdName;
  const savedDesc = saved?.desc || listing?.desc.split("\n").slice(1).join("\n") || "";
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<ServiceId | "">(saved?.serviceId || listing?.serviceId || "");
  const [title, setTitle] = useState(savedTitle);
  const [desc, setDesc] = useState(savedDesc);
  const [level, setLevel] = useState(saved?.level || levels[0]);
  const [certs, setCerts] = useState<string[]>(saved?.certs ?? []);
  const [certDraft, setCertDraft] = useState("");
  const [certOpen, setCertOpen] = useState(false);
  const [photos, setPhotos] = useState(saved?.photos ?? photoPool.slice(0, 3));
  const [offers, setOffers] = useState<Offer[]>(saved?.offers ?? []);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftOffer, setDraftOffer] = useState({ name: "", hours: "", price: "" });
  const [includes, setIncludes] = useState<{ text: string; on: boolean }[]>(saved?.includes ?? []);
  const [extras, setExtras] = useState<{ name: string; price: number }[]>(saved?.extras ?? []);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [areaMode, setAreaMode] = useState<"radius" | "areas" | "city">(saved?.areaMode ?? "radius");
  const [km, setKm] = useState(saved?.km ?? 20);
  const [days, setDays] = useState(saved?.days ?? [0, 1, 2, 3, 4]);
  const [from, setFrom] = useState(saved?.from ?? "08:00");
  const [to, setTo] = useState(saved?.to ?? "17:00");
  const [offs, setOffs] = useState<string[]>(saved?.offs ?? []);
  const [offOpen, setOffOpen] = useState(false);
  const [offDate, setOffDate] = useState("");
  const [notice, setNotice] = useState(saved?.notice ?? "Snarast");
  const [payout, setPayout] = useState(saved?.payout ?? true);
  const [terms, setTerms] = useState(saved?.terms ?? true);
  const keepOffers = useRef(Boolean(saved?.offers.length));

  useEffect(() => {
    if (!serviceId) return;
    if (keepOffers.current) {
      keepOffers.current = false;
      return;
    }
    const pack = packs[serviceId];
    setOffers(pack.offers.map((offer) => ({ ...offer })));
    setIncludes(pack.includes.map((text) => ({ text, on: true })));
    setExtras(pack.extras.map((extra) => ({ ...extra })));
  }, [serviceId]);

  useEffect(() => {
    const form: BusinessForm = {
      serviceId,
      title,
      desc,
      level,
      certs,
      photos,
      offers,
      includes,
      extras,
      areaMode,
      km,
      days,
      from,
      to,
      offs,
      notice,
      payout,
      terms,
    };
    saveBusinessForm(form);
  }, [serviceId, title, desc, level, certs, photos, offers, includes, extras, areaMode, km, days, from, to, offs, notice, payout, terms, saveBusinessForm]);

  const next = () => {
    if (step === 1) {
      if (!serviceId) return showToast("Välj en yrkesroll");
      if (title.trim().length < 3) return showToast("Skriv en titel");
      if (desc.trim().length < 12) return showToast("Beskriv dig lite mer");
    }
    if (step === 2 && !offers.some((offer) => offer.on)) return showToast("Välj minst en tjänst");
    if (step === 3 && days.length === 0) return showToast("Välj minst en arbetsdag");
    setStep(step + 1);
  };

  const publish = () => {
    if (!serviceId) return;
    const amount = offers.find((offer) => offer.on)?.price || 0;
    if (!terms) return showToast("Godkänn villkoren för att publicera");
    if (amount <= 0) return showToast("Ange ett pris");
    finishOnboard({ serviceId, desc: `${title.trim()}\n${desc.trim()}`, price: amount });
  };

  return (
    <div className="sheet-in absolute inset-0 z-40 flex flex-col bg-[#f6f1ea]">
      <AppHeader />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" aria-label="Tillbaka" onClick={() => (step === 1 ? closeSheet() : setStep(step - 1))}>
            <ChevronRight className="size-5 rotate-180" />
          </button>
          <h2 className="text-xl font-semibold">Velio Business</h2>
        </div>
        <div className="relative overflow-hidden rounded-[1.2rem]">
          <img src={asset("/velio/business.jpg")} alt="" className="h-36 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#4a3424]/80 via-[#4a3424]/35 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-4 text-white">
            <h3 className="font-serif text-[1.7rem] leading-none">Uppdatera ditt jobb</h3>
            <p className="mt-2 max-w-[16rem] text-sm leading-snug">{blurbs[step - 1]}</p>
          </div>
        </div>
        <Stepper step={step} />
        <div className="mt-4 rounded-[1.3rem] border border-[#efeae4] bg-white/80 p-4">
          {step === 1 ? (
            <StepInfo
              serviceId={serviceId}
              title={title}
              desc={desc}
              level={level}
              certs={certs}
              certOpen={certOpen}
              certDraft={certDraft}
              photos={photos}
              onService={setServiceId}
              onTitle={setTitle}
              onDesc={setDesc}
              onLevel={setLevel}
              onCertOpen={setCertOpen}
              onCertDraft={setCertDraft}
              onAddCert={() => {
                if (certDraft.trim().length < 2) return;
                setCerts([...certs, certDraft.trim()]);
                setCertDraft("");
                setCertOpen(false);
              }}
              onRemoveCert={(name) => setCerts(certs.filter((item) => item !== name))}
              onAddPhoto={() => {
                const nextPhoto = photoPool.find((item) => !photos.includes(item));
                if (!nextPhoto) return showToast("Du kan lägga till högst sex bilder");
                setPhotos([...photos, nextPhoto]);
              }}
              onRemovePhoto={(src) => setPhotos(photos.filter((item) => item !== src))}
            />
          ) : null}
          {step === 2 ? (
            <StepServices
              offers={offers}
              editing={editing}
              adding={adding}
              draft={draftOffer}
              includes={includes}
              extras={extras}
              extraOpen={extraOpen}
              extraName={extraName}
              extraPrice={extraPrice}
              onToggle={(id) => setOffers(offers.map((offer) => (offer.id === id ? { ...offer, on: !offer.on } : offer)))}
              onEdit={setEditing}
              onPrice={(id, price) => setOffers(offers.map((offer) => (offer.id === id ? { ...offer, price } : offer)))}
              onRemove={(id) => setOffers(offers.filter((offer) => offer.id !== id))}
              onAdding={setAdding}
              onDraft={setDraftOffer}
              onCreate={() => {
                const price = Number(draftOffer.price);
                if (draftOffer.name.trim().length < 2 || !Number.isFinite(price) || price <= 0) return showToast("Fyll i namn och pris");
                setOffers([...offers, { id: crypto.randomUUID(), name: draftOffer.name.trim(), hours: draftOffer.hours.trim() || "Efter överenskommelse", price, on: true }]);
                setDraftOffer({ name: "", hours: "", price: "" });
                setAdding(false);
              }}
              onInclude={(text) => setIncludes(includes.map((item) => (item.text === text ? { ...item, on: !item.on } : item)))}
              onExtraOpen={setExtraOpen}
              onExtraName={setExtraName}
              onExtraPrice={setExtraPrice}
              onAddExtra={() => {
                const price = Number(extraPrice);
                if (extraName.trim().length < 2 || !Number.isFinite(price)) return showToast("Fyll i tillval och pris");
                setExtras([...extras, { name: extraName.trim(), price }]);
                setExtraName("");
                setExtraPrice("");
                setExtraOpen(false);
              }}
              onRemoveExtra={(name) => setExtras(extras.filter((item) => item.name !== name))}
            />
          ) : null}
          {step === 3 ? (
            <StepArea
              areaMode={areaMode}
              km={km}
              days={days}
              from={from}
              to={to}
              offs={offs}
              offOpen={offOpen}
              offDate={offDate}
              notice={notice}
              onMode={setAreaMode}
              onKm={setKm}
              onDay={(index) => setDays(days.includes(index) ? days.filter((day) => day !== index) : [...days, index])}
              onFrom={setFrom}
              onTo={setTo}
              onOffOpen={setOffOpen}
              onOffDate={setOffDate}
              onAddOff={() => {
                if (!offDate) return;
                setOffs([...offs, offDate]);
                setOffDate("");
                setOffOpen(false);
              }}
              onNotice={setNotice}
            />
          ) : null}
          {step === 4 ? (
            <StepPay
              payout={payout}
              terms={terms}
              onPayout={setPayout}
              onTerms={setTerms}
              onBank={() => showToast("Bankkontot är en demo")}
            />
          ) : null}
        </div>
      </div>
      <div className="flex gap-2 px-4 pt-2 pb-4">
        {step > 1 ? (
          <button type="button" onClick={() => setStep(step - 1)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[#e6dfd6] bg-white font-semibold">
            <ChevronRight className="size-4 rotate-180" /> Tillbaka
          </button>
        ) : null}
        {step < 4 ? (
          <button type="button" onClick={next} className="h-12 flex-[1.4] rounded-full bg-[#8a6a3d] font-semibold text-white">
            {step === 1 ? "Nästa: Tjänster" : step === 2 ? "Nästa: Område & tid" : "Nästa: Pris & betalning"} →
          </button>
        ) : (
          <button type="button" onClick={publish} className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-[#8a6a3d] font-semibold text-white">
            Publicera jobb <Check className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const items = [
    { icon: Briefcase, label: "1. Jobb & info" },
    { icon: Layers, label: "2. Tjänster" },
    { icon: MapPin, label: "3. Område & tid" },
    { icon: Wallet, label: "4. Pris & betalning" },
  ];
  return (
    <div className="relative mt-4 grid grid-cols-4">
      <div className="absolute top-[1.05rem] right-[12%] left-[12%] h-px bg-[#e4ddd4]" />
      <div className="absolute top-[1.05rem] left-[12%] h-px bg-[#8a6a3d]" style={{ width: `${((step - 1) / 3) * 76}%` }} />
      {items.map((item, index) => {
        const Icon = item.icon;
        const current = index + 1 === step;
        const done = index + 1 < step;
        return (
          <div key={item.label} className="relative z-10 text-center">
            <span className={cn("mx-auto grid size-9 place-items-center rounded-full border bg-[#f6f1ea]", current ? "border-[#8a6a3d] bg-[#8a6a3d] text-white" : "border-[#cfc6ba] text-[#8a6a3d]")}>
              {done ? <Check className="size-4" /> : <Icon className="size-4" />}
            </span>
            <span className={cn("mt-1 block text-[10px] leading-tight", current && "font-semibold")}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Label({ icon: Icon, children }: { icon: typeof Briefcase; children: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 font-semibold">
      <Icon className="size-4 text-[#8a6a3d]" />
      {children}
    </div>
  );
}

function StepInfo(props: {
  serviceId: ServiceId | "";
  title: string;
  desc: string;
  level: string;
  certs: string[];
  certOpen: boolean;
  certDraft: string;
  photos: string[];
  onService: (id: ServiceId) => void;
  onTitle: (value: string) => void;
  onDesc: (value: string) => void;
  onLevel: (value: string) => void;
  onCertOpen: (open: boolean) => void;
  onCertDraft: (value: string) => void;
  onAddCert: () => void;
  onRemoveCert: (name: string) => void;
  onAddPhoto: () => void;
  onRemovePhoto: (src: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label icon={Briefcase}>Din yrkesroll *</Label>
        <div className="relative">
          <select value={props.serviceId} onChange={(event) => props.onService(event.target.value as ServiceId)} className="w-full appearance-none rounded-2xl border border-[#e6dfd6] bg-white px-4 py-3 text-sm outline-none">
            <option value="">Välj yrke eller kategori</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-3.5 right-3 size-4 text-muted" />
        </div>
      </div>
      <div>
        <Label icon={Type}>Titel på din profil *</Label>
        <input value={props.title} onChange={(event) => props.onTitle(event.target.value)} placeholder="T.ex. Certifierad städfirma i Stockholm" className="w-full rounded-2xl border border-[#e6dfd6] bg-white px-4 py-3 text-sm outline-none" />
      </div>
      <div>
        <Label icon={MessageSquare}>Beskrivning *</Label>
        <textarea value={props.desc} maxLength={500} onChange={(event) => props.onDesc(event.target.value)} placeholder="Berätta kort om dig/dit företag, din erfarenhet, certifieringar och vad du erbjuder." className="h-24 w-full rounded-2xl border border-[#e6dfd6] bg-white px-4 py-3 text-sm outline-none" />
        <p className="text-right text-xs text-muted">{props.desc.length}/500</p>
      </div>
      <div>
        <Label icon={ImageIcon}>Bilder</Label>
        <p className="mb-2 text-sm text-muted">Lägg till bilder på ditt arbete, team eller utrustning.</p>
        <div className="flex gap-2 overflow-x-auto">
          <button type="button" onClick={props.onAddPhoto} className="grid size-20 shrink-0 place-items-center rounded-2xl border border-[#e6dfd6] bg-[#f6f1ea] text-xs text-muted">
            <Plus className="size-5" />
            Lägg till bild
          </button>
          {props.photos.map((src) => (
            <span key={src} className="relative size-20 shrink-0">
              <img src={src} alt="" className="size-20 rounded-2xl object-cover" />
              <button type="button" aria-label="Ta bort bild" onClick={() => props.onRemovePhoto(src)} className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-white shadow">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
      <div>
        <Label icon={Award}>Erfarenhet</Label>
        <div className="relative">
          <select value={props.level} onChange={(event) => props.onLevel(event.target.value)} className="w-full appearance-none rounded-2xl border border-[#e6dfd6] bg-white px-4 py-3 text-sm outline-none">
            {levels.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-3.5 right-3 size-4 text-muted" />
        </div>
      </div>
      <div>
        <Label icon={Shield}>Certifieringar & behörigheter</Label>
        <div className="flex flex-wrap gap-2">
          {props.certs.map((cert) => (
            <button key={cert} type="button" onClick={() => props.onRemoveCert(cert)} className="rounded-full bg-[#f3ece3] px-3 py-1 text-sm">
              {cert} ×
            </button>
          ))}
        </div>
        {props.certOpen ? (
          <div className="mt-2 flex gap-2">
            <input value={props.certDraft} onChange={(event) => props.onCertDraft(event.target.value)} placeholder="T.ex. Yrkesbevis" className="min-w-0 flex-1 rounded-full border border-[#e6dfd6] px-4 py-2 text-sm outline-none" />
            <button type="button" onClick={props.onAddCert} className="rounded-full bg-[#2a211c] px-4 text-sm text-white">Lägg till</button>
          </div>
        ) : (
          <button type="button" onClick={() => props.onCertOpen(true)} className="mt-2 rounded-full border border-[#e6dfd6] px-4 py-2 text-sm">
            + Lägg till (t.ex. Yrkesbevis, ID06, F-skatt)
          </button>
        )}
      </div>
    </div>
  );
}

function StepServices(props: {
  offers: Offer[];
  editing: string | null;
  adding: boolean;
  draft: { name: string; hours: string; price: string };
  includes: { text: string; on: boolean }[];
  extras: { name: string; price: number }[];
  extraOpen: boolean;
  extraName: string;
  extraPrice: string;
  onToggle: (id: string) => void;
  onEdit: (id: string | null) => void;
  onPrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  onAdding: (open: boolean) => void;
  onDraft: (draft: { name: string; hours: string; price: string }) => void;
  onCreate: () => void;
  onInclude: (text: string) => void;
  onExtraOpen: (open: boolean) => void;
  onExtraName: (value: string) => void;
  onExtraPrice: (value: string) => void;
  onAddExtra: () => void;
  onRemoveExtra: (name: string) => void;
}) {
  const included = props.includes.filter((item) => item.on).map((item) => item.text).join(" ").length;
  return (
    <div className="space-y-4">
      <div>
        <Label icon={Layers}>Dina tjänster *</Label>
        <p className="mb-2 text-sm text-muted">Lägg till de tjänster du erbjuder.</p>
        <div className="space-y-2">
          {props.offers.map((offer) => (
            <div key={offer.id} className="flex items-center gap-2 rounded-2xl border border-[#efeae4] bg-[#fbf8f4] px-3 py-2">
              <button type="button" aria-label={offer.on ? "Avmarkera" : "Markera"} onClick={() => props.onToggle(offer.id)} className={cn("grid size-6 place-items-center rounded-md", offer.on ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6]")}>
                {offer.on ? <Check className="size-3.5" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{offer.name}</p>
                <p className="text-xs text-muted">{offer.hours}</p>
              </div>
              {props.editing === offer.id ? (
                <input
                  autoFocus
                  inputMode="numeric"
                  defaultValue={offer.price}
                  onBlur={(event) => {
                    const price = Number(event.target.value);
                    if (price > 0) props.onPrice(offer.id, price);
                    props.onEdit(null);
                  }}
                  className="w-20 rounded-full border px-2 py-1 text-sm"
                />
              ) : (
                <span className="flex items-center gap-1 rounded-full border border-[#e6dfd6] bg-white px-3 py-1 text-sm">
                  fr. {kr(offer.price)}
                  <button type="button" aria-label="Ändra pris" onClick={() => props.onEdit(offer.id)}><Pencil className="size-3.5" /></button>
                </span>
              )}
              <button type="button" aria-label="Ta bort tjänst" onClick={() => props.onRemove(offer.id)} className="text-muted">···</button>
            </div>
          ))}
        </div>
        {props.adding ? (
          <div className="mt-2 space-y-2">
            <input value={props.draft.name} onChange={(event) => props.onDraft({ ...props.draft, name: event.target.value })} placeholder="Tjänstens namn" className="w-full rounded-2xl border border-[#e6dfd6] px-3 py-2 text-sm outline-none" />
            <input value={props.draft.hours} onChange={(event) => props.onDraft({ ...props.draft, hours: event.target.value })} placeholder="T.ex. 2 – 4 timmar" className="w-full rounded-2xl border border-[#e6dfd6] px-3 py-2 text-sm outline-none" />
            <input value={props.draft.price} inputMode="numeric" onChange={(event) => props.onDraft({ ...props.draft, price: event.target.value })} placeholder="Pris i kr" className="w-full rounded-2xl border border-[#e6dfd6] px-3 py-2 text-sm outline-none" />
            <button type="button" onClick={props.onCreate} className="rounded-full bg-[#2a211c] px-4 py-2 text-sm text-white">Spara tjänst</button>
          </div>
        ) : (
          <button type="button" onClick={() => props.onAdding(true)} className="mt-3 w-full rounded-full border border-[#e6dfd6] py-3 text-sm font-semibold">+ Lägg till tjänst</button>
        )}
      </div>
      <div>
        <Label icon={MessageSquare}>Vad ingår?</Label>
        <p className="mb-2 text-sm text-muted">Beskriv kort vad som ingår i dina tjänster.</p>
        <div className="rounded-2xl border border-[#e6dfd6] px-3 py-2 text-sm">
          {props.includes.map((item) => (
            <button key={item.text} type="button" onClick={() => props.onInclude(item.text)} className="flex w-full items-center gap-2 py-1 text-left">
              <span className={item.on ? "text-[#8a6a3d]" : "text-muted"}>{item.on ? "✓" : "○"}</span>
              {item.text}
            </button>
          ))}
        </div>
        <p className="text-right text-xs text-muted">{included}/300</p>
      </div>
      <div>
        <Label icon={Star}>Extra tillval (valfritt)</Label>
        <p className="mb-2 text-sm text-muted">Erbjud tilläggstjänster som kunden kan boka.</p>
        <div className="flex flex-wrap gap-2">
          {props.extras.map((extra) => (
            <button key={extra.name} type="button" onClick={() => props.onRemoveExtra(extra.name)} className="rounded-full border border-[#e6dfd6] bg-white px-3 py-1.5 text-sm">
              {extra.name} + {kr(extra.price)} ×
            </button>
          ))}
          {props.extraOpen ? (
            <div className="flex w-full gap-2">
              <input value={props.extraName} onChange={(event) => props.onExtraName(event.target.value)} placeholder="Tillval" className="min-w-0 flex-1 rounded-full border px-3 py-2 text-sm outline-none" />
              <input value={props.extraPrice} inputMode="numeric" onChange={(event) => props.onExtraPrice(event.target.value)} placeholder="kr" className="w-20 rounded-full border px-3 py-2 text-sm outline-none" />
              <button type="button" onClick={props.onAddExtra} className="rounded-full bg-[#2a211c] px-3 text-sm text-white">OK</button>
            </div>
          ) : (
            <button type="button" onClick={() => props.onExtraOpen(true)} className="rounded-full border border-[#e6dfd6] px-3 py-1.5 text-sm">+ Lägg till tillval</button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepArea(props: {
  areaMode: "radius" | "areas" | "city";
  km: number;
  days: number[];
  from: string;
  to: string;
  offs: string[];
  offOpen: boolean;
  offDate: string;
  notice: string;
  onMode: (mode: "radius" | "areas" | "city") => void;
  onKm: (km: number) => void;
  onDay: (index: number) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onOffOpen: (open: boolean) => void;
  onOffDate: (value: string) => void;
  onAddOff: () => void;
  onNotice: (value: string) => void;
}) {
  const modes = [
    { id: "radius" as const, icon: MapPin, label: "Inom en radie" },
    { id: "areas" as const, icon: Layers, label: "Specifika områden" },
    { id: "city" as const, icon: Building2, label: "Hela staden" },
  ];
  return (
    <div className="space-y-5">
      <div>
        <Label icon={MapPin}>Arbetsområde *</Label>
        <p className="mb-2 text-sm text-muted">Välj var du erbjuder dina tjänster.</p>
        <div className="flex gap-2 overflow-x-auto">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const active = props.areaMode === mode.id;
            return (
              <button key={mode.id} type="button" onClick={() => props.onMode(mode.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm", active ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6] bg-white")}>
                <Icon className="size-4" /> {mode.label}
              </button>
            );
          })}
        </div>
        {props.areaMode === "radius" ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold">
              <span>Radie</span>
              <span className="rounded-full border border-[#e6dfd6] px-3 py-1 font-medium">{props.km} km</span>
            </div>
            <input type="range" min={1} max={50} value={props.km} onChange={(event) => props.onKm(Number(event.target.value))} className="w-full accent-[#8a6a3d]" />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{props.areaMode === "city" ? "Du syns i hela Stockholm." : "Välj stadsdelar när uppdraget kommer."}</p>
        )}
        <button type="button" className="mt-2 flex w-full items-center gap-2 rounded-full border border-[#e6dfd6] bg-white px-4 py-3 text-sm">
          <MapPin className="size-4" /> Centrum, Stockholm <ChevronRight className="ml-auto size-4 text-muted" />
        </button>
      </div>
      <div>
        <Label icon={Calendar}>Tillgänglighet *</Label>
        <p className="mb-2 text-sm text-muted">När kan kunder boka dig?</p>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm">Välj arbetsdagar</span>
          {dayNames.map((name, index) => (
            <button key={name} type="button" onClick={() => props.onDay(index)} className={cn("rounded-full px-2.5 py-1 text-xs", props.days.includes(index) ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6] bg-white")}>
              {name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="size-4" />
          <span className="mr-auto">Arbetstider</span>
          <Hour value={props.from} onChange={props.onFrom} />
          <span>–</span>
          <Hour value={props.to} onChange={props.onTo} />
        </div>
      </div>
      <div>
        <Label icon={Calendar}>Undantag</Label>
        <p className="mb-2 text-sm text-muted">Lägg till datum då du inte är tillgänglig (t.ex. semester).</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {props.offs.map((day) => (
            <span key={day} className="rounded-full bg-[#f3ece3] px-3 py-1 text-sm">{day}</span>
          ))}
        </div>
        {props.offOpen ? (
          <div className="flex gap-2">
            <input type="date" value={props.offDate} onChange={(event) => props.onOffDate(event.target.value)} className="flex-1 rounded-full border px-3 py-2 text-sm" />
            <button type="button" onClick={props.onAddOff} className="rounded-full bg-[#2a211c] px-4 text-sm text-white">Lägg till</button>
          </div>
        ) : (
          <button type="button" onClick={() => props.onOffOpen(true)} className="w-full rounded-full border border-[#e6dfd6] py-3 text-sm">+ Lägg till otillgängligt datum</button>
        )}
      </div>
      <div>
        <Label icon={Zap}>Bokningsregler</Label>
        <p className="mb-2 text-sm text-muted">Anpassa hur och när du kan bokas.</p>
        <Rule label="Bokningsfrist" value={props.notice} options={["Snarast", "Minst 2 timmar i förväg", "Minst 12 timmar i förväg", "Minst 24 timmar i förväg", "Minst 48 timmar i förväg"]} onChange={props.onNotice} />
      </div>
    </div>
  );
}

function Hour({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <span className="relative">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="appearance-none rounded-full border border-[#e6dfd6] bg-white py-1.5 pr-7 pl-3 text-sm">
        {hours.map((hour) => (
          <option key={hour}>{hour}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-2 right-2 size-3.5 text-muted" />
    </span>
  );
}

function Rule({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-full border border-[#e6dfd6] bg-white px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-[11rem] appearance-none bg-transparent pr-5 text-right">
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1 right-0 size-3.5 text-muted" />
      </span>
    </div>
  );
}

function StepPay(props: {
  payout: boolean;
  terms: boolean;
  onPayout: (on: boolean) => void;
  onTerms: (on: boolean) => void;
  onBank: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="flex gap-2 rounded-2xl bg-[#f6f1ea] px-3 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        Det slutliga priset bestäms i samråd med kunden innan arbetet bekräftas.
      </p>
      <div>
        <Label icon={Landmark}>Utbetalning</Label>
        <p className="mb-2 text-sm text-muted">Välj hur du vill få dina pengar från ditt Velio-konto.</p>
        <button type="button" onClick={() => props.onPayout(!props.payout)} className="flex w-full items-center gap-3 rounded-2xl border border-[#efeae4] bg-[#fbf8f4] px-3 py-3 text-left">
          <Wallet className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Automatisk utbetalning</span>
            <span className="block text-xs text-muted">Pengarna betalas ut till ditt bankkonto 3 timmar efter avslutat arbete.</span>
          </span>
          <span className={cn("relative h-6 w-11 shrink-0 rounded-full", props.payout ? "bg-[#8a6a3d]" : "bg-[#e6dfd6]")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white", props.payout ? "right-0.5" : "left-0.5")} />
          </span>
        </button>
        <button type="button" onClick={props.onBank} className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[#efeae4] bg-white px-3 py-3 text-left">
          <Landmark className="size-5" />
          <span className="flex-1">
            <span className="block font-semibold">Bankkonto för utbetalning</span>
            <span className="text-sm text-muted">•••• 4321</span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </button>
      </div>
      <div>
        <Label icon={Shield}>Avtal & villkor</Label>
        <button type="button" onClick={() => props.onTerms(!props.terms)} className="flex items-start gap-2 text-left text-sm">
          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md", props.terms ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6]")}>
            {props.terms ? <Check className="size-3.5" /> : null}
          </span>
          Jag godkänner Velios villkor för utförare och intygar att informationen är korrekt.
        </button>
      </div>
    </div>
  );
}
