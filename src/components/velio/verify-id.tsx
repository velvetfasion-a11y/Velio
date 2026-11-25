import { useState } from "react";
import { completeBankIdVerification, startBankIdVerification, submitPassportVerification } from "@/lib/velio/auth-api";
import { useVelio } from "@/lib/velio/store";
import { cn } from "@/lib/cn";
import { ScreenHeader } from "@/components/velio/ui";

type Method = "choose" | "bankid" | "passport";

export function VerifyIdScreen() {
  const go = useVelio((state) => state.go);
  const applyAccountFlags = useVelio((state) => state.applyAccountFlags);
  const showToast = useVelio((state) => state.showToast);
  const profile = useVelio((state) => state.profile);
  const [method, setMethod] = useState<Method>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalNumber, setPersonalNumber] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [passportNumber, setPassportNumber] = useState("");
  const [country, setCountry] = useState("SE");
  const [fullName, setFullName] = useState(profile.name);
  const [expiry, setExpiry] = useState("");

  const startBankId = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const started = await startBankIdVerification(personalNumber || undefined);
      setChallengeId(started.challengeId);
      setOrderRef(started.orderRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte starta BankID");
    } finally {
      setBusy(false);
    }
  };

  const finishBankId = async () => {
    if (busy || !challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const account = await completeBankIdVerification(challengeId, true);
      applyAccountFlags(account);
      showToast("BankID klart — VELIO Business aktiverat");
      go("business");
    } catch (err) {
      setError(err instanceof Error ? err.message : "BankID misslyckades");
    } finally {
      setBusy(false);
    }
  };

  const finishPassport = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const account = await submitPassportVerification({
        passportNumber,
        country,
        fullName,
        expiry,
        activateBusiness: true,
      });
      applyAccountFlags(account);
      showToast("Pass verifierat — VELIO Business aktiverat");
      go("business");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passverifiering misslyckades");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 pt-4 pb-8">
      <ScreenHeader title="Verifiera dig" onBack={() => go("profile")} />
      <p className="mt-2 text-sm leading-relaxed text-[#6e6964]">
        För att skapa ett VELIO Business-konto måste du identifiera dig med BankID eller pass.
      </p>

      {method === "choose" ? (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => setMethod("bankid")}
            className="flex h-14 w-full items-center justify-center rounded-full bg-[#F7C948] text-[15px] font-semibold text-[#1a1a1a]"
          >
            Identifiera med BankID
          </button>
          <button
            type="button"
            onClick={() => setMethod("passport")}
            className="flex h-14 w-full items-center justify-center rounded-full border border-[#e6dfd6] bg-white text-[15px] font-semibold text-[#2a211c]"
          >
            Identifiera med pass
          </button>
        </div>
      ) : null}

      {method === "bankid" ? (
        <div className="mt-5 space-y-3">
          <button type="button" className="text-sm font-medium text-[#6e5636]" onClick={() => { setMethod("choose"); setChallengeId(null); }}>
            ← Byt metod
          </button>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[#5c564f]">Personnummer (valfritt)</span>
            <input
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              placeholder="ÅÅÅÅMMDDXXXX"
              className="h-12 w-full rounded-full border border-[#efeae4] bg-white/80 px-4 text-[15px] outline-none"
            />
          </label>
          {!challengeId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startBankId()}
              className="h-12 w-full rounded-full bg-[#F7C948] text-[15px] font-semibold disabled:opacity-60"
            >
              {busy ? "Startar…" : "Starta BankID"}
            </button>
          ) : (
            <div className="rounded-[1.2rem] border border-[#efeae4] bg-[#fbf8f4] p-4">
              <p className="text-sm text-[#5c564f]">Öppna BankID-appen och slutför identifieringen.</p>
              {orderRef ? <p className="mt-2 text-xs text-[#8a847e]">Order: {orderRef.slice(0, 18)}…</p> : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishBankId()}
                className="mt-4 h-12 w-full rounded-full bg-[#1c1917] text-[15px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Bekräftar…" : "Jag har identifierat mig"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {method === "passport" ? (
        <div className="mt-5 space-y-3">
          <button type="button" className="text-sm font-medium text-[#6e5636]" onClick={() => setMethod("choose")}>
            ← Byt metod
          </button>
          <Field label="Namn som i passet" value={fullName} onChange={setFullName} />
          <Field label="Passnummer" value={passportNumber} onChange={setPassportNumber} placeholder="AB1234567" />
          <Field label="Landskod" value={country} onChange={setCountry} placeholder="SE" />
          <Field label="Giltigt t.o.m." value={expiry} onChange={setExpiry} placeholder="ÅÅÅÅ-MM-DD" />
          <button
            type="button"
            disabled={busy}
            onClick={() => void finishPassport()}
            className={cn("h-12 w-full rounded-full bg-[#6e5636] text-[15px] font-semibold text-white disabled:opacity-60")}
          >
            {busy ? "Verifierar…" : "Skicka passuppgifter"}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-center text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#5c564f]">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-full border border-[#efeae4] bg-white/80 px-4 text-[15px] outline-none"
      />
    </label>
  );
}
