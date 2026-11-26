import { firebaseAuth } from "@/lib/firebase/client";
import { paymentsApiBase } from "@/lib/stripe/config";

export async function downloadInvoicePdf(invoiceId: string, filename: string) {
  const base = paymentsApiBase();
  if (!base) throw new Error("Betaltjänsten är inte kopplad ännu");
  const token = await firebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Logga in igen");
  const response = await fetch(`${base}/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) throw new Error("Kvittot finns inte ännu");
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Kvittot kunde inte hämtas");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
