import catalog from "./categories.json";
import { asset } from "./asset";

export type TaxStatus = "rut" | "rot" | "mixed" | "partial" | "none";
export type ServiceIcon =
  | "sparkles"
  | "leaf"
  | "truck"
  | "drill"
  | "wrench"
  | "zap"
  | "droplets"
  | "hammer"
  | "shield"
  | "heart"
  | "eye"
  | "laptop"
  | "users"
  | "calculator"
  | "key"
  | "user"
  | "ellipsis";

export const SERVICE_IDS = ["stad", "trad", "flytt", "mon", "rep", "el", "vvs", "ren", "sak", "oms", "til", "it", "per", "eko", "annat"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export type TaxRelief = { status: TaxStatus; label: string; note: string; source: string };
export type PriceEstimate = {
  unit: string;
  min: number;
  max: number;
  isEstimate: true;
  note: string;
  afterDeduction?: { kind: string; rate: number; min: number; max: number };
};
export type PhotoCredit = {
  file: string;
  thumb: string;
  photographer: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  alt: string;
};
export type Subcategory = {
  id: string;
  name: string;
  desc: string;
  taxRelief: TaxRelief;
  priceEstimate?: PriceEstimate;
  image?: string;
  imageThumb?: string;
  credit?: PhotoCredit;
};
export type Service = {
  id: ServiceId;
  name: string;
  desc: string;
  intro: string;
  icon: ServiceIcon;
  popular: boolean;
  image: string;
  imageThumb: string;
  credit: PhotoCredit;
  taxRelief: TaxRelief;
  priceEstimate?: PriceEstimate;
  subcategories: Subcategory[];
};

function creditOf(image: { file: string; thumb: string; photographer: string; sourceUrl: string; license: string; licenseUrl: string; alt: string }): PhotoCredit {
  return {
    file: image.file,
    thumb: image.thumb,
    photographer: image.photographer,
    sourceUrl: image.sourceUrl,
    license: image.license,
    licenseUrl: image.licenseUrl,
    alt: image.alt,
  };
}

const otherTax: TaxRelief = {
  status: "none",
  label: "Beror på uppdraget",
  note: "RUT och ROT beror på vad som ska göras. Det här är ingen bedömning.",
  source: "https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut/gerarbetetratttillrutavdrag.4.2ef18e6a125660db8b080001531.html",
};

export const otherSubcategory: Subcategory = {
  id: "annat",
  name: "Annat",
  desc: "Beskriv vad du behöver hjälp med",
  taxRelief: otherTax,
};

function mapSub(raw: (typeof catalog.categories)[number]["subcategories"][number]): Subcategory {
  const image = "image" in raw ? raw.image : undefined;
  return {
    id: raw.id,
    name: raw.name,
    desc: raw.desc,
    taxRelief: raw.taxRelief as TaxRelief,
    priceEstimate: "priceEstimate" in raw ? (raw.priceEstimate as PriceEstimate) : undefined,
    image: image ? asset(`/velio/categories/${image.file}`) : undefined,
    imageThumb: image ? asset(`/velio/categories/${image.thumb}`) : undefined,
    credit: image ? creditOf(image) : undefined,
  };
}

export const services: Service[] = catalog.categories.map((raw) => ({
  id: raw.id as ServiceId,
  name: raw.name,
  desc: raw.desc,
  intro: raw.intro,
  icon: raw.icon as ServiceIcon,
  popular: raw.popular,
  image: asset(`/velio/categories/${raw.image.file}`),
  imageThumb: asset(`/velio/categories/${raw.image.thumb}`),
  credit: creditOf(raw.image),
  taxRelief: raw.taxRelief as TaxRelief,
  priceEstimate: raw.priceEstimate as PriceEstimate | undefined,
  subcategories: [...raw.subcategories.map(mapSub).filter((item) => item.id !== "annat"), otherSubcategory],
}));

export const taxReliefDisclaimer = catalog.taxReliefDisclaimer;
export const priceDisclaimer = catalog.priceDisclaimer;

export const photoCredits: PhotoCredit[] = [
  ...services.map((service) => service.credit),
  ...services.flatMap((service) => service.subcategories.flatMap((item) => (item.credit ? [item.credit] : []))),
].filter((credit) => credit.sourceUrl.startsWith("http"));

export const deprecatedServiceMap: Record<string, { id: ServiceId; subcategoryId: string }> = {
  ank: { id: "til", subcategoryId: "ankomst" },
};

export function categoryImage(id: string | null | undefined) {
  return resolveServiceId(id)?.imageThumb ?? asset("/velio/categories/stad-thumb.webp");
}
export type Slot = "morning" | "afternoon" | "evening";
export type SortKey = "best" | "rating" | "price-desc" | "price-asc";

export type Provider = {
  id: string;
  name: string;
  initials: string;
  serviceId: ServiceId;
  rating: number;
  reviews: number;
  etaMin: number;
  price: number;
  area: string;
  about: string;
  quote: string;
  reviewer: string;
  reviewAgo: string;
  slots: Slot[];
  tags?: string[];
  photo?: string;
  place?: string;
  experience?: string;
  title?: string;
  serviceIds?: ServiceId[];
  otherTrade?: string;
  photos?: string[];
  offers?: { name: string; hours: string; price: number }[];
  includes?: string[];
  qualifications?: string[];
  extras?: { name: string; price: number }[];
  areas?: string[];
  /** Self-reported company details. Not a verification. */
  companyName?: string;
  orgNumber?: string;
  fTax?: "yes" | "no" | "unsure";
  /** Private people have no company block on the public profile. */
  sellerKind?: "company" | "private";
  /** Shown instead of a verified badge. Not an identity check. */
  demo?: boolean;
};

/** Public “Om” text. Prices and F-skatt stay off the profile even if an older text still contains them. */
export function providerDescription(provider: { name: string; about: string }) {
  let raw = provider.about.trim();
  const name = provider.name.trim();
  if (!raw) return "";
  if (name && raw === name) return "";
  if (name && raw.startsWith(`${name}\n`)) raw = raw.slice(name.length).trim();
  raw = raw.replace(/\n*Priser\n[\s\S]*$/i, "").trim();
  raw = raw
    .split("\n")
    .filter((line) => !/^f-skatt\b/i.test(line.trim()))
    .join("\n")
    .trim();
  return raw;
}

export const areaLayout: Record<string, { x: number; y: number }> = {
  Kungsholmen: { x: 20, y: 44 },
  Vasastan: { x: 40, y: 16 },
  Norrmalm: { x: 47, y: 39 },
  Östermalm: { x: 72, y: 30 },
  "Gamla Stan": { x: 57, y: 55 },
  Djurgården: { x: 90, y: 51 },
  Södermalm: { x: 55, y: 72 },
  Hammarby: { x: 78, y: 90 },
};

export let providers: Provider[] = [];

/** Replace the live marketplace directory (real published profiles only). */
export function setProviders(next: Provider[]) {
  providers = next;
}

export const areaCoords: Record<string, { lat: number; lng: number }> = {
  Kungsholmen: { lat: 59.330, lng: 18.030 },
  Vasastan: { lat: 59.343, lng: 18.045 },
  Norrmalm: { lat: 59.334, lng: 18.065 },
  Östermalm: { lat: 59.338, lng: 18.089 },
  "Gamla Stan": { lat: 59.325, lng: 18.071 },
  Djurgården: { lat: 59.326, lng: 18.120 },
  Södermalm: { lat: 59.312, lng: 18.075 },
  Hammarby: { lat: 59.302, lng: 18.103 },
  Solna: { lat: 59.360, lng: 18.000 },
  Stockholm: { lat: 59.330, lng: 18.068 },
};

export function coordsForArea(area: string | null | undefined) {
  if (!area) return areaCoords.Stockholm;
  return areaCoords[area] ?? areaCoords.Stockholm;
}

export function distanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * rad;
  const dLng = (to.lng - from.lng) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


export const whenOptions = ["Så snart som möjligt", "Idag", "Imorgon", "Välj tid i chatten"] as const;

export const sortLabels: Record<SortKey, string> = {
  best: "Bäst för dig",
  rating: "Betyg",
  "price-desc": "Dyrast först",
  "price-asc": "Billigast först",
};

export function serviceById(id: string | null | undefined) {
  if (!id) return undefined;
  return services.find((service) => service.id === id);
}

export function resolveServiceId(id: string | null | undefined) {
  if (!id) return undefined;
  const mapped = deprecatedServiceMap[id];
  return serviceById(mapped ? mapped.id : id);
}

export function subcategoryById(serviceId: string | null | undefined, subcategoryId: string | null | undefined) {
  const service = resolveServiceId(serviceId);
  if (!service || !subcategoryId) return undefined;
  return service.subcategories.find((item) => item.id === subcategoryId);
}

export function providerById(id: string | null | undefined) {
  return providers.find((provider) => provider.id === id);
}

export function kr(value: number) {
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}

export function ratingLabel(value: number) {
  return value.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Hide placeholder login labels such as "BankID-användare". */
export function publicDisplayName(name: string | null | undefined) {
  const trimmed = (name ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (/bankid|google-användare|apple-användare|^användare$/i.test(trimmed)) return "";
  return trimmed;
}

/** Drop generated stand-in addresses. A chosen address is kept. */
export function contactEmail(email: string | null | undefined) {
  const value = (email ?? "").trim();
  if (!value || /@(?:bankid\.|users\.)?velio\.local$/i.test(value)) return "";
  return value;
}

/** An address the person chooses, including one that is not a real mailbox, such as namn@.com. */
export function isSignInEmail(email: string | null | undefined) {
  const value = contactEmail(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]*\.[^\s@]+$/.test(value)) return "";
  return value;
}

export function greetingName(name: string | null | undefined) {
  return publicDisplayName(name).split(" ")[0] ?? "";
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const slotNames: Record<Slot, string> = {
  morning: "förmiddag",
  afternoon: "eftermiddag",
  evening: "kväll",
};

export function autoReply(text: string, provider: Provider) {
  const message = text.toLowerCase();
  if (message.includes("kost") || message.includes("pris")) {
    return `Jag tar från ${kr(provider.price)}. RUT kan gälla på många jobb, och slutpriset bekräftar jag innan start.`;
  }
  if (message.includes("idag") || message.includes("komma") || message.includes("nu")) {
    return `Jag kan vara hos dig i ${provider.area} om ungefär ${provider.etaMin} minuter.`;
  }
  if (message.includes("när") || message.includes("tid") || message.includes("tillgäng")) {
    const when = provider.slots.map((slot) => slotNames[slot]).join(" och ");
    return `Jag är oftast ledig på ${when}. Vilken tid passar dig?`;
  }
  if (message.includes("bok")) {
    return "Toppen. Bekräfta bokningen i appen så är jag på väg.";
  }
  return "Tack, jag har läst det. Jag återkommer strax med ett förslag.";
}

export function isOpenAt(provider: Provider, date: Date | null, time: string | null) {
  if (!date && !time) return true;
  if (date && !openWeekdays(provider).includes(date.getDay())) return false;
  if (!time) return true;
  const [hour, minute] = time.split(":").map(Number);
  const minutes = hour * 60 + (minute || 0);
  const ranges: Record<Slot, [number, number]> = {
    morning: [8 * 60, 12 * 60],
    afternoon: [12 * 60, 16 * 60],
    evening: [16 * 60, 21 * 60],
  };
  return provider.slots.some((slot) => minutes >= ranges[slot][0] && minutes < ranges[slot][1]);
}

function openWeekdays(provider: Provider) {
  const days = [1, 2, 3, 4, 5];
  if (provider.slots.includes("evening")) days.push(6);
  if (provider.slots.length >= 3) days.push(0);
  return days;
}

export function providerTradeNames(provider: Pick<Provider, "serviceId" | "serviceIds" | "otherTrade">) {
  const ids = provider.serviceIds ?? [provider.serviceId];
  const names: string[] = ids.map((id) => serviceById(id)?.name ?? "").filter((name) => name.length > 0);
  if (provider.otherTrade?.trim()) names.push(provider.otherTrade.trim());
  return names;
}

export function providerWorksIn(provider: Provider, area: string) {
  const areas = provider.areas ?? [];
  if (areas.includes("Överallt") || provider.place === "Överallt" || provider.place === "Hela Stockholm") return true;
  return provider.area === area || provider.place === area || areas.includes(area);
}

export function filterProviders(options: {
  serviceId?: string | null;
  time: Slot | "anytime";
  sort: SortKey;
  area?: string | null;
  query?: string;
  list?: Provider[];
}) {
  const query = options.query?.trim().toLowerCase() ?? "";
  const source = options.list ?? providers;
  const list = source.filter((provider) => {
    if (options.serviceId) {
      const ids = provider.serviceIds ?? [provider.serviceId];
      if (!ids.includes(options.serviceId as ServiceId)) return false;
    }
    if (options.time !== "anytime" && !provider.slots.includes(options.time)) return false;
    if (options.area && !providerWorksIn(provider, options.area)) return false;
    if (!query) return true;
    const haystack = [
      provider.name,
      provider.area,
      provider.place,
      provider.title,
      provider.otherTrade,
      ...(provider.areas ?? []),
      ...providerTradeNames(provider),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  return list.sort((a, b) => {
    if (options.sort === "rating") return b.rating - a.rating;
    if (options.sort === "price-desc") return b.price - a.price;
    if (options.sort === "price-asc") return a.price - b.price;
    return a.etaMin - b.etaMin || b.rating - a.rating;
  });
}
