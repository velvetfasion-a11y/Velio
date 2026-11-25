import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useVelio } from "@/lib/velio/store";
import {
  collectBankIdLogin,
  fetchAuthCapabilities,
  fetchMe,
  startBankIdLogin,
  startEmailOtp,
  startSmsOtp,
  verifyEmailOtp,
  verifySmsOtp,
} from "@/lib/velio/auth-api";
import { isSignInEmail } from "@/lib/velio/data";
import { isStaticHost, localGoogleSignIn, localMePayload, localSignInWithEmail } from "@/lib/velio/local-auth";
import { googleGisAvailable, signInWithGoogleGis } from "@/lib/velio/google-gis";

type Step = "methods" | "bankid-open" | "email" | "email-code" | "phone" | "phone-code";

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
  const [hint, setHint] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [caps, setCaps] = useState({ google: false, email: false, sms: false, bankid: false });
  const [bankOrderRef, setBankOrderRef] = useState("");
  const [bankLaunchUrl, setBankLaunchUrl] = useState("");
  const [bankStatus, setBankStatus] = useState("Startar BankID…");
  const pollRef = useRef<number | null>(null);
  const staticHost = typeof window !== "undefined" && isStaticHost();

  useEffect(() => {
    if (staticHost) {
      // Static hosts have no API routes — never fake email/SMS/BankID delivery.
      setCaps({ google: googleGisAvailable(), email: false, sms: false, bankid: false });
      return;
    }
    void fetchAuthCapabilities().then((next) =>
      setCaps({
        google: next.google,
        email: next.email,
        sms: next.sms,
        bankid: Boolean(next.bankid),
      }),
    );
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
  }, [staticHost]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const stopBankPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const back = () => {
    stopBankPoll();
    setLocalError(null);
    setHint(null);
    setCode("");
    setBankLaunchUrl("");
    setBankOrderRef("");
    if (step === "email-code") setStep("email");
    else if (step === "phone-code") setStep("phone");
    else setStep("methods");
  };

  const openBankIdApp = (url: string) => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = url;
    }
  };

  const startBankId = async () => {
    if (busy) return;
    setLocalError(null);
    if (staticHost || !caps.bankid) {
      setLocalError("BankID är inte aktiverat ännu. Det krävs en BankID-koppling som öppnar BankID-appen.");
      return;
    }
    setBusy(true);
    setStep("bankid-open");
    setBankStatus("Startar BankID…");
    try {
      // No name/phone/personnummer in the app — BankID provides identity after the user signs.
      const started = await startBankIdLogin();
      setChallengeId(started.challengeId);
      setBankOrderRef(started.orderRef);
      setBankLaunchUrl(started.launchUrl);
      setBankStatus("Öppna BankID-appen och identifiera dig.");
      openBankIdApp(started.launchUrl);

      stopBankPoll();
      pollRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const result = await collectBankIdLogin({
              challengeId: started.challengeId,
              orderRef: started.orderRef,
            });
            if (result.status === "pending") {
              setBankStatus("Väntar på att du identifierar dig i BankID-appen…");
              return;
            }
            stopBankPoll();
            if (result.status === "failed") {
              setLocalError(result.message || "BankID misslyckades");
              setStep("methods");
              return;
            }
            const me = await fetchMe();
            if (!me.authenticated) throw new Error("BankID-inloggning misslyckades");
            applyMe(me);
          } catch (error) {
            stopBankPoll();
            setLocalError(error instanceof Error ? error.message : "BankID-inloggning misslyckades");
          }
        })();
      }, 2000);
    } catch (error) {
      setStep("methods");
      setLocalError(error instanceof Error ? error.message : "Kunde inte starta BankID");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (staticHost) {
        if (!googleGisAvailable()) {
          throw new Error("Google-inloggning är inte aktiverad ännu.");
        }
        const profile = await signInWithGoogleGis();
        const account = localGoogleSignIn(profile.email, profile.name, profile.sub);
        applyMe(localMePayload(account));
        return;
      }
      if (!caps.google) {
        throw new Error("Google-inloggning är inte aktiverad ännu.");
      }
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/auth/google/start`;
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Google-inloggning misslyckades");
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    if (busy) return;
    const chosen = isSignInEmail(email);
    if (!chosen) return setLocalError("Skriv en e-postadress, till exempel namn@.com");
    setBusy(true);
    setLocalError(null);
    try {
      if (staticHost) {
        const account = localSignInWithEmail(chosen, name.trim() || undefined);
        applyMe(localMePayload(account));
        return;
      }
      if (!caps.email) {
        throw new Error("E-postinloggning skickar koden till din mejlbox och är inte aktiverad ännu.");
      }
      const result = await startEmailOtp(chosen, name.trim() || undefined);
      setChallengeId(result.challengeId);
      setHint(result.message ?? "Vi har skickat en kod till din mejlbox. Kolla inkorgen (och skräppost).");
      setStep("email-code");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Kunde inte skicka kod till mejlen");
    } finally {
      setBusy(false);
    }
  };

  const confirmEmail = async () => {
    if (busy) return;
    if (code.trim().length < 4) return setLocalError("Ange koden från din mejlbox");
    setBusy(true);
    setLocalError(null);
    setAuthError(null);
    try {
      if (staticHost) throw new Error("E-postinloggning är inte aktiverad på den här versionen.");
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
      if (staticHost || !caps.sms) {
        throw new Error("SMS-inloggning skickar koden till din telefon och är inte aktiverad ännu.");
      }
      const result = await startSmsOtp(phone.trim(), name.trim() || undefined);
      setChallengeId(result.challengeId);
      setHint(result.message ?? "Vi har skickat en kod via SMS.");
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
      if (staticHost) throw new Error("SMS-inloggning är inte aktiverad på den här versionen.");
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

  useEffect(() => {
    if (staticHost) return;
    void fetchMe().then((me) => {
      if (me.authenticated) applyMe(me);
    });
  }, [applyMe, staticHost]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <div className="pointer-events-none absolute -top-20 -left-16 size-64 rounded-full bg-wheat blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 size-72 rounded-full bg-sand blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-8 size-48 rounded-full bg-cream blur-3xl" />

      <div className="relative flex flex-1 flex-col justify-center px-6 pb-8">
        {step !== "methods" ? (
          <button type="button" aria-label="Tillbaka" onClick={back} className="mb-2 grid size-9 place-items-center self-start">
            <ArrowLeft className="size-5 text-ink" />
          </button>
        ) : null}

        <p className="text-center font-serif text-[1.55rem] tracking-[0.32em] text-ink">VELIO</p>

        {step === "methods" ? (
          <>
            <h1 className="mt-8 text-center font-serif text-[2.7rem] leading-none font-medium text-ink">Logga in</h1>
            <p className="mx-auto mt-3 max-w-[17rem] text-center text-sm leading-snug text-muted">
              {staticHost
                ? "E-post loggar in med adressen du skriver, även om den inte är en riktig inkorg."
                : "BankID öppnar BankID-appen. E-post- och SMS-kod skickas till dig — aldrig i appen."}
            </p>

            <div className="mt-8 rounded-[1.7rem] border border-white/80 bg-paper/60 backdrop-blur-xl p-3 shadow-[0_18px_50px_rgba(70,50,20,0.08)] backdrop-blur-xl">
              <div className="space-y-2.5">
                <Method label="Fortsätt med BankID" onClick={() => void startBankId()} icon={<BankIdMark />} disabled={busy} />
                <Method label="Fortsätt med Google" onClick={() => void onGoogle()} icon={<GoogleMark />} disabled={busy} />
                <Method label="Fortsätt med e-post" onClick={() => setStep("email")} icon={<MailMark />} disabled={busy} />
                <Method label="Fortsätt med mobilnummer" onClick={() => setStep("phone")} icon={<PhoneMark />} disabled={busy} />
              </div>
            </div>
          </>
        ) : null}

        {step === "bankid-open" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-ink">BankID</h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-muted">{bankStatus}</p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={!bankLaunchUrl || busy}
                onClick={() => bankLaunchUrl && openBankIdApp(bankLaunchUrl)}
                className="h-12 w-full rounded-full bg-[#F7C948] text-[15px] font-semibold text-[#1a1a1a] disabled:opacity-60"
              >
                Öppna BankID
              </button>
              <p className="text-center text-xs text-muted">
                Identifiera dig i BankID-appen. VELIO hämtar ditt namn därifrån — inget fylls i här.
              </p>
              {bankOrderRef ? <p className="text-center text-[10px] text-muted">Order {bankOrderRef.slice(0, 12)}…</p> : null}
            </div>
          </>
        ) : null}

        {step === "email" || step === "email-code" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-ink">
              {step === "email" ? "E-post" : "Bekräfta e-post"}
            </h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-muted">
              {step === "email"
                ? staticHost
                  ? "Skriv adressen du vill logga in med, till exempel namn@.com. Ingen kod skickas."
                  : "Vi skickar en engångskod till din mejlbox. Koden visas aldrig i appen."
                : `Ange koden som skickades till ${email}.`}
            </p>
            <div className="mt-5 space-y-3">
              {step === "email" ? (
                <>
                  <Field label="Namn (valfritt)" value={name} onChange={setName} placeholder="För- och efternamn" />
                  <Field
                    label="E-post"
                    value={email}
                    onChange={(value) => {
                      setEmail(value);
                      setLocalError(null);
                    }}
                    placeholder="namn@.com"
                    type="text"
                  />
                </>
              ) : (
                <Field label="Verifieringskod från mejlen" value={code} onChange={setCode} placeholder="6 siffror" />
              )}
            </div>
            {hint ? <p className="mt-3 text-center text-sm text-muted">{hint}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void (step === "email" ? sendEmail() : confirmEmail())}
              className="mt-5 h-12 w-full rounded-full bg-brown text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Vänta…" : step === "email" ? (staticHost ? "Logga in" : "Skicka kod till mejlen") : "Bekräfta och logga in"}
            </button>
          </>
        ) : null}

        {step === "phone" || step === "phone-code" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-ink">
              {step === "phone" ? "Mobilnummer" : "SMS-kod"}
            </h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-muted">
              {step === "phone"
                ? "Vi skickar en SMS-kod till din telefon. Koden visas aldrig i appen."
                : `Ange koden som skickades till ${phone}.`}
            </p>
            <div className="mt-5 space-y-3">
              {step === "phone" ? (
                <>
                  <Field label="Namn (valfritt)" value={name} onChange={setName} placeholder="För- och efternamn" />
                  <Field label="Mobilnummer" value={phone} onChange={setPhone} placeholder="+46 70 …" />
                </>
              ) : (
                <Field label="SMS-kod från telefonen" value={code} onChange={setCode} placeholder="6 siffror" />
              )}
            </div>
            {hint ? <p className="mt-3 text-center text-sm text-muted">{hint}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void (step === "phone" ? sendSms() : confirmSms())}
              className="mt-5 h-12 w-full rounded-full bg-brown text-[15px] font-semibold text-white disabled:opacity-60"
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
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-full border border-line bg-paper/80 backdrop-blur-xl px-4 text-[15px] outline-none"
        autoComplete={type === "email" || placeholder?.includes("@") ? "email" : "one-time-code"}
        autoCapitalize={placeholder?.includes("@") ? "off" : undefined}
        autoCorrect={placeholder?.includes("@") ? "off" : undefined}
        inputMode={type === "email" || placeholder?.includes("@") ? "email" : "numeric"}
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
      className="flex h-12 w-full items-center rounded-full border border-white/90 bg-paper/80 backdrop-blur-xl px-4 text-[15px] font-medium text-ink disabled:opacity-60"
    >
      <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
      <span className="-ml-6 flex-1 text-center">{label}</span>
    </button>
  );
}

function BankIdMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#F7C948" />
      <path
        d="M8 12.2c1.2-2.4 2.2-3.6 4-3.6 1.6 0 2.4 1 2.4 2.3 0 2.6-6.2 1.2-6.2 4.2 0 1 .8 1.7 2 1.7 1.5 0 2.6-1 3.6-2.6"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
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
