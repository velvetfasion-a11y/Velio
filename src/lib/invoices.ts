import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase/client";
import { paymentsApiBase } from "@/lib/stripe/config";

export function safeOrgNr(value: string) {
  const digits = value.replace(/\D/g, "");
  const body = digits.length === 12 ? digits.slice(2) : digits;
  if (body.length !== 10) return "";
  const month = Number(body.slice(2, 4));
  if (month >= 1 && month <= 12) return "";
  return `${body.slice(0, 6)}-${body.slice(6)}`;
}

export async function saveInvoiceBuyer(offerId: string, input: { companyName: string; orgNr: string }) {
  if (!offerId || offerId === "demo") return;
  const uid = firebaseAuth().currentUser?.uid;
  if (!uid) return;
  const ref = doc(firebaseDb(), "invoiceDrafts", offerId);
  const companyName = input.companyName.trim().slice(0, 120);
  const orgNr = safeOrgNr(input.orgNr);
  if (!companyName && !orgNr) {
    await deleteDoc(ref).catch(() => undefined);
    return;
  }
  const payload: Record<string, unknown> = { buyerId: uid, updatedAt: serverTimestamp() };
  if (companyName) payload.companyName = companyName;
  if (orgNr) payload.orgNr = orgNr;
  await setDoc(ref, payload);
}

export async function downloadInvoicePdf(invoiceId: string, filename: string) {
  const base = paymentsApiBase();
  if (!base) throw new Error("Betaltjänsten är inte kopplad ännu");
  const token = await firebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Logga in igen");
  const response = await fetch(`${base}/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) throw new Error("Fakturan finns inte ännu");
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Fakturan kunde inte hämtas");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
