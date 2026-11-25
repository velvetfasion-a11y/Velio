import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Home, MessageCircle, User, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVelio, type Screen } from "@/lib/velio/store";
import { Home as HomeScreen, HomeSheets, InboxScreen, SearchScreen } from "@/components/velio/home";
import { HistoryScreen } from "@/components/velio/history";
import { NotificationsScreen } from "@/components/velio/notifications";
import { ServiceScreen } from "@/components/velio/service";
import { ProfileScreens } from "@/components/velio/profile";
import { BusinessSetup } from "@/components/velio/business-setup";
import { WalletScreen } from "@/components/velio/wallet";
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
import { CheckoutView } from "@/components/velio/checkout";

const profileScreens: Screen[] = ["profile", "edit", "payments", "bookings", "posted", "business", "verify-id", "settings", "help", "favorites", "addresses", "wallet"];

export function VelioApp() {
  const screen = useVelio((state) => state.screen);
  const sheet = useVelio((state) => state.sheet);
  const addressOpen = useVelio((state) => state.addressOpen);
  const go = useVelio((state) => state.go);
  const accountMode = useVelio((state) => state.accountMode);
  const mapMode = useVelio((state) => state.mapMode);
  const fullMap = screen === "service" && mapMode;
  const mainRef = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const bootstrapAuth = useVelio((state) => state.bootstrapAuth);
  const refreshSync = useVelio((state) => state.refreshSync);
  const loggedIn = useVelio((state) => state.loggedIn);

  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [screen]);

  useEffect(() => {
    void Promise.resolve(useVelio.persist.rehydrate())
      .then(async () => {
        useVelio.getState().reconcileNotifications();
        await bootstrapAuth();
      })
      .finally(() => setReady(true));
  }, [bootstrapAuth]);

  useEffect(() => {
    if (!loggedIn) return;
    const timer = window.setInterval(() => {
      void refreshSync();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loggedIn, refreshSync]);

  const nav: { id: Screen; label: string; icon: typeof Home }[] =
    accountMode === "business"
      ? [
          { id: "home", label: "Hem", icon: Home },
          { id: "wallet", label: "Saldo", icon: Wallet },
          { id: "inbox", label: "Meddelanden", icon: MessageCircle },
          { id: "profile", label: "Profil", icon: User },
        ]
      : [
          { id: "home", label: "Hem", icon: Home },
          { id: "inbox", label: "Meddelanden", icon: MessageCircle },
          { id: "profile", label: "Profil", icon: User },
        ];

  const navActive = (id: Screen) => {
    if (id === "home") return screen === "home" || screen === "service";
    if (id === "inbox") return screen === "inbox";
    if (id === "wallet") return screen === "wallet";
    if (id === "profile") return profileScreens.includes(screen) && screen !== "wallet";
    return screen === id;
  };
  const showChrome =
    screen !== "home" &&
    screen !== "service" &&
    screen !== "history" &&
    screen !== "inbox" &&
    screen !== "notifications";
  const unread = useVelio((state) => Object.keys(state.chats).some((key) => (state.chats[key]?.length ?? 0) > 0));

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stage">
        <div className="font-serif text-2xl tracking-[0.28em] text-paper/80">VELIO</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh justify-center bg-stage md:items-center md:p-4">
      <div className="relative flex h-dvh w-full max-w-phone flex-col overflow-hidden bg-cream md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:shadow-2xl">
        {loggedIn ? (
          screen === "checkout" ? (
            <CheckoutView embedded onClose={() => go("posted")} />
          ) : (
          <>
            {showChrome && sheet !== "onboard" && sheet !== "job" ? <AppHeader /> : null}

            <main
              key={screen}
              ref={mainRef}
              className={cn("rise-in min-h-0 flex-1", fullMap ? "flex flex-col overflow-hidden" : "overflow-y-auto pb-28")}
            >
              {screen === "home" ? (accountMode === "business" ? <BusinessHome /> : <HomeScreen />) : null}
              {screen === "search" ? <SearchScreen /> : null}
              {screen === "inbox" ? <InboxScreen /> : null}
              {screen === "notifications" ? <NotificationsScreen /> : null}
              {screen === "service" ? <ServiceScreen /> : null}
              {screen === "history" ? <HistoryScreen /> : null}
              {screen === "wallet" ? <WalletScreen /> : null}
              {screen !== "wallet" && profileScreens.includes(screen) ? <ProfileScreens /> : null}
            </main>

            {sheet ? null : (
            <nav className="glass absolute inset-x-3 bottom-2 z-20 flex items-stretch justify-around rounded-[1.6rem] px-1 py-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = navActive(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item.id)}
                    className={cn(
                      "flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[11px] font-medium text-muted",
                      active && "bg-brown/10 text-brown",
                    )}
                  >
                    <span className="relative">
                      <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />
                      {item.id === "inbox" && unread ? (
                        <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-gold" />
                      ) : null}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>
            )}

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
            {addressOpen ? (
              <div className="absolute inset-0 z-50">
                <LocationSheet />
              </div>
            ) : null}
            {sheet === "bankid" ? <BankIdSheet /> : null}
            {sheet === "onboard" ? <BusinessSetup /> : null}
            <HomeSheets />
          </>
          )
        ) : (
          <LoginScreen />
        )}
      </div>
    </div>
  );
}
