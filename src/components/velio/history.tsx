import { useEffect, useRef, useState } from "react";
import { Leaf, Shield, Sparkles, Wrench, Zap, type LucideIcon } from "lucide-react";
import { kr, serviceById, type ServiceId } from "@/lib/velio/data";
import { useVelio, bookingStatusLabel, type Booking, type VelioInvoice } from "@/lib/velio/store";
import { downloadInvoicePdf } from "@/lib/invoices";
import { AppHeader } from "@/components/velio/header";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/velio/asset";

const again: { id: ServiceId; label: string; image: string; icon: LucideIcon }[] = [
  { id: "el", label: "Elektriker", image: asset("/velio/el.jpg"), icon: Zap },
  { id: "stad", label: "Städning", image: asset("/velio/stad.jpg"), icon: Sparkles },
  { id: "trad", label: "Trädgård", image: asset("/velio/trad.jpg"), icon: Leaf },
  { id: "rep", label: "Reparationer", image: asset("/velio/rep.jpg"), icon: Wrench },
  { id: "sak", label: "Säkerhet", image: asset("/velio/sak.jpg"), icon: Shield },
];

const thumbs: Partial<Record<ServiceId, string>> = {
  el: asset("/velio/el.jpg"),
  stad: asset("/velio/stad.jpg"),
  trad: asset("/velio/trad.jpg"),
  rep: asset("/velio/rep.jpg"),
  sak: asset("/velio/sak.jpg"),
  ren: asset("/velio/ren.jpg"),
  per: asset("/velio/per.jpg"),
  til: asset("/velio/til.jpg"),
};

export function HistoryScreen() {
  const bookings = useVelio((state) => state.bookings);
  const invoices = useVelio((state) => state.invoices);
  const openReceipt = useVelio((state) => state.openReceipt);
  const rebook = useVelio((state) => state.rebook);
  const openService = useVelio((state) => state.openService);
  const scroller = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0.42 });

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const width = el.scrollWidth ? Math.min(1, el.clientWidth / el.scrollWidth) : 1;
    const left = max > 0 ? (el.scrollLeft / max) * (1 - width) : 0;
    setThumb({ left, width });
  };

  useEffect(() => {
    onScroll();
  }, []);

  return (
    <div className="bg-cream">
      <AppHeader />
      <div className="px-4 pt-5">
        <h1 className="font-serif text-[2.6rem] leading-none font-medium">Historik</h1>
        {invoices.length ? (
          <div className="mt-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted">Kvitton</h2>
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {bookings.length === 0 ? <p className="text-sm text-muted">Inga bokningar ännu.</p> : null}
          {bookings.map((booking) => (
            <HistoryCard key={booking.id} booking={booking} onOpen={() => openReceipt(booking.id)} onRebook={() => rebook(booking.id)} />
          ))}
        </div>

        <h2 className="mt-8 font-serif text-[2.2rem] leading-none font-medium">Boka igen</h2>
        <div ref={scroller} onScroll={onScroll} className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {again.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => openService(item.id)} className="w-[4.6rem] shrink-0 text-center">
                <span className="relative block overflow-hidden rounded-2xl">
                  <img src={item.image} alt="" className="aspect-square w-full object-cover" />
                  <Icon className="absolute bottom-1.5 left-1.5 size-4 text-paper drop-shadow" />
                </span>
                <span className="mt-1.5 block text-[11px] leading-tight font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="relative mt-3 mb-6 h-0.5 rounded-full bg-line">
          <span className="absolute top-0 h-0.5 rounded-full bg-bronze" style={{ left: `${thumb.left * 100}%`, width: `${thumb.width * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: VelioInvoice }) {
  const showToast = useVelio((state) => state.showToast);
  return (
    <article className="flex items-center gap-3 rounded-[1.25rem] border border-line bg-paper p-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{invoice.number || "Kvitto"}</p>
        <p className="text-[13px] text-muted">{invoice.title}</p>
        <p className="text-[13px] text-muted">{kr(invoice.totalSek)}{invoice.status === "draft" ? " · Utkast" : ""}</p>
      </div>
      <button
        type="button"
        onClick={() => void downloadInvoicePdf(invoice.id, `${invoice.number || "faktura"}.pdf`).catch((reason: unknown) => showToast(reason instanceof Error ? reason.message : "Fakturan kunde inte hämtas"))}
        className="shrink-0 rounded-full bg-[#1A1A1A] px-3 py-2 text-[13px] font-semibold text-white"
      >
        Ladda ner faktura (PDF)
      </button>
    </article>
  );
}

export function HistoryCard({ booking, onOpen, onRebook }: { booking: Booking; onOpen: () => void; onRebook: () => void }) {
  const service = serviceById(booking.serviceId);
  const status = bookingStatusLabel(booking.status);
  const photo = thumbs[booking.serviceId];
  return (
    <article className="flex items-center gap-3 rounded-[1.25rem] border border-line bg-paper/75 backdrop-blur-xl p-2.5">
      <button type="button" onClick={onOpen} className="shrink-0">
        {photo ? (
          <img src={photo} alt="" className="size-[4.25rem] rounded-xl object-cover" />
        ) : (
          <span className="grid size-[4.25rem] place-items-center rounded-xl bg-sand font-serif text-xl">{service?.name.slice(0, 1)}</span>
        )}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block font-semibold">{service?.name}</span>
        <span className="mt-0.5 block text-[13px] leading-tight text-muted">{booking.whenLabel}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{kr(booking.cost)}</span>
      </button>
      <span className={cn("text-sm font-medium", booking.status === "done" ? "text-ok" : "text-ink")}>{status}</span>
      <button type="button" onClick={onOpen} className="shrink-0 text-sm font-semibold text-ink">
        Kvitto
      </button>
      <button type="button" onClick={onRebook} className="shrink-0 rounded-full bg-bronze px-3.5 py-2 text-sm font-semibold text-white">
        Boka om
      </button>
    </article>
  );
}
