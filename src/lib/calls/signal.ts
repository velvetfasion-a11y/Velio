import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase/client";

export type CallStatus = "ringing" | "accepted" | "declined" | "ended" | "missed";

export type SdpPayload = { type: RTCSdpType; sdp: string };

export type SignalDoc = {
  callerId: string;
  calleeId: string;
  callerName: string;
  calleeName: string;
  status: CallStatus;
  video: boolean;
  createdAtMs: number;
  demo?: boolean;
  room?: string;
  chatId?: string;
  jobId?: string;
  offer?: SdpPayload;
  answer?: SdpPayload;
  offerRev?: number;
  answerRev?: number;
};

export type IcePayload = { candidate: string; sdpMid?: string; sdpMLineIndex?: number };

export interface Signaling {
  create(id: string, data: SignalDoc): Promise<void>;
  update(id: string, patch: Partial<SignalDoc>): Promise<void>;
  listen(id: string, onDoc: (data: SignalDoc | null) => void): () => void;
  addCandidate(id: string, role: "caller" | "callee", candidate: IcePayload): Promise<void>;
  listenCandidates(id: string, role: "caller" | "callee", onCandidate: (candidate: IcePayload) => void): () => void;
  listenIncoming(calleeId: string, onCall: (id: string, data: SignalDoc) => void): () => void;
  reset?(id: string): Promise<void>;
}

function sdpOf(value: unknown): SdpPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { type?: unknown; sdp?: unknown };
  if (typeof record.type !== "string" || typeof record.sdp !== "string" || !record.sdp) return undefined;
  return { type: record.type as RTCSdpType, sdp: record.sdp };
}

function millis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "toMillis" in value) return (value as Timestamp).toMillis();
  return 0;
}

function fromFirestore(data: Record<string, unknown>): SignalDoc {
  return {
    callerId: String(data.callerId || ""),
    calleeId: String(data.calleeId || ""),
    callerName: String(data.callerName || ""),
    calleeName: String(data.calleeName || ""),
    status: (data.status as CallStatus) || "ended",
    video: data.video === true,
    createdAtMs: millis(data.createdAtMs) || millis(data.createdAt),
    demo: data.demo === true ? true : undefined,
    room: typeof data.room === "string" ? data.room : undefined,
    chatId: typeof data.chatId === "string" ? data.chatId : undefined,
    jobId: typeof data.jobId === "string" ? data.jobId : undefined,
    offer: sdpOf(data.offer),
    answer: sdpOf(data.answer),
    offerRev: typeof data.offerRev === "number" ? data.offerRev : undefined,
    answerRev: typeof data.answerRev === "number" ? data.answerRev : undefined,
  };
}

function writeBody(data: SignalDoc, created: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    callerId: data.callerId,
    calleeId: data.calleeId,
    callerName: data.callerName.slice(0, 80),
    calleeName: data.calleeName.slice(0, 80),
    status: data.status,
    video: data.video,
    createdAtMs: data.createdAtMs,
    offerRev: data.offerRev ?? 0,
    answerRev: data.answerRev ?? 0,
    updatedAt: serverTimestamp(),
  };
  if (created) body.createdAt = serverTimestamp();
  if (data.demo) body.demo = true;
  if (data.room) body.room = data.room;
  if (data.chatId) body.chatId = data.chatId;
  if (data.jobId) body.jobId = data.jobId;
  if (data.offer) body.offer = data.offer;
  if (data.answer) body.answer = data.answer;
  return body;
}

function patchBody(patch: Partial<SignalDoc>): Record<string, unknown> {
  const body: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.status) body.status = patch.status;
  if (typeof patch.video === "boolean") body.video = patch.video;
  if (patch.offer) body.offer = patch.offer;
  if (patch.answer) body.answer = patch.answer;
  if (typeof patch.offerRev === "number") body.offerRev = patch.offerRev;
  if (typeof patch.answerRev === "number") body.answerRev = patch.answerRev;
  if (patch.status === "accepted") body.acceptedAt = serverTimestamp();
  if (patch.status === "ended" || patch.status === "missed" || patch.status === "declined") body.endedAt = serverTimestamp();
  return body;
}

