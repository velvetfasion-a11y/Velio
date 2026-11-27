import { FieldValue } from "firebase-admin/firestore";
import PDFDocument from "pdfkit";

const BROWN = "#6B4226";
const INK = "#1A1A1A";
const MUTED = "#6E6560";
const LINE = "#E6E1DB";
const CREAM = "#FAF8F5";

export function sellerConfig() {
  return {
    name: String(process.env.VELIO_COMPANY_NAME || "").trim() || "VELIO",
    email: String(process.env.VELIO_EMAIL || "").trim(),
  };
}

/** Organisation numbers only. A personnummer-shaped value is dropped. */
export function safeOrgNr(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const body = digits.length === 12 ? digits.slice(2) : digits;
  if (body.length !== 10) return "";
  const month = Number(body.slice(2, 4));
  if (month >= 1 && month <= 12) return "";
  return `${body.slice(0, 6)}-${body.slice(6)}`;
}

export function sekFromOre(ore) {
  const abs = Math.abs(Math.round(Number(ore) || 0));
  const kronor = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = String(kronor).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = cents ? `${grouped},${String(cents).padStart(2, "0")}` : grouped;
  return `${ore < 0 ? "−" : ""}${body} kr`;
}

function text(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildInvoice({ intent, job, buyer, workerUser, business, now = new Date() }) {
  const seller = sellerConfig();
  const totalOre = Math.round(Number(intent.amount) || 0);
  const extra = intent.metadata?.feeModel === "extra";
  const workOre = extra ? Number(intent.metadata.workOre) || 0 : Math.max(0, totalOre - Math.round(totalOre * 0.1));
  const feeOre = extra ? Number(intent.metadata.feeOre) || 0 : Math.round(totalOre * 0.1);
  const workerName = text(workerUser?.displayName || business?.companyName, 120) || "Utförare";
  const when = text(job?.schedule?.when || job?.schedule?.date, 120);
  const address = text(job?.locationLabel, 200);
  const category = text(job?.category || job?.title, 80) || "Uppdrag";
  const title = text(job?.title || category, 120);

  return {
    status: "issued",
    kind: "receipt",
    currency: "sek",
    issuedAt: now.toISOString(),
    buyerId: text(intent.metadata?.customerId, 128),
    workerId: text(intent.metadata?.workerId, 128),
    buyerName: text(buyer?.displayName, 80),
    buyerEmail: text(buyer?.email, 254),
    jobId: text(intent.metadata?.jobId, 128),
    offerId: text(intent.metadata?.offerId, 128),
    job: { category, date: when, address, title },
    worker: { name: workerName },
    velio: { name: seller.name || "VELIO", email: seller.email },
    lines: [
      { title: "Jobbpris", amountOre: workOre },
      { title: "Serviceavgift VELIO", amountOre: feeOre },
    ],
    totalOre,
    payment: {
      method: text(intent.paymentMethodLabel || "Kort", 80),
      paymentIntentId: intent.id,
    },
  };
}

export async function paymentMethodLabel(stripe, intent) {
  const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : "";
  if (!stripe || !chargeId) return "Kort";
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const details = charge.payment_method_details || {};
    if (details.type === "card") {
      const wallet = details.card?.wallet?.type;
      if (wallet === "apple_pay") return "Apple Pay";
      if (wallet === "google_pay") return "Google Pay";
      const brand = details.card?.brand || "Kort";
      const last4 = details.card?.last4 || "";
      const pretty = brand.charAt(0).toUpperCase() + brand.slice(1);
      return last4 ? `${pretty} ···· ${last4}` : pretty;
    }
    if (details.type === "klarna") return "Klarna";
    return details.type || "Kort";
  } catch {
    return "Kort";
  }
}

