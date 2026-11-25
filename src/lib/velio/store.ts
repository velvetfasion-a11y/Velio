import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  areaCoords,
  initialsOf,
  kr,
  providerById,
  providers,
  contactEmail,
  publicDisplayName,
  serviceById,
  setProviders,
  type Provider,
  type ServiceId,
  type Slot,
  type SortKey,
} from "@/lib/velio/data";
import { resolveCurrentLocation, type UserLocation } from "@/lib/velio/geo";
import {
  createAccountRemote,
  createJobRemote,
  fetchMe,
  fetchMessages,
  loginWithAccount,
  logoutRemote,
  openConversation,
  updateProfileRemote,
  type AccountDto,
  type AuthProvider,
  type ConversationDto,
  type JobDto,
  type MeResponse,
} from "@/lib/velio/auth-api";
import { chatDtoToMsg, previewMessageText, resolveTakeRequestStatuses } from "@/lib/velio/chat-codec";
import { isStaticHost, localDeleteAccount, localSetAccountMode } from "@/lib/velio/local-auth";

function mapSyncedMessages(
  messages: { id: string; from: "me" | "them"; text: string; time?: string }[],
): ChatMsg[] {
  return resolveTakeRequestStatuses(messages.map(chatDtoToMsg));
}

/** Profile this browser published. Pages keeps the directory locally, so a single listing belongs to the signed-in owner even if the account id drifted. */
export function ownBusiness(state: {
  accountId: string | null;
  directory: Provider[];
  loggedIn: boolean;
}): Provider | undefined {
  const exact = state.accountId ? state.directory.find((item) => item.id === `biz-${state.accountId}`) : undefined;
  if (exact) return exact;
  if (!state.loggedIn || state.directory.length === 0) return undefined;
  return state.directory[state.directory.length - 1];
}

export type Screen =
  | "home"
  | "search"
  | "inbox"
  | "notifications"
  | "service"
  | "history"
  | "profile"
  | "edit"
  | "payments"
  | "bookings"
  | "posted"
  | "business"
  | "verify-id"
  | "settings"
  | "help";

export type AppNotification = {
  id: string;
  kind: "booking_accepted" | "booking_declined" | "booking_requested" | "booking_done" | "message" | "info";
  title: string;
  body: string;
  bookingId?: string;
  createdAt: string;
  read: boolean;
};

export type Sheet =
  | "provider"
  | "chat"
  | "receipt"
  | "book"
  | "cart"
  | "location"
  | "bankid"
  | "sort"
  | "onboard"
  | "track"
  | "menu"
  | "job"
  | "notes"
  | "filters"
  | "request"
  | "pay"
  | "rate"
  | null;

export type ChatCard =
  | {
      kind: "request";
      service: string;
      when: string;
      place: string;
      price: number;
      intent?: "book" | "take";
      status?: "pending" | "accepted" | "declined";
      about?: string;
    }
  | { kind: "confirmed"; date: string; time: string; place: string }
  | { kind: "enroute"; eta: string }
  | { kind: "done"; service: string; desc: string; price: number }
  | { kind: "slot"; when: string; place: string; service: string }
  | { kind: "quote"; amount: number; service: string; hours: string; when: string; place: string }
  | { kind: "paid"; amount: number }
  | { kind: "reschedule"; when: string; place: string; service: string }
  | { kind: "cancelled" }
  | { kind: "rebook"; service: string; when: string; place: string; about: string; price: number; status: "pending" | "accepted" | "declined" };

export type ChatMsg = {
  id: string;
  from: "me" | "them" | "system";
  text?: string;
  time?: string;
  day?: string;
  card?: ChatCard;
};

export type CartItem = { id: string; serviceId: ServiceId; providerId: string };

export type PayCard = { id: string; label: string; detail: string };

export type Booking = {
  id: string;
  serviceId: ServiceId;
  providerId: string;
  whenLabel: string;
  cost: number;
  tip: number | null;
  location: string;
  rating: number | null;
  status: "done" | "enroute" | "scheduled" | "requested" | "accepted" | "declined";
  holdKr?: number;
};

export type Listing = {
  serviceId: ServiceId;
  serviceIds?: ServiceId[];
  otherTrade?: string;
  title?: string;
  desc: string;
  price: number;
  experience?: string;
  photos?: string[];
  offers?: { name: string; hours: string; price: number }[];
  includes?: string[];
  qualifications?: string[];
  extras?: { name: string; price: number }[];
  areas?: string[];
};

export type BusinessForm = {
  serviceId: ServiceId | "";
  serviceIds: ServiceId[];
  otherTrade: string;
  title: string;
  desc: string;
  level: string;
  certs: string[];
  photos: string[];
  offers: { id: string; name: string; hours: string; price: number; on: boolean }[];
  includes: string[];
  extras: { name: string; price: number }[];
  areaMode: "radius" | "areas" | "city";
  areas: string[];
  km: number;
  days: number[];
  from: string;
  to: string;
  offs: string[];
  notice: string;
  payout: boolean;
  terms: boolean;
};

export type Profile = { name: string; phone: string; email: string; avatar?: string };

export type PostedJob = {
  id: string;
  serviceId: ServiceId;
  text: string;
  when: string;
  address: string;
  rate: "hour" | "fixed";
  price: number;
  ownerId?: string;
  ownerName?: string;
};

export type PeerInfo = {
  id: string;
  name: string;
  providerId: string | null;
};

const seedBookings: Booking[] = [];
const seedNotifications: AppNotification[] = [];
const seedCart: CartItem[] = [];

function areaSummary(areas: string[] | undefined) {
  const list = (areas ?? []).map((area) => area.trim()).filter(Boolean);
  if (list.includes("Överallt")) {
    const extra = list.filter((area) => area !== "Överallt");
    return { area: "Stockholm", place: extra.length ? `Överallt, ${extra.join(", ")}` : "Överallt" };
  }
  const known = list.find((area) => areaCoords[area]);
  if (list.length) return { area: known || "Stockholm", place: list.join(", ") };
  return { area: "Stockholm", place: "Stockholm" };
}

