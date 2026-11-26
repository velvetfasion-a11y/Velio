"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { createAccountSession, createConnectAccount } from "@/lib/stripe/api";
import { paymentsMode, showTestBadge, stripePublishableKey } from "@/lib/stripe/config";

export function GetPaidCard() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<React.ReactNode>(null);
  const mode = paymentsMode();

  const start = async () => {
    setError("");
    if (mode !== "test") {
      setOpen(true);
      return;
    }
    try {
      await createConnectAccount();
      const [{ loadConnectAndInitialize }, kit] = await Promise.all([
        import("@stripe/connect-js"),
        import("@stripe/react-connect-js"),
      ]);
      const instance = loadConnectAndInitialize({
        publishableKey: stripePublishableKey(),
        fetchClientSecret: async () => {
          const session = await createAccountSession();
          return session.clientSecret;
        },
        appearance: {
          overlays: "dialog",
          variables: {
            colorPrimary: "#6B4226",
            colorText: "#1A1A1A",
            buttonBorderRadius: "999px",
            fontFamily: "Inter, -apple-system, sans-serif",
          },
        },
      });
      const { ConnectComponentsProvider, ConnectAccountOnboarding } = kit;
      setPanel(
        <ConnectComponentsProvider connectInstance={instance}>
          <ConnectAccountOnboarding onExit={() => setOpen(false)} />
        </ConnectComponentsProvider>,
      );
      setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Utbetalningar kunde inte öppnas");
    }
  };

  return (
    <section className="mt-5 rounded-[1.2rem] border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#6B4226]">FÅ BETALT</p>
          <h3 className="mt-1 text-lg font-semibold">Utbetalning till ditt konto</h3>
        </div>
        {showTestBadge() ? <span className="rounded-full bg-[#F3EEE8] px-2.5 py-1 text-[11px] font-semibold text-[#6B4226]">Testläge</span> : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Du får betalt när jobbet är klart.
      </p>
      <ol className="mt-3 space-y-1 text-sm text-muted">
        <li>1. Koppla kontot</li>
        <li>2. Bekräfta uppgifterna</li>
        <li>3. Ta emot utbetalningar</li>
      </ol>
      <button type="button" onClick={() => void start()} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6B4226] text-sm font-semibold text-white">
        <Wallet className="size-4" />
        Få betalt
      </button>
      {error ? <p className="mt-2 text-sm text-[#9B2C2C]">{error}</p> : null}
      {open && mode !== "test" ? (
        <p className="mt-3 rounded-2xl bg-sand px-3 py-3 text-sm leading-relaxed text-muted">
          Testläge. Kontokopplingen visas här i appen när testnyckeln och betaltjänsten är på plats. Ingen uppgift lämnar den här sidan.
        </p>
      ) : null}
      {open && mode === "test" ? <div className="mt-4">{panel}</div> : null}
    </section>
  );
}
