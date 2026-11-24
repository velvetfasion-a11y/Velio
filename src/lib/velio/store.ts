import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  kr,
  providerById,
  providers,
  serviceById,
  type ServiceId,
  type Slot,
  type SortKey,
} from "@/lib/velio/data";
import {
  createJobRemote,
  fetchMe,
  fetchMessages,
  loginWithProvider as loginRemote,
  logoutRemote,
  openConversation,
  type AuthProvider,
  type ConversationDto,
  type JobDto,
} from "@/lib/velio/auth-api";
import { chatDtoToMsg, previewMessageText, resolveTakeRequestStatuses } from "@/lib/velio/chat-codec";

function mapSyncedMessages(
  messages: { id: string; from: "me" | "them"; text: string; time?: string }[],
): ChatMsg[] {
  return resolveTakeRequestStatuses(messages.map(chatDtoToMsg));
}

export type Screen =
  | "home"
  | "search"
  | "inbox"
  | "service"
  | "history"
  | "profile"
  | "edit"
  | "payments"
  | "bookings"
  | "posted"
  | "business"
  | "settings"
  | "help";

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
  status: "done" | "enroute" | "scheduled" | "requested" | "accepted";
  holdKr?: number;
};

export type Listing = { serviceId: ServiceId; desc: string; price: number };

export type BusinessForm = {
  serviceId: ServiceId | "";
  title: string;
  desc: string;
  level: string;
  certs: string[];
  photos: string[];
  offers: { id: string; name: string; hours: string; price: number; on: boolean }[];
  includes: { text: string; on: boolean }[];
  extras: { name: string; price: number }[];
  areaMode: "radius" | "areas" | "city";
  km: number;
  days: number[];
  from: string;
  to: string;
  offs: string[];
  notice: string;
  payout: boolean;
  terms: boolean;
};

export type Profile = { name: string; phone: string; email: string };

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

const seedBookings: Booking[] = [
  {
    id: "b1",
    serviceId: "stad",
    providerId: "st-sofia",
    whenLabel: "17 nov 2026, 14:30–15:45",
    cost: 650,
    tip: 50,
    location: "Södermalm",
    rating: 4.8,
    status: "done",
  },
  {
    id: "b2",
    serviceId: "el",
    providerId: "el-erik",
    whenLabel: "15 nov 2026, 09:15–10:30",
    cost: 890,
    tip: 0,
    location: "Östermalm",
    rating: 4.9,
    status: "done",
  },
  {
    id: "b3",
    serviceId: "trad",
    providerId: "tr-johan",
    whenLabel: "10 nov 2026, 11:00–12:30",
    cost: 720,
    tip: 50,
    location: "Vasastan",
    rating: 5,
    status: "done",
  },
  {
    id: "b4",
    serviceId: "rep",
    providerId: "re-lisa",
    whenLabel: "4 nov 2026, 16:45–17:30",
    cost: 540,
    tip: 20,
    location: "Kungsholmen",
    rating: 4.7,
    status: "done",
  },
  {
    id: "b-erik",
    serviceId: "el",
    providerId: "el-erik",
    whenLabel: "Idag 14:00",
    cost: 890,
    tip: null,
    location: "Östermalm",
    rating: null,
    status: "done",
    holdKr: 890,
  },
];

const seedCart: CartItem[] = [
  { id: "c1", serviceId: "el", providerId: "el-erik" },
  { id: "c2", serviceId: "stad", providerId: "st-sofia" },
  { id: "c3", serviceId: "trad", providerId: "tr-johan" },
  { id: "c4", serviceId: "sak", providerId: "sa-karin" },
];

