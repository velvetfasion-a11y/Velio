"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Check, ChevronRight } from "lucide-react";
import { createPaymentIntent } from "@/lib/stripe/api";
import { downloadInvoicePdf, saveInvoiceBuyer } from "@/lib/invoices";
import {
  paymentReturnUrl,
  paymentsMode,
  sek,
  showTestBadge,
  stripePublishableKey,
  type CheckoutOrder,
} from "@/lib/stripe/config";

type Method = "apple" | "google" | "card" | "klarna";
type Phase = "form" | "processing" | "failed" | "success";

const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#6B4226",
    colorBackground: "#ffffff",
    colorText: "#1A1A1A",
    colorDanger: "#9B2C2C",
    borderRadius: "12px",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #E6E1DB", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #6B4226", boxShadow: "none" },
    ".Label": { color: "#1A1A1A", fontWeight: "400" },
  },
};

const methodLabel: Record<Method, string> = {
  apple: "Apple Pay",
  google: "Google Pay",
  card: "Kort",
  klarna: "Klarna",
};

export function PaymentSheet({
  open,
  order,
  onClose,
  onPaid,
  initialPhase = "form",
  contained = false,
}: {
  open: boolean;
  order: CheckoutOrder;
  onClose: () => void;
  onPaid?: () => void;
  initialPhase?: Phase;
  contained?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [method, setMethod] = useState<Method>("apple");
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [pdfNote, setPdfNote] = useState("");
  const [drag, setDrag] = useState(0);
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const dragOrigin = useRef<number | null>(null);
  const mode = paymentsMode();
  const live = mode === "test" && order.offerId !== "demo";

  useEffect(() => {
    if (!open) return;
    setPhase(initialPhase);
    setPicker(false);
    setError("");
    setDrag(0);
  }, [open, initialPhase, order.offerId]);

  useEffect(() => {
    if (!open || !live) return;
    let cancelled = false;
    void createPaymentIntent(order.offerId)
      .then((result) => {
        if (!cancelled) {
          setClientSecret(result.clientSecret);
          setPaymentIntentId(result.paymentIntentId);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Betalningen kunde inte startas");
      });
    return () => {
      cancelled = true;
    };
  }, [open, live, order.offerId]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    const root = panelRef.current;
    const focusable = () =>
      Array.from(root?.querySelectorAll<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])") ?? []).filter(
        (node) => !node.hasAttribute("disabled"),
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (picker) setPicker(false);
        else onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, picker, onClose]);

  const onPaidRef = useRef(onPaid);
  const onCloseRef = useRef(onClose);
  onPaidRef.current = onPaid;
  onCloseRef.current = onClose;
  useEffect(() => {
    if (phase !== "success") return;
    onPaidRef.current?.();
  }, [phase]);

  const succeed = () => {
    setPhase("success");
  };

  const payDemo = () => {
    setError("");
    setPhase("processing");
    window.setTimeout(() => succeed(), 650);
  };

  if (!open) return null;

  const detail = [order.jobTitle, order.workerName, order.whenLabel].filter(Boolean).join(" · ");

  return (
    <div className={`${contained ? "absolute" : "fixed"} inset-0 z-[80] flex items-end justify-center md:items-center md:p-8`}>
      <button type="button" aria-label="Stäng" className="absolute inset-0 bg-[#1A1A1A]/40" onClick={onClose} />
      <style>{`
        @keyframes velio-sheet { from { transform: translateY(110%); } to { transform: translateY(0); } }
        @keyframes velio-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes velio-pop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes velio-draw { to { stroke-dashoffset: 0; } }
        .velio-sheet { animation: velio-sheet 0.46s cubic-bezier(0.22, 1.15, 0.36, 1) forwards; }
        .velio-fade { animation: velio-fade 0.28s ease; }
        @media (prefers-reduced-motion: reduce) {
          .velio-sheet, .velio-fade, .velio-pop { animation: none !important; }
        }
      `}</style>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="velio-sheet relative w-full max-w-[420px] rounded-t-[24px] bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(26,26,26,0.12)] md:rounded-[24px]"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined }}
      >
        <div
          className="flex justify-center pt-2.5 pb-1"
          onPointerDown={(event) => {
            dragOrigin.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragOrigin.current == null) return;
            setDrag(Math.max(0, event.clientY - dragOrigin.current));
          }}
          onPointerUp={() => {
            if (drag > 72) onClose();
            setDrag(0);
            dragOrigin.current = null;
          }}
        >
          <span className="h-1 w-9 rounded-full bg-[#E4DDD6]" />
        </div>

        {phase === "success" ? (
          <Success
            order={order}
            companyName={companyName}
            orgNr={orgNr}
            note={pdfNote}
            onPdf={() => {
              if (!paymentIntentId) {
                setPdfNote("PDF:en skapas när en betalning är registrerad.");
                return;
              }
              void downloadInvoicePdf(paymentIntentId, "faktura.pdf").catch((reason: unknown) => {
                setPdfNote(reason instanceof Error ? reason.message : "Fakturan kunde inte hämtas");
              });
            }}
            onClose={onClose}
          />
        ) : phase === "processing" ? (
          <p className="px-6 py-16 text-center text-[15px] text-[#6E6560]">Betalningen behandlas</p>
        ) : picker ? (
          <MethodPicker
            method={method}
            total={order.priceSek}
            live={live && Boolean(clientSecret)}
            clientSecret={clientSecret}
            onSelect={(next) => {
              setMethod(next);
              if (next === "apple" || next === "google") setPicker(false);
            }}
            onBack={() => setPicker(false)}
            onPaid={succeed}
            onFail={(message) => {
              setError(message);
              setPhase("failed");
              setPicker(false);
            }}
          />
        ) : (
          <div className="px-6 pt-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <p id={titleId} className="text-[44px] leading-none font-semibold tracking-[-0.03em] text-[#1A1A1A]">
                {sek(order.priceSek)}
              </p>
              {showTestBadge() ? <span className="mt-2 text-[10px] tracking-wide text-[#A39890]">Testläge</span> : null}
            </div>
            <p className="mt-3 text-[15px] text-[#5C534C]">{detail}</p>
            <p className="mt-1 text-[12px] text-[#8A8178]">Serviceavgift VELIO läggs till. Moms står på fakturan.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                onBlur={() => void saveInvoiceBuyer(order.offerId, { companyName, orgNr }).catch(() => undefined)}
                placeholder="Företag, valfritt"
                aria-label="Företagsnamn"
                className="h-11 rounded-xl border border-[#E6E1DB] px-3 text-[14px] outline-none"
              />
              <input
                value={orgNr}
                onChange={(event) => setOrgNr(event.target.value)}
                onBlur={() => void saveInvoiceBuyer(order.offerId, { companyName, orgNr }).catch(() => undefined)}
                placeholder="Org.nr"
                aria-label="Organisationsnummer"
                className="h-11 rounded-xl border border-[#E6E1DB] px-3 text-[14px] outline-none"
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {live && clientSecret ? (
                <div className="col-span-2">
                  <LiveWallets clientSecret={clientSecret} onPaid={succeed} onFail={setError} />
                </div>
              ) : (
                <>
                  <WalletButton brand="apple" onClick={payDemo} />
                  <WalletButton brand="google" onClick={payDemo} />
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPicker(true)}
              className="mt-4 flex w-full items-center gap-3 border-t border-[#EFEBE6] py-4 text-left active:scale-[0.99]"
            >
              <MethodMark method={method} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-[#8A8178]">Betalningssätt</span>
                <span className="block text-[15px] text-[#1A1A1A]">{methodLabel[method]}</span>
              </span>
              <ChevronRight className="size-4 text-[#A39890]" />
            </button>
            {method === "card" || method === "klarna" ? (
              <button
                type="button"
                onClick={payDemo}
                className="h-[52px] w-full rounded-[14px] bg-[#6B4226] text-[16px] font-semibold text-white active:scale-[0.98]"
              >
                Betala {sek(order.priceSek)}
              </button>
            ) : null}
            {phase === "failed" || error ? <p className="mt-3 text-[13px] text-[#9B2C2C]">{error || "Betalningen gick inte igenom. Försök igen."}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function MethodPicker({
  method,
  total,
  live,
  clientSecret,
  onSelect,
  onBack,
  onPaid,
  onFail,
}: {
  method: Method;
  total: number;
  live: boolean;
  clientSecret: string;
  onSelect: (method: Method) => void;
  onBack: () => void;
  onPaid: () => void;
  onFail: (message: string) => void;
}) {
  const options: Method[] = ["apple", "google", "card", "klarna"];
  return (
    <div className="px-6 pt-2 pb-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-[15px] text-[#6B4226]">
          Tillbaka
        </button>
        <p className="text-[15px] text-[#1A1A1A]">Betalningssätt</p>
        <span className="w-14" />
      </div>
      <div className="mt-4 overflow-hidden rounded-[16px] border border-[#EFEBE6]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className="flex w-full items-center gap-3 border-t border-[#EFEBE6] px-3 py-3.5 text-left first:border-t-0"
          >
            <MethodMark method={option} />
            <span className="flex-1 text-[15px]">{methodLabel[option]}</span>
            <span className={`size-4 rounded-full border ${method === option ? "border-[#6B4226] bg-[#6B4226]" : "border-[#D5CEC6]"}`} />
          </button>
        ))}
      </div>
      {method === "card" || method === "klarna" ? (
        live && clientSecret ? (
          <LiveCard clientSecret={clientSecret} total={total} onPaid={onPaid} onFail={onFail} />
        ) : (
          <DemoCard method={method} total={total} onPay={onPaid} />
        )
      ) : null}
    </div>
  );
}

function DemoCard({ method, total, onPay }: { method: Method; total: number; onPay: () => void }) {
  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onPay();
      }}
    >
      {method === "card" ? (
        <div className="space-y-3">
          <Field label="Kortnummer" placeholder="1234 1234 1234 1234" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Utgång" placeholder="MM / ÅÅ" />
            <Field label="CVC" placeholder="123" />
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[#6E6560]">Klarna öppnar sin bekräftelse. I testläget stannar du här.</p>
      )}
      <button type="submit" className="mt-4 h-[52px] w-full rounded-[14px] bg-[#6B4226] text-[16px] font-semibold text-white active:scale-[0.98]">
        Betala {sek(total)}
      </button>
    </form>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block text-[13px] text-[#5C534C]">
      {label}
      <input readOnly placeholder={placeholder} className="mt-1 h-12 w-full rounded-xl border border-[#E6E1DB] px-3 text-[16px] text-[#1A1A1A] outline-none" />
    </label>
  );
}

function LiveWallets({ clientSecret, onPaid, onFail }: { clientSecret: string; onPaid: () => void; onFail: (message: string) => void }) {
  const stripePromise = useMemo(() => loadStripe(stripePublishableKey()), []);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance, locale: "sv" }}>
      <WalletForm onPaid={onPaid} onFail={onFail} />
    </Elements>
  );
}

