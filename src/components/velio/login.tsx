import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useVelio } from "@/lib/velio/store";
import { listAccountsRemote, type AccountDto, type AuthProvider } from "@/lib/velio/auth-api";
import { cn } from "@/lib/cn";

type Step = "methods" | "pick" | "create";

const providerLabel: Record<AuthProvider, string> = {
  bankid: "BankID",
  google: "Google",
  apple: "Apple",
  phone: "mobilnummer",
};

export function LoginScreen() {
  const loginWithAccountId = useVelio((state) => state.loginWithAccountId);
  const createAccount = useVelio((state) => state.createAccount);
  const authError = useVelio((state) => state.authError);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("methods");
  const [provider, setProvider] = useState<AuthProvider>("bankid");
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"customer" | "business">("customer");
  const [localError, setLocalError] = useState<string | null>(null);

  const openProvider = async (next: AuthProvider) => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    setProvider(next);
    try {
      const list = await listAccountsRemote(next);
      setAccounts(list);
      setStep(list.length ? "pick" : "create");
    } catch {
      setLocalError("Kunde inte hämta konton just nu.");
    } finally {
      setBusy(false);
    }
  };

  const openCreate = (next?: AuthProvider) => {
    if (next) setProvider(next);
    setLocalError(null);
    setStep("create");
  };

  const onPick = async (accountId: string) => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await loginWithAccountId(provider, accountId);
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    if (busy) return;
    if (name.trim().length < 2) return setLocalError("Ange ditt namn");
    if (!email.includes("@")) return setLocalError("Ange en giltig e-postadress");
    if (phone.trim().length < 6) return setLocalError("Ange ett telefonnummer");
    setBusy(true);
    setLocalError(null);
    try {
      const ok = await createAccount({
        provider,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        accountMode: mode,
      });
      if (!ok) setLocalError("Kontot kunde inte skapas.");
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
          <button
            type="button"
            aria-label="Tillbaka"
            onClick={() => {
              setLocalError(null);
              setStep(step === "create" && accounts.length ? "pick" : "methods");
            }}
            className="mb-2 grid size-9 place-items-center self-start"
          >
            <ArrowLeft className="size-5 text-[#2a211c]" />
          </button>
        ) : null}

        <p className="text-center font-serif text-[1.55rem] tracking-[0.32em] text-[#2a211c]">VELIO</p>

        {step === "methods" ? (
          <>
            <h1 className="mt-8 text-center font-serif text-[2.7rem] leading-none font-medium text-[#2a211c]">Logga in</h1>
            <p className="mx-auto mt-3 max-w-[16rem] text-center text-sm leading-snug text-[#6e6964]">
              Välj metod. Sedan väljer eller skapar du din profil.
            </p>

            <div className="mt-8 rounded-[1.7rem] border border-white/80 bg-white/45 p-3 shadow-[0_18px_50px_rgba(70,50,20,0.08)] backdrop-blur-xl">
              <div className="space-y-2.5">
                <Method label="Fortsätt med BankID" onClick={() => void openProvider("bankid")} icon={<BankIdMark />} disabled={busy} />
                <Method label="Fortsätt med Google" onClick={() => void openProvider("google")} icon={<GoogleMark />} disabled={busy} />
                <Method label="Fortsätt med Apple" onClick={() => void openProvider("apple")} icon={<AppleMark />} disabled={busy} />
                <Method label="Fortsätt med mobilnummer" onClick={() => void openProvider("phone")} icon={<PhoneMark />} disabled={busy} />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs tracking-wide text-[#8a847e]">
              <span className="h-px flex-1 bg-[#e6e1db]" />
              eller
              <span className="h-px flex-1 bg-[#e6e1db]" />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => openCreate("bankid")}
              className="mt-4 h-12 w-full rounded-full border border-white/90 bg-white/70 text-[15px] font-semibold text-[#2a211c] shadow-sm backdrop-blur-md disabled:opacity-60"
            >
              Skapa konto
            </button>
          </>
        ) : null}

        {step === "pick" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-[#2a211c]">Välj profil</h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-[#6e6964]">
              Konton via {providerLabel[provider]}. Välj din profil eller skapa en ny.
            </p>
            <div className="mt-6 space-y-2">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void onPick(account.id)}
                  className="flex w-full items-center gap-3 rounded-[1.2rem] border border-white/90 bg-white/75 px-4 py-3 text-left disabled:opacity-60"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f3ece3] text-sm font-semibold text-[#2a211c]">
                    {initials(account.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[#2a211c]">{account.name}</span>
                    <span className="block truncate text-sm text-[#6e6964]">
                      {account.accountMode === "business" ? "Business" : "Kund"} · {account.email || account.phone}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => openCreate(provider)}
              className="mt-4 h-12 w-full rounded-full bg-[#6e5636] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Öppnar…" : "Skapa ny profil"}
            </button>
          </>
        ) : null}

        {step === "create" ? (
          <>
            <h1 className="mt-4 text-center font-serif text-[2.2rem] leading-none font-medium text-[#2a211c]">Skapa profil</h1>
            <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-snug text-[#6e6964]">
              Ny användare via {providerLabel[provider]}. Du kan lägga upp jobb och chatta direkt.
            </p>

            <div className="mt-5 flex rounded-full bg-[#f6f1ea] p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("customer")}
                className={cn("flex-1 rounded-full py-2 font-semibold", mode === "customer" ? "bg-[#6e5636] text-white" : "text-[#5c564f]")}
              >
                Kund
              </button>
              <button
                type="button"
                onClick={() => setMode("business")}
                className={cn("flex-1 rounded-full py-2 font-semibold", mode === "business" ? "bg-[#6e5636] text-white" : "text-[#5c564f]")}
              >
                Utförare
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Namn" value={name} onChange={setName} placeholder="För- och efternamn" />
              <Field label="E-post" value={email} onChange={setEmail} placeholder="namn@mail.se" type="email" />
              <Field label="Telefon" value={phone} onChange={setPhone} placeholder="+46 70 …" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["bankid", "google", "apple", "phone"] as AuthProvider[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setProvider(item)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-medium capitalize",
                    provider === item ? "border-[#6e5636] bg-[#6e5636] text-white" : "border-[#e6dfd6] bg-white/70 text-[#2a211c]",
                  )}
                >
                  {providerLabel[item]}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="mt-5 h-12 w-full rounded-full bg-[#6e5636] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Skapar konto…" : "Skapa konto"}
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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-[#2a211c]" aria-hidden="true">
      <path d="M16.4 12.6c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.9-.7c-1.5.1-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7 1.9-1.1 2.6-2.2c.8-1.2 1.2-2.4 1.2-2.4s-2.3-.9-2.1-3.7zM14.7 6.4c.6-.7 1-1.7.9-2.7-.9.1-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z" />
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
