import { FieldValue } from "firebase-admin/firestore";
import PDFDocument from "pdfkit";

const BROWN = "#6B4226";
const INK = "#1A1A1A";
const MUTED = "#6E6560";
const LINE = "#E6E1DB";
const CREAM = "#FAF8F5";

export function envFlag(name) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return null;
}

export function sellerConfig() {
  const vatRegistered = envFlag("VELIO_VAT_REGISTERED");
  const rate = Number(process.env.VELIO_VAT_RATE || 25);
  return {
    name: String(process.env.VELIO_COMPANY_NAME || "").trim(),
    orgNr: safeOrgNr(process.env.VELIO_ORG_NR),
    vatNr: String(process.env.VELIO_VAT_NR || "").trim(),
    address: String(process.env.VELIO_ADDRESS || "").trim(),
    email: String(process.env.VELIO_EMAIL || "").trim(),
    fSkatt: envFlag("VELIO_F_SKATT"),
    vatRegistered,
    vatRate: vatRegistered ? (Number.isFinite(rate) ? rate : 25) : vatRegistered === false ? 0 : null,
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

export function splitInclusive(amountOre, rate) {
  const amount = Math.round(Number(amountOre) || 0);
  if (rate == null) return { netOre: null, vatOre: null, label: "Momsuppgift saknas" };
  if (Number(rate) === 0) return { netOre: amount, vatOre: 0, label: "Momsfri/ej momsregistrerad" };
  const vatOre = Math.round((amount * Number(rate)) / (100 + Number(rate)));
  return { netOre: amount - vatOre, vatOre, label: `${Number(rate)} %` };
}

function text(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function fSkattLabel(value) {
  if (value === true) return "Godkänd för F-skatt";
  if (value === false) return "Inte godkänd för F-skatt";
  return "F-skatt: uppgift saknas";
}

function workerVat(user) {
  if (!user || typeof user.vatRegistered !== "boolean") return { registered: null, rate: null };
  if (user.vatRegistered === false) return { registered: false, rate: 0 };
  const rate = Number(user.vatRate ?? 25);
  return { registered: true, rate: Number.isFinite(rate) ? rate : 25 };
}

export function buildInvoice({ intent, job, buyer, workerUser, business, draft, now = new Date() }) {
  const seller = sellerConfig();
  const totalOre = Math.round(Number(intent.amount) || 0);
  const extra = intent.metadata?.feeModel === "extra";
  const workOre = extra ? Number(intent.metadata.workOre) || 0 : totalOre - Math.round(totalOre * 0.1);
  const feeOre = extra ? Number(intent.metadata.feeOre) || 0 : Math.round(totalOre * 0.1);
  const workerRate = workerVat(workerUser);
  const workVat = splitInclusive(workOre, workerRate.rate);
  const feeVat = splitInclusive(feeOre, seller.vatRate);
  const orgNr = safeOrgNr(workerUser?.orgNumber) || safeOrgNr(business?.orgNumber);
  const workerName = text(business?.companyName || workerUser?.displayName, 120);
  const buyerCompany = safeOrgNr(draft?.orgNr || intent.metadata?.buyerOrgNr);
  const buyerCompanyName = text(draft?.companyName || intent.metadata?.buyerCompanyName, 120);
  const when = text(job?.schedule?.when || job?.schedule?.date, 120);
  const address = text(job?.locationLabel, 200);
  const description = text(job?.description, 500);
  const category = text(job?.category || job?.title, 80);
  const title = text(job?.title || category || "Uppdrag", 120);
  const reasons = [];
  if (!seller.name) reasons.push("VELIO saknar företagsnamn");
  if (!seller.orgNr) reasons.push("VELIO saknar organisationsnummer");
  if (!seller.address) reasons.push("VELIO saknar adress");
  if (!seller.email) reasons.push("VELIO saknar e-post");
  if (seller.vatRegistered == null) reasons.push("VELIO saknar uppgift om momsregistrering");
  if (seller.vatRegistered === true && !seller.vatNr) reasons.push("VELIO saknar momsregistreringsnummer");
  if (!text(buyer?.displayName, 80)) reasons.push("Köparens namn saknas");
  if (!workerName) reasons.push("Utförarens namn saknas");
  if (workerRate.registered == null) reasons.push("Utförarens momsstatus saknas");
  if (!title) reasons.push("Uppgift om uppdraget saknas");

  const lines = [
    {
      seller: "worker",
      title,
      detail: [category, when, address, description].filter(Boolean).join(" · "),
      amountOre: workOre,
      ...workVat,
    },
    {
      seller: "velio",
      title: "Serviceavgift VELIO",
      detail: "Tillägg utöver utförarens pris",
      amountOre: feeOre,
      ...feeVat,
    },
  ];
  const vatGroups = new Map();
  for (const line of lines) {
    const key = line.label;
    const group = vatGroups.get(key) || { label: key, netOre: 0, vatOre: 0, known: line.netOre != null };
    if (line.netOre == null) group.known = false;
    else {
      group.netOre += line.netOre;
      group.vatOre += line.vatOre;
    }
    vatGroups.set(key, group);
  }

  return {
    status: reasons.length ? "draft" : "issued",
    draftReasons: reasons,
    currency: "sek",
    issuedAt: now.toISOString(),
    buyerId: text(intent.metadata?.customerId, 128),
    workerId: text(intent.metadata?.workerId, 128),
    buyerName: text(buyer?.displayName, 80),
    buyerEmail: text(buyer?.email, 254),
    buyerAddress: address,
    buyerCompanyName,
    buyerOrgNr: buyerCompany,
    jobId: text(intent.metadata?.jobId, 128),
    offerId: text(intent.metadata?.offerId, 128),
    job: { category, date: when, address, description, title },
    worker: {
      name: workerName,
      orgNr,
      publicId: orgNr ? "" : text(intent.metadata?.workerId, 12),
      fSkatt: workerUser?.fSkatt === true ? true : workerUser?.fSkatt === false ? false : null,
      kind: orgNr ? "company" : "private",
      vatRegistered: workerRate.registered,
    },
    velio: seller,
    lines,
    vatGroups: [...vatGroups.values()],
    totalOre,
    payment: {
      method: text(intent.paymentMethodLabel || "Kort", 80),
      paymentIntentId: intent.id,
      chargeId: text(intent.latest_charge, 128),
    },
    rut: { eligible: false, note: "RUT är inte aktiverat.", personnummerStored: false },
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
      return last4 ? `${brand} ···· ${last4}` : brand;
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
    meta.offerId ? db.collection("invoiceDrafts").doc(meta.offerId).get() : null,
  ]);
  const label = await paymentMethodLabel(stripe, intent);
  const invoice = buildInvoice({
    intent: { ...intent, paymentMethodLabel: label },
    job: jobSnap?.exists ? jobSnap.data() : null,
    buyer: buyerSnap?.exists ? buyerSnap.data() : null,
    workerUser: workerSnap?.exists ? workerSnap.data() : null,
    business: businessSnap?.exists ? businessSnap.data() : null,
    draft: draftSnap?.exists ? draftSnap.data() : null,
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

function drawInvoice(doc, invoice) {
  const draft = invoice.status !== "issued";
  doc.fillColor(BROWN).font("Helvetica-Bold").fontSize(22).text("VELIO", 48, 46);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text(draft ? "UTKAST" : "FAKTURA", 360, 48, { width: 180, align: "right" });
  doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(invoice.number || "Utan nummer", 360, 72, { width: 180, align: "right" });
  doc.text(String(invoice.issuedAt || "").slice(0, 10), 360, 86, { width: 180, align: "right" });
  if (draft) {
    doc.roundedRect(48, 112, 499, 58, 8).fill(CREAM);
    doc.fillColor(BROWN).font("Helvetica-Bold").fontSize(11).text("Utkast. Inte en färdig faktura.", 64, 124);
    doc.fillColor(INK).font("Helvetica").fontSize(9).text((invoice.draftReasons || []).join(" · ") || "Uppgifter saknas.", 64, 142, { width: 470 });
  }
  let y = draft ? 188 : 120;
  y = party(doc, y, "Från", [
    invoice.velio?.name || "Företagsnamn saknas",
    invoice.velio?.orgNr ? `Org.nr ${invoice.velio.orgNr}` : "Org.nr saknas",
    invoice.velio?.vatNr ? `Momsreg.nr ${invoice.velio.vatNr}` : invoice.velio?.vatRegistered === false ? "Ej momsregistrerad" : "Momsreg.nr saknas",
    invoice.velio?.address || "Adress saknas",
    invoice.velio?.email || "",
    fSkattLabel(invoice.velio?.fSkatt),
  ]);
  const buyerLines = [
    invoice.buyerCompanyName || invoice.buyerName || "Namn saknas",
    invoice.buyerCompanyName && invoice.buyerName ? invoice.buyerName : "",
    invoice.buyerOrgNr ? `Org.nr ${invoice.buyerOrgNr}` : "",
    invoice.buyerAddress || "",
    invoice.buyerEmail || "",
  ];
  y = party(doc, y, "Köpare", buyerLines);
  const workerId = invoice.worker?.orgNr
    ? `Org.nr ${invoice.worker.orgNr}`
    : invoice.worker?.publicId
      ? `Utförar-id ${invoice.worker.publicId}`
      : "Identitet saknas";
  y = party(doc, y, "Utförare", [invoice.worker?.name || "Namn saknas", workerId, fSkattLabel(invoice.worker?.fSkatt)]);
  y += 8;
  doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke();
  y += 14;
  doc.fillColor(MUTED).font("Helvetica").fontSize(9);
  doc.text("Beskrivning", 48, y);
  doc.text("Netto", 330, y, { width: 70, align: "right" });
  doc.text("Moms", 400, y, { width: 70, align: "right" });
  doc.text("Belopp", 470, y, { width: 77, align: "right" });
  y += 16;
  for (const line of invoice.lines || []) {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(line.title, 48, y, { width: 270 });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(line.detail || "", 48, y + 16, { width: 270 });
    doc.fillColor(INK).font("Helvetica").fontSize(10);
    doc.text(line.netOre == null ? "—" : sekFromOre(line.netOre), 330, y, { width: 70, align: "right" });
    doc.text(line.vatOre == null ? "—" : sekFromOre(line.vatOre), 400, y, { width: 70, align: "right" });
    doc.text(sekFromOre(line.amountOre), 470, y, { width: 77, align: "right" });
    doc.fillColor(MUTED).fontSize(8).text(line.label, 400, y + 16, { width: 147, align: "right" });
    y += 42;
  }
  doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke();
  y += 12;
  for (const group of invoice.vatGroups || []) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(
      group.known ? `${group.label}: netto ${sekFromOre(group.netOre)}, moms ${sekFromOre(group.vatOre)}` : group.label,
      48,
      y,
      { width: 320 },
    );
    y += 14;
  }
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(14).text(`Att betala ${sekFromOre(invoice.totalOre)}`, 300, y + 6, { width: 247, align: "right" });
  y += 36;
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Betalt med ${invoice.payment?.method || "okänt sätt"}`, 48, y);
  y += 12;
  doc.text(`Betalreferens ${invoice.payment?.paymentIntentId || "—"}`, 48, y);
  if (invoice.payment?.chargeId) {
    y += 12;
    doc.text(`Debitering ${invoice.payment.chargeId}`, 48, y);
  }
  y += 22;
  doc.text(invoice.rut?.note || "", 48, y);
  doc.fillColor(BROWN).fontSize(8).text("VELIO", 48, 780, { width: 499, align: "center" });
}

function party(doc, y, title, lines) {
  doc.fillColor(BROWN).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), 48, y);
  let next = y + 14;
  doc.fillColor(INK).font("Helvetica").fontSize(10);
  for (const line of lines.filter(Boolean)) {
    doc.text(line, 48, next, { width: 499 });
    next += 14;
  }
  return next + 8;
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
      subject: `${invoice.status === "issued" ? "Faktura" : "Utkast"} ${invoice.number}`,
      text: `${invoice.buyerName || "Hej"},\n\nHär är ${invoice.number} för ${invoice.job?.title || "uppdraget"}. ${sekFromOre(invoice.totalOre)}.\n`,
      attachments: [{ filename: `${invoice.number}.pdf`, content: pdf.toString("base64") }],
    }),
  });
  if (!response.ok) return { sent: false, skipped: false };
  return { sent: true };
}