function WalletForm({ onPaid, onFail }: { onPaid: () => void; onFail: (message: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const confirm = async () => {
    if (!stripe || !elements) return;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: paymentReturnUrl() },
      redirect: "if_required",
    });
    if (error) {
      onFail(error.message || "Betalningen gick inte igenom");
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") onPaid();
  };
  return (
    <ExpressCheckoutElement
      onConfirm={() => void confirm()}
      options={{
        buttonHeight: 52,
        layout: { maxColumns: 2, maxRows: 1 },
        paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never" },
      }}
    />
  );
}

function LiveCard({
  clientSecret,
  total,
  onPaid,
  onFail,
}: {
  clientSecret: string;
  total: number;
  onPaid: () => void;
  onFail: (message: string) => void;
}) {
  const stripePromise = useMemo(() => loadStripe(stripePublishableKey()), []);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance, locale: "sv" }}>
      <CardForm total={total} onPaid={onPaid} onFail={onFail} />
    </Elements>
  );
}

function CardForm({ total, onPaid, onFail }: { total: number; onPaid: () => void; onFail: (message: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: paymentReturnUrl() },
      redirect: "if_required",
    });
    if (error) {
      onFail(error.message || "Betalningen gick inte igenom");
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") onPaid();
  };
  return (
    <form className="mt-4" onSubmit={(event) => void submit(event)}>
      <PaymentElement
        options={{
          layout: { type: "accordion", defaultCollapsed: false, spacedAccordionItems: true },
          paymentMethodOrder: ["card", "klarna"],
          wallets: { applePay: "never", googlePay: "never", link: "never" },
        }}
      />
      <button type="submit" disabled={!stripe} className="mt-4 h-[52px] w-full rounded-[14px] bg-[#6B4226] text-[16px] font-semibold text-white active:scale-[0.98] disabled:opacity-60">
        Betala {sek(total)}
      </button>
    </form>
  );
}

