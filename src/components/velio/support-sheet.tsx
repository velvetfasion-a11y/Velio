"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase/client";
import { paymentsApiBase } from "@/lib/stripe/config";
import { useVelio } from "@/lib/velio/store";

let opener: (topic?: string) => void = () => undefined;

export function openSupportSheet(topic?: string) {
  opener(topic);
}

export function SupportHost() {
  const loggedIn = useVelio((state) => state.loggedIn);
  const showToast = useVelio((state) => state.showToast);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("Övrigt");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    opener = (next) => {
      setTopic(next || "Övrigt");
      setText(next && next !== "Övrigt" ? next : "");
      setSent(false);
      setOpen(true);
    };
    return () => {
      opener = () => undefined;
    };
  }, []);
  if (!open || !loggedIn) return null;

  const send = async () => {
    const body = text.trim();
    if (body.length < 2) {
      showToast("Skriv ett meddelande");
      return;
    }
    const user = firebaseAuth().currentUser;
    if (!user) {
      showToast("Logga in igen");
      return;
    }
    try {
      const base = paymentsApiBase();
      if (base) {
        const token = await user.getIdToken();
        const response = await fetch(`${base}/api/support/threads`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: body, topic }),
        });
        if (!response.ok) throw new Error("api");
      } else {
        const ref = await addDoc(collection(firebaseDb(), "supportThreads"), {
          customerId: user.uid,
          participantIds: [user.uid],
          status: "open",
          topic: topic.slice(0, 80),
          lastMessagePreview: body.slice(0, 140),
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(firebaseDb(), "supportThreads", ref.id, "messages"), {
          senderId: user.uid,
          senderRole: "customer",
          text: body.slice(0, 4000),
          createdAt: serverTimestamp(),
        });
      }
      setSent(true);
    } catch {
      showToast("Meddelandet kunde inte skickas");
    }
  };

  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-[#FAF8F5]">
      <div className="flex items-center px-3 pt-3">
        <button type="button" aria-label="Stäng" onClick={() => setOpen(false)} className="grid size-9 place-items-center">
          <X className="size-5" />
        </button>
        <p className="flex-1 text-center font-serif text-[1.4rem] tracking-[0.22em]">VELIO</p>
        <span className="size-9" />
      </div>
      <div className="flex flex-1 flex-col px-5 pt-6">
        <p className="text-[13px] text-[#8A8178]">Kontakta support</p>
        <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.03em]">Vi svarar här</h2>
        {sent ? (
          <p className="mt-6 text-[15px] text-[#5C534C]">Tack. Meddelandet ligger hos VELIO.</p>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              placeholder="Beskriv vad som hänt"
              className="mt-6 w-full resize-none rounded-2xl border border-[#E6E1DB] bg-white px-4 py-3 text-[15px] outline-none"
            />
            <button type="button" onClick={() => void send()} className="mt-4 h-[52px] rounded-[14px] bg-[#1A1A1A] text-[16px] font-semibold text-white active:scale-[0.98]">
              Skicka
            </button>
          </>
        )}
      </div>
    </div>
  );
}
