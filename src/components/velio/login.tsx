import { useState, type ReactNode } from "react";
import { useVelio } from "@/lib/velio/store";

export function LoginScreen() {
  const loginWithCursor = useVelio((state) => state.loginWithCursor);
  const authError = useVelio((state) => state.authError);
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await loginWithCursor();
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
        <p className="text-center font-serif text-[1.55rem] tracking-[0.32em] text-[#2a211c]">VELIO</p>
        <h1 className="mt-8 text-center font-serif text-[2.7rem] leading-none font-medium text-[#2a211c]">Logga in</h1>
        <p className="mx-auto mt-3 max-w-[16rem] text-center text-sm leading-snug text-[#6e6964]">
          Fortsätt säkert. Ett tryck räcker.
        </p>

        <div className="mt-8 rounded-[1.7rem] border border-white/80 bg-white/45 p-3 shadow-[0_18px_50px_rgba(70,50,20,0.08)] backdrop-blur-xl">
          <div className="space-y-2.5">
            <Method label="Fortsätt med BankID" onClick={() => void onContinue()} icon={<BankIdMark />} disabled={busy} />
            <Method label="Fortsätt med Google" onClick={() => void onContinue()} icon={<GoogleMark />} disabled={busy} />
            <Method label="Fortsätt med Apple" onClick={() => void onContinue()} icon={<AppleMark />} disabled={busy} />
            <Method label="Fortsätt med mobilnummer" onClick={() => void onContinue()} icon={<PhoneMark />} disabled={busy} />
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
          onClick={() => void onContinue()}
          className="mt-4 h-12 w-full rounded-full border border-white/90 bg-white/70 text-[15px] font-semibold text-[#2a211c] shadow-sm backdrop-blur-md disabled:opacity-60"
        >
          {busy ? "Loggar in…" : "Skapa konto"}
        </button>

        {authError ? <p className="mt-4 text-center text-sm text-red-700">{authError}</p> : null}
      </div>
    </div>
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