function WalletButton({ brand, onClick }: { brand: "apple" | "google"; onClick: () => void }) {
  const apple = brand === "apple";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={apple ? "Apple Pay" : "Google Pay"}
      className={
        apple
          ? "flex h-[52px] items-center justify-center gap-1.5 rounded-[14px] bg-black text-[16px] font-semibold text-white active:scale-[0.98]"
          : "flex h-[52px] items-center justify-center gap-1.5 rounded-[14px] border border-[#E6E1DB] bg-white text-[16px] font-semibold text-[#1A1A1A] active:scale-[0.98]"
      }
    >
      {apple ? <AppleMark /> : <GoogleMark />}
      Pay
    </button>
  );
}

function MethodMark({ method }: { method: Method }) {
  if (method === "apple") {
    return (
      <span className="grid h-7 w-10 place-items-center rounded-md bg-black text-white">
        <AppleMark />
      </span>
    );
  }
  if (method === "google") {
    return (
      <span className="grid h-7 w-10 place-items-center rounded-md border border-[#E6E1DB] bg-white">
        <GoogleMark />
      </span>
    );
  }
  if (method === "klarna") {
    return <span className="grid h-7 w-10 place-items-center rounded-md bg-[#FFB3C7] text-[10px] font-semibold text-[#1A1A1A]">K</span>;
  }
  return <span className="grid h-7 w-10 place-items-center rounded-md bg-[#F6F3EF] text-[10px] text-[#1A1A1A]">VISA</span>;
}

