import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useVelio } from "@/lib/velio/store";
import {
  fetchAuthCapabilities,
  startEmailOtp,
  startSmsOtp,
  verifyEmailOtp,
  verifySmsOtp,
} from "@/lib/velio/auth-api";

type Step = "methods" | "email" | "email-code" | "phone" | "phone-code";

export function LoginScreen() {
  const applyMe = useVelio((state) => state.applyMe);
  const authError = useVelio((state) => state.authError);
  const setAuthError = useVelio((state) => state.setAuthError);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("methods");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [sampleCode, setSampleCode] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(true);

  useEffect(() => {
    void fetchAuthCapabilities().then((caps) => setGoogleReady(caps.google));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("authError");
      if (err) {
        setLocalError(err);
        params.delete("authError");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", next);
      }
    }
  }, []);

  const back = () => {
    setLocalError(null);
    setHint(null);
    setSampleCode(null);
    setCode("");
    if (step === "email-code") setStep("email");
    else if (step === "phone-code") setStep("phone");
    else setStep("methods");
  };

  const onGoogle = async () => {
    if (googleReady) {
      window.location.href = "/api/auth/google/start";
      return;
    }
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      const response = await fetch("/api/auth/google/sample", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "demo.google@velio.local", name: "Google Demo" }),
      });
      if (!response.ok) throw new Error("Sample Google-inloggning misslyckades");
      const me = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" }).then((r) => r.json());
      if (!me.authenticated) throw new Error("Kunde inte skapa session");
      applyMe(me);
      setHint("Google OAuth-secrets saknas — inloggad med sample-konto. Lägg till secrets för riktig Google.");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Google misslyckades");
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    if (busy) return;
    if (!email.includes("@")) return setLocalError("Ange en giltig e-postadress");
    setBusy(true);
    setLocalError(null);
    try {
      const result = await startEmailOtp(email.trim(), name.trim() || undefined);
      setChallengeId(result.challengeId);
      setSampleCode(result.sampleCode ?? null);
      setHint(result.message ?? "Kolla din inkorg.");
      setStep("email-code");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Kunde inte skicka kod");
    } finally {
      setBusy(false);
    }
  };

  const confirmEmail = async () => {
    if (busy) return;
    if (code.trim().length < 4) return setLocalError("Ange koden från e-posten");
    setBusy(true);
    setLocalError(null);
    setAuthError(null);
    try {
      const me = await verifyEmailOtp({
        challengeId,
        code: code.trim(),
        name: name.trim() || undefined,
      });
      if (!me.authenticated) throw new Error("Inloggningen misslyckades");
      applyMe(me);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Fel kod");
    } finally {
      setBusy(false);
    }
  };

  const sendSms = async () => {
    if (busy) return;
    if (phone.trim().length < 6) return setLocalError("Ange ett giltigt mobilnummer");
    setBusy(true);
    setLocalError(null);
    try {
      const result = await startSmsOtp(phone.trim(), name.trim() || undefined);
      setChallengeId(result.challengeId);
      setSampleCode(result.sampleCode ?? null);
      setHint(result.message ?? "Kolla ditt SMS.");
      setStep("phone-code");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Kunde inte skicka SMS");
    } finally {
      setBusy(false);
    }
  };

  const confirmSms = async () => {
    if (busy) return;
    if (code.trim().length < 4) return setLocalError("Ange koden från SMS");
    setBusy(true);
    setLocalError(null);
    setAuthError(null);
    try {
      const me = await verifySmsOtp({
        challengeId,
        code: code.trim(),
        name: name.trim() || undefined,
      });
      if (!me.authenticated) throw new Error("Inloggningen misslyckades");
      applyMe(me);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Fel kod");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <div className="pointer-events-none absolute -top-20 -left-16 size-64 rounded-full bg-[#f4eadc] blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 size-72 rounded-full bg-[#efe4d4] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-8 size-48 rounded-full bg-[#f7f1e8] blur-3xl" />

      <div className="relative flex flex-1 flex-col justify-center px-6 pb-8">
        {step !== "methods" ? (
          <button type="button" aria-label="Tillbaka" onClick={back} className="mb-2 grid size-9 place-items-center self-start">
            <ArrowLeft className="size-5 text-[#2a211c]" />
          </button>
        ) : null}

        <p className="text-center font-serif text-[1.55rem] tracking-[0.32em] text-[#2a211c]">VELIO</p>

        {step === "methods" ? (
          <>
            <h1 className="mt-8 text-center font-serif text-[2.7rem] leading-none font-medium text-[#2a211c]">Logga in</h1>
            <p className="mx-auto mt-3 max-w-[17rem] text-center text-sm leading-snug text-[#6e6964]">
              Google, e-post med kod eller mobil med SMS. Business kräver BankID eller pass.
            </p>

            <div className="mt-8 rounded-[1.7rem] border border-white/80 bg-white/45 p-3 shadow-[0_18px_50px_rgba(70,50,20,0.08)] backdrop-blur-xl">
              <div className="space-y-2.5">
                <Method label="Fortsätt med Google" onClick={onGoogle} icon={<GoogleMark />} disabled={busy} />
                <Method label="Fortsätt med e-post" onClick={() => setStep("email")} icon={<MailMark />} disabled={busy} />
                <Method label="Fortsätt med mobilnummer" onClick={() => setStep("phone")} icon={<PhoneMark />} disabled={busy} />
              </div>
            </div>
          </>
        ) : null}

        {step === "email" || step === "email-code" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-[#2a211c]">
              {step === "email" ? "E-post" : "Bekräfta e-post"}
            </h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-[#6e6964]">
              {step === "email"
                ? "Vi skickar en engångskod. Du måste bekräfta innan du loggas in."
                : `Ange koden vi skickade till ${email}.`}
            </p>
            <div className="mt-5 space-y-3">
              {step === "email" ? (
                <>
                  <Field label="Namn (valfritt)" value={name} onChange={setName} placeholder="För- och efternamn" />
                  <Field label="E-post" value={email} onChange={setEmail} placeholder="namn@mail.se" type="email" />
                </>
              ) : (
                <Field label="Verifieringskod" value={code} onChange={setCode} placeholder="6 siffror" />
              )}
            </div>
            {hint ? <p className="mt-3 text-center text-sm text-[#6e6964]">{hint}</p> : null}
            {sampleCode ? (
              <p className="mt-2 rounded-xl bg-[#f6f1ea] px-3 py-2 text-center text-sm text-[#2a211c]">
                Sample-kod (lokalt): <span className="font-semibold tracking-widest">{sampleCode}</span>
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void (step === "email" ? sendEmail() : confirmEmail())}
              className="mt-5 h-12 w-full rounded-full bg-[#6e5636] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Vänta…" : step === "email" ? "Skicka kod" : "Bekräfta och logga in"}
            </button>
          </>
        ) : null}

        {step === "phone" || step === "phone-code" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-[#2a211c]">
              {step === "phone" ? "Mobilnummer" : "SMS-kod"}
            </h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-[#6e6964]">
              {step === "phone" ? "Vi skickar en SMS-kod som du anger för att logga in." : `Ange koden vi skickade till ${phone}.`}
            </p>
            <div className="mt-5 space-y-3">
              {step === "phone" ? (
                <>
                  <Field label="Namn (valfritt)" value={name} onChange={setName} placeholder="För- och efternamn" />
                  <Field label="Mobilnummer" value={phone} onChange={setPhone} placeholder="+46 70 …" />
                </>
              ) : (
                <Field label="SMS-kod" value={code} onChange={setCode} placeholder="6 siffror" />
              )}
            </div>
            {hint ? <p className="mt-3 text-center text-sm text-[#6e6964]">{hint}</p> : null}
            {sampleCode ? (
              <p className="mt-2 rounded-xl bg-[#f6f1ea] px-3 py-2 text-center text-sm text-[#2a211c]">
                Sample-kod (lokalt): <span className="font-semibold tracking-widest">{sampleCode}</span>
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void (step === "phone" ? sendSms() : confirmSms())}
              className="mt-5 h-12 w-full rounded-full bg-[#6e5636] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Vänta…" : step === "phone" ? "Skicka SMS" : "Bekräfta och logga in"}
            </button>
          </>
        ) : null}

        {localError || authError ? (
          <p className="mt-4 text-center text-sm text-red-700">{localError || authError}</p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#5c564f]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-full border border-[#efeae4] bg-white/80 px-4 text-[15px] outline-none"
      />
    </label>
  );
}

function Method({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-full items-center rounded-full border border-white/90 bg-white/75 px-4 text-[15px] font-medium text-[#2a211c] disabled:opacity-60"
    >
      <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
      <span className="-ml-6 flex-1 text-center">{label}</span>
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" />
    </svg>
  );
}

function MailMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="#2a211c" strokeWidth="1.6" />
      <path d="M4 7l8 6 8-6" fill="none" stroke="#2a211c" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PhoneMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="#2a211c" strokeWidth="1.6" />
      <circle cx="12" cy="18.2" r="0.8" fill="#2a211c" />
    </svg>
  );
}
