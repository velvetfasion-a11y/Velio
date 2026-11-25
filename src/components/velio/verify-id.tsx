import { useCallback, useEffect, useState } from "react";
import {
  completeBankIdVerification,
  startBankIdVerification,
  submitPassportVerification,
} from "@/lib/velio/auth-api";
import { isStaticHost } from "@/lib/velio/local-auth";
import { useVelio } from "@/lib/velio/store";
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
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState("");
  const [bankStatus, setBankStatus] = useState("BankID är inte kopplat.");
  const [passportNumber, setPassportNumber] = useState("");
  const [country, setCountry] = useState("SE");
  const [fullName, setFullName] = useState(profile.name);
  const [expiry, setExpiry] = useState("");
  const staticHost = typeof window !== "undefined" && isStaticHost();

  const startBankId = async () => {
    if (busy) return;
    setError(null);
    if (staticHost) {
      setBankStatus("BankID är inte kopplat i den här versionen. Ingen identitet har verifierats.");
      setError("BankID är inte kopplat. Profilen förblir inte verifierad tills en BankID-leverantör svarar.");
      return;
    }
    setBusy(true);
    setBankStatus("Startar BankID…");
    try {
      const started = await startBankIdVerification();
      setChallengeId(started.challengeId);
      setLaunchUrl(started.launchUrl ?? "");
      setBankStatus(started.message ?? "Öppna BankID-appen och identifiera dig.");
      if (started.launchUrl) window.open(started.launchUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setBankStatus("BankID är inte kopplat.");
      setError(err instanceof Error ? err.message : "Kunde inte starta BankID");
    } finally {
      setBusy(false);
    }
  };

  const finishBankId = useCallback(async () => {
    if (!challengeId) return;
    try {
      const result = await completeBankIdVerification(challengeId, true);
      if (result.status === "pending") {
        setBankStatus("Väntar på att du identifierar dig i BankID…");
        return;
      }
      applyAccountFlags(result.account);
      showToast("BankID klart — identiteten är verifierad");
      go("business");
    } catch (err) {
      setError(err instanceof Error ? err.message : "BankID misslyckades");
    }
  }, [applyAccountFlags, challengeId, go, showToast]);

  useEffect(() => {
    if (!challengeId || staticHost) return;
    const timer = window.setInterval(() => {
      void finishBankId();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [challengeId, finishBankId, staticHost]);

  const finishPassport = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (staticHost) {
        setError("Passgranskning kräver servern. Ingenting har markerats som verifierat.");
        return;
      }
      const result = await submitPassportVerification({
        passportNumber,
        country,
        fullName,
        expiry,
      });
      applyAccountFlags(result.account);
      showToast(result.message || "Pass skickat för granskning. Identiteten är inte verifierad ännu.");
      go("profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passverifiering misslyckades");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 pt-4 pb-8">
      <ScreenHeader title="Verifiera dig" />
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Identiteten behövs så att kunder vet vem som utför jobbet och så att utbetalningar kan kopplas till rätt person. Ingenting markeras som verifierat förrän BankID svarar, eller tills en manuell granskning är godkänd.
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
            className="flex h-14 w-full items-center justify-center rounded-full border border-line bg-white text-[15px] font-semibold text-ink"
          >
            Skicka pass för granskning
          </button>
        </div>
      ) : null}

      {method === "bankid" ? (
        <div className="mt-5 space-y-3">
          <button
            type="button"
            className="text-sm font-medium text-brown"
            onClick={() => {
              setMethod("choose");
              setChallengeId(null);
            }}
          >
            ← Byt metod
          </button>
          <p className="rounded-2xl bg-sand px-3 py-3 text-sm leading-snug text-ink">{bankStatus}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startBankId()}
            className="h-12 w-full rounded-full bg-[#F7C948] text-[15px] font-semibold text-[#1a1a1a] disabled:opacity-60"
          >
            {busy ? "Startar…" : "Öppna BankID"}
          </button>
          {launchUrl ? (
            <button type="button" onClick={() => window.open(launchUrl, "_blank", "noopener,noreferrer")} className="h-12 w-full rounded-full border border-line bg-paper text-sm font-semibold">
              Öppna BankID igen
            </button>
          ) : null}
        </div>
      ) : null}

      {method === "passport" ? (
        <div className="mt-5 space-y-3">
          <button type="button" className="text-sm font-medium text-brown" onClick={() => setMethod("choose")}>
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
            className="h-12 w-full rounded-full bg-brown text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Skickar…" : "Skicka för granskning"}
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
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-full border border-line bg-paper/80 backdrop-blur-xl px-4 text-[15px] outline-none"
      />
    </label>
  );
}
