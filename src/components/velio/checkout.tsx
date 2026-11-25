"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { ArrowLeft, Check } from "lucide-react";
import { useVelio } from "@/lib/velio/store";
import { createPaymentIntent } from "@/lib/stripe/api";
import {
  paymentReturnUrl,
  paymentsMode,
  quoteBreakdown,
  sek,
  showTestBadge,
  stripePublishableKey,
} from "@/lib/stripe/config";

export type CheckoutOrder = {
  offerId: string;
  jobId: string;
  jobTitle: string;
  workerName: string;
  priceSek: number;
};

type Phase = "form" | "processing" | "failed" | "success";

const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#6B4226",
    colorBackground: "#ffffff",
    colorText: "#1A1A1A",
    colorDanger: "#9B2C2C",
    borderRadius: "12px",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, SF Pro Text, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #E7E2DC", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #6B4226", boxShadow: "none" },
    ".Label": { color: "#1A1A1A", fontWeight: "500" },
    ".Tab": { border: "1px solid #E7E2DC", boxShadow: "none" },
    ".Tab--selected": { border: "1px solid #6B4226", color: "#1A1A1A" },
  },
};

const sampleOrder: CheckoutOrder = {
  offerId: "demo",
  jobId: "demo",
  jobTitle: "Hemstäd",
  workerName: "Lind Städ AB",
  priceSek: 1200,
};

function readReturnPhase(): Phase | null {
  if (typeof window === "undefined") return null;
  const status = new URLSearchParams(window.location.search).get("redirect_status");
  if (status === "succeeded") return "success";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  return null;
}