type VelioState = {
  screen: Screen;
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
  notifications: boolean;
  search: string;
  serviceId: ServiceId | null;
  providerId: string | null;
  receiptId: string | null;
  mapMode: boolean;
  sort: SortKey;
  time: Slot | "anytime";
  area: string | null;
  listing: Listing | null;
  businessForm: BusinessForm | null;
  accountMode: "customer" | "business";
  profile: Profile;
  cards: PayCard[];
  cart: CartItem[];
  chats: Record<string, ChatMsg[]>;
  bookings: Booking[];
  posted: PostedJob[];
  activeBookingId: string | null;
  toast: string | null;
  go: (screen: Screen) => void;
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
  loginWithProvider: (provider: AuthProvider) => Promise<void>;
  refreshSync: () => Promise<void>;
  login: () => void;
  logout: () => void;
  allowLocation: () => void;
  setNotifications: (notifications: boolean) => void;
  setProfile: (profile: Profile) => void;
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

export const erikThread: ChatMsg[] = [
  {
    id: "e1",
    from: "system",
    day: "Idag 10:24",
    time: "10:24",
    text: "Bokningsförfrågan",
    card: { kind: "request", service: "Elektriker", when: "Så snart som möjligt", place: "Östermalm", price: 890 },
  },
  {
    id: "e2",
    from: "me",
    time: "10:24",
    text: "Hej Erik! Jag skulle gärna boka en elektriker för att installera ett nytt uttag hemma. Passar det för dig?",
  },
  {
    id: "e3",
    from: "them",
    day: "Idag 10:31",
    time: "10:31",
    text: "När passar det bäst för dig? Jag har en tid idag kl. 14:00 om det fungerar.",
  },
  {
    id: "e4",
    from: "me",
    time: "10:32",
    text: "Ja, kl. 14:00 passar perfekt!",
  },
  {
    id: "e5",
    from: "system",
    time: "10:32",
    text: "Tid bekräftad",
    card: { kind: "confirmed", date: "Idag", time: "14:00", place: "Östermalm" },
  },
  {
    id: "e6",
    from: "them",
    day: "Idag 13:50",
    time: "13:50",
    text: "Jag är på väg nu och beräknas vara hos dig om ca 10 minuter.",
  },
  {
    id: "e7",
    from: "system",
    time: "13:50",
    text: "På väg",
    card: { kind: "enroute", eta: "ca 10 min" },
  },
  {
    id: "e8",
    from: "them",
    day: "Idag 14:58",
    time: "14:58",
    text: "Nu är jobbet klart! 🎉 Jag har installerat det nya uttaget och kontrollerat att allt fungerar som det ska.",
  },
  {
    id: "e9",
    from: "system",
    time: "14:58",
    text: "Jobb slutfört",
    card: { kind: "done", service: "Elektriker", desc: "Installation av nytt uttag", price: 890 },
  },
];

export const useVelio = create<VelioState>()(
  persist(
    (set, get) => ({
      screen: "home",
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
      notifications: true,
      search: "",
      serviceId: null,
      providerId: null,
      receiptId: null,
      mapMode: false,
      sort: "best",
      time: "anytime",
      area: null,
      listing: null,
      businessForm: null,
      accountMode: "customer",
      profile: {
        name: "Anna Karlsson",
        phone: "+46 70 123 45 67",
        email: "anna.karlsson@velio.se",
      },
      cards: [
        { id: "swish", label: "Swish", detail: "070-123 45 67" },
        { id: "visa", label: "Visa · 4242", detail: "Utgår 12/28" },
      ],
      cart: seedCart,
      chats: {
        "st-cleanpro": [
          { id: "c1", from: "me", text: "Hej! Kan du komma idag klockan 14?", time: "14:02" },
          { id: "c2", from: "them", text: "Ja, det passar mig.", time: "14:05" },
        ],
        "el-erik": erikThread,
      },
      bookings: seedBookings,
      posted: [],
      activeBookingId: null,
      toast: null,
      go: (screen) => set({ screen, sheet: null, mapMode: screen === "service" ? get().mapMode : false }),
      openService: (serviceId) =>
        set({
          serviceId,
          screen: "service",
          sheet: null,
          mapMode: false,
          area: null,
          sort: "best",
          time: "anytime",
        }),
      openProvider: (providerId) => set({ providerId, sheet: "provider" }),
      openThread: (peerKey, opts) => {
        set({ providerId: peerKey, sheet: "chat" });
        void (async () => {
          const marketplace = providerById(peerKey);
          const opened = await openConversation(
            opts?.accountId
              ? { accountId: opts.accountId }
              : marketplace
                ? { providerId: peerKey }
                : { accountId: peerKey },
          );
          if (!opened) {
            get().showToast("Kunde inte öppna chatten");
            return;
          }
          const threadKey = opened.threadKey || peerKey;
          const messages = await fetchMessages(opened.conversationId);
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
              [threadKey]: mapSyncedMessages(messages),
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
        if (toastTimer) clearTimeout(toastTimer);
        set({ toast });
        toastTimer = setTimeout(() => set({ toast: null }), 2600);
      },
      bootstrapAuth: async () => {
        try {
          const me = await fetchMe();
          if (!me.authenticated) {
            set({
              authReady: true,
              authError: null,
              loggedIn: false,
              accountId: null,
              authProvider: null,
            });
            return;
          }
          const mapped = applyConversations(me.conversations, get().chats, get().peers);
          set({
            authReady: true,
            authError: null,
            loggedIn: true,
            accountId: me.account.id,
            authProvider: me.account.provider,
            profile: {
              name: me.account.name,
              phone: me.account.phone,
              email: me.account.email,
            },
            accountMode: me.account.accountMode,
            posted: jobsToPosted(me.jobs),
            conversationByProvider: mapped.conversationByProvider,
            chats: mapped.chats,
            peers: mapped.peers,
          });
        } catch {
          set({
            authReady: true,
            authError: "Kunde inte nå inloggningen just nu.",
            loggedIn: false,
          });
        }
      },
      loginWithProvider: async (provider) => {
        const me = await loginRemote(provider);
        if (!me.authenticated) {
          set({
            authError: "Inloggningen kunde inte slutföras. Försök igen.",
            loggedIn: false,
          });
          return;
        }
        const mapped = applyConversations(me.conversations, {}, {});
        set({
          authError: null,
          loggedIn: true,
          loginIntro: true,
          sheet: null,
          screen: "home",
          accountId: me.account.id,
          authProvider: me.account.provider,
          profile: {
            name: me.account.name,
            phone: me.account.phone,
            email: me.account.email,
          },
          accountMode: me.account.accountMode,
          posted: jobsToPosted(me.jobs),
          conversationByProvider: mapped.conversationByProvider,
          chats: mapped.chats,
          peers: mapped.peers,
        });
        get().showToast(`Inloggad som ${me.account.name}`);
      },
      refreshSync: async () => {
        if (!get().loggedIn) return;
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
          posted: jobsToPosted(me.jobs),
          conversationByProvider: mapped.conversationByProvider,
          chats: nextChats,
          peers: mapped.peers,
          profile: {
            name: me.account.name,
            phone: me.account.phone || get().profile.phone,
            email: me.account.email,
          },
          accountMode: me.account.accountMode,
        });
      },
      login: () => {
        void get().loginWithProvider("bankid");
      },
      logout: () => {
        void logoutRemote();
        set({
          loggedIn: false,
          screen: "home",
          sheet: null,
          accountId: null,
          authProvider: null,
          conversationByProvider: {},
          peers: {},
        });
      },
      allowLocation: () => {
        set({ locationOn: true, sheet: null });
        get().showToast("Plats delad. Visar utförare nära Östermalm.");
      },
      setNotifications: (notifications) => {
        set({ notifications });
      },
      setProfile: (profile) => {
        set({ profile });
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
        window.setTimeout(() => {
          const ids = new Set(created.map((item) => item.id));
          const still = get().bookings.filter((item) => ids.has(item.id) && item.status === "requested");
          if (!still.length) return;
          set({
            bookings: get().bookings.map((item) => (ids.has(item.id) && item.status === "requested" ? { ...item, status: "accepted" } : item)),
          });
          get().showToast("Utförarna har accepterat. Nu kan ni chatta.");
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
          if (!conversationId) {
            const marketplace = providerById(providerId);
            const peerMeta = get().peers[providerId];
            const opened = await openConversation(
              marketplace
                ? { providerId }
                : { accountId: peerMeta?.id || providerId },
            );
            if (!opened) {
              get().showToast("Kunde inte skicka meddelandet");
              return;
            }
            conversationId = opened.conversationId;
            const threadKey = opened.threadKey || providerId;
            set({
              providerId: threadKey,
              conversationByProvider: {
                ...get().conversationByProvider,
                [threadKey]: conversationId,
              },
              peers: {
                ...get().peers,
                [threadKey]: {
                  id: opened.peer.id,
                  name: opened.peer.name,
                  providerId: opened.peer.providerId,
                },
              },
            });
          }
          const threadKey = get().providerId || providerId;
          const optimistic: ChatMsg = { id: uid(), from: "me", text: trimmed, time: clock() };
          const prev = get().chats[threadKey] ?? [];
          set({ chats: { ...get().chats, [threadKey]: [...prev, optimistic] } });
          const { sendMessageRemote } = await import("@/lib/velio/auth-api");
          const saved = await sendMessageRemote(conversationId, trimmed);
          if (!saved) {
            get().showToast("Meddelandet synkades inte");
            return;
          }
          const current = get().chats[threadKey] ?? [];
          set({
            chats: {
              ...get().chats,
              [threadKey]: current.map((message) =>
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
          location: get().locationOn ? "Östermalm" : provider.area,
          rating: null,
          status: "requested",
        };
        set({
          bookings: [booking, ...get().bookings],
          activeBookingId: booking.id,
          sheet: "request",
        });
        get().showToast(`${kr(provider.price)} reserverat. Inget dras om arbetet inte utförs.`);
        const first = provider.name.split(" ")[0];
        window.setTimeout(() => {
          const current = get().bookings.find((item) => item.id === booking.id);
          if (!current || current.status !== "requested") return;
          set({
            bookings: get().bookings.map((item) => (item.id === booking.id ? { ...item, status: "accepted" } : item)),
          });
          void get().openThread(provider.id);
          get().showToast(`${first} har accepterat. Nu kan ni chatta.`);
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
        set({ listing, accountMode: "business", sheet: null, screen: "business" });
        get().showToast("Profil skickad. Granskas inom 24 timmar.");
      },
      saveBusinessForm: (businessForm) => {
        set({ businessForm });
      },
      setAccountMode: (accountMode) => {
        set({ accountMode });
      },
      addPosted: (job) => {
        void (async () => {
          const jobs = await createJobRemote(job);
          set({ posted: jobsToPosted(jobs) });
          get().showToast("Uppdraget är publicerat");
        })();
      },
    }),
    {
      name: "velio",
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
      partialize: (state) => ({
        loginIntro: state.loginIntro,
        locationOn: state.locationOn,
        notifications: state.notifications,
        listing: state.listing,
        businessForm: state.businessForm,
        accountMode: state.accountMode,
        profile: state.profile,
        cards: state.cards,
        cart: state.cart,
        chats: state.chats,
        bookings: state.bookings,
        posted: state.posted,
        activeBookingId: state.activeBookingId,
      }),
    },
  ),
);

export function bookingStatusLabel(status: Booking["status"]) {
  if (status === "done") return "Klar";
  if (status === "enroute") return "På väg";
  if (status === "requested") return "Väntar";
  if (status === "accepted") return "Accepterad";
  return "Planerad";
}

export function useActiveBooking() {
  return useVelio((state) => state.bookings.find((booking) => booking.id === state.activeBookingId) ?? null);
}
