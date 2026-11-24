import { useEffect, useRef } from "react";
import { Home, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVelio, erikThread, type Screen } from "@/lib/velio/store";
import { Home as HomeScreen, HomeSheets, InboxScreen, SearchScreen } from "@/components/velio/home";
import { HistoryScreen } from "@/components/velio/history";
import { ServiceScreen } from "@/components/velio/service";
import { OnboardSheet, ProfileScreens } from "@/components/velio/profile";
import { LoginScreen } from "@/components/velio/login";
import { AppHeader } from "@/components/velio/header";
import { BusinessHome } from "@/components/velio/business-home";
import {
  BankIdSheet,
  BookSheet,
  CartSheet,
  ChatSheet,
  LocationSheet,
  PaySheet,
  ProviderSheet,
  RateSheet,
  ReceiptSheet,
  RequestSheet,
  SortSheet,
  TrackSheet,
} from "@/components/velio/flows";
import { Toast } from "@/components/velio/ui";

const profileScreens: Screen[] = ["profile", "edit", "payments", "bookings", "posted", "business", "settings", "help"];

export function VelioApp() {
  const screen = useVelio((state) => state.screen);
  const sheet = useVelio((state) => state.sheet);
  const go = useVelio((state) => state.go);
  const accountMode = useVelio((state) => state.accountMode);
  const mapMode = useVelio((state) => state.mapMode);
  const fullMap = screen === "service" && mapMode;
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [screen]);

  useEffect(() => {
    void Promise.resolve(useVelio.persist.rehydrate()).then(() => {
      const { chats } = useVelio.getState();
      const clean = chats["st-cleanpro"];
      if (!clean?.length || (clean.length === 1 && clean[0]?.text?.includes("Hej Anna"))) {
        useVelio.setState({
          chats: {
            ...chats,
            "st-cleanpro": [
              { id: "c1", from: "me", text: "Hej! Kan du komma idag klockan 14?", time: "14:02" },
              { id: "c2", from: "them", text: "Ja, det passar mig.", time: "14:05" },
            ],
          },
        });
      } else if (!clean[0]?.time) {
        useVelio.setState({
          chats: {
            ...chats,
            "st-cleanpro": clean.map((message, index) => (index === 0 ? { ...message, time: "14:02" } : message)),
          },
        });
      }
      const next = useVelio.getState().chats;
      if (!next["el-erik"]?.some((message) => message.card)) {
        useVelio.setState({ chats: { ...next, "el-erik": erikThread } });
      }
      const bookings = useVelio.getState().bookings;
      if (!bookings.some((item) => item.id === "b-erik" || (item.providerId === "el-erik" && item.whenLabel === "Idag 14:00"))) {
        useVelio.setState({
          bookings: [
            ...bookings,
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
          ],
        });
      }
      if (!useVelio.getState().loginIntro) {
        useVelio.setState({ loggedIn: false, loginIntro: true });
      }
    });
  }, []);

  const nav: { id: Screen; label: string; icon: typeof Home }[] = [
    { id: "home", label: "Hem", icon: Home },
    { id: "inbox", label: "Meddelanden", icon: MessageCircle },
    { id: "profile", label: "Profil", icon: User },
  ];

  const navActive = (id: Screen) => {
    if (id === "home") return screen === "home" || screen === "service";
    if (id === "inbox") return screen === "inbox";
    if (id === "profile") return profileScreens.includes(screen);
    return screen === id;
  };
  const showChrome = screen !== "home" && screen !== "service" && screen !== "history" && screen !== "inbox";
  const unread = useVelio((state) => Object.keys(state.chats).length > 0);
  const loggedIn = useVelio((state) => state.loggedIn);

  return (
    <div className="flex min-h-dvh justify-center bg-stage md:items-center md:p-4">
      <div className="relative flex h-dvh w-full max-w-phone flex-col overflow-hidden bg-cream md:h-[calc(100dvh-2rem)] md:rounded-3xl md:shadow-2xl">
        {loggedIn ? (
          <>
        {showChrome ? <AppHeader /> : null}

        <main
          ref={mainRef}
          className={cn("min-h-0 flex-1", fullMap ? "flex flex-col overflow-hidden" : "overflow-y-auto pb-24")}
        >
          {screen === "home" ? (accountMode === "business" ? <BusinessHome /> : <HomeScreen />) : null}
          {screen === "search" ? <SearchScreen /> : null}
          {screen === "inbox" ? <InboxScreen /> : null}
          {screen === "service" ? <ServiceScreen /> : null}
          {screen === "history" ? <HistoryScreen /> : null}
          {profileScreens.includes(screen) ? <ProfileScreens /> : null}
        </main>

        <nav className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-around border-t border-ink/5 bg-cream px-1 pt-1.5 pb-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = navActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-medium text-muted",
                  active && "bg-sand text-ink",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  {item.id === "inbox" && unread ? (
                    <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-gold" />
                  ) : null}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <Toast />
        {sheet === "provider" ? <ProviderSheet /> : null}
        {sheet === "chat" ? <ChatSheet /> : null}
        {sheet === "book" ? <BookSheet /> : null}
        {sheet === "request" ? <RequestSheet /> : null}
        {sheet === "sort" ? <SortSheet /> : null}
        {sheet === "cart" ? <CartSheet /> : null}
        {sheet === "receipt" ? <ReceiptSheet /> : null}
        {sheet === "track" ? <TrackSheet /> : null}
        {sheet === "pay" ? <PaySheet /> : null}
        {sheet === "rate" ? <RateSheet /> : null}
        {sheet === "location" ? <LocationSheet /> : null}
        {sheet === "bankid" ? <BankIdSheet /> : null}
        {sheet === "onboard" ? <OnboardSheet /> : null}
        <HomeSheets />
          </>
        ) : (
          <LoginScreen />
        )}
      </div>
    </div>
  );
}
