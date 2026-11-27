export type PriceType = "quote" | "budget" | "fixed" | "hourly";

export type JobPrice = {
  priceType?: string | null;
  price?: number | null;
  rate?: string | null;
  estHours?: number | null;
};

/** Swedish kronor with a space as the thousands separator, for example 1 500 kr. */
export function formatKr(value: number) {
  const amount = Math.round(Number(value) || 0);
  return `${new Intl.NumberFormat("sv-SE").format(Math.abs(amount))} kr`;
}

export function normalizeJobPrice(job: JobPrice): { priceType: PriceType; price: number; estHours?: number } {
  const raw = Number(job.price);
  const price = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  const hours = Number(job.estHours);
  const estHours = Number.isFinite(hours) && hours > 0 ? hours : undefined;
  if (job.priceType === "quote") return { priceType: "quote", price: 0, estHours };
  if (job.priceType === "budget") return { priceType: price > 0 ? "budget" : "quote", price, estHours };
  if (job.priceType === "hourly") return { priceType: price > 0 ? "hourly" : "quote", price, estHours };
  if (job.priceType === "fixed") return { priceType: price > 0 ? "fixed" : "quote", price, estHours };
  if (price > 0) return { priceType: job.rate === "hour" ? "hourly" : "fixed", price, estHours };
  return { priceType: "quote", price: 0, estHours };
}

export function overBudget(amount: number, job: JobPrice) {
  const next = normalizeJobPrice(job);
  return next.priceType === "budget" && amount > next.price;
}

/** Card pill. Never returns "0 kr". */
export function jobPriceCard(job: JobPrice) {
  const next = normalizeJobPrice(job);
  if (next.priceType === "hourly") return `${formatKr(next.price).replace(/ kr$/, "")} kr/tim`;
  if (next.priceType === "fixed") return `Fr ${formatKr(next.price)}`;
  if (next.priceType === "budget") return `Max ${formatKr(next.price)}`;
  return "Ge offert";
}

/** Detail line. Never returns "0 kr". */
export function jobPriceDetail(job: JobPrice) {
  const next = normalizeJobPrice(job);
  if (next.priceType === "hourly") {
    const hours = next.estHours ? ` · ca ${String(next.estHours).replace(".", ",")} tim` : "";
    return `${formatKr(next.price).replace(/ kr$/, "")} kr/tim${hours}`;
  }
  if (next.priceType === "fixed") return formatKr(next.price);
  if (next.priceType === "budget") return `Budget: max ${formatKr(next.price)}`;
  return "Pris enligt offert";
}

/** A money amount in chat. Zero is an offer, not 0 kr. */
export function priceOrQuote(amount: number) {
  return amount > 0 ? formatKr(amount) : "Pris enligt offert";
}