function AppleMark() {
  return (
    <svg viewBox="0 0 14 16" className="h-4 w-3.5" aria-hidden="true">
      <path fill="currentColor" d="M11.2 8.4c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.3-2.5-1.4-1.1-.1-2.1.6-2.6.6s-1.4-.6-2.3-.6c-1.2 0-2.3.7-2.9 1.7-1.2 2.1-.3 5.3.9 7 .6.8 1.3 1.8 2.2 1.7.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6 1.5-.8 2.1-1.7c.7-1 1-1.9 1-2 .1 0-1.9-.7-1.9-2.7zM9.4 3.6c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 .1C7.6 2.1 7.2 3 7.3 3.8c.8.1 1.6-.3 2.1-.8z" />
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

function Success({
  order,
  companyName,
  orgNr,
  note,
  onPdf,
  onClose,
}: {
  order: CheckoutOrder;
  companyName: string;
  orgNr: string;
  note: string;
  onPdf: () => void;
  onClose: () => void;
}) {
  const work = order.priceSek;
  const fee = Math.round(work * 0.1);
  const total = work + fee;
  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-6">
      <span className="velio-pop grid size-16 place-items-center rounded-full bg-[#1A1A1A] text-white">
        <Check className="size-8" strokeWidth={2.4} />
      </span>
      <p className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">Betalt!</p>
      <div className="mt-6 w-full rounded-2xl border border-[#EFEBE6] px-4 py-3">
        <p className="text-[12px] text-[#8A8178]">Kvitto</p>
        <p className="mt-1 text-[15px]">{order.jobTitle}</p>
        <div className="mt-3 flex justify-between text-[14px]">
          <span>{order.workerName}</span>
          <span>{sek(work)}</span>
        </div>
        <div className="mt-1 flex justify-between text-[14px] text-[#5C534C]">
          <span>Serviceavgift VELIO</span>
          <span>{sek(fee)}</span>
        </div>
        <div className="mt-3 flex justify-between border-t border-[#EFEBE6] pt-3 text-[16px] font-semibold">
          <span>Totalt</span>
          <span>{sek(total)}</span>
        </div>
        {companyName || orgNr ? <p className="mt-2 text-[12px] text-[#8A8178]">{[companyName, orgNr].filter(Boolean).join(" · ")}</p> : null}
        <p className="mt-2 text-[12px] text-[#8A8178]">Moms specificeras på fakturan. Saknas uppgifter är den ett utkast.</p>
      </div>
      <button type="button" onClick={onPdf} className="mt-4 h-[52px] w-full rounded-[14px] bg-[#1A1A1A] text-[16px] font-semibold text-white active:scale-[0.98]">
        Ladda ner faktura (PDF)
      </button>
      {note ? <p className="mt-3 text-center text-[13px] text-[#6E6560]">{note}</p> : null}
      <button type="button" onClick={onClose} className="mt-3 h-11 text-[15px] text-[#5C534C]">
        Stäng
      </button>
    </div>
  );
}

export function DemoJob({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [paid, setPaid] = useState(false);
  const [returned, setReturned] = useState<string | null>(null);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("redirect_status");
    setReturned(status);
    if (status === "succeeded") {
      setPaid(true);
      setOpen(true);
    } else if (status === "failed") setOpen(true);
  }, []);
  const order: CheckoutOrder = {
    offerId: "demo",
    jobId: "demo",
    jobTitle: "Hemstäd",
    workerName: "Lind Städ AB",
    whenLabel: "Idag",
    priceSek: 500,
  };
  return (
    <div className="relative flex min-h-dvh justify-center bg-[#E8E2DA] md:items-center md:p-8">
      <div className="relative flex min-h-dvh w-full max-w-[420px] flex-col bg-[#FAF8F5] md:min-h-[760px] md:rounded-[2rem] md:shadow-2xl">
        <p className="pt-8 text-center font-serif text-[1.4rem] tracking-[0.28em]">VELIO</p>
        <div className="px-5 pt-8">
          <p className="text-[13px] text-[#8A8178]">Uppdrag</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em]">Hemstäd</h1>
          <p className="mt-1 text-[15px] text-[#5C534C]">Lind Städ AB · Idag</p>
          <p className="mt-6 text-[40px] leading-none font-semibold tracking-[-0.03em]">500 kr</p>
          {paid ? (
            <p className="mt-6 inline-flex items-center gap-2 text-[15px] text-[#1A1A1A]">
              <Check className="size-4" /> Betald
            </p>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="mt-8 h-[52px] w-full rounded-[14px] bg-[#1A1A1A] text-[16px] font-semibold text-white active:scale-[0.98]">
              Betala
            </button>
          )}
        </div>
        <PaymentSheet
          open={open}
          order={order}
          initialPhase={returned === "succeeded" ? "success" : returned === "failed" ? "failed" : "form"}
          onClose={() => setOpen(false)}
          onPaid={() => setPaid(true)}
        />
      </div>
    </div>
  );
}