function iceBody(candidate: IcePayload): Record<string, unknown> {
  const body: Record<string, unknown> = { candidate: candidate.candidate.slice(0, 2000) };
  if (candidate.sdpMid) body.sdpMid = candidate.sdpMid;
  if (typeof candidate.sdpMLineIndex === "number") body.sdpMLineIndex = candidate.sdpMLineIndex;
  return body;
}

export function firestoreSignaling(): Signaling {
  const db = firebaseDb();
  return {
    async create(id, data) {
      await setDoc(doc(db, "calls", id), writeBody(data, true));
    },
    async update(id, patch) {
      await updateDoc(doc(db, "calls", id), patchBody(patch));
    },
    listen(id, onDoc) {
      return onSnapshot(
        doc(db, "calls", id),
        (snap) => onDoc(snap.exists() ? fromFirestore(snap.data() as Record<string, unknown>) : null),
        () => onDoc(null),
      );
    },
    async addCandidate(id, role, candidate) {
      const name = role === "caller" ? "callerCandidates" : "calleeCandidates";
      await addDoc(collection(db, "calls", id, name), iceBody(candidate));
    },
    listenCandidates(id, role, onCandidate) {
      const name = role === "caller" ? "callerCandidates" : "calleeCandidates";
      return onSnapshot(collection(db, "calls", id, name), (snap) => {
        for (const item of snap.docChanges()) {
          if (item.type !== "added") continue;
          const data = item.doc.data();
          if (typeof data.candidate !== "string") continue;
          onCandidate({
            candidate: data.candidate,
            sdpMid: typeof data.sdpMid === "string" ? data.sdpMid : undefined,
            sdpMLineIndex: typeof data.sdpMLineIndex === "number" ? data.sdpMLineIndex : undefined,
          });
        }
      });
    },
    listenIncoming(calleeId, onCall) {
      const incoming = query(collection(db, "calls"), where("calleeId", "==", calleeId));
      return onSnapshot(
        incoming,
        (snap) => {
          for (const item of snap.docs) {
            const data = fromFirestore(item.data() as Record<string, unknown>);
            if (data.status === "ringing") onCall(item.id, data);
          }
        },
        () => undefined,
      );
    },
    async reset(id) {
      const caller = await getDocs(collection(db, "calls", id, "callerCandidates"));
      const callee = await getDocs(collection(db, "calls", id, "calleeCandidates"));
      await Promise.all([...caller.docs, ...callee.docs].map((item) => deleteDoc(item.ref)));
      await deleteDoc(doc(db, "calls", id)).catch(() => undefined);
    },
  };
}

type BridgeDoc = SignalDoc | null;

export function bridgeSignaling(origin: string): Signaling {
  const root = origin.replace(/\/$/, "");
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${root}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Signaleringen svarade inte");
  };
  return {
    async create(id, data) {
      await post("/doc", { id, doc: data, reset: true });
    },
    async update(id, patch) {
      await post("/doc", { id, patch });
    },
    listen(id, onDoc) {
      let stop = false;
      const tick = async () => {
        if (stop) return;
        try {
          const response = await fetch(`${root}/doc?id=${encodeURIComponent(id)}`);
          const data = (await response.json()) as { doc?: BridgeDoc };
          onDoc(data.doc ?? null);
        } catch {
          /* The next poll retries. */
        }
        if (!stop) window.setTimeout(tick, 250);
      };
      void tick();
      return () => {
        stop = true;
      };
    },
    async addCandidate(id, role, candidate) {
      await post("/candidate", { id, role, candidate });
    },
    listenCandidates(id, role, onCandidate) {
      let stop = false;
      let from = 0;
      const tick = async () => {
        if (stop) return;
        try {
          const response = await fetch(`${root}/candidates?id=${encodeURIComponent(id)}&role=${role}&from=${from}`);
          const data = (await response.json()) as { items?: { n: number; candidate: IcePayload }[] };
          for (const item of data.items ?? []) {
            from = Math.max(from, item.n + 1);
            onCandidate(item.candidate);
          }
        } catch {
          /* The next poll retries. */
        }
        if (!stop) window.setTimeout(tick, 250);
      };
      void tick();
      return () => {
        stop = true;
      };
    },
    listenIncoming() {
      return () => undefined;
    },
    async reset(id) {
      await post("/doc", { id, reset: true });
    },
  };
}

export function localBridge(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return null;
  const value = new URLSearchParams(window.location.search).get("bridge");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function demoCallId(room: string) {
  return `demo-${room}`;
}
