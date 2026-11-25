import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { authErrorSv, sendReset, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/firebase/auth";
import { useVelio } from "@/lib/velio/store";

type Step = "methods" | "email" | "phone";

export function LoginScreen() {
  const authError = useVelio((state) => state.authError);
  const setAuthError = useVelio((state) => state.setAuthError);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("methods");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const back = () => {
    setLocalError(null);
    setHint(null);
    setStep("methods");
  };

  const onGoogle = () => {
    if (busy) return;
    setLocalError(null);
    setAuthError(null);
    // Popup must start before any await. Safari otherwise sends the person
    // through a full-page redirect and drops them back on this screen.
    const pending = signInWithGoogle();
    setBusy(true);
    void pending
      .catch((error: unknown) => setLocalError(authErrorSv(error)))
      .finally(() => setBusy(false));
  };

  const onEmail = async (mode: "in" | "up" | "reset") => {
    if (busy) return;
    const chosen = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chosen)) return setLocalError("Skriv en giltig e-postadress");
    if (mode !== "reset" && password.length < 6) return setLocalError("Lösenordet behöver minst 6 tecken");
    setBusy(true);
    setLocalError(null);
    setAuthError(null);
    setHint(null);
    try {
      if (mode === "reset") {
        await sendReset(chosen);
        setHint("Om adressen finns hos oss skickar vi en länk för att välja ett nytt lösenord.");
        return;
      }
      if (mode === "up") await signUpWithEmail(chosen, password, name);
      else await signInWithEmail(chosen, password);
    } catch (error) {
      setLocalError(authErrorSv(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <div className="pointer-events-none absolute -top-20 -left-16 size-64 rounded-full bg-wheat blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 size-72 rounded-full bg-sand blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-8 size-48 rounded-full bg-cream blur-3xl" />

      <div className="relative flex flex-1 flex-col justify-center overflow-y-auto px-6 py-8">
        {step !== "methods" ? (
          <button type="button" aria-label="Tillbaka" onClick={back} className="mb-2 grid size-9 place-items-center self-start">
            <ArrowLeft className="size-5 text-ink" />
          </button>
        ) : null}

        <p className="text-center font-serif text-[1.55rem] tracking-[0.32em] text-ink">VELIO</p>

        {step === "methods" ? (
          <>
            <h1 className="mt-8 text-center font-serif text-[2.7rem] leading-none font-medium text-ink">Logga in</h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-muted">
              E-post och Google är riktiga konton. BankID och mobilnummer är inte aktiverade ännu.
            </p>
            <div className="mt-8 rounded-[1.7rem] border border-white/80 bg-paper/60 p-3 shadow-[0_18px_50px_rgba(70,50,20,0.08)] backdrop-blur-xl">
              <div className="space-y-2.5">
                <Method label="Fortsätt med BankID" onClick={() => setLocalError("BankID är inte kopplat. Det är en platshållare tills BankID-avtalet finns.")} icon={<BankIdMark />} disabled={busy} />
                <Method label="Fortsätt med Google" onClick={() => void onGoogle()} icon={<GoogleMark />} disabled={busy} />
                <Method label="Fortsätt med e-post" onClick={() => { setLocalError(null); setStep("email"); }} icon={<MailMark />} disabled={busy} />
                <Method label="Fortsätt med mobilnummer" onClick={() => { setLocalError(null); setStep("phone"); }} icon={<PhoneMark />} disabled={busy} />
              </div>
            </div>
          </>
        ) : null}

        {step === "email" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-ink">E-post</h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-muted">
              Skapa ett konto eller logga in med lösenord. Glömt lösenord skickar en återställningslänk.
            </p>
            <div className="mt-5 space-y-3">
              <Field label="Namn" value={name} onChange={setName} placeholder="För- och efternamn" autoComplete="name" />
              <Field label="E-post" value={email} onChange={setEmail} placeholder="namn@example.com" type="email" autoComplete="email" />
              <Field label="Lösenord" value={password} onChange={setPassword} placeholder="Minst 6 tecken" type="password" autoComplete="current-password" />
            </div>
            {hint ? <p className="mt-3 text-center text-sm text-muted">{hint}</p> : null}
            <button type="button" disabled={busy} onClick={() => void onEmail("in")} className="mt-5 h-12 w-full rounded-full bg-brown text-[15px] font-semibold text-white disabled:opacity-60">
              {busy ? "Vänta…" : "Logga in"}
            </button>
            <button type="button" disabled={busy} onClick={() => void onEmail("up")} className="mt-2 h-12 w-full rounded-full border border-line text-[15px] font-semibold text-ink disabled:opacity-60">
              Skapa konto
            </button>
            <button type="button" disabled={busy} onClick={() => void onEmail("reset")} className="mt-3 w-full text-center text-sm font-semibold text-brown">
              Glömt lösenord
            </button>
          </>
        ) : null}

        {step === "phone" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-ink">Mobilnummer</h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-muted">
              SMS-inloggning kommer snart. Telefonautentisering är inte aktiverad på kontot ännu.
            </p>
            <p className="mt-6 rounded-2xl bg-sand px-4 py-3 text-center text-sm font-semibold">Kommer snart</p>
          </>
        ) : null}

        {localError || authError ? <p className="mt-4 text-center text-sm text-red-700">{localError || authError}</p> : null}
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
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize={type === "email" ? "off" : undefined}
        autoCorrect={type === "email" ? "off" : undefined}
        inputMode={type === "email" ? "email" : type === "password" ? "text" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-full border border-line bg-paper/80 px-4 text-[15px] outline-none backdrop-blur-xl"
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
      className="flex h-12 w-full items-center rounded-full border border-white/90 bg-paper/80 px-4 text-[15px] font-medium text-ink backdrop-blur-xl disabled:opacity-60"
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
      <path d="M8 12.2c1.2-2.4 2.2-3.6 4-3.6 1.6 0 2.4 1 2.4 2.3 0 2.6-6.2 1.2-6.2 4.2 0 1 .8 1.7 2 1.7 1.5 0 2.6-1 3.6-2.6" fill="none" stroke="#1a1a1a" strokeWidth="1.7" strokeLinecap="round" />
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
