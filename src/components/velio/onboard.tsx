import { useEffect, useRef, useState } from "react";
import {
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
import { areaLayout, kr, services, type ServiceId } from "@/lib/velio/data";
import { saveWeekTemplate } from "@/lib/velio/schedule";
import { useVelio, type BusinessForm } from "@/lib/velio/store";
import { AppHeader } from "@/components/velio/header";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/velio/asset";

const levels = ["Nybörjare", "1–3 år", "3–5 år", "5–10 år", "10+ år"];
const hours = Array.from({ length: 16 }, (_, index) => `${String(index + 6).padStart(2, "0")}:00`);
const dayNames = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const blurbs = [
  "Fyll i dina uppgifter så att kunder kan hitta, boka och anlita dig.",
  "Fyll i vilka tjänster du erbjuder, vad som ingår och dina villkor.",
  "Välj var du arbetar, din räckvidd och när du är tillgänglig.",
  "Sätt dina priser, hantera betalning och välj hur du får dina utbetalningar.",
];

type Offer = { id: string; name: string; hours: string; price: number; on: boolean };

export function OnboardSheet() {
  const closeSheet = useVelio((state) => state.closeSheet);
  const finishOnboard = useVelio((state) => state.finishOnboard);
  const saveBusinessForm = useVelio((state) => state.saveBusinessForm);
  const showToast = useVelio((state) => state.showToast);
  const saved = useRef(useVelio.getState().businessForm).current;
  const listing = useRef(useVelio.getState().listing).current;
  const savedTitle = saved?.title || listing?.title || "";
  const savedDesc = saved?.desc || (listing?.desc ?? "");
  const tradesOf = (source: { serviceIds?: ServiceId[]; serviceId?: ServiceId | "" } | null | undefined) => {
    if (!source) return null;
    if (source.serviceIds) return source.serviceIds;
    if (source.serviceId) return [source.serviceId];
    return null;
  };
  const initialServices = tradesOf(saved) ?? tradesOf(listing) ?? [];
  const [step, setStep] = useState(1);
  const [serviceIds, setServiceIds] = useState<ServiceId[]>(initialServices);
  const [otherOn, setOtherOn] = useState(Boolean(saved?.otherTrade || listing?.otherTrade));
  const [otherTrade, setOtherTrade] = useState(saved?.otherTrade || listing?.otherTrade || "");
  const [title, setTitle] = useState(savedTitle);
  const [desc, setDesc] = useState(savedDesc.startsWith("\n") ? savedDesc.trim() : savedDesc);
  const [level, setLevel] = useState(saved?.level || listing?.experience || "");
  const [certs, setCerts] = useState<string[]>(saved?.certs ?? []);
  const [certDraft, setCertDraft] = useState("");
  const [certOpen, setCertOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>((saved?.photos ?? listing?.photos ?? []).filter((src) => src.startsWith("data:")));
  const [offers, setOffers] = useState<Offer[]>(
    saved?.offers?.length
      ? saved.offers
      : (listing?.offers ?? []).map((offer) => ({ ...offer, id: crypto.randomUUID(), on: true })),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftOffer, setDraftOffer] = useState({ name: "", hours: "", price: "" });
  const [includes, setIncludes] = useState<string[]>(saved?.includes ?? listing?.includes ?? []);
  const [includeDraft, setIncludeDraft] = useState("");
  const [extras, setExtras] = useState<{ name: string; price: number }[]>(saved?.extras ?? listing?.extras ?? []);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [areaMode, setAreaMode] = useState<"radius" | "areas" | "city">(saved?.areaMode ?? (listing?.areas?.includes("Överallt") ? "city" : "areas"));
  const [areas, setAreas] = useState<string[]>(saved?.areas ?? listing?.areas ?? []);
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

  const toggleService = (id: ServiceId) => {
    setServiceIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        showToast("Du kan välja högst tre yrken");
        return current;
      }
      return [...current, id];
    });
  };

  const toggleArea = (name: string) => {
    const districts = Object.keys(areaLayout);
    if (name !== "Överallt" && !districts.includes(name)) {
      setAreas((current) => current.filter((item) => item !== name));
      return;
    }
    setAreas((current) => {
      if (name === "Överallt") {
        if (current.includes("Överallt")) return current.filter((item) => item !== "Överallt");
        return ["Överallt", ...current.filter((item) => !districts.includes(item))];
      }
      const withoutAll = current.filter((item) => item !== "Överallt");
      return withoutAll.includes(name) ? withoutAll.filter((item) => item !== name) : [...withoutAll, name];
    });
    setAreaMode(name === "Överallt" ? "city" : "areas");
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 6 - photos.length;
    if (room <= 0) return showToast("Du kan lägga till högst sex bilder");
    const next: string[] = [];
    for (const file of [...files].slice(0, room)) {
      next.push(await readWorkPhoto(file));
    }
    setPhotos([...photos, ...next]);
  };

  useEffect(() => {
    const form: BusinessForm = {
      serviceId: serviceIds[0] ?? "",
      serviceIds,
      otherTrade: otherOn ? otherTrade.trim() : "",
      title,
      desc,
      level,
      certs,
      photos,
      offers,
      includes,
      extras,
      areaMode,
      areas,
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
  }, [serviceIds, otherOn, otherTrade, title, desc, level, certs, photos, offers, includes, extras, areaMode, areas, km, days, from, to, offs, notice, payout, terms, saveBusinessForm]);

  const next = () => {
    if (step === 1) {
      if (!serviceIds.length && !(otherOn && otherTrade.trim().length > 1)) return showToast("Välj minst ett yrke");
      if (title.trim().length < 3) return showToast("Skriv en titel");
      if (!level) return showToast("Välj hur många års erfarenhet du har");
      if (desc.trim().length < 12) return showToast("Beskriv dig lite mer");
    }
    if (step === 2 && !offers.some((offer) => offer.on)) return showToast("Lägg till minst en tjänst");
    if (step === 3 && !areas.length) return showToast("Välj minst ett område");
    if (step === 3 && days.length === 0) return showToast("Välj minst en arbetsdag");
    setStep(step + 1);
  };

  const publish = () => {
    const active = offers.filter((offer) => offer.on);
    const amount = active[0]?.price || 0;
    if (!serviceIds.length && !(otherOn && otherTrade.trim())) return showToast("Välj minst ett yrke");
    if (!terms) return showToast("Godkänn villkoren för att publicera");
    if (amount <= 0) return showToast("Ange ett pris");
    const primary = serviceIds[0] ?? "rep";
    saveWeekTemplate(days, from, to);
    finishOnboard({
      serviceId: primary,
      serviceIds,
      otherTrade: otherOn ? otherTrade.trim() : "",
      title: title.trim(),
      desc: desc.trim(),
      price: amount,
      experience: level,
      photos,
      offers: active.slice(0, 10).map(({ name, hours, price }) => ({ name, hours, price })),
      includes,
      extras,
      areas,
    });
  };

  return (
    <div className="sheet-in absolute inset-0 z-40 flex flex-col bg-[#f6f1ea]">
      <AppHeader onBack={() => (step === 1 ? closeSheet() : setStep(step - 1))} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        <h2 className="mb-3 text-xl font-semibold">Velio Business</h2>
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
              serviceIds={serviceIds}
              otherOn={otherOn}
              otherTrade={otherTrade}
              title={title}
              desc={desc}
              level={level}
              certs={certs}
              certOpen={certOpen}
              certDraft={certDraft}
              photos={photos}
              onToggleService={toggleService}
              onToggleOther={() => setOtherOn((value) => !value)}
              onOtherTrade={setOtherTrade}
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
              onAddPhotos={(files) => void addPhotos(files)}
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
              includeDraft={includeDraft}
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
                if (offers.length >= 10) return showToast("Du kan lägga till högst tio tjänster");
                const price = Number(draftOffer.price);
                if (draftOffer.name.trim().length < 2 || !Number.isFinite(price) || price <= 0) return showToast("Fyll i namn och pris");
                setOffers([...offers, { id: crypto.randomUUID(), name: draftOffer.name.trim(), hours: draftOffer.hours.trim() || "Efter överenskommelse", price, on: true }]);
                setDraftOffer({ name: "", hours: "", price: "" });
                setAdding(false);
              }}
              onIncludeDraft={setIncludeDraft}
              onAddInclude={() => {
                const text = includeDraft.trim();
                if (text.length < 2) return showToast("Skriv vad som ingår");
                setIncludes([...includes, text]);
                setIncludeDraft("");
              }}
              onRemoveInclude={(text) => setIncludes(includes.filter((item) => item !== text))}
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
              areas={areas}
              km={km}
              days={days}
              from={from}
              to={to}
              offs={offs}
              offOpen={offOpen}
              offDate={offDate}
              notice={notice}
              onMode={setAreaMode}
              onToggleArea={toggleArea}
              onAddArea={(name) => {
                const trimmed = name.trim();
                if (trimmed.length < 2) return showToast("Skriv ett område");
                setAreas((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
              }}
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

function readWorkPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 720;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => reject(new Error("bild"));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function StepInfo(props: {
  serviceIds: ServiceId[];
  otherOn: boolean;
  otherTrade: string;
  title: string;
  desc: string;
  level: string;
  certs: string[];
  certOpen: boolean;
  certDraft: string;
  photos: string[];
  onToggleService: (id: ServiceId) => void;
  onToggleOther: () => void;
  onOtherTrade: (value: string) => void;
  onTitle: (value: string) => void;
  onDesc: (value: string) => void;
  onLevel: (value: string) => void;
  onCertOpen: (open: boolean) => void;
  onCertDraft: (value: string) => void;
  onAddCert: () => void;
  onRemoveCert: (name: string) => void;
  onAddPhotos: (files: FileList | null) => void;
  onRemovePhoto: (src: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <div>
        <Label icon={Briefcase}>Dina yrken *</Label>
        <p className="mb-2 text-sm text-muted">Välj upp till tre. Tryck en gång till för att ta bort.</p>
        <div className="flex flex-wrap gap-1.5">
          {services.map((service) => {
            const active = props.serviceIds.includes(service.id);
            return (
              <button
                key={service.id}
                type="button"
                aria-pressed={active}
                onClick={() => props.onToggleService(service.id)}
                className={cn("rounded-full px-3 py-1.5 text-sm", active ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6] bg-white")}
              >
                {service.name}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={props.otherOn}
            onClick={props.onToggleOther}
            className={cn("rounded-full px-3 py-1.5 text-sm", props.otherOn ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6] bg-white")}
          >
            Annat
          </button>
        </div>
        {props.otherOn ? (
          <input
            value={props.otherTrade}
            onChange={(event) => props.onOtherTrade(event.target.value)}
            placeholder="Beskriv vad annat betyder"
            className="mt-2 w-full rounded-2xl border border-[#e6dfd6] bg-white px-4 py-3 text-sm outline-none"
          />
        ) : null}
      </div>
      <div className="rounded-2xl border border-[#e6dfd6] bg-white p-3">
        <Label icon={Type}>Titel på din profil *</Label>
        <input value={props.title} onChange={(event) => props.onTitle(event.target.value)} placeholder="T.ex. Certifierad städfirma i Stockholm" className="w-full rounded-2xl border border-[#e6dfd6] bg-white px-4 py-3 text-sm outline-none" />
        <p className="mt-3 text-xs font-semibold tracking-wide text-[#8a6a3d]">ERFARENHET</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {levels.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={props.level === item}
              onClick={() => props.onLevel(item)}
              className={cn("rounded-full px-3 py-1 text-xs", props.level === item ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6]")}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label icon={MessageSquare}>Beskrivning *</Label>
        <textarea value={props.desc} maxLength={500} onChange={(event) => props.onDesc(event.target.value)} placeholder="Berätta kort om dig, ditt företag och vad du erbjuder." className="h-24 w-full rounded-2xl border border-[#e6dfd6] bg-white px-4 py-3 text-sm outline-none" />
        <p className="text-right text-xs text-muted">{props.desc.length}/500</p>
      </div>
      <div>
        <Label icon={ImageIcon}>Bilder</Label>
        <p className="mb-2 text-sm text-muted">Visa öppet arbete och jobb du utför.</p>
        <div className="flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => fileRef.current?.click()} className="grid size-20 shrink-0 place-items-center rounded-2xl border border-[#e6dfd6] bg-[#f6f1ea] text-xs text-muted">
            <Plus className="size-5" />
            Lägg till bild
          </button>
          {props.photos.map((src) => (
            <span key={src.slice(0, 48)} className="relative size-20 shrink-0">
              <img src={src} alt="" className="size-20 rounded-2xl object-cover" />
              <button type="button" aria-label="Ta bort bild" onClick={() => props.onRemovePhoto(src)} className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-white shadow">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => props.onAddPhotos(event.target.files)} />
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
  includes: string[];
  includeDraft: string;
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
  onIncludeDraft: (value: string) => void;
  onAddInclude: () => void;
  onRemoveInclude: (text: string) => void;
  onExtraOpen: (open: boolean) => void;
  onExtraName: (value: string) => void;
  onExtraPrice: (value: string) => void;
  onAddExtra: () => void;
  onRemoveExtra: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label icon={Layers}>Dina tjänster *</Label>
        <p className="mb-2 text-sm text-muted">Skriv de tjänster du erbjuder. Högst tio.</p>
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
        ) : props.offers.length >= 10 ? (
          <p className="mt-3 text-sm text-muted">Du har lagt till tio tjänster.</p>
        ) : (
          <button type="button" onClick={() => props.onAdding(true)} className="mt-3 w-full rounded-full border border-[#e6dfd6] py-3 text-sm font-semibold">+ Lägg till tjänst</button>
        )}
      </div>
      <div>
        <Label icon={MessageSquare}>Vad ingår?</Label>
        <p className="mb-2 text-sm text-muted">Skriv själv vad som ingår.</p>
        <div className="flex flex-wrap gap-2">
          {props.includes.map((text) => (
            <button key={text} type="button" onClick={() => props.onRemoveInclude(text)} className="rounded-full border border-[#e6dfd6] bg-white px-3 py-1.5 text-sm">
              {text} ×
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={props.includeDraft} onChange={(event) => props.onIncludeDraft(event.target.value)} placeholder="T.ex. material och städning efteråt" className="min-w-0 flex-1 rounded-full border border-[#e6dfd6] px-3 py-2 text-sm outline-none" />
          <button type="button" onClick={props.onAddInclude} className="rounded-full bg-[#2a211c] px-3 text-sm text-white">Lägg till</button>
        </div>
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
  areas: string[];
  km: number;
  days: number[];
  from: string;
  to: string;
  offs: string[];
  offOpen: boolean;
  offDate: string;
  notice: string;
  onMode: (mode: "radius" | "areas" | "city") => void;
  onToggleArea: (name: string) => void;
  onAddArea: (name: string) => void;
  onKm: (km: number) => void;
  onDay: (index: number) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onOffOpen: (open: boolean) => void;
  onOffDate: (value: string) => void;
  onAddOff: () => void;
  onNotice: (value: string) => void;
}) {
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraName, setExtraName] = useState("");
  const presets = ["Överallt", ...Object.keys(areaLayout)];
  const custom = props.areas.filter((area) => !presets.includes(area));
  const modes = [
    { id: "radius" as const, icon: MapPin, label: "Inom en radie" },
    { id: "areas" as const, icon: Layers, label: "Valda områden" },
    { id: "city" as const, icon: Building2, label: "Överallt" },
  ];
  return (
    <div className="space-y-5">
      <div>
        <Label icon={MapPin}>Arbetsområde *</Label>
        <p className="mb-2 text-sm text-muted">Välj överallt, eller de områden du tar uppdrag i.</p>
        <div className="flex flex-wrap gap-1.5">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const active = props.areaMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  props.onMode(mode.id);
                  if (mode.id === "city" && !props.areas.includes("Överallt")) props.onToggleArea("Överallt");
                }}
                className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs", active ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6] bg-white")}
              >
                <Icon className="size-3.5" /> {mode.label}
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
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.map((name) => {
            const active = props.areas.includes(name);
            return (
              <button key={name} type="button" aria-pressed={active} onClick={() => props.onToggleArea(name)} className={cn("rounded-full px-2.5 py-1 text-xs", active ? "bg-[#8a6a3d] text-white" : "border border-[#e6dfd6] bg-white")}>
                {name}
              </button>
            );
          })}
          {custom.map((name) => (
            <button key={name} type="button" onClick={() => props.onToggleArea(name)} className="rounded-full bg-[#8a6a3d] px-2.5 py-1 text-xs text-white">
              {name} ×
            </button>
          ))}
          {extraOpen ? (
            <span className="flex items-center gap-1">
              <input value={extraName} onChange={(event) => setExtraName(event.target.value)} placeholder="Område" className="w-28 rounded-full border border-[#e6dfd6] px-2 py-1 text-xs outline-none" />
              <button
                type="button"
                onClick={() => {
                  props.onAddArea(extraName);
                  setExtraName("");
                  setExtraOpen(false);
                }}
                className="rounded-full bg-[#2a211c] px-2 py-1 text-xs text-white"
              >
                OK
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setExtraOpen(true)} className="rounded-full border border-[#e6dfd6] px-2.5 py-1 text-xs">
              + Område
            </button>
          )}
        </div>
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