function listingToProvider(input: {
  id: string;
  name: string;
  serviceId: ServiceId;
  serviceIds?: ServiceId[];
  otherTrade?: string;
  title?: string;
  desc: string;
  price: number;
  area?: string;
  place?: string;
  experience?: string;
  photo?: string;
  photos?: string[];
  offers?: Listing["offers"];
  includes?: string[];
  qualifications?: string[];
  extras?: Listing["extras"];
  areas?: string[];
}): Provider {
  return {
    id: input.id,
    name: input.name,
    initials: initialsOf(input.name) || "V",
    serviceId: input.serviceId,
    serviceIds: input.serviceIds,
    otherTrade: input.otherTrade || undefined,
    title: input.title || undefined,
    rating: 5,
    reviews: 0,
    etaMin: 20,
    price: input.price,
    area: input.area || "Stockholm",
    place: input.place,
    about: input.desc,
    quote: "",
    reviewer: "",
    reviewAgo: "",
    slots: ["morning", "afternoon", "evening"],
    experience: input.experience || undefined,
    photo: input.photo,
    photos: input.photos,
    offers: input.offers,
    includes: input.includes,
    qualifications: input.qualifications,
    extras: input.extras,
    areas: input.areas,
  };
}

function syncDirectory(directory: Provider[]) {
  setProviders(directory);
}

const screens: Screen[] = [
  "home",
  "search",
  "inbox",
  "notifications",
  "service",
  "history",
  "profile",
  "edit",
  "payments",
  "bookings",
  "posted",
  "business",
  "verify-id",
  "settings",
  "help",
];

const sheets: Exclude<Sheet, null>[] = [
  "provider",
  "chat",
  "receipt",
  "book",
  "cart",
  "location",
  "bankid",
  "sort",
  "onboard",
  "track",
  "menu",
  "job",
  "notes",
  "filters",
  "request",
  "pay",
  "rate",
];

function isScreen(value: unknown): value is Screen {
  return typeof value === "string" && screens.includes(value as Screen);
}

function isSheet(value: unknown): value is Sheet {
  return value === null || (typeof value === "string" && sheets.includes(value as Exclude<Sheet, null>));
}

type VelioState = {
  screen: Screen;
  navStack: Screen[];
  sheet: Sheet;
  loggedIn: boolean;
  loginIntro: boolean;
  authReady: boolean;
  authError: string | null;
  accountId: string | null;
  authProvider: string | null;
  conversationByProvider: Record<string, string>;
  peers: Record<string, PeerInfo>;
  locationOn: boolean;
  userLocation: UserLocation | null;
  locationBusy: boolean;
  locationError: string | null;
  onboardFocus: "place" | null;
  notifications: boolean;
  appNotifications: AppNotification[];
  search: string;
  serviceId: ServiceId | null;
  providerId: string | null;
  receiptId: string | null;
  mapMode: boolean;
  sort: SortKey;
  time: Slot | "anytime";
  area: string | null;
  listing: Listing | null;
  directory: Provider[];
  businessForm: BusinessForm | null;
  accountMode: "customer" | "business";
  idVerified: boolean;
  idMethod: string | null;
  profile: Profile;
  cards: PayCard[];
  cart: CartItem[];
  chats: Record<string, ChatMsg[]>;
  bookings: Booking[];
  posted: PostedJob[];
  activeBookingId: string | null;
  toast: string | null;
  go: (screen: Screen, opts?: { replace?: boolean }) => void;
  goBack: () => void;
  openService: (serviceId: ServiceId) => void;
  openProvider: (providerId: string) => void;
  openThread: (peerKey: string, opts?: { accountId?: string }) => void;
  closeSheet: () => void;
  setSheet: (sheet: Sheet) => void;
  setSearch: (search: string) => void;
  setMapMode: (mapMode: boolean) => void;
  setSort: (sort: SortKey) => void;
  setTime: (time: Slot | "anytime") => void;
  setArea: (area: string | null) => void;
  showToast: (toast: string) => void;
  bootstrapAuth: () => Promise<void>;
  applyMe: (me: Extract<MeResponse, { authenticated: true }>, opts?: { keepPlace?: boolean }) => void;
  setAuthError: (error: string | null) => void;
  applyAccountFlags: (account: AccountDto) => void;
  loginWithProvider: (provider: AuthProvider) => Promise<void>;
  loginWithAccountId: (provider: AuthProvider, accountId: string) => Promise<void>;
  createAccount: (input: {
    provider: AuthProvider;
    name: string;
    email: string;
    phone: string;
    accountMode?: "customer" | "business";
  }) => Promise<boolean>;
  saveProfile: (profile?: Profile) => Promise<boolean>;
  refreshSync: () => Promise<void>;
  login: () => void;
  logout: () => void;
  removeBusiness: () => void;
  deleteAccount: () => void;
  allowLocation: () => Promise<void>;
  clearLocation: () => void;
  setNotifications: (notifications: boolean) => void;
  enableNotifications: () => Promise<"granted" | "denied" | "unsupported">;
  reconcileNotifications: () => void;
  pushNotification: (input: Omit<AppNotification, "id" | "createdAt" | "read"> & { id?: string; createdAt?: string; read?: boolean }) => void;
  markNotificationRead: (id: string) => void;
  openBookingFromNotification: (bookingId: string) => void;
  setProfile: (profile: Profile) => void;
  setAvatar: (avatar: string) => void;
  addCard: (card: PayCard) => void;
  addToCart: () => void;
  removeFromCart: (id: string) => void;
  checkoutCart: () => void;
  openChat: () => void;
  sendChat: (text: string) => void;
  appendChat: (providerId: string, message: ChatMsg) => void;
  answerRebook: (providerId: string, messageId: string, status: "accepted" | "declined") => void;
  confirmBook: (whenLabel: string) => void;
  openReceipt: (id: string) => void;
  rebook: (bookingId: string) => void;
  cancelActive: () => void;
  cancelBooking: (id: string) => void;
  completeActive: (rating: number, tip: number) => void;
  finishOnboard: (listing: Listing) => void;
  saveBusinessForm: (form: BusinessForm) => void;
  setAccountMode: (mode: "customer" | "business") => void;
  addPosted: (job: Omit<PostedJob, "id">) => void;
  takePostedJob: (job: PostedJob) => void;
  answerTakeRequest: (peerKey: string, messageId: string, status: "accepted" | "declined") => void;
  submitReview: (rating: number, tip: number) => void;
};

const memoryStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function clock() {
  return new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function uid() {
  return crypto.randomUUID();
}

function jobsToPosted(jobs: JobDto[]): PostedJob[] {
  return jobs.map((job) => ({
    id: job.id,
    serviceId: job.serviceId as ServiceId,
    text: job.text,
    when: job.when,
    address: job.address,
    rate: job.rate,
    price: job.price,
    ownerId: job.ownerId,
    ownerName: job.ownerName,
  }));
}

/** Local demo thread when the sync API is unavailable (e.g. GitHub Pages). */
function localThreadSeed(providerId: string, booking?: Booking | null): ChatMsg[] {
  const provider = providerById(providerId);
  const service = provider ? serviceById(provider.serviceId) : null;
  const when = booking?.whenLabel ?? "Så snart som möjligt";
  const place = booking?.location ?? provider?.area ?? "Stockholm";
  const price = booking?.cost ?? provider?.price ?? 0;
  return [
    {
      id: uid(),
      from: "system",
      day: "Idag",
      time: clock(),
      text: "Bokning skapad",
      card: {
        kind: "request",
        service: service?.name ?? "Tjänst",
        when,
        place,
        price,
        status: booking?.status === "declined" ? "declined" : "accepted",
      },
    },
    {
      id: uid(),
      from: "system",
      time: clock(),
      text: "Skriv till varandra här. Endast ni två ser konversationen.",
    },
  ];
}

function applyConversations(
  conversations: ConversationDto[],
  chats: Record<string, ChatMsg[]>,
  peers: Record<string, PeerInfo>,
): {
  conversationByProvider: Record<string, string>;
  chats: Record<string, ChatMsg[]>;
  peers: Record<string, PeerInfo>;
} {
  const conversationByProvider: Record<string, string> = {};
  const nextChats = { ...chats };
  const nextPeers = { ...peers };
  for (const item of conversations) {
    const key = item.providerId || item.peerId;
    conversationByProvider[key] = item.id;
    nextPeers[key] = {
      id: item.peerId,
      name: item.peerName,
      providerId: item.providerId,
    };
    if (!nextChats[key]?.length && item.lastMessage) {
      nextChats[key] = [
        {
          id: `preview-${item.id}`,
          from: "them",
          text: previewMessageText(item.lastMessage),
          time: new Date(item.lastAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
        },
      ];
    }
  }
  return { conversationByProvider, chats: nextChats, peers: nextPeers };
}

let locationRequest = 0;

export const useVelio = create<VelioState>()(
  persist(
    (set, get) => ({
      screen: "home",
      navStack: [],
      sheet: null,
      loggedIn: false,
      loginIntro: false,
      authReady: false,
      authError: null,
      accountId: null,
      authProvider: null,
      conversationByProvider: {},
      peers: {},
      locationOn: false,
      userLocation: null,
      locationBusy: false,
      locationError: null,
      onboardFocus: null,
      notifications: false,
      appNotifications: seedNotifications,
      search: "",
      serviceId: null,
      providerId: null,
      receiptId: null,
      mapMode: false,
      sort: "best",
      time: "anytime",
      area: null,
      listing: null,
      directory: [],
      businessForm: null,
      accountMode: "customer",
      idVerified: false,
      idMethod: null,
      profile: {
        name: "",
        phone: "",
        email: "",
      },
      cards: [],
      cart: seedCart,
      chats: {},
      bookings: seedBookings,
      posted: [],
      activeBookingId: null,
      toast: null,
      go: (screen, opts) => {
        const current = get().screen;
        const tabRoot = screen === "home" || screen === "inbox" || screen === "profile";
        const replace = Boolean(opts?.replace) || tabRoot;
        const navStack =
          replace || screen === current
            ? []
            : [...get().navStack.filter((item) => item !== screen), current].slice(-16);
        set({
          screen,
          navStack,
          // Always leave chat/provider sheets when switching tabs so Meddelanden shows the list.
          sheet: null,
          mapMode: screen === "service" ? get().mapMode : false,
        });
      },
      goBack: () => {
        const stack = [...get().navStack];
        const prev = stack.pop() ?? "home";
        set({
          screen: prev,
          navStack: stack,
          sheet: null,
          mapMode: false,
        });
      },
      openService: (serviceId) => {
        const current = get().screen;
        const navStack =
          current === "service"
            ? get().navStack
            : [...get().navStack.filter((item) => item !== "service"), current].slice(-16);
        set({
          serviceId,
          screen: "service",
          navStack,
          sheet: null,
          mapMode: false,
          area: null,
          sort: "best",
          time: "anytime",
        });
      },
      openProvider: (providerId) => set({ providerId, sheet: "provider" }),
      openThread: (peerKey, opts) => {
        const marketplace = providerById(peerKey);
        const booking =
          get().bookings.find((item) => item.providerId === peerKey && item.status !== "done" && item.status !== "declined") ??
          get().bookings.find((item) => item.providerId === peerKey) ??
          null;
        // Always open the sheet locally first — Pages has no chat API.
        if (!(get().chats[peerKey]?.length) && marketplace) {
          set({
            providerId: peerKey,
            sheet: "chat",
            screen: get().screen === "inbox" ? "inbox" : get().screen,
            chats: {
              ...get().chats,
              [peerKey]: localThreadSeed(peerKey, booking),
            },
          });
        } else {
          set({ providerId: peerKey, sheet: "chat", screen: get().screen === "inbox" ? "inbox" : get().screen });
        }
        void (async () => {
          const opened = await openConversation(
            opts?.accountId
              ? { accountId: opts.accountId }
              : marketplace
                ? { providerId: peerKey }
                : { accountId: peerKey },
          );
          if (!opened) {
            // Static / offline: keep the local thread — never toast a failure for marketplace chats.
            if (!(get().chats[peerKey]?.length)) {
              const seed = marketplace
                ? localThreadSeed(peerKey, booking)
                : [
                    {
                      id: uid(),
                      from: "them" as const,
                      time: clock(),
                      text: "Hej! Skriv ett meddelande så svarar jag här.",
                    },
                  ];
              set({ chats: { ...get().chats, [peerKey]: seed } });
            }
            return;
          }
          const threadKey = opened.threadKey || peerKey;
          const messages = await fetchMessages(opened.conversationId);
          const existing = get().chats[threadKey] ?? [];
          set({
            providerId: threadKey,
            conversationByProvider: {
              ...get().conversationByProvider,
              [threadKey]: opened.conversationId,
            },
            peers: {
              ...get().peers,
              [threadKey]: {
                id: opened.peer.id,
                name: opened.peer.name,
                providerId: opened.peer.providerId,
              },
            },
            chats: {
              ...get().chats,
              // Don't replace a non-empty local thread with an empty remote result.
              [threadKey]: messages.length ? mapSyncedMessages(messages) : existing.length ? existing : localThreadSeed(threadKey, booking),
            },
          });
        })();
      },
      closeSheet: () => set({ sheet: null }),
      setSheet: (sheet) => set({ sheet }),
      setSearch: (search) => set({ search }),
      setMapMode: (mapMode) => set({ mapMode }),
      setSort: (sort) => set({ sort, sheet: null }),
      setTime: (time) => set({ time }),
      setArea: (area) => set({ area }),
      showToast: (toast) => {
        if (/bankid-användare|inloggad med/i.test(toast)) return;
        if (toastTimer) clearTimeout(toastTimer);
        set({ toast });
        toastTimer = setTimeout(() => set({ toast: null }), 2600);
      },
      bootstrapAuth: async () => {
        try {
          const { getLocalSessionAccount, isStaticHost, localMePayload } = await import("@/lib/velio/local-auth");
          if (typeof window !== "undefined" && isStaticHost()) {
            const local = getLocalSessionAccount();
            if (local) get().applyMe(localMePayload(local), { keepPlace: true });
            set({ authReady: true, authError: null, loggedIn: Boolean(local) });
            return;
          }
          const me = await fetchMe();
          if (!me.authenticated) {
            set({
              authReady: true,
              authError: null,
              loggedIn: false,
              accountId: null,
              authProvider: null,
              idVerified: false,
              idMethod: null,
            });
            return;
          }
          get().applyMe(me, { keepPlace: true });
          set({ authReady: true });
        } catch {
          set({
            authReady: true,
            authError: "Kunde inte nå inloggningen just nu.",
            loggedIn: false,
          });
        }
      },
      setAuthError: (error) => set({ authError: error }),
      applyAccountFlags: (account) => {
        set({
          accountMode: account.accountMode,
          idVerified: Boolean(account.idVerified),
          idMethod: account.idMethod ?? null,
          profile: {
            name: publicDisplayName(account.name),
            phone: account.phone || get().profile.phone,
            email: account.email,
            avatar: get().profile.avatar,
          },
        });
      },
      applyMe: (me, opts) => {
        const wasLoggedIn = get().loggedIn;
        const keepPlace = Boolean(opts?.keepPlace);
        const own = ownBusiness({ accountId: me.account.id, directory: get().directory, loggedIn: true });
        const accountMode =
          own || get().accountMode === "business" || me.account.accountMode === "business"
            ? "business"
            : me.account.accountMode;
        // Always keep local threads so Meddelanden doesn't wipe chats on login/sync.
        const mapped = applyConversations(me.conversations, get().chats, get().peers);
        set({
          authError: null,
          loggedIn: true,
          loginIntro: true,
          sheet: keepPlace ? get().sheet : null,
          screen: keepPlace || wasLoggedIn ? get().screen : "home",
          accountId: me.account.id,
          authProvider: me.account.provider,
          profile: {
            name:
              publicDisplayName(me.account.name) ||
              publicDisplayName(get().profile.name) ||
              publicDisplayName(own?.name) ||
              publicDisplayName(get().listing?.title) ||
              publicDisplayName(own?.title),
            phone: me.account.phone || get().profile.phone,
            email: contactEmail(me.account.email) || contactEmail(get().profile.email),
            avatar: get().profile.avatar,
          },
          accountMode,
          idVerified: Boolean(me.account.idVerified) || Boolean(own) || get().idVerified,
          idMethod: me.account.idMethod ?? get().idMethod,
          posted: isStaticHost() ? get().posted : jobsToPosted(me.jobs),
          conversationByProvider: {
            ...get().conversationByProvider,
            ...mapped.conversationByProvider,
          },
          chats: mapped.chats,
          peers: mapped.peers,
          listing: own
            ? {
                serviceId: own.serviceId,
                serviceIds: own.serviceIds,
                otherTrade: own.otherTrade,
                title: own.title,
                desc: own.about,
                price: own.price,
                experience: own.experience,
                photos: own.photos,
                offers: own.offers,
                includes: own.includes,
                qualifications: own.qualifications,
                extras: own.extras,
                areas: own.areas,
              }
            : get().listing,
          ...(keepPlace || wasLoggedIn
            ? {}
            : {
                cart: [],
                cards: get().cards.length ? get().cards : [],
                activeBookingId: null,
                businessForm: null,
              }),
        });
        if (accountMode === "business") {
          void import("@/lib/velio/local-auth").then(({ isStaticHost, localSetAccountMode }) => {
            if (isStaticHost()) localSetAccountMode("business");
          });
        }
      },
      loginWithAccountId: async (provider, accountId) => {
        const me = await loginWithAccount(provider, accountId);
        if (!me.authenticated) {
          set({
            authError: "Inloggningen kunde inte slutföras. Försök igen.",
            loggedIn: false,
          });
          return;
        }
        get().applyMe(me);
      },
      createAccount: async (input) => {
        const me = await createAccountRemote(input);
        if (!me.authenticated) {
          set({
            authError: "Kontot kunde inte skapas. Kontrollera uppgifterna och försök igen.",
            loggedIn: false,
          });
          return false;
        }
        get().applyMe(me);
        return true;
      },
      loginWithProvider: async (provider) => {
        const { listAccountsRemote } = await import("@/lib/velio/auth-api");
        const accounts = await listAccountsRemote(provider);
        if (!accounts[0]) {
          set({ authError: "Inga konton hittades för den metoden. Skapa ett nytt konto." });
          return;
        }
        await get().loginWithAccountId(provider, accounts[0].id);
      },
      saveProfile: async (nextProfile) => {
        const profile = nextProfile ?? get().profile;
        set({ profile: { ...profile, avatar: profile.avatar ?? get().profile.avatar } });
        const { isStaticHost, localUpdateAccount } = await import("@/lib/velio/local-auth");
        const syncDirectoryName = () => {
          const own = ownBusiness({ accountId: get().accountId, directory: get().directory, loggedIn: true });
          if (!own) return;
          const directory = get().directory.map((item) =>
            item.id === own.id ? { ...item, name: profile.name || item.name, initials: initialsOf(profile.name || item.name) || item.initials } : item,
          );
          syncDirectory(directory);
          set({ directory });
        };
        if (typeof window !== "undefined" && isStaticHost()) {
          localUpdateAccount({ name: profile.name, email: profile.email, phone: profile.phone });
          syncDirectoryName();
          return true;
        }
        const saved = await updateProfileRemote({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          accountMode: get().accountMode,
        });
        if (!saved) {
          syncDirectoryName();
          return true;
        }
        set({
          profile: {
            name: saved.name,
            email: saved.email,
            phone: saved.phone,
            avatar: get().profile.avatar,
          },
          accountMode: saved.accountMode,
        });
        syncDirectoryName();
        return true;
      },
      refreshSync: async () => {
        if (!get().loggedIn || isStaticHost()) return;
        const me = await fetchMe();
        if (!me.authenticated) return;
        const mapped = applyConversations(me.conversations, get().chats, get().peers);
        const nextChats = { ...mapped.chats };
        const activeProvider = get().providerId;
        const activeConversation = activeProvider ? mapped.conversationByProvider[activeProvider] : null;
        if (activeConversation && get().sheet === "chat" && activeProvider) {
          const messages = await fetchMessages(activeConversation);
          nextChats[activeProvider] = mapSyncedMessages(messages);
        }
        set({
          posted: isStaticHost() ? get().posted : jobsToPosted(me.jobs),
          conversationByProvider: mapped.conversationByProvider,
          chats: nextChats,
          peers: mapped.peers,
          profile: {
            name: publicDisplayName(me.account.name) || publicDisplayName(get().profile.name),
            phone: me.account.phone || get().profile.phone,
            email: contactEmail(me.account.email) || contactEmail(get().profile.email),
            avatar: get().profile.avatar,
          },
          accountMode: me.account.accountMode,
          idVerified: Boolean(me.account.idVerified),
          idMethod: me.account.idMethod ?? null,
        });
      },
      login: () => {
        set({ screen: "profile", sheet: null });
      },
      logout: () => {
        void import("@/lib/velio/local-auth").then(({ clearLocalSession, isStaticHost }) => {
          if (isStaticHost()) clearLocalSession();
          else void logoutRemote();
        });
        set({
          loggedIn: false,
          screen: "home",
          sheet: null,
          accountId: null,
          authProvider: null,
          conversationByProvider: {},
          peers: {},
          chats: {},
          bookings: [],
          cart: [],
          posted: [],
          cards: [],
          appNotifications: [],
          activeBookingId: null,
          listing: null,
          businessForm: null,
          accountMode: "customer",
          idVerified: false,
          idMethod: null,
        });
      },
      removeBusiness: () => {
        const own = ownBusiness({ accountId: get().accountId, directory: get().directory, loggedIn: true });
        const directory = own ? get().directory.filter((item) => item.id !== own.id) : get().directory;
        syncDirectory(directory);
        set({
          directory,
          listing: null,
          businessForm: null,
          accountMode: "customer",
          providerId: null,
          sheet: null,
        });
        if (typeof window !== "undefined" && isStaticHost()) localSetAccountMode("customer");
        get().showToast("VELIO Business är borttaget");
      },
      deleteAccount: () => {
        const accountId = get().accountId;
        const own = ownBusiness({ accountId, directory: get().directory, loggedIn: true });
        const directory = own ? get().directory.filter((item) => item.id !== own.id) : get().directory;
        syncDirectory(directory);
        if (typeof window !== "undefined" && isStaticHost()) localDeleteAccount();
        else void logoutRemote();
        set({
          loggedIn: false,
          screen: "home",
          sheet: null,
          accountId: null,
          authProvider: null,
          conversationByProvider: {},
          peers: {},
          chats: {},
          bookings: [],
          cart: [],
          posted: accountId ? get().posted.filter((job) => job.ownerId !== accountId) : [],
          cards: [],
          appNotifications: [],
          activeBookingId: null,
          directory,
          listing: null,
          businessForm: null,
          accountMode: "customer",
          idVerified: false,
          idMethod: null,
          profile: { name: "", phone: "", email: "" },
        });
      },
      allowLocation: async () => {
        const request = ++locationRequest;
        set({ locationBusy: true, locationError: null, sheet: "location" });
        try {
          const userLocation = await resolveCurrentLocation();
          if (request !== locationRequest) return;
          set({
            locationOn: true,
            userLocation,
            locationBusy: false,
            locationError: null,
            sheet: null,
          });
          get().showToast(`Plats: ${userLocation.label}`);
        } catch (error) {
          if (request !== locationRequest) return;
          const code = error && typeof error === "object" && "code" in error ? Number((error as GeolocationPositionError).code) : 0;
          const locationError =
            code === 1
              ? "Plats är blockerad för den här sidan. I Safari: tryck aA i adressfältet, välj Webbplatsinställningar och slå på Plats. Tryck sedan Dela plats igen."
              : code === 2
                ? "Telefonen hittade ingen plats. Slå på platstjänster och prova igen, eller lägg in önskad plats i arbetsinformationen."
                : code === 3
                  ? "Telefonen hann inte svara. Slå på platstjänster och tryck Dela plats igen."
                  : code === 0 || String(error).includes("unsupported")
                    ? "Den här enheten har ingen platstjänst. Lägg in önskad plats i arbetsinformationen."
                    : "Ingen plats kom fram. Slå på platstjänster för VELIO och tryck Dela plats igen.";
          set({ locationBusy: false, locationError, sheet: "location" });
        }
      },
      clearLocation: () => {
        locationRequest += 1;
        set({ locationOn: false, userLocation: null, locationError: null, locationBusy: false, sheet: null });
        get().showToast("Platsdelning avstängd");
      },
      setNotifications: (notifications) => {
        set({ notifications });
      },
      reconcileNotifications: () => {
        const allowed = typeof Notification !== "undefined" && Notification.permission === "granted";
        if (get().notifications && !allowed) set({ notifications: false });
      },
      enableNotifications: async () => {
        if (typeof Notification === "undefined" || typeof Notification.requestPermission !== "function") {
          set({ notifications: false });
          return "unsupported";
        }
        let permission = Notification.permission;
        if (permission !== "granted") {
          try {
            permission = await Notification.requestPermission();
          } catch {
            set({ notifications: false });
            return "unsupported";
          }
        }
        if (permission !== "granted") {
          set({ notifications: false });
          return "denied";
        }
        set({ notifications: true });
        try {
          const shown = new Notification("VELIO", { body: "Notifikationer är på." });
          window.setTimeout(() => shown.close(), 6000);
        } catch {
          // Permission is on even if this browser cannot show a banner.
        }
        return "granted";
      },
      pushNotification: (input) => {
        if (!get().notifications && input.kind !== "info") {
          // Preference off still keeps booking status events visible in-app.
        }
        const note: AppNotification = {
          id: input.id ?? uid(),
          kind: input.kind,
          title: input.title,
          body: input.body,
          bookingId: input.bookingId,
          createdAt: input.createdAt ?? new Date().toISOString(),
          read: input.read ?? false,
        };
        set({ appNotifications: [note, ...get().appNotifications] });
      },
      markNotificationRead: (id) => {
        set({
          appNotifications: get().appNotifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
        });
      },
      openBookingFromNotification: (bookingId) => {
        const booking = get().bookings.find((item) => item.id === bookingId);
        if (!booking) {
          get().showToast("Bokningen hittades inte");
          return;
        }
        const unread = get().appNotifications.find((item) => item.bookingId === bookingId && !item.read);
        if (unread) get().markNotificationRead(unread.id);
        set({
          screen: "history",
          sheet: "receipt",
          receiptId: bookingId,
          activeBookingId: bookingId,
        });
      },
      setProfile: (profile) => {
        set({ profile: { ...profile, avatar: profile.avatar ?? get().profile.avatar } });
      },
      setAvatar: (avatar) => {
        set({ profile: { ...get().profile, avatar } });
        const own = ownBusiness({ accountId: get().accountId, directory: get().directory, loggedIn: get().loggedIn });
        if (!own) return;
        const directory = get().directory.map((item) => (item.id === own.id ? { ...item, photo: avatar } : item));
        syncDirectory(directory);
        set({ directory });
      },
      addCard: (card) => set({ cards: [...get().cards, card] }),
      addToCart: () => {
        const { providerId, cart } = get();
        const provider = providerById(providerId);
        if (!provider) return;
        if (cart.some((item) => item.providerId === provider.id)) {
          get().showToast("Redan i kundvagnen");
          return;
        }
        set({
          cart: [...cart, { id: uid(), serviceId: provider.serviceId, providerId: provider.id }],
        });
        get().showToast("Tillagd i kundvagnen");
      },
      removeFromCart: (id) => set({ cart: get().cart.filter((item) => item.id !== id) }),
      checkoutCart: () => {
        const { cart, bookings } = get();
        if (!cart.length) return;
        const created: Booking[] = cart.map((item) => {
          const provider = providers.find((entry) => entry.id === item.providerId);
          return {
            id: uid(),
            serviceId: item.serviceId,
            providerId: item.providerId,
            whenLabel: "Så snart som möjligt",
            cost: provider?.price ?? 0,
            holdKr: provider?.price ?? 0,
            tip: null,
            location: provider?.area ?? "Stockholm",
            rating: null,
            status: "requested",
          };
        });
        set({ cart: [], bookings: [...created, ...bookings], sheet: "request", activeBookingId: created[0]?.id ?? null, screen: "history" });
        get().showToast("Förfrågningar skickade. Minimibeloppen är reserverade, inget dras om arbetet inte utförs.");
        for (const item of created) {
          const provider = providerById(item.providerId);
          get().pushNotification({
            kind: "booking_requested",
            title: "Förfrågan skickad",
            body: `Väntar på svar från ${provider?.name ?? "utföraren"}.`,
            bookingId: item.id,
          });
        }
        window.setTimeout(() => {
          const ids = new Set(created.map((item) => item.id));
          const still = get().bookings.filter((item) => ids.has(item.id) && item.status === "requested");
          if (!still.length) return;
          set({
            bookings: get().bookings.map((item) => (ids.has(item.id) && item.status === "requested" ? { ...item, status: "accepted" } : item)),
          });
          const nextChats = { ...get().chats };
          for (const item of still) {
            const provider = providerById(item.providerId);
            if (provider && !(nextChats[item.providerId]?.length)) {
              nextChats[item.providerId] = localThreadSeed(item.providerId, item);
            }
            get().pushNotification({
              kind: "booking_accepted",
              title: "Bokning accepterad",
              body: `${provider?.name ?? "Utföraren"} har accepterat din bokning.`,
              bookingId: item.id,
            });
          }
          set({ chats: nextChats });
          get().showToast("Utförarna har accepterat. Se Meddelanden.");
        }, 2400);
      },
      openChat: () => {
        const providerId = get().providerId;
        if (!providerId) return;
        get().openThread(providerId);
      },
      sendChat: (text) => {
        const providerId = get().providerId;
        const trimmed = text.trim();
        if (!providerId || !trimmed) return;
        void (async () => {
          let conversationId = get().conversationByProvider[providerId];
          const threadKey = get().providerId || providerId;
          const optimistic: ChatMsg = { id: uid(), from: "me", text: trimmed, time: clock() };
          // Always keep the message locally so Meddelanden stays populated on Pages.
          const prev = get().chats[threadKey] ?? [];
          set({ chats: { ...get().chats, [threadKey]: [...prev, optimistic] } });

          if (!conversationId) {
            const marketplace = providerById(providerId);
            const peerMeta = get().peers[providerId];
            const opened = await openConversation(
              marketplace
                ? { providerId }
                : { accountId: peerMeta?.id || providerId },
            );
            if (!opened) {
              // Offline / static host — local message already saved.
              return;
            }
            conversationId = opened.conversationId;
            const remoteKey = opened.threadKey || providerId;
            set({
              providerId: remoteKey,
              conversationByProvider: {
                ...get().conversationByProvider,
                [remoteKey]: conversationId,
              },
              peers: {
                ...get().peers,
                [remoteKey]: {
                  id: opened.peer.id,
                  name: opened.peer.name,
                  providerId: opened.peer.providerId,
                },
              },
            });
          }
          const { sendMessageRemote } = await import("@/lib/velio/auth-api");
          const saved = await sendMessageRemote(conversationId, trimmed);
          if (!saved) return;
          const key = get().providerId || providerId;
          const current = get().chats[key] ?? [];
          set({
            chats: {
              ...get().chats,
              [key]: current.map((message) =>
                message.id === optimistic.id ? chatDtoToMsg({ ...saved, from: "me" }) : message,
              ),
            },
          });
        })();
      },
      appendChat: (providerId, message) => {
        const prev = get().chats[providerId] ?? [];
        set({ chats: { ...get().chats, [providerId]: [...prev, message] } });
      },
      answerRebook: (providerId, messageId, status) => {
        const prev = get().chats[providerId] ?? [];
        set({
          chats: {
            ...get().chats,
            [providerId]: prev.map((message) =>
              message.id === messageId && message.card?.kind === "rebook" ? { ...message, card: { ...message.card, status } } : message,
            ),
          },
        });
      },
      answerTakeRequest: (peerKey, messageId, status) => {
        const prev = get().chats[peerKey] ?? [];
        set({
          chats: {
            ...get().chats,
            [peerKey]: prev.map((message) =>
              message.id === messageId && message.card?.kind === "request"
                ? { ...message, card: { ...message.card, status } }
                : message,
            ),
          },
        });
        void (async () => {
          const conversationId = get().conversationByProvider[peerKey];
          if (!conversationId) return;
          const note =
            status === "accepted"
              ? "Jag godkänner — du får ta uppdraget."
              : "Tack, men jag tar en annan utförare den här gången.";
          const { sendMessageRemote } = await import("@/lib/velio/auth-api");
          const saved = await sendMessageRemote(conversationId, note);
          if (saved) {
            const next = resolveTakeRequestStatuses([
              ...(get().chats[peerKey] ?? []),
              chatDtoToMsg({ ...saved, from: "me" }),
            ]);
            set({
              chats: {
                ...get().chats,
                [peerKey]: next,
              },
            });
          }
          get().showToast(status === "accepted" ? "Utföraren får ta uppdraget" : "Förfrågan avböjd");
        })();
      },
      takePostedJob: (job) => {
        const ownerId = job.ownerId;
        if (!ownerId) {
          get().showToast("Kunde inte hitta kunden");
          return;
        }
        void (async () => {
          const opened = await openConversation({ accountId: ownerId });
          if (!opened) {
            get().showToast("Kunde inte öppna chatten");
            return;
          }
          const threadKey = opened.threadKey || ownerId;
          const serviceName = serviceById(job.serviceId)?.name ?? "Uppdrag";
          const card: ChatCard = {
            kind: "request",
            service: serviceName,
            when: job.when,
            place: job.address,
            price: job.price || 0,
            intent: "take",
            status: "pending",
            about: job.text,
          };
          const { sendMessageRemote } = await import("@/lib/velio/auth-api");
          const saved = await sendMessageRemote(opened.conversationId, "Bokningsförfrågan", card);
          const messages = await fetchMessages(opened.conversationId);
          let mapped = mapSyncedMessages(messages);
          if (saved && !mapped.some((message) => message.id === saved.id)) {
            mapped = resolveTakeRequestStatuses([...mapped, chatDtoToMsg({ ...saved, from: "me" })]);
          }
          set({
            providerId: threadKey,
            sheet: "chat",
            conversationByProvider: {
              ...get().conversationByProvider,
              [threadKey]: opened.conversationId,
            },
            peers: {
              ...get().peers,
              [threadKey]: {
                id: opened.peer.id,
                name: opened.peer.name,
                providerId: opened.peer.providerId,
              },
            },
            chats: {
              ...get().chats,
              [threadKey]: mapped,
            },
          });
          get().showToast("Förfrågan skickad till kunden");
        })();
      },
      confirmBook: (whenLabel) => {
        const provider = providerById(get().providerId);
        if (!provider) return;
        const booking: Booking = {
          id: uid(),
          serviceId: provider.serviceId,
          providerId: provider.id,
          whenLabel,
          cost: provider.price,
          holdKr: provider.price,
          tip: null,
          location: get().userLocation?.label || provider.area,
          rating: null,
          status: "requested",
        };
        set({
          bookings: [booking, ...get().bookings],
          activeBookingId: booking.id,
          sheet: "request",
        });
        get().showToast(`${kr(provider.price)} reserverat. Inget dras om arbetet inte utförs.`);
        get().pushNotification({
          kind: "booking_requested",
          title: "Förfrågan skickad",
          body: `Väntar på att ${provider.name.split(" ")[0]} accepterar.`,
          bookingId: booking.id,
        });
        const first = provider.name.split(" ")[0];
        window.setTimeout(() => {
          const current = get().bookings.find((item) => item.id === booking.id);
          if (!current || current.status !== "requested") return;
          const accepted = { ...current, status: "accepted" as const };
          set({
            bookings: get().bookings.map((item) => (item.id === booking.id ? accepted : item)),
            chats: {
              ...get().chats,
              [provider.id]: get().chats[provider.id]?.length
                ? get().chats[provider.id]
                : localThreadSeed(provider.id, accepted),
            },
          });
          get().pushNotification({
            kind: "booking_accepted",
            title: "Bokning accepterad",
            body: `${first} har accepterat din bokning. Nu kan ni chatta.`,
            bookingId: booking.id,
          });
          get().showToast(`${first} har accepterat. Öppna Meddelanden för att chatta.`);
        }, 2400);
      },
      openReceipt: (id) => set({ receiptId: id, sheet: "receipt" }),
      rebook: (bookingId) => {
        const booking = get().bookings.find((item) => item.id === bookingId);
        if (!booking) return;
        set({
          providerId: booking.providerId,
          serviceId: booking.serviceId,
          sheet: "book",
        });
      },
      cancelActive: () => {
        const id = get().activeBookingId;
        const booking = get().bookings.find((item) => item.id === id);
        const held = booking?.status === "requested" || booking?.status === "accepted";
        set({
          activeBookingId: null,
          sheet: null,
          bookings: get().bookings.filter((item) => item.id !== id),
        });
        get().showToast(held ? "Avbrutet. Inget har dragits — reservationen släpptes direkt." : "Uppdraget är avbokat");
      },
      cancelBooking: (id) => {
        set({
          bookings: get().bookings.filter((item) => item.id !== id),
          activeBookingId: get().activeBookingId === id ? null : get().activeBookingId,
        });
        get().showToast("Avbokat. Inget har dragits.");
      },
      completeActive: (rating, tip) => {
        const id = get().activeBookingId;
        set({
          activeBookingId: null,
          sheet: "receipt",
          receiptId: id,
          bookings: get().bookings.map((booking) =>
            booking.id === id ? { ...booking, status: "done", rating, tip } : booking,
          ),
        });
        if (id) {
          get().pushNotification({
            kind: "booking_done",
            title: "Uppdrag klart",
            body: "Bokningen är markerad som klar.",
            bookingId: id,
          });
        }
        get().showToast("Tack för betyget");
      },
      submitReview: (rating, tip) => {
        const providerId = get().providerId;
        const target =
          get().bookings.find((item) => item.providerId === providerId && item.status !== "done") ??
          get().bookings.find((item) => item.id === "b-erik");
        set({
          sheet: "chat",
          activeBookingId: null,
          bookings: target
            ? get().bookings.map((item) => (item.id === target.id ? { ...item, status: "done", rating, tip } : item))
            : get().bookings,
        });
        get().showToast(tip > 0 ? `Tack! ${kr(tip)} i dricks är skickat.` : "Tack för betyget");
      },
      finishOnboard: (listing) => {
        if (!get().idVerified) {
          set({ listing });
          get().go("verify-id");
          get().showToast("Verifiera dig med BankID eller pass först");
          return;
        }
        const profile = get().profile;
        const id = get().accountId ? `biz-${get().accountId}` : `biz-${uid()}`;
        const previous = get().directory.find((item) => item.id === id);
        const serviceIds = listing.serviceIds ?? (listing.serviceId ? [listing.serviceId] : []);
        const where = areaSummary(listing.areas);
        const published = listingToProvider({
          id,
          name: profile.name || "Mitt företag",
          serviceId: serviceIds[0] ?? listing.serviceId,
          serviceIds,
          otherTrade: listing.otherTrade,
          title: listing.title,
          desc: listing.desc,
          price: listing.price,
          area: where.area,
          place: where.place,
          experience: listing.experience,
          photo: profile.avatar || previous?.photo,
          photos: listing.photos,
          offers: listing.offers,
          includes: listing.includes,
          qualifications: listing.qualifications,
          extras: listing.extras,
          areas: listing.areas,
        });
        published.rating = previous?.rating ?? published.rating;
        published.reviews = previous?.reviews ?? published.reviews;
        const directory = [...get().directory.filter((item) => item.id !== id), published];
        syncDirectory(directory);
        set({
          listing,
          directory,
          accountMode: "business",
          idVerified: true,
          sheet: null,
          screen: "business",
          providerId: id,
        });
        void import("@/lib/velio/local-auth").then(({ isStaticHost, localSetAccountMode }) => {
          if (isStaticHost()) localSetAccountMode("business");
        });
        void updateProfileRemote({ accountMode: "business" }).then((saved) => {
          if (saved) set({ accountMode: saved.accountMode, idVerified: Boolean(saved.idVerified) || true });
        });
        get().showToast("Din profil är publicerad. Öppna den under Profil → VELIO Business.");
      },
      saveBusinessForm: (businessForm) => {
        set({ businessForm });
      },
      setAccountMode: (accountMode) => {
        const own = ownBusiness({ accountId: get().accountId, directory: get().directory, loggedIn: true });
        const ownsListing = Boolean(own);
        if (accountMode === "business" && !get().idVerified && !ownsListing) {
          get().go("verify-id");
          get().showToast("BankID eller pass krävs för VELIO Business");
          return;
        }
        set({
          accountMode,
          ...(accountMode === "business" && own
            ? {
                idVerified: true,
                providerId: own.id,
                listing: get().listing ?? {
                  serviceId: own.serviceId,
                  serviceIds: own.serviceIds,
                  otherTrade: own.otherTrade,
                  title: own.title,
                  desc: own.about,
                  price: own.price,
                  experience: own.experience,
                  photos: own.photos,
                  offers: own.offers,
                  includes: own.includes,
                  qualifications: own.qualifications,
                  extras: own.extras,
                  areas: own.areas,
                },
              }
            : {}),
        });
        void import("@/lib/velio/local-auth").then(({ isStaticHost, localSetAccountMode }) => {
          if (isStaticHost()) localSetAccountMode(accountMode);
        });
        void updateProfileRemote({ accountMode }).then((saved) => {
          if (saved && !ownsListing) {
            set({
              accountMode: saved.accountMode,
              idVerified: Boolean(saved.idVerified),
              idMethod: saved.idMethod ?? null,
            });
          }
        });
      },
      addPosted: (job) => {
        const local: PostedJob = {
          id: `job-${uid()}`,
          ownerId: get().accountId ?? undefined,
          ownerName: get().profile.name || undefined,
          ...job,
        };
        void (async () => {
          const jobs = await createJobRemote(job);
          if (jobs.length) set({ posted: jobsToPosted(jobs) });
          else set({ posted: [local, ...get().posted.filter((item) => item.id !== local.id)] });
          get().showToast("Uppdraget är publicerat");
        })();
      },
    }),
    {
      name: "velio-v6",
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
      partialize: (state) => ({
        loginIntro: state.loginIntro,
        locationOn: state.locationOn,
        userLocation: state.userLocation,
        notifications: state.notifications,
        chats: state.chats,
        peers: state.peers,
        conversationByProvider: state.conversationByProvider,
        appNotifications: state.appNotifications,
        bookings: state.bookings,
        posted: state.posted,
        directory: state.directory,
        listing: state.listing,
        profile: state.profile,
        cards: state.cards,
        accountMode: state.accountMode,
        idVerified: state.idVerified,
        idMethod: state.idMethod,
        screen: state.screen,
        navStack: state.navStack,
        sheet: state.sheet,
        serviceId: state.serviceId,
        providerId: state.providerId,
        receiptId: state.receiptId,
        activeBookingId: state.activeBookingId,
        mapMode: state.mapMode,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<VelioState>;
        const serviceId = saved.serviceId ?? null;
        const providerId = saved.providerId ?? null;
        let screen = isScreen(saved.screen) ? saved.screen : current.screen;
        if (screen === "service" && !serviceId) screen = "home";
        let sheet = isSheet(saved.sheet) ? saved.sheet : null;
        if ((sheet === "provider" || sheet === "chat" || sheet === "book" || sheet === "pay" || sheet === "rate") && !providerId) {
          sheet = null;
        }
        const navStack = Array.isArray(saved.navStack) ? saved.navStack.filter(isScreen) : [];
        const notificationsAllowed = typeof Notification !== "undefined" && Notification.permission === "granted";
        const chats = { ...(saved.chats ?? {}) };
        const appNotifications = saved.appNotifications ?? [];
        const bookings = saved.bookings ?? [];
        const directory = saved.directory ?? [];
        syncDirectory(directory);
        const profile = saved.profile
          ? { ...saved.profile, name: publicDisplayName(saved.profile.name), email: contactEmail(saved.profile.email) }
          : current.profile;
        return {
          ...current,
          ...saved,
          screen,
          navStack,
          sheet,
          serviceId,
          providerId,
          mapMode: screen === "service" ? Boolean(saved.mapMode) : false,
          profile,
          chats,
          peers: { ...(saved.peers ?? {}) },
          conversationByProvider: {
            ...(saved.conversationByProvider ?? {}),
          },
          appNotifications,
          bookings,
          posted: saved.posted ?? [],
          directory,
          cart: [],
          notifications: saved.notifications === true && notificationsAllowed,
        };
      },
    },
  ),
);

export function bookingStatusLabel(status: Booking["status"]) {
  if (status === "done") return "Klar";
  if (status === "enroute") return "På väg";
  if (status === "requested") return "Väntar";
  if (status === "accepted") return "Accepterad";
  if (status === "declined") return "Nekad";
  return "Planerad";
}

export function useActiveBooking() {
  return useVelio((state) => state.bookings.find((booking) => booking.id === state.activeBookingId) ?? null);
}
