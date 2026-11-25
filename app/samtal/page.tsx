"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { CallActionSheet, CallOverlay, MissedCallCard, useCall } from "@/components/velio/call-screen";
import { callEngine } from "@/lib/calls/engine";
import { bridgeSignaling, demoCallId, firestoreSignaling, localBridge } from "@/lib/calls/signal";

type Role = "kund" | "utforare";

function roleFromLocation(): Role {
  if (typeof window === "undefined") return "kund";
  return new URLSearchParams(window.location.search).get("roll") === "utforare" ? "utforare" : "kund";
}

function roomFromLocation() {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get("rum") || "";
  return /^[A-Za-z0-9]{4,24}$/.test(value) ? value : "";
}

export default function SamtalPage() {
  const view = useCall();
  const [role, setRole] = useState<Role>("kund");
  const [room, setRoom] = useState("");
  const [bridge, setBridge] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nextRole = roleFromLocation();
    const nextRoom = roomFromLocation() || Math.random().toString(36).slice(2, 8);
    const nextBridge = localBridge();
    setRole(nextRole);
    setRoom(nextRoom);
    setBridge(nextBridge);
    const signal = nextBridge ? bridgeSignaling(nextBridge) : firestoreSignaling();
    const selfId = nextRole === "kund" ? "demo-customer" : "demo-worker";
    const selfName = nextRole === "kund" ? "Demo-kund" : "Demo-utförare";
    const stop = callEngine.watchDemo({ room: nextRoom, selfId, selfName, signal });
    setReady(true);
    return stop;
  }, []);

  const peerName = role === "kund" ? "Demo-utförare" : "Demo-kund";
  const selfName = role === "kund" ? "Demo-kund" : "Demo-utförare";
  const otherRole = role === "kund" ? "utforare" : "kund";
  const otherHref = room ? `?roll=${otherRole}&rum=${room}${bridge ? `&bridge=${encodeURIComponent(bridge)}` : ""}` : "";

  return (
    <div className="relative flex min-h-dvh justify-center bg-[#E8E2DA] md:items-center md:p-8">
      <div className="relative flex min-h-dvh w-full max-w-[420px] flex-col bg-[#FAF8F5] md:min-h-[760px] md:rounded-[2rem] md:shadow-2xl">
        <p className="pt-8 text-center font-serif text-[1.4rem] tracking-[0.28em]">VELIO</p>
        <div className="px-5 pt-6">
          <p className="text-[13px] text-[#8A8178]">Du är</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em]">{selfName}</h1>
          <p className="mt-4 text-[13px] text-[#8A8178]">Rum</p>
          <p className="mt-1 text-[20px] font-semibold tracking-[0.08em]">{room || "····"}</p>
          {otherHref ? (
            <a href={otherHref} className="mt-2 block text-[13px] text-[#6B4226]">
              Öppna den andra sidan
            </a>
          ) : null}
          <div className="mt-8 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-[#1A1A1A] text-sm font-semibold text-white">
              {peerName.split("-").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold">{peerName}</p>
              <p className="text-[13px] text-[#8A8178]">Demo</p>
            </div>
            <button type="button" aria-label="Ring" disabled={!ready} onClick={() => setSheet(true)} className="grid size-11 place-items-center rounded-full bg-white active:scale-[0.96]">
              <Phone className="size-5" />
            </button>
          </div>
          {view.phase === "missed" ? (
            <div className="mt-6">
              <MissedCallCard />
            </div>
          ) : null}
        </div>
        {sheet && view.phase === "idle" ? (
          <CallActionSheet
            name={peerName}
            masked={false}
            proxyNumber=""
            error=""
            onClose={() => setSheet(false)}
            onPhone={() => undefined}
            onApp={() => {
              setSheet(false);
              void callEngine.placeCall({
                selfId: role === "kund" ? "demo-customer" : "demo-worker",
                selfName,
                peerId: role === "kund" ? "demo-worker" : "demo-customer",
                peerName,
                demo: true,
                room,
                signal: bridge ? bridgeSignaling(bridge) : firestoreSignaling(),
              });
            }}
          />
        ) : null}
        <CallOverlay contained />
        <p className="sr-only">{demoCallId(room || "x")}</p>
      </div>
    </div>
  );
}
