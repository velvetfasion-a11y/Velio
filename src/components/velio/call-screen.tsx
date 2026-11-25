"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2 } from "lucide-react";
import { callEngine, formatCallTime, type CallSnapshot } from "@/lib/calls/engine";
import { cn } from "@/lib/cn";

export function useCall() {
  return useSyncExternalStore(callEngine.subscribe, callEngine.getSnapshot, callEngine.getSnapshot);
}

export function MissedCallCard({ time }: { time?: string }) {
  return (
    <div className="mx-auto max-w-[240px] rounded-2xl border border-line bg-white px-4 py-3 text-center shadow-soft">
      <p className="text-[15px] font-semibold">Missat samtal</p>
      {time ? <p className="mt-0.5 text-[12px] text-muted">{time}</p> : null}
    </div>
  );
}

export function CallActionSheet({
  name,
  masked,
  proxyNumber,
  error,
  onApp,
  onPhone,
  onClose,
}: {
  name: string;
  masked: boolean;
  proxyNumber: string;
  error: string;
  onApp: () => void;
  onPhone: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[85] flex items-end bg-[#1A1A1A]/40" role="presentation">
      <button type="button" aria-label="Stäng" className="absolute inset-0" onClick={onClose} />
      <div role="dialog" aria-label="Ring" className="velio-sheet relative w-full rounded-t-[24px] bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(26,26,26,0.12)]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#E4DDD6]" />
        <p className="text-center text-[13px] text-[#8A8178]">Ring {name}</p>
        {proxyNumber ? (
          <div className="mt-4 text-center">
            <p className="text-[28px] font-semibold tracking-[-0.03em]">{proxyNumber}</p>
            <p className="mt-1 text-[13px] text-[#8A8178]">Ditt nummer visas inte.</p>
            <a href={`tel:${proxyNumber}`} className="mt-4 flex h-[52px] items-center justify-center rounded-[14px] bg-[#1A1A1A] text-[16px] font-semibold text-white active:scale-[0.98]">
              Öppna telefon
            </a>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <button type="button" onClick={onApp} className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[#1A1A1A] text-[16px] font-semibold text-white active:scale-[0.98]">
              Ring via appen
            </button>
            {masked ? (
              <button type="button" onClick={onPhone} className="flex h-[52px] w-full items-center justify-center rounded-[14px] border border-[#E6E1DB] bg-white text-[16px] font-semibold active:scale-[0.98]">
                Ring via telefon
              </button>
            ) : null}
          </div>
        )}
        {error ? <p className="mt-3 text-center text-[13px] text-[#9B2C2C]">{error}</p> : null}
        <button type="button" onClick={onClose} className="mt-3 h-11 w-full text-[15px] text-[#5C534C]">
          Avbryt
        </button>
      </div>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  children,
  tone = "light",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "light" | "dark" | "end";
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-20 flex-col items-center gap-2 active:scale-[0.96]">
      <span
        className={cn(
          "grid size-16 place-items-center rounded-full",
          tone === "dark" && "bg-[#1A1A1A] text-white",
          tone === "end" && "bg-[#1A1A1A] text-white",
          tone === "light" && "border border-[#E6E1DB] bg-white text-[#1A1A1A]",
        )}
      >
        {children}
      </span>
      <span className="text-[12px] text-[#5C534C]">{label}</span>
    </button>
  );
}

export function CallOverlay({ contained = false }: { contained?: boolean }) {
  const view = useCall();
  useEffect(() => {
    if (view.phase === "idle") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (view.phase === "incoming") void callEngine.decline();
      else if (view.phase === "outgoing" || view.phase === "connecting" || view.phase === "active") void callEngine.hangup();
      else callEngine.dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view.phase]);
  if (view.phase === "idle") return null;
  return (
    <div className={`${contained ? "absolute" : "fixed"} inset-0 z-[90] flex flex-col bg-[#FAF8F5] text-[#1A1A1A]`}>
      <CallStage view={view} />
    </div>
  );
}

function CallStage({ view }: { view: CallSnapshot }) {
  const ended = view.phase === "ended" || view.phase === "missed" || view.phase === "declined" || view.phase === "error";
  const title =
    view.phase === "outgoing"
      ? "Ringer…"
      : view.phase === "incoming"
        ? "Inkommande samtal"
        : view.phase === "connecting"
          ? "Kopplar…"
          : view.phase === "missed"
            ? "Inget svar"
            : view.phase === "declined"
              ? "Avvisat"
              : view.phase === "error"
                ? "Samtalet avbröts"
                : view.phase === "ended"
                  ? "Samtalet avslutat"
                  : formatCallTime(view.elapsed);
  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pt-16 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center">
        <span className={cn("grid size-24 place-items-center rounded-full bg-[#1A1A1A] text-[28px] font-semibold text-white", view.phase === "incoming" && "velio-ring")}>
          {view.initials || "V"}
        </span>
        {view.localStream && view.video ? (
          <video
            ref={(node) => {
              if (node) node.srcObject = view.localStream;
            }}
            autoPlay
            muted
            playsInline
            className="mt-6 h-40 w-28 rounded-2xl object-cover"
          />
        ) : null}
        <h2 className="mt-6 text-center text-[28px] font-semibold tracking-[-0.03em]">{view.name || "Samtal"}</h2>
        <p className="mt-2 text-[15px] text-[#8A8178]" aria-live="polite">
          {view.phase === "active" ? <span className="text-[40px] font-semibold tracking-[-0.03em] text-[#1A1A1A] tabular-nums">{title}</span> : title}
        </p>
        {view.error ? <p className="mt-4 max-w-[280px] text-center text-[13px] text-[#9B2C2C]">{view.error}</p> : null}
        {view.phase === "missed" ? <div className="mt-6"><MissedCallCard /></div> : null}
      </div>
      {view.phase === "incoming" ? (
        <div className="flex items-center justify-between px-6">
          <RoundButton label="Avvisa" tone="light" onClick={() => void callEngine.decline()}>
            <PhoneOff className="size-6" />
          </RoundButton>
          <RoundButton label="Svara" tone="dark" onClick={() => void callEngine.accept()}>
            <Phone className="size-6" />
          </RoundButton>
        </div>
      ) : ended ? (
        <button type="button" onClick={() => callEngine.dismiss()} className="mx-auto h-[52px] w-full max-w-[280px] rounded-[14px] bg-[#1A1A1A] text-[16px] font-semibold text-white active:scale-[0.98]">
          Stäng
        </button>
      ) : (
        <div className="flex items-end justify-center gap-6">
          <RoundButton label={view.muted ? "Ljud på" : "Ljud av"} onClick={() => callEngine.toggleMute()}>
            {view.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
          </RoundButton>
          {view.phase === "active" || view.phase === "connecting" ? (
            <RoundButton label="Video" onClick={() => void callEngine.toggleVideo()}>
              {view.video ? <VideoOff className="size-6" /> : <Video className="size-6" />}
            </RoundButton>
          ) : null}
          <RoundButton label="Lägg på" tone="end" onClick={() => void callEngine.hangup()}>
            <PhoneOff className="size-6" />
          </RoundButton>
          <RoundButton label="Högtalare" tone={view.speaker ? "dark" : "light"} onClick={() => void callEngine.toggleSpeaker()}>
            <Volume2 className="size-6" />
          </RoundButton>
        </div>
      )}
      <style>{`
        @keyframes velio-ring { 0% { box-shadow: 0 0 0 0 rgba(26,26,26,0.18); } 100% { box-shadow: 0 0 0 16px rgba(26,26,26,0); } }
        .velio-ring { animation: velio-ring 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .velio-ring { animation: none; } }
      `}</style>
    </div>
  );
}