export async function createInvoiceForIntent(db, stripe, intent) {
  const ref = db.collection("invoices").doc(intent.id);
  const existing = await ref.get();
  if (existing.exists) return existing.data();
  const meta = intent.metadata || {};
  const [jobSnap, buyerSnap, workerSnap, businessSnap, draftSnap] = await Promise.all([
    meta.jobId ? db.collection("jobs").doc(meta.jobId).get() : null,
    meta.customerId ? db.collection("users").doc(meta.customerId).get() : null,
    meta.workerId ? db.collection("users").doc(meta.workerId).get() : null,
    meta.workerId ? db.collection("businesses").doc(meta.workerId).get() : null,
  ]);
  const label = await paymentMethodLabel(stripe, intent);
  const invoice = buildInvoice({
    intent: { ...intent, paymentMethodLabel: label },
    job: jobSnap?.exists ? jobSnap.data() : null,
    buyer: buyerSnap?.exists ? buyerSnap.data() : null,
    workerUser: workerSnap?.exists ? workerSnap.data() : null,
    business: businessSnap?.exists ? businessSnap.data() : null,
  });
  const saved = await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (current.exists) return current.data();
    const counterRef = db.collection("counters").doc("invoices");
    const counter = await tx.get(counterRef);
    const year = Number(invoice.issuedAt.slice(0, 4));
    const data = counter.exists ? counter.data() : {};
    const value = data.year === year ? Number(data.value || 0) + 1 : 1;
    tx.set(counterRef, { year, value, updatedAt: FieldValue.serverTimestamp() });
    const number = `VELIO-${year}-${String(value).padStart(6, "0")}`;
    const record = {
      ...invoice,
      number,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, record);
    return record;
  });
  if (saved?.number && !saved.emailed) {
    const email = await sendInvoiceEmail(saved).catch(() => ({ sent: false }));
    if (email.sent) await ref.set({ emailed: true }, { merge: true });
  }
  return saved;
}

export function renderInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, compress: false });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawInvoice(doc, invoice);
    doc.end();
  });
}

function paidStamp(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function drawInvoice(doc, invoice) {
  const seller = invoice.velio?.name || "VELIO";
  doc.rect(0, 0, 595, 92).fill(CREAM);
  doc.fillColor(BROWN).font("Helvetica-Bold").fontSize(26).text(seller, 48, 36);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text("KVITTO", 360, 40, { width: 180, align: "right" });
  let y = 116;
  const row = (label, value) => {
    if (!value) return;
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(label, 48, y, { width: 160 });
    doc.fillColor(INK).font("Helvetica").fontSize(11).text(String(value), 210, y, { width: 330 });
    y += 22;
  };
  row("Kvittonummer", invoice.number || "");
  row("Betald", paidStamp(invoice.issuedAt));
  row("Status", "Betald");
  y += 8;
  doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke();
  y += 16;
  doc.fillColor(BROWN).font("Helvetica-Bold").fontSize(11).text("Uppdrag", 48, y);
  y += 18;
  row("Kategori", invoice.job?.category || invoice.job?.title || "Uppdrag");
  row("Datum", invoice.job?.date || "");
  row("Plats", invoice.job?.address || "");
  row("Utförare", invoice.worker?.name || "");
  y += 6;
  doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke();
  y += 16;
  const work = (invoice.lines || []).find((line) => line.title === "Jobbpris") || invoice.lines?.[0];
  const fee = (invoice.lines || []).find((line) => String(line.title || "").includes("Serviceavgift"));
  const amountRow = (label, ore, bold) => {
    doc.fillColor(INK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 11).text(label, 48, y);
    doc.text(sekFromOre(ore), 360, y, { width: 187, align: "right" });
    y += bold ? 24 : 20;
  };
  if (work) amountRow("Jobbpris", work.amountOre);
  if (fee) amountRow("Serviceavgift VELIO", fee.amountOre);
  doc.moveTo(300, y).lineTo(547, y).strokeColor(LINE).stroke();
  y += 10;
  amountRow("Totalt", invoice.totalOre, true);
  y += 8;
  row("Betalsätt", invoice.payment?.method || "Kort");
  if (invoice.velio?.email) {
    y += 10;
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Support ${invoice.velio.email}`, 48, y);
  }
}

export async function sendInvoiceEmail(invoice) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || process.env.VELIO_EMAIL;
  if (!key || !from || !invoice.buyerEmail) return { sent: false, skipped: true };
  const pdf = await renderInvoicePdf(invoice);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [invoice.buyerEmail],
      subject: `Kvitto ${invoice.number}`,
      text: `Hej,\n\nHär är kvitto ${invoice.number} för ${invoice.job?.title || "uppdraget"}. ${sekFromOre(invoice.totalOre)}. Status: Betald.\n`,
      attachments: [{ filename: `${invoice.number}.pdf`, content: pdf.toString("base64") }],
    }),
  });
  if (!response.ok) return { sent: false, skipped: false };
  return { sent: true };
}
