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
};

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

export const providers: Provider[] = [
  {
    id: "el-erik",
    name: "Erik Lindberg",
    initials: "EL",
    serviceId: "el",
    rating: 4.9,
    reviews: 124,
    etaMin: 8,
    price: 890,
    area: "Östermalm",
    photo: "/velio/erik.jpg",
    about: "Behörig elektriker med tolv års erfarenhet. Installationer, laddboxar och felsökning i lägenhet.",
    quote: "Mycket professionell och snabb. Rekommenderas varmt.",
    reviewer: "Anna K.",
    reviewAgo: "2 dagar sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "el-mira",
    name: "Mira Holm",
    initials: "MH",
    serviceId: "el",
    rating: 4.7,
    reviews: 86,
    etaMin: 14,
    price: 760,
    area: "Norrmalm",
    about: "Löser jordfel, byter uttag och sätter upp belysning utan att lämna ett bygge efter sig.",
    quote: "Förklarade allt tydligt och städade efter sig.",
    reviewer: "Jon P.",
    reviewAgo: "en vecka sedan",
    slots: ["afternoon", "evening"],
  },
  {
    id: "st-sofia",
    name: "Sofia Andersson",
    initials: "SA",
    serviceId: "stad",
    rating: 4.8,
    reviews: 210,
    etaMin: 5,
    price: 650,
    area: "Södermalm",
    about: "Hemstäd och flyttstäd med egna medel. Noggrann i kök och badrum.",
    quote: "Lägenheten kändes ny. Kommer boka igen.",
    reviewer: "Lars M.",
    reviewAgo: "igår",
    slots: ["morning", "afternoon", "evening"],
  },
  {
    id: "st-amir",
    name: "Amir Hassan",
    initials: "AH",
    serviceId: "stad",
    rating: 4.9,
    reviews: 96,
    etaMin: 11,
    price: 590,
    area: "Kungsholmen",
    about: "Återkommande hemstäd varannan vecka eller enstaka storstäd inför besök.",
    quote: "Punktlig och diskret. Precis vad vi behövde.",
    reviewer: "Eva S.",
    reviewAgo: "4 dagar sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "st-leila",
    name: "Leila Osman",
    initials: "LO",
    serviceId: "stad",
    rating: 4.6,
    reviews: 120,
    etaMin: 9,
    price: 610,
    area: "Gamla Stan",
    about: "Flyttstäd med garanti. Van vid trånga kök och branta trapphus.",
    quote: "Inget att anmärka på vid besiktningen.",
    reviewer: "Noah E.",
    reviewAgo: "3 dagar sedan",
    slots: ["morning", "evening"],
  },
  {
    id: "tr-johan",
    name: "Johan Berg",
    initials: "JB",
    serviceId: "trad",
    rating: 5,
    reviews: 64,
    etaMin: 12,
    price: 720,
    area: "Vasastan",
    about: "Gräsklippning, häck och höststädning av innergård. Tar med egen utrustning.",
    quote: "Gården såg ut som en park efteråt.",
    reviewer: "Maja L.",
    reviewAgo: "5 dagar sedan",
    slots: ["morning"],
  },
  {
    id: "tr-elsa",
    name: "Elsa Nyström",
    initials: "EN",
    serviceId: "trad",
    rating: 4.6,
    reviews: 41,
    etaMin: 18,
    price: 640,
    area: "Djurgården",
    about: "Plantering, beskärning och skötsel av små trädgårdar och balkonglådor.",
    quote: "Visste exakt vilka växter som klarar skuggan.",
    reviewer: "Per A.",
    reviewAgo: "en vecka sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "re-lisa",
    name: "Lisa Nilsson",
    initials: "LN",
    serviceId: "rep",
    rating: 4.7,
    reviews: 88,
    etaMin: 9,
    price: 540,
    area: "Kungsholmen",
    about: "Möbler, blandare, dörrar som kärvar. Det mesta som gått sönder i hemmet.",
    quote: "Fixade garderobsdörren på tjugo minuter.",
    reviewer: "Sara B.",
    reviewAgo: "igår",
    slots: ["afternoon", "evening"],
  },
  {
    id: "re-noah",
    name: "Noah Ek",
    initials: "NE",
    serviceId: "rep",
    rating: 4.8,
    reviews: 53,
    etaMin: 15,
    price: 610,
    area: "Södermalm",
    about: "Montering av IKEA-möbler och mindre snickeri. Tar med rätt bits och plugg.",
    quote: "Sängen stod klar innan middagen.",
    reviewer: "Kim H.",
    reviewAgo: "6 dagar sedan",
    slots: ["morning", "afternoon", "evening"],
  },
  {
    id: "sa-karin",
    name: "Karin Blom",
    initials: "KB",
    serviceId: "sak",
    rating: 4.9,
    reviews: 128,
    etaMin: 10,
    price: 980,
    area: "Östermalm",
    tags: ["Bevakning", "Larm", "Event"],
    photo: "/velio/sak-karin.jpg",
    about: "Erfaren säkerhetsvakt med bakgrund inom event, fastighetsbevakning och personlig säkerhet. Lugn, diskret och pålitlig.",
    quote: "Professionell, punktlig och gav en trygg känsla hela kvällen.",
    reviewer: "Helen G.",
    reviewAgo: "8 dagar sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "sa-olle",
    name: "Olle Strand",
    initials: "OS",
    serviceId: "sak",
    rating: 4.5,
    reviews: 67,
    etaMin: 20,
    price: 860,
    area: "Vasastan",
    tags: ["Bevakning", "Personskydd", "Event"],
    photo: "/velio/sak-olle.jpg",
    about: "Portkod, brevinkast och fönsterlås. Van vid äldre fastigheter.",
    quote: "Kom med rätt cylinder direkt.",
    reviewer: "Inger W.",
    reviewAgo: "en vecka sedan",
    slots: ["afternoon", "evening"],
  },
  {
    id: "sa-nordic",
    name: "Nordic Security",
    initials: "NS",
    serviceId: "sak",
    rating: 4.8,
    reviews: 302,
    etaMin: 15,
    price: 1200,
    area: "Södermalm",
    tags: ["Larm", "Patrullering", "Trygghetsjour"],
    photo: "/velio/sak-nordic.jpg",
    about: "Patrullering och trygghetsjour för hem och event. Verifierade väktare.",
    quote: "Kände oss lugna hela kvällen.",
    reviewer: "Familjen Berg",
    reviewAgo: "3 dagar sedan",
    slots: ["morning", "afternoon", "evening"],
  },
  {
    id: "sa-safe",
    name: "SafeTech",
    initials: "ST",
    serviceId: "sak",
    rating: 4.7,
    reviews: 96,
    etaMin: 30,
    price: 1490,
    area: "Norrmalm",
    place: "Hela Stockholm",
    tags: ["Larm", "Kamera", "Installation"],
    photo: "/velio/sak-safe.jpg",
    about: "Larm och kameror, installerade och igång samma dag.",
    quote: "Kameran satt uppe innan kvällen.",
    reviewer: "Omar S.",
    reviewAgo: "en vecka sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "rn-fatima",
    name: "Fatima Ali",
    initials: "FA",
    serviceId: "ren",
    rating: 4.8,
    reviews: 143,
    etaMin: 16,
    price: 1100,
    area: "Hammarby",
    about: "Målning av rum och små renoveringar. Täcker golv och lämnar ytan dammfri.",
    quote: "Väggen blev jämn och färgen rätt nyans.",
    reviewer: "Oskar T.",
    reviewAgo: "3 dagar sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "rn-peter",
    name: "Peter Wahl",
    initials: "PW",
    serviceId: "ren",
    rating: 4.6,
    reviews: 70,
    etaMin: 22,
    price: 980,
    area: "Norrmalm",
    about: "Lister, spackling och ommålning inför försäljning. Arbetar kvällar vid behov.",
    quote: "Tog bilder före och efter. Smidigt.",
    reviewer: "Helen G.",
    reviewAgo: "8 dagar sedan",
    slots: ["evening"],
  },
  {
    id: "pe-nora",
    name: "Nora Lind",
    initials: "NL",
    serviceId: "per",
    rating: 4.9,
    reviews: 58,
    etaMin: 7,
    price: 495,
    area: "Södermalm",
    about: "Tillfällig hjälp vid event, flytt eller en extra person i butiken.",
    quote: "Lugn, trevlig och höll tiden.",
    reviewer: "Studio Nord",
    reviewAgo: "igår",
    slots: ["morning", "afternoon", "evening"],
  },
  {
    id: "ek-david",
    name: "David Berg",
    initials: "DB",
    serviceId: "eko",
    rating: 5,
    reviews: 39,
    etaMin: 25,
    price: 850,
    area: "Östermalm",
    about: "Löpande bokföring för enskild firma och hjälp inför deklarationen.",
    quote: "Äntligen någon som förklarar moms utan floskler.",
    reviewer: "Ali R.",
    reviewAgo: "4 dagar sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "an-maya",
    name: "Maya Svensson",
    initials: "MS",
    serviceId: "ank",
    rating: 4.8,
    reviews: 47,
    etaMin: 6,
    price: 420,
    area: "Norrmalm",
    about: "Vädrar, handlar basvaror och tänder lamporna innan du landar.",
    quote: "Mjölk i kylen och nyckeln där vi bestämt. Perfekt.",
    reviewer: "Chris D.",
    reviewAgo: "2 dagar sedan",
    slots: ["afternoon", "evening"],
  },
  {
    id: "ti-axel",
    name: "Axel Holm",
    initials: "AX",
    serviceId: "til",
    rating: 4.7,
    reviews: 61,
    etaMin: 9,
    price: 350,
    area: "Vasastan",
    about: "Tillsyn av lägenheten när du reser. Vattnar, tar posten och skickar en bild.",
    quote: "Fick rapport samma dag. Växterna levde.",
    reviewer: "Nina F.",
    reviewAgo: "en vecka sedan",
    slots: ["morning", "evening"],
  },
  {
    id: "ti-siri",
    name: "Siri Dahl",
    initials: "SD",
    serviceId: "til",
    rating: 4.9,
    reviews: 28,
    etaMin: 13,
    price: 390,
    area: "Kungsholmen",
    about: "Kollar fönster, element och att allt är låst. Ringer direkt om något avviker.",
    quote: "Upptäckte en droppande kran i tid.",
    reviewer: "Bo E.",
    reviewAgo: "5 dagar sedan",
    slots: ["afternoon"],
  },
  {
    id: "ren-ali",
    name: "Ali Byggservice",
    initials: "AB",
    serviceId: "ren",
    rating: 4.9,
    reviews: 126,
    etaMin: 12,
    price: 890,
    area: "Östermalm",
    about: "Målning, lagning och mindre renoveringar. Täcker golv och lämnar rent efter sig.",
    quote: "Väggen var klar innan dagen var slut.",
    reviewer: "Anna K.",
    reviewAgo: "3 dagar sedan",
    slots: ["morning", "afternoon"],
  },
  {
    id: "st-cleanpro",
    name: "CleanPro",
    initials: "CP",
    serviceId: "stad",
    rating: 4.8,
    reviews: 209,
    etaMin: 8,
    price: 640,
    area: "Södermalm",
    about: "Hemstäd med fasta team. Tar kök, badrum och golv, och kan komma samma dag.",
    quote: "Punktliga och väldigt noggranna.",
    reviewer: "Maja L.",
    reviewAgo: "igår",
    slots: ["morning", "afternoon", "evening"],
  },
  {
    id: "tr-gron",
    name: "Grön Trädgård",
    initials: "GT",
    serviceId: "trad",
    rating: 4.9,
    reviews: 98,
    etaMin: 16,
    price: 740,
    area: "Vasastan",
    about: "Häck, plantering och skötsel av små trädgårdar. Tar med egen utrustning.",
    quote: "Buskarna såg ut som efter en trädgårdsmästare.",
    reviewer: "Per A.",
    reviewAgo: "4 dagar sedan",
    slots: ["morning", "afternoon"],
  },
];

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

export function filterProviders(options: {
  serviceId?: string | null;
  time: Slot | "anytime";
  sort: SortKey;
  area?: string | null;
  query?: string;
}) {
  const query = options.query?.trim().toLowerCase() ?? "";
  const list = providers.filter((provider) => {
    if (options.serviceId && provider.serviceId !== options.serviceId) return false;
    if (options.time !== "anytime" && !provider.slots.includes(options.time)) return false;
    if (options.area && provider.area !== options.area && provider.place !== "Hela Stockholm") return false;
    if (!query) return true;
    return (
      provider.name.toLowerCase().includes(query) ||
      provider.area.toLowerCase().includes(query) ||
      serviceById(provider.serviceId)?.name.toLowerCase().includes(query) === true
    );
  });

  return list.sort((a, b) => {
    if (options.sort === "rating") return b.rating - a.rating;
    if (options.sort === "price-desc") return b.price - a.price;
    if (options.sort === "price-asc") return a.price - b.price;
    return a.etaMin - b.etaMin || b.rating - a.rating;
  });
}
