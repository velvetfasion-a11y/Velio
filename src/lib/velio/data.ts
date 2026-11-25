export const services = [
  { id: "el", name: "Elektriker", desc: "Elinstallationer och felsökning", icon: "zap" },
  { id: "stad", name: "Städning", desc: "Hemstäd och flyttstäd", icon: "sparkles" },
  { id: "trad", name: "Trädgård", desc: "Gräsklippning och skötsel", icon: "leaf" },
  { id: "rep", name: "Reparationer", desc: "Allt som gått sönder", icon: "wrench" },
  { id: "sak", name: "Säkerhet", desc: "Larm och lås", icon: "shield" },
  { id: "ren", name: "Renovering", desc: "Målning och renovering", icon: "hammer" },
  { id: "per", name: "Personal", desc: "Tillfällig personal", icon: "user" },
  { id: "eko", name: "Ekonomi", desc: "Bokföring och deklaration", icon: "calculator" },
  { id: "ank", name: "Ankomstservice", desc: "Förbered hemmet inför ankomst", icon: "key" },
  { id: "til", name: "Tillsyn", desc: "Kolla bostaden när du är borta", icon: "eye" },
] as const;

export type ServiceId = (typeof services)[number]["id"];
export type ServiceIcon = (typeof services)[number]["icon"];
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
  extras?: { name: string; price: number }[];
  areas?: string[];
};

/** Public “Om” text: the description the person wrote, without a leading account name. */
export function providerDescription(provider: { name: string; about: string }) {
  const raw = provider.about.trim();
  const name = provider.name.trim();
  if (!raw) return "";
  if (name && raw === name) return "";
  if (name && raw.startsWith(`${name}\n`)) return raw.slice(name.length).trim();
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


export const whenOptions = ["Så snart som möjligt", "Idag", "Imorgon", "Välj tid i chatten"] as const;

export const sortLabels: Record<SortKey, string> = {
  best: "Bäst för dig",
  rating: "Betyg",
  "price-desc": "Dyrast först",
  "price-asc": "Billigast först",
};

export function serviceById(id: string | null | undefined) {
  return services.find((service) => service.id === id);
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
