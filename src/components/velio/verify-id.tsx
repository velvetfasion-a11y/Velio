import { useCallback, useEffect, useState } from "react";
import { completeBankIdVerification, startBankIdVerification } from "@/lib/velio/auth-api";
import { isStaticHost } from "@/lib/velio/local-auth";
import { useVelio } from "@/lib/velio/store";
import { ScreenHeader } from "@/components/velio/ui";
import { IdentityFlow } from "@/components/velio/identity";

type Method = "choose" | "bankid" | "document";

export function VerifyIdScreen() {
  const go = useVelio((state) => state.go);
  const applyAccountFlags = useVelio((state) => state.applyAccountFlags);
  const showToast = useVelio((state) => state.showToast);
  const [method, setMethod] = useState<Method>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState("");
  const [bankStatus, setBankStatus] = useState("BankID är inte kopplat.");
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
      if (result.personalNumber) useVelio.getState().rememberBankIdNumber(result.personalNumber);
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

  return (
    <div className="px-5 pt-4 pb-8">
      <ScreenHeader title="Verifiera dig" />
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Identiteten behövs för både kund och VELIO Business. BankID är det rekommenderade sättet. ID-handling är en platshållare: bilderna laddas inte upp och kontot blir inte verifierat.
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
          <p className="text-center text-xs font-medium text-muted">Rekommenderas</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMethod("document");
            }}
            className="flex h-14 w-full items-center justify-center rounded-full border border-line bg-white text-[15px] font-semibold text-ink"
          >
            ID-handling
          </button>
          <p className="text-center text-xs text-muted">Pass, nationellt id-kort eller svenskt körkort. Platshållare.</p>
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
              setError(null);
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

      {method === "document" ? <IdentityFlow onBack={() => setMethod("choose")} /> : null}

      {method === "bankid" && error ? <p className="mt-4 text-center text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
