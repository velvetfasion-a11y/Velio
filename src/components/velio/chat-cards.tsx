"use client";

import dynamic from "next/dynamic";
import { Calendar, Check, CreditCard } from "lucide-react";
import { quoteBreakdown, sek } from "@/lib/stripe/config";
import { distanceLabel, etaPhrase } from "@/lib/velio/route-eta";
import { overBudget } from "@/lib/velio/price";
import { useVelio, type ChatCard } from "@/lib/velio/store";

const EnrouteMap = dynamic(() => import("@/components/velio/enroute-map").then((mod) => mod.EnrouteMap), {
  ssr: false,
  loading: () => <div className="mt-3 h-32 rounded-2xl bg-sand" />,
});

function Stamp({ time }: { time?: string }) {
  return time ? <p className="mt-1 text-right text-xs text-muted">{time}</p> : null;
}

export function TimeConfirmationCard({
  card,
  mine,
  time,
  onAccept,
  onPropose,
}: {
  card: Extract<ChatCard, { kind: "time_confirmation" }>;
  mine: boolean;
  time?: string;
  onAccept?: () => void;
  onPropose?: () => void;
}) {
  const confirmed = card.status === "confirmed";
  return (
    <div>
      <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="size-5" />
          <h3 className="text-lg font-semibold">Tid</h3>
          <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${confirmed ? "bg-ok/15 text-ok" : "bg-sand text-muted"}`}>
            {confirmed ? "Bekräftad" : "Väntar"}
          </span>
        </div>
        <div className="space-y-1 text-[15px]">
          {card.service ? <p><span className="font-semibold">Uppdrag:</span> {card.service}</p> : null}
          {card.date ? <p><span className="font-semibold">Datum:</span> {card.date}</p> : null}
          {card.time ? <p><span className="font-semibold">Tid:</span> {card.time}</p> : null}
          {card.place ? <p><span className="font-semibold">Plats:</span> {card.place}</p> : null}
        </div>
        {!mine && !confirmed && onAccept && onPropose ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={onPropose} className="rounded-full border border-line py-3 text-[15px] font-semibold">
              Föreslå ny tid
            </button>
            <button type="button" onClick={onAccept} className="rounded-full bg-brown py-3 text-[15px] font-semibold text-white">
              Godkänn
            </button>
          </div>
        ) : null}
      </div>
      <Stamp time={time} />
    </div>
  );
}

export function FinalPriceMessage({
  card,
  mine,
  time,
  onPay,
}: {
  card: Extract<ChatCard, { kind: "final_price" }>;
  mine: boolean;
  time?: string;
  onPay?: () => void;
}) {
  const parts = quoteBreakdown(card.amount);
  const paid = card.status === "paid";
  const posted = useVelio((state) => state.posted);
  const accountId = useVelio((state) => state.accountId);
  const budgetJob = posted.find((job) => (!accountId || job.ownerId === accountId) && overBudget(card.amount, job));
  return (
    <div>
      <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="size-5" />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold leading-tight">Slutpris</span>
            <span className="block text-sm text-muted">{card.service}</span>
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paid ? "bg-ok/15 text-ok" : "bg-sand text-muted"}`}>
            {paid ? "Betald" : mine ? "Väntar på betalning" : "Att betala"}
          </span>
        </div>
        <div className="space-y-1.5 text-[15px]">
          {card.hours && card.rate ? (
            <p className="flex justify-between text-muted"><span>{String(card.hours).replace(".", ",")} tim × {sek(card.rate).replace(/ kr$/, "")} kr/tim</span><span>{sek(parts.work)}</span></p>
          ) : (
            <p className="flex justify-between"><span>Jobbpris</span><span>{sek(parts.work)}</span></p>
          )}
          <p className="flex justify-between text-muted"><span>Serviceavgift VELIO</span><span>{sek(parts.fee)}</span></p>
          <p className="flex justify-between border-t border-line pt-2 font-semibold"><span>Totalt</span><span>{sek(parts.total)}</span></p>
          {budgetJob ? <p className="text-xs text-brown">Över kundens budget</p> : null}
        </div>
        {card.when || card.place ? (
          <p className="mt-3 text-sm text-muted">{[card.when, card.place].filter(Boolean).join(" · ")}</p>
        ) : null}
        {paid ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-[15px] font-semibold text-ok">
            <Check className="size-4" /> Betald
          </p>
        ) : !mine && onPay ? (
          <button type="button" onClick={onPay} className="mt-4 w-full rounded-full bg-brown py-3.5 text-base font-semibold text-white">
            Betala
          </button>
        ) : null}
      </div>
      <Stamp time={time} />
    </div>
  );
}

export function BookingChangeCard({
  card,
  mine,
  time,
  onAccept,
  onDecline,
}: {
  card: Extract<ChatCard, { kind: "booking_change" }>;
  mine: boolean;
  time?: string;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const pending = card.status === "pending";
  const label = card.status === "accepted" ? "Godkänd" : card.status === "declined" ? "Avböjd" : mine ? "Väntar på svar" : "Väntar";
  return (
    <div>
      <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="size-5" />
          <h3 className="text-lg font-semibold">Ny tid</h3>
          <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${card.status === "accepted" ? "bg-ok/15 text-ok" : "bg-sand text-muted"}`}>
            {label}
          </span>
        </div>
        <div className="space-y-1 text-[15px]">
          {card.service ? <p><span className="font-semibold">Uppdrag:</span> {card.service}</p> : null}
          <p><span className="font-semibold">Datum:</span> {card.date}</p>
          <p><span className="font-semibold">Tid:</span> {card.time}</p>
          {card.place ? <p><span className="font-semibold">Plats:</span> {card.place}</p> : null}
          {card.description ? <p><span className="font-semibold">Beskrivning:</span> {card.description}</p> : null}
        </div>
        {!mine && pending && onAccept && onDecline ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={onDecline} className="rounded-full border border-line py-3 text-[15px] font-semibold">
              Avböj
            </button>
            <button type="button" onClick={onAccept} className="rounded-full bg-brown py-3 text-[15px] font-semibold text-white">
              Godkänn
            </button>
          </div>
        ) : null}
      </div>
      <Stamp time={time} />
    </div>
  );
}

export function OnTheWayCard({
  card,
  time,
}: {
  card: Extract<ChatCard, { kind: "on_the_way" }>;
  time?: string;
}) {
  const arrived = card.status === "arrived";
  const phrase = etaPhrase(card);
  const showMap = !arrived && !card.approximate && card.lat != null && card.lng != null && card.jobLat != null && card.jobLng != null;
  const distance = distanceLabel(card.distanceM);
  return (
    <div>
      <div className="rounded-[1.25rem] border border-line bg-white px-4 py-4">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-lg font-semibold">{arrived ? "Framme" : "På väg"}</h3>
          {card.approximate && !arrived ? <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-muted">Ungefär</span> : null}
        </div>
        <p className="text-[15px]">{arrived ? "Utföraren är framme." : `På väg – ${phrase}`}</p>
        {distance && !arrived ? <p className="mt-1 text-sm text-muted">{distance}</p> : null}
        {card.place ? <p className="mt-1 text-sm text-muted">{card.place}</p> : null}
        {showMap ? <EnrouteMap worker={{ lat: card.lat!, lng: card.lng! }} job={{ lat: card.jobLat!, lng: card.jobLng! }} /> : null}
      </div>
      <Stamp time={time} />
    </div>
  );
}
