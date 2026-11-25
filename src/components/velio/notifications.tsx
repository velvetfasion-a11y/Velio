import { ArrowLeft, Bell, CheckCircle2, CircleX, ClipboardList, Info } from "lucide-react";
import { useVelio, type AppNotification } from "@/lib/velio/store";
import { cn } from "@/lib/cn";
import { Btn } from "@/components/velio/ui";

function iconFor(kind: AppNotification["kind"]) {
  if (kind === "booking_accepted") return CheckCircle2;
  if (kind === "booking_declined") return CircleX;
  if (kind === "booking_requested" || kind === "booking_done") return ClipboardList;
  return Info;
}

function toneFor(kind: AppNotification["kind"]) {
  if (kind === "booking_accepted") return "text-ok";
  if (kind === "booking_declined") return "text-[#a33a2c]";
  return "text-bronze";
}

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleString("sv-SE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function NotificationsScreen() {
  const go = useVelio((state) => state.go);
  const notes = useVelio((state) => state.appNotifications);
  const markNotificationRead = useVelio((state) => state.markNotificationRead);
  const openBookingFromNotification = useVelio((state) => state.openBookingFromNotification);

  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="bg-cream">
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" aria-label="Tillbaka" onClick={() => go("home")} className="grid size-10 place-items-center">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="flex-1 text-center font-serif text-[1.7rem] leading-none font-medium tracking-[0.08em]">Notiser</h1>
        <span className="grid size-10 place-items-center" aria-hidden="true">
          <Bell className="size-5 text-muted" />
        </span>
      </div>

      <div className="px-4 pt-2 pb-8">
        {sorted.length === 0 ? <p className="text-sm text-muted">Inga notiser ännu.</p> : null}
        <div className="space-y-3">
          {sorted.map((note) => {
            const Icon = iconFor(note.kind);
            return (
              <article
                key={note.id}
                className={cn(
                  "rounded-[1.35rem] border border-line px-4 py-3.5",
                  note.read ? "bg-paper/40" : "bg-paper",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-sand", toneFor(note.kind))}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold leading-snug">{note.title}</h2>
                      {!note.read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-gold" aria-label="Oläst" /> : null}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{note.body}</p>
                    <p className="mt-1.5 text-xs text-muted">{timeLabel(note.createdAt)}</p>
                    {note.bookingId ? (
                      <Btn
                        className="mt-3 py-2.5 text-sm"
                        onClick={() => {
                          markNotificationRead(note.id);
                          openBookingFromNotification(note.bookingId!);
                        }}
                      >
                        Gå till bokningen
                      </Btn>
                    ) : (
                      <button
                        type="button"
                        className="mt-3 text-sm font-semibold"
                        onClick={() => markNotificationRead(note.id)}
                      >
                        Markera som läst
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
