import type { ChatCard, ChatMsg } from "@/lib/velio/store";

const CARD_PREFIX = "VELIO_CARD:";

export function encodeCardMessage(card: ChatCard, fallback = "Bokningsförfrågan"): string {
  return `${CARD_PREFIX}${JSON.stringify({ text: fallback, card })}`;
}

export function decodeStoredMessage(raw: string): { text?: string; card?: ChatCard } {
  if (!raw.startsWith(CARD_PREFIX)) return { text: raw };
  try {
    const parsed = JSON.parse(raw.slice(CARD_PREFIX.length)) as { text?: string; card?: ChatCard };
    if (!parsed?.card || typeof parsed.card !== "object") return { text: raw };
    return {
      text: parsed.text || "Bokningsförfrågan",
      card: parsed.card,
    };
  } catch {
    return { text: raw };
  }
}

export function previewMessageText(raw: string): string {
  const decoded = decodeStoredMessage(raw);
  const card = decoded.card ? presentCard(decoded.card) : legacyCard(raw);
  if (card?.kind === "request") return "Bokningsförfrågan";
  if (card?.kind === "rebook") return "Ny förfrågan";
  if (card?.kind === "confirmed" || card?.kind === "time_confirmation") return "Tid bekräftad";
  if (card?.kind === "quote" || card?.kind === "final_price") return "Slutpris skickat";
  if (card?.kind === "on_the_way") return card.status === "arrived" ? "Framme" : "På väg";
  if (card?.kind === "booking_change") return "Ny tid föreslagen";
  if (card?.kind === "cancelled") return "Uppdraget är avbokat";
  if (card?.kind === "paid") return "Betalning mottagen";
  return decoded.text || raw;
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Older slot/quote cards and plain-text sends render as the structured cards. */
export function presentCard(card: ChatCard): ChatCard {
  if (card.kind === "slot") {
    const clock = card.when.match(/(\d{1,2}:\d{2})\s*$/)?.[1] ?? "";
    const date = clock ? card.when.replace(/,?\s*\d{1,2}:\d{2}\s*$/, "") : card.when;
    return { kind: "time_confirmation", date, time: clock, place: card.place, service: card.service, status: "waiting" };
  }
  if (card.kind === "quote") {
    return { kind: "final_price", service: card.service, amount: card.amount, when: card.when, place: card.place, status: "waiting" };
  }
  return card;
}

export function legacyCard(text: string): ChatCard | null {
  if (/^Tack, jag har skickat min tidsbekräftelse/i.test(text)) {
    return { kind: "time_confirmation", date: "", time: "", place: "", service: "Uppdrag", status: "waiting" };
  }
  const price = text.match(/^Slutpris:\s*([\d\s\u00a0]+)\s*kr/i);
  if (price) {
    const amount = Number(price[1].replace(/[\s\u00a0]/g, ""));
    if (amount > 0) return { kind: "final_price", service: "Uppdrag", amount, when: "", place: "", status: "waiting" };
  }
  if (text.startsWith("Uppdraget är avbokat")) return { kind: "cancelled" };
  return null;
}

export function displayMessage(message: ChatMsg): ChatMsg {
  if (message.card) {
    const card = presentCard(message.card);
    return card === message.card ? message : { ...message, card };
  }
  const decoded = message.text ? decodeStoredMessage(message.text) : {};
  const card = decoded.card ? presentCard(decoded.card) : message.text ? legacyCard(message.text) : null;
  if (!card) return message;
  return { ...message, card, text: undefined };
}

export function messageFromFirestore(id: string, data: Record<string, unknown>, mine: boolean, time: string): ChatMsg {
  const from = mine ? "me" : "them";
  const type = str(data.type);
  if (type === "time_confirmation") {
    return {
      id,
      from,
      time,
      card: {
        kind: "time_confirmation",
        date: str(data.date),
        time: str(data.time),
        place: str(data.place),
        service: str(data.service) || "Uppdrag",
        status: data.status === "confirmed" ? "confirmed" : "waiting",
      },
    };
  }
  if (type === "final_price") {
    return {
      id,
      from,
      time,
      card: {
        kind: "final_price",
        service: str(data.service) || "Uppdrag",
        amount: num(data.amount) ?? 0,
        when: str(data.when),
        place: str(data.place),
        status: data.status === "paid" ? "paid" : "waiting",
      },
    };
  }
  if (type === "on_the_way") {
    return {
      id,
      from,
      time,
      card: {
        kind: "on_the_way",
        place: str(data.place),
        etaMin: num(data.etaMin) ?? 0,
        etaMax: num(data.etaMax),
        distanceM: num(data.distanceM),
        approximate: data.approximate === true,
        status: data.status === "arrived" ? "arrived" : "enroute",
        lat: num(data.lat),
        lng: num(data.lng),
        jobLat: num(data.jobLat),
        jobLng: num(data.jobLng),
      },
    };
  }
  if (type === "booking_change") {
    const status = data.status === "accepted" || data.status === "declined" ? data.status : "pending";
    return {
      id,
      from,
      time,
      card: {
        kind: "booking_change",
        date: str(data.date),
        time: str(data.time),
        place: str(data.place),
        description: str(data.description) || undefined,
        service: str(data.service) || "Uppdrag",
        status,
      },
    };
  }
  if (type === "cancelled") {
    return { id, from: "system", time, card: { kind: "cancelled" } };
  }
  const text = str(data.text);
  const base = displayMessage({ id, from, time, text });
  return base;
}

export function chatDtoToMsg(message: {
  id: string;
  from: "me" | "them";
  text: string;
  time?: string;
}): ChatMsg {
  const decoded = decodeStoredMessage(message.text);
  return {
    id: message.id,
    from: message.from,
    text: decoded.card ? decoded.text : message.text,
    time: message.time,
    card: decoded.card,
  };
}

/** Resolve take-job request cards from later accept/decline replies in the same thread. */
export function resolveTakeRequestStatuses(messages: ChatMsg[]): ChatMsg[] {
  return messages.map((message, index) => {
    if (message.card?.kind !== "request" || message.card.intent !== "take") return message;
    if (message.card.status && message.card.status !== "pending") return message;
    for (let later = index + 1; later < messages.length; later += 1) {
      const next = messages[later];
      const text = next.text ?? "";
      if (text.includes("Jag godkänner")) {
        return { ...message, card: { ...message.card, status: "accepted" } };
      }
      if (text.includes("annan utförare")) {
        return { ...message, card: { ...message.card, status: "declined" } };
      }
      if (next.card?.kind === "request" && next.card.intent === "take" && next.card.status === "accepted") {
        return { ...message, card: { ...message.card, status: "accepted" } };
      }
      if (next.card?.kind === "request" && next.card.intent === "take" && next.card.status === "declined") {
        return { ...message, card: { ...message.card, status: "declined" } };
      }
    }
    return message;
  });
}
