"use client";

import { useEffect, useState } from "react";
import { paymentsApiBase } from "@/lib/stripe/config";
import { firebaseAuth } from "@/lib/firebase/client";
import { useVelio } from "@/lib/velio/store";

type Start = {
  configured?: boolean;
  autoStartUrl?: string;
  qrImage?: string;
  hint?: string;
  error?: string;
};

type Collect = {
  configured?: boolean;
  status?: "pending" | "verified" | "failed" | "expired" | "unavailable";
  qrImage?: string;
  hint?: string;
  name?: string;
  message?: string;
  error?: string;
};

async function postIdentity<T>(path: string): Promise<T> {
  const base = paymentsApiBase();
  if (!base) throw new Error("BankID kommer snart");
  const token = await firebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Logga in igen");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 404) throw new Error("BankID kommer snart");
  if (!response.ok) throw new Error(data.error || "BankID kunde inte startas");
  return data;
}

export function BankIdVerify({ onVerified }: { onVerified?: (name: string) => void }) {
  const idVerified = useVelio((state) => state.idVerified);
  const idStatus = useVelio((state) => state.idStatus);
  const verifiedName = useVelio((state) => state.verifiedName);
  const [phase, setPhase] = useState<"idle" | "wait" | "soon" | "done" | "failed">("idle");
  const [autoStartUrl, setAutoStartUrl] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (idVerified && idStatus !== "pending") setPhase("done");
  }, [idStatus, idVerified]);

  useEffect(() => {
    if (phase !== "wait") return;
    let stopped = false;
    const tick = async () => {
      try {
        const result = await postIdentity<Collect>("/api/identity/bankid/collect");
        if (stopped) return;
        if (result.qrImage) setQrImage(result.qrImage);
        if (result.hint) setHint(result.hint);
        if (result.status === "verified") {
          setPhase("done");
          onVerified?.(result.name || "");
        } else if (result.status === "failed" || result.status === "expired" || result.status === "unavailable") {
          setPhase(result.status === "unavailable" ? "soon" : "failed");
          setError(result.message || "BankID avbröts.");
        }
      } catch (reason) {
        if (!stopped) {
          setPhase("failed");
          setError(reason instanceof Error ? reason.message : "BankID kunde inte kontrolleras");
        }
      }
    };
    const timer = window.setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [onVerified, phase]);

  const start = async () => {
    setError("");
    try {
      const started = await postIdentity<Start>("/api/identity/bankid/start");
      if (!started.configured) {
        setPhase("soon");
        return;
      }
      setAutoStartUrl(started.autoStartUrl || "");
      setQrImage(started.qrImage || "");
      setHint(started.hint || "Starta BankID-appen.");
      setPhase("wait");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "BankID kunde inte startas";
      if (message.includes("kommer snart")) {
        setPhase("soon");
        return;
      }
      setPhase("failed");
      setError(message);
    }
  };

  const statusLabel = idVerified ? "Verifierad" : idStatus === "pending" || phase === "wait" ? "Väntar" : phase === "failed" || idStatus === "canceled" ? "Försök igen" : "";

  return (
    <div className="mt-4 space-y-3">
      {statusLabel ? (
        <p className="text-sm font-semibold">{statusLabel}{verifiedName && idVerified ? ` · ${verifiedName}` : ""}</p>
      ) : null}
      {phase === "soon" ? <p className="rounded-2xl bg-sand px-3 py-3 text-sm">BankID kommer snart.</p> : null}
      {phase === "wait" ? (
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-sm">{hint || "Öppna BankID på den här enheten, eller skanna koden med en annan."}</p>
          {autoStartUrl ? (
            <a href={autoStartUrl} className="mt-3 flex h-12 items-center justify-center rounded-full bg-brown text-sm font-semibold text-paper">
              Öppna BankID
            </a>
          ) : null}
          {qrImage ? <img src={qrImage} alt="BankID QR-kod" className="mx-auto mt-4 size-52 rounded-xl bg-white p-2" /> : null}
        </div>
      ) : null}
      {phase === "done" || idVerified ? (
        <p className="rounded-2xl bg-sand px-3 py-3 text-sm">BankID är klart. Identiteten är verifierad.</p>
      ) : phase === "idle" || phase === "failed" ? (
        <button type="button" onClick={() => void start()} className="h-12 w-full rounded-full bg-[#F7C948] text-[15px] font-semibold text-[#1a1a1a]">
          {phase === "failed" ? "Försök igen" : "Starta BankID"}
        </button>
      ) : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <p className="text-xs leading-snug text-muted">Har du inte BankID? Verifiering med pass är inte tillgänglig.</p>
    </div>
  );
}