export function CheckoutView({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void }) {
  const draft = useVelio((state) => state.checkout);
  const acceptOffer = useVelio((state) => state.acceptOffer);
  const [phase, setPhase] = useState<Phase>(readReturnPhase() || "form");
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const order = draft ?? sampleOrder;
  const mode = paymentsMode();
  const amounts = quoteBreakdown(order.priceSek);
  const example = !draft;

  useEffect(() => {
    if (mode !== "test" || !draft || draft.offerId === "demo") return;
    let cancelled = false;
    void createPaymentIntent(draft.offerId)
      .then((result) => {
        if (!cancelled) setClientSecret(result.clientSecret);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Betalningen kunde inte startas");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, draft]);

  const finish = (next: Phase) => {
    setPhase(next);
    if (next === "success" && draft && draft.offerId !== "demo") acceptOffer(draft.offerId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-[#1A1A1A]">
      <div className="flex items-center px-4 pt-3">
        {onClose && phase === "form" ? (
          <button type="button" aria-label="Tillbaka" onClick={onClose} className="grid size-10 place-items-center rounded-full">
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <span className="size-10" />
        )}
        <p className="flex-1 text-center font-serif text-[1.35rem] tracking-[0.28em]">VELIO</p>
        <span className="size-10" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {showTestBadge() ? (
          <p className="mx-auto mt-1 w-fit rounded-full bg-[#F3EEE8] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#6B4226]">
            Testläge
          </p>
        ) : null}
        <h1 className="mt-4 text-[1.7rem] font-semibold tracking-tight">{phase === "success" ? "Kvitto" : "Betala"}</h1>
        {phase === "form" ? (
          <>
            <OrderSummary order={order} amounts={amounts} example={example && !embedded} />
            {mode === "test" && clientSecret ? (
              <LivePayment
                clientSecret={clientSecret}
                total={amounts.total}
                onProcessing={() => setPhase("processing")}
                onSuccess={() => finish("success")}
                onFail={(message) => {
                  setError(message);
                  setPhase("failed");
                }}
              />
            ) : (
              <DemoPayment
                total={amounts.total}
                onPay={() => {
                  setPhase("processing");
                  window.setTimeout(() => finish("success"), 700);
                }}
              />
            )}
            {error && mode === "test" && !clientSecret ? <p className="mt-3 text-sm text-[#9B2C2C]">{error}</p> : null}
          </>
        ) : null}
        {phase === "processing" ? <StatusBlock title="Betalningen behandlas" body="Vänta kvar. Du lämnar inte VELIO." /> : null}
        {phase === "failed" ? (
          <StatusBlock title="Betalningen gick inte igenom" body={error || "Inget belopp har dragits. Försök igen."}>
            <button type="button" onClick={() => setPhase("form")} className="mt-4 h-12 w-full rounded-full bg-[#6B4226] text-base font-semibold text-white">
              Försök igen
            </button>
          </StatusBlock>
        ) : null}
        {phase === "success" ? <Receipt order={order} amounts={amounts} demo={mode === "demo"} onClose={onClose} /> : null}
      </div>
    </div>
  );
}

function OrderSummary({
  order,
  amounts,
  example,
}: {
  order: CheckoutOrder;
  amounts: { work: number; fee: number; total: number };
  example: boolean;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-[#E7E2DC] bg-white p-4">
      {example ? <p className="text-xs font-medium text-[#6B4226]">Exempelorder</p> : null}
      <p className="mt-1 text-lg font-semibold">{order.jobTitle}</p>
      <p className="text-sm text-[#5C534C]">{order.workerName}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt>Arbete</dt><dd>{sek(amounts.work)}</dd></div>
        <div className="flex justify-between"><dt>Serviceavgift 10%</dt><dd>{sek(amounts.fee)}</dd></div>
        <div className="flex justify-between border-t border-[#E7E2DC] pt-2 text-base font-semibold">
          <dt>Totalt</dt><dd>{sek(amounts.total)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-[#5C534C]">Avgiften ingår i totalen. Utföraren får 90% när jobbet varit klart i tre timmar.</p>
    </section>
  );
}

function DemoPayment({ total, onPay }: { total: number; onPay: () => void }) {
  const [method, setMethod] = useState<"card" | "klarna">("card");
  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onPay();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <ApplePayButton type="button" onClick={onPay} />
        <GooglePayButton type="button" onClick={onPay} />
      </div>
      <p className="my-4 text-center text-xs text-[#8A817A]">eller betala med</p>
      <div className="overflow-hidden rounded-2xl border border-[#E7E2DC]">
        <MethodTab label="Kort" selected={method === "card"} onClick={() => setMethod("card")} />
        {method === "card" ? (
          <div className="space-y-3 px-3 pb-3">
            <DemoField label="Kortnummer" placeholder="1234 1234 1234 1234" />
            <div className="grid grid-cols-2 gap-2">
              <DemoField label="Utgång" placeholder="MM / ÅÅ" />
              <DemoField label="CVC" placeholder="123" />
            </div>
          </div>
        ) : null}
        <MethodTab label="Klarna" selected={method === "klarna"} onClick={() => setMethod("klarna")} />
        {method === "klarna" ? (
          <p className="px-3 pb-3 text-sm text-[#5C534C]">Klarna öppnar sin egen bekräftelse när en riktig betalning görs. I testläget stannar du här.</p>
        ) : null}
      </div>
      <PayButton total={total} />
    </form>
  );
}

function LivePayment({
  clientSecret,
  total,
  onProcessing,
  onSuccess,
  onFail,
}: {
  clientSecret: string;
  total: number;
  onProcessing: () => void;
  onSuccess: () => void;
  onFail: (message: string) => void;
}) {
  const stripePromise = useMemo(() => loadStripe(stripePublishableKey()), []);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance, locale: "sv" }}>
      <LiveForm total={total} onProcessing={onProcessing} onSuccess={onSuccess} onFail={onFail} />
    </Elements>
  );
}

function LiveForm({
  total,
  onProcessing,
  onSuccess,
  onFail,
}: {
  total: number;
  onProcessing: () => void;
  onSuccess: () => void;
  onFail: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const confirm = async () => {
    if (!stripe || !elements) return;
    onProcessing();
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: paymentReturnUrl() },
      redirect: "if_required",
    });
    if (error) {
      onFail(error.message || "Betalningen gick inte igenom");
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      onSuccess();
      return;
    }
    onFail("Betalningen behöver ett till steg");
  };

  return (
    <form
      className="mt-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <ExpressCheckoutElement
        onConfirm={() => void confirm()}
        options={{
          buttonHeight: 48,
          layout: { maxColumns: 2, maxRows: 1 },
          paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never" },
        }}
      />
      <p className="my-4 text-center text-xs text-[#8A817A]">eller betala med</p>
      <PaymentElement
        options={{
          layout: { type: "accordion", defaultCollapsed: false, spacedAccordionItems: true },
          paymentMethodOrder: ["card", "klarna"],
          wallets: { applePay: "never", googlePay: "never", link: "never" },
        }}
      />
      <PayButton total={total} disabled={!stripe} />
    </form>
  );
}

function PayButton({ total, disabled }: { total: number; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-4 h-14 w-full rounded-full bg-[#6B4226] text-base font-semibold text-white disabled:opacity-60"
    >
      Betala {sek(total)}
    </button>
  );
}

function MethodTab({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex w-full items-center justify-between border-t border-[#E7E2DC] px-3 py-3 text-left text-sm font-semibold first:border-t-0"
    >
      {label}
      <span className={`size-4 rounded-full border ${selected ? "border-[#6B4226] bg-[#6B4226]" : "border-[#C9C1B8]"}`} />
    </button>
  );
}

function DemoField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        readOnly
        value=""
        placeholder={placeholder}
        className="mt-1 h-12 w-full rounded-xl border border-[#E7E2DC] px-3 text-base font-normal outline-none"
      />
    </label>
  );
}

function ApplePayButton({ type, onClick }: { type?: "button" | "submit"; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-black text-[15px] font-medium text-white">
      <AppleMark />
      Pay
    </button>
  );
}

function GooglePayButton({ type, onClick }: { type?: "button" | "submit"; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-[#E7E2DC] bg-white text-[15px] font-medium text-[#1A1A1A]">
      <GoogleMark />
      Pay
    </button>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 14 16" className="h-4 w-3.5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.2 8.4c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.3-2.5-1.4-1.1-.1-2.1.6-2.6.6s-1.4-.6-2.3-.6c-1.2 0-2.3.7-2.9 1.7-1.2 2.1-.3 5.3.9 7 .6.8 1.3 1.8 2.2 1.7.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6 1.5-.8 2.1-1.7c.7-1 1-1.9 1-2 .1 0-1.9-.7-1.9-2.7zM9.4 3.6c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 .1C7.6 2.1 7.2 3 7.3 3.8c.8.1 1.6-.3 2.1-.8z"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M14.4 8.2c0-.5-.1-.9-.2-1.3H8.2v2.5h3.5c-.2.8-.7 1.5-1.4 2v1.6h2.2c1.3-1.2 2-2.9 2-4.8z" />
      <path fill="#34A853" d="M8.2 15c1.8 0 3.3-.6 4.4-1.6l-2.2-1.6c-.6.4-1.3.6-2.2.6-1.7 0-3.2-1.2-3.7-2.7H2.2v1.7A6.8 6.8 0 0 0 8.2 15z" />
      <path fill="#FBBC05" d="M4.5 9.7a4 4 0 0 1 0-2.6V5.4H2.2a6.8 6.8 0 0 0 0 6.1l2.3-1.8z" />
      <path fill="#EA4335" d="M8.2 4.4c1 0 1.8.3 2.5 1l1.9-1.9A6.6 6.6 0 0 0 2.2 5.4l2.3 1.7c.5-1.5 2-2.7 3.7-2.7z" />
    </svg>
  );
}

function StatusBlock({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-[#E7E2DC] p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5C534C]">{body}</p>
      {children}
    </section>
  );
}

function Receipt({
  order,
  amounts,
  demo,
  onClose,
}: {
  order: CheckoutOrder;
  amounts: { work: number; fee: number; total: number };
  demo: boolean;
  onClose?: () => void;
}) {
  const reference = `VELIO-${order.offerId.slice(0, 8).toUpperCase()}`;
  return (
    <section className="mt-4 rounded-2xl border border-[#E7E2DC] p-5">
      <span className="grid size-12 place-items-center rounded-full bg-[#6B4226] text-white">
        <Check className="size-6" />
      </span>
      <h2 className="mt-4 text-2xl font-semibold">Betalt</h2>
      <p className="mt-1 text-sm text-[#5C534C]">{order.jobTitle} · {order.workerName}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt>Arbete</dt><dd>{sek(amounts.work)}</dd></div>
        <div className="flex justify-between"><dt>Serviceavgift 10%</dt><dd>{sek(amounts.fee)}</dd></div>
        <div className="flex justify-between text-base font-semibold"><dt>Totalt</dt><dd>{sek(amounts.total)}</dd></div>
        <div className="flex justify-between"><dt>Referens</dt><dd>{reference}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-[#5C534C]">
        {demo
          ? "Testkvitto. Ingen betalning har dragits."
          : "Kvittot sparas på uppdraget. Utföraren får 90% tre timmar efter att jobbet är klart."}
      </p>
      {onClose ? (
        <button type="button" onClick={onClose} className="mt-4 h-12 w-full rounded-full bg-[#1A1A1A] text-base font-semibold text-white">
          Tillbaka
        </button>
      ) : null}
    </section>
  );
}
