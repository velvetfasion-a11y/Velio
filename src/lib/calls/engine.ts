import { iceServers, MISSED_CALL_TEXT, RING_MS } from "@/lib/calls/ice";
import { demoCallId, firestoreSignaling, type IcePayload, type SdpPayload, type SignalDoc, type Signaling } from "@/lib/calls/signal";

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended" | "missed" | "declined" | "error";

export type CallSnapshot = {
  phase: CallPhase;
  name: string;
  initials: string;
  muted: boolean;
  speaker: boolean;
  video: boolean;
  elapsed: number;
  error: string;
  localStream: MediaStream | null;
};

export type PlaceCallInput = {
  selfId: string;
  selfName: string;
  peerId: string;
  peerName: string;
  chatId?: string;
  jobId?: string;
  demo?: boolean;
  room?: string;
  signal?: Signaling;
};

const idle: CallSnapshot = {
  phase: "idle",
  name: "",
  initials: "",
  muted: false,
  speaker: true,
  video: false,
  elapsed: 0,
  error: "",
  localStream: null,
};

function initialsOf(name: string) {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function failureText(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "VELIO behöver mikrofonen. Tillåt mikrofonen i webbläsaren och försök igen.";
  }
  if (name === "NotFoundError") return "Ingen mikrofon hittades.";
  if (code.includes("permission-denied")) return "Samtalet kunde inte kopplas. Reglerna för samtal behöver publiceras.";
  return "Samtalet kunde inte startas.";
}

function sdp(description: RTCSessionDescriptionInit | null): SdpPayload | undefined {
  if (!description?.type || !description.sdp) return undefined;
  return { type: description.type, sdp: description.sdp };
}

class CallEngine {
  private snapshot: CallSnapshot = idle;
  private listeners = new Set<() => void>();
  private signal: Signaling | null = null;
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private unsubDoc: (() => void) | null = null;
  private unsubIce: (() => void) | null = null;
  private unsubIncoming: (() => void) | null = null;
  private ringTimer = 0;
  private tickTimer = 0;
  private ringTone = 0;
  private audioCtx: AudioContext | null = null;
  private seen = new Set<string>();
  private early: IcePayload[] = [];
  private selfId = "";
  private selfName = "";
  private peerId = "";
  private role: "caller" | "callee" | null = null;
  private callId = "";
  private chatId = "";
  private demo = false;
  private doc: SignalDoc | null = null;
  private lastOfferRev = -1;
  private lastAnswerRev = -1;
  private startedAt = 0;
  private closing = false;
  private missedPosted = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private emit(patch: Partial<CallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  listenForIncoming(selfId: string, selfName: string) {
    this.selfId = selfId;
    this.selfName = selfName || "VELIO";
    this.unsubIncoming?.();
    this.signal = firestoreSignaling();
    this.unsubIncoming = this.signal.listenIncoming(selfId, (id, data) => {
      if (this.snapshot.phase !== "idle" && this.snapshot.phase !== "ended" && this.snapshot.phase !== "missed" && this.snapshot.phase !== "declined") return;
      if (Date.now() - data.createdAtMs > RING_MS) return;
      this.attach(id, data, "callee");
    });
    return () => {
      this.unsubIncoming?.();
      this.unsubIncoming = null;
    };
  }

  watchDemo(input: { room: string; selfId: string; selfName: string; signal: Signaling }) {
    this.release();
    this.selfId = input.selfId;
    this.selfName = input.selfName;
    this.signal = input.signal;
    this.demo = true;
    this.callId = demoCallId(input.room);
    this.unsubDoc = input.signal.listen(this.callId, (data) => {
      void this.onDoc(data);
    });
    return () => this.release();
  }

  async placeCall(input: PlaceCallInput) {
    this.stopRing();
    this.closePc();
    this.closing = false;
    this.missedPosted = false;
    this.seen.clear();
    this.early = [];
    this.lastOfferRev = -1;
    this.lastAnswerRev = -1;
    this.doc = null;
    this.selfId = input.selfId;
    this.selfName = input.selfName || "VELIO";
    this.peerId = input.peerId;
    this.chatId = input.chatId || "";
    this.demo = Boolean(input.demo);
    this.role = "caller";
    this.signal = input.signal ?? firestoreSignaling();
    this.callId = input.demo && input.room ? demoCallId(input.room) : crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    this.emit({
      phase: "outgoing",
      name: input.peerName,
      initials: initialsOf(input.peerName),
      muted: false,
      speaker: true,
      video: false,
      elapsed: 0,
      error: "",
      localStream: null,
    });
    try {
      await this.ensureMic();
      this.pc = this.makePc();
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      const data: SignalDoc = {
        callerId: this.selfId,
        calleeId: input.peerId,
        callerName: this.selfName,
        calleeName: input.peerName,
        status: "ringing",
        video: false,
        createdAtMs: Date.now(),
        offer: sdp(this.pc.localDescription),
        offerRev: 1,
        answerRev: 0,
        demo: input.demo || undefined,
        room: input.room,
        chatId: input.chatId,
        jobId: input.jobId,
      };
      if (input.demo) await this.signal.reset?.(this.callId);
      await this.signal.create(this.callId, data);
      this.lastOfferRev = 1;
      this.listenTo(this.callId);
      this.listenIce("callee");
      this.armRing(data.createdAtMs);
      this.startTone(false);
    } catch (error) {
      this.closePc();
      this.emit({ phase: "error", error: failureText(error) });
    }
  }

  private attach(id: string, data: SignalDoc, role: "caller" | "callee") {
    if (this.callId === id && this.snapshot.phase === "incoming") return;
    this.closePc();
    this.closing = false;
    this.missedPosted = false;
    this.seen.clear();
    this.early = [];
    this.lastOfferRev = -1;
    this.lastAnswerRev = -1;
    this.callId = id;
    this.role = role;
    this.peerId = role === "callee" ? data.callerId : data.calleeId;
    this.chatId = data.chatId || "";
    this.demo = data.demo === true;
    this.doc = data;
    const name = role === "callee" ? data.callerName : data.calleeName;
    this.emit({ phase: "incoming", name, initials: initialsOf(name), muted: false, speaker: true, video: false, elapsed: 0, error: "", localStream: null });
    this.armRing(data.createdAtMs);
    this.startTone(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([200, 90, 200, 90, 200]);
    this.unsubDoc?.();
    this.unsubDoc = this.signal?.listen(id, (next) => void this.onDoc(next)) ?? null;
  }

  private listenTo(id: string) {
    this.unsubDoc?.();
    this.unsubDoc = this.signal?.listen(id, (data) => void this.onDoc(data)) ?? null;
  }

  private async onDoc(data: SignalDoc | null) {
    if (!data) return;
    try {
      await this.applyDoc(data);
    } catch {
      if (this.snapshot.phase !== "idle") this.emit({ error: "Samtalet kunde inte kopplas." });
    }
  }

  private async applyDoc(data: SignalDoc) {
    if (this.callId && data.callerId && this.demo) {
      const mine = data.callerId === this.selfId || data.calleeId === this.selfId;
      if (!mine) return;
    }
    this.doc = data;
    if (data.status === "missed") return this.finish("missed");
    if (data.status === "ended") return this.finish("ended");
    if (data.status === "declined") return this.finish(this.role === "caller" ? "declined" : "ended");
    if (data.status === "ringing" && data.calleeId === this.selfId && this.role !== "caller") {
      if (this.snapshot.phase === "idle" || this.snapshot.phase === "ended" || this.snapshot.phase === "missed" || this.snapshot.phase === "declined" || this.snapshot.phase === "error") {
        this.attach(this.callId || demoCallId(data.room || ""), data, "callee");
      }
      return;
    }
    if (this.role === "caller") await this.takeAnswer(data);
    if (this.role === "callee" && (this.snapshot.phase === "connecting" || this.snapshot.phase === "active")) await this.takeOffer(data);
  }

  async accept() {
    if (!this.doc?.offer || !this.signal || this.snapshot.phase !== "incoming") return;
    this.stopRing();
    this.emit({ phase: "connecting", error: "" });
    try {
      await this.ensureMic();
      this.pc = this.makePc();
      this.listenIce("caller");
      await this.takeOffer(this.doc);
    } catch (error) {
      this.closePc();
      this.emit({ phase: "error", error: failureText(error) });
    }
  }

  async decline() {
    this.stopRing();
    try {
      if (this.signal && this.callId) await this.signal.update(this.callId, { status: "declined" });
    } catch {
      /* The caller times out if this write does not land. */
    }
    this.finish("ended");
  }

  async hangup() {
    this.stopRing();
    const phase = this.snapshot.phase;
    const missed = phase === "outgoing";
    try {
      if (this.signal && this.callId && (phase === "outgoing" || phase === "connecting" || phase === "active")) {
        await this.signal.update(this.callId, { status: missed ? "missed" : "ended" });
      }
    } catch {
      /* Local end still closes the screen. */
    }
    if (missed) void this.postMissed();
    this.finish(missed ? "missed" : "ended");
  }

  dismiss() {
    this.stopRing();
    this.closePc();
    this.role = null;
    this.callId = this.demo ? this.callId : "";
    this.emit({ ...idle });
  }

  toggleMute() {
    const muted = !this.snapshot.muted;
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.emit({ muted });
  }

  async toggleSpeaker() {
    const speaker = !this.snapshot.speaker;
    this.emit({ speaker });
    const audio = this.remoteAudio as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!audio?.setSinkId) return;
    try {
      await audio.setSinkId(speaker ? "" : "communications");
    } catch {
      /* This browser has one output. The button still shows the choice. */
    }
  }

  async toggleVideo() {
    if (!this.pc || (this.snapshot.phase !== "active" && this.snapshot.phase !== "connecting")) return;
    try {
      const existing = this.local?.getVideoTracks()[0];
      if (existing) {
        existing.stop();
        this.local?.removeTrack(existing);
        const sender = this.pc.getSenders().find((item) => item.track === existing);
        if (sender) this.pc.removeTrack(sender);
        this.emit({ video: false, localStream: this.local });
      } else {
        const camera = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = camera.getVideoTracks()[0];
        if (!track || !this.local) return;
        this.local.addTrack(track);
        this.pc.addTrack(track, this.local);
        this.emit({ video: true, localStream: this.local });
      }
      if (this.role !== "caller") return;
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      const offerRev = (this.doc?.offerRev ?? 1) + 1;
      this.lastOfferRev = offerRev;
      await this.signal?.update(this.callId, { offer: sdp(this.pc.localDescription), offerRev, video: this.snapshot.video });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError") this.emit({ error: "Kameran är avstängd i webbläsaren." });
    }
  }

  private async takeOffer(data: SignalDoc) {
    if (!this.pc || !data.offer || data.offerRev === undefined || data.offerRev === this.lastOfferRev) return;
    this.lastOfferRev = data.offerRev;
    await this.pc.setRemoteDescription(data.offer);
    await this.flushEarly();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    const answerRev = (data.answerRev ?? 0) + 1;
    this.lastAnswerRev = answerRev;
    await this.signal?.update(this.callId, { status: "accepted", answer: sdp(this.pc.localDescription), answerRev });
    this.markActive();
  }

  private async takeAnswer(data: SignalDoc) {
    if (!this.pc || !data.answer || data.answerRev === undefined || data.answerRev === this.lastAnswerRev) return;
    this.lastAnswerRev = data.answerRev;
    await this.pc.setRemoteDescription(data.answer);
    await this.flushEarly();
    if (data.status === "accepted") this.markActive();
  }

  private markActive() {
    if (this.snapshot.phase === "active" || this.closing) return;
    this.stopRing();
    this.startedAt = Date.now();
    this.emit({ phase: "active", elapsed: 0, error: "" });
    window.clearInterval(this.tickTimer);
    this.tickTimer = window.setInterval(() => {
      this.emit({ elapsed: Math.floor((Date.now() - this.startedAt) / 1000) });
    }, 1000);
  }

  private async ensureMic() {
    this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    this.emit({ localStream: this.local });
  }

  private makePc() {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    this.local?.getTracks().forEach((track) => this.local && pc.addTrack(track, this.local));
    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.role) return;
      const init = event.candidate.toJSON();
      if (!init.candidate) return;
      void this.signal?.addCandidate(this.callId, this.role, {
        candidate: init.candidate,
        sdpMid: init.sdpMid ?? undefined,
        sdpMLineIndex: init.sdpMLineIndex ?? undefined,
      });
    };
    pc.ontrack = (event) => {
      const remote = event.streams[0];
      if (!remote) return;
      if (!this.remoteAudio) this.remoteAudio = new Audio();
      this.remoteAudio.srcObject = remote;
      this.remoteAudio.autoplay = true;
      void this.remoteAudio.play().catch(() => undefined);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") this.emit({ error: "Samtalet bröts." });
    };
    return pc;
  }

  private listenIce(role: "caller" | "callee") {
    this.unsubIce?.();
    this.unsubIce = this.signal?.listenCandidates(this.callId, role, (candidate) => {
      if (this.seen.has(candidate.candidate)) return;
      this.seen.add(candidate.candidate);
      if (!this.pc?.remoteDescription) {
        this.early.push(candidate);
        return;
      }
      void this.pc.addIceCandidate(candidate).catch(() => undefined);
    }) ?? null;
  }

  private async flushEarly() {
    const queued = this.early;
    this.early = [];
    for (const candidate of queued) {
      await this.pc?.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  private armRing(createdAtMs: number) {
    window.clearTimeout(this.ringTimer);
    const wait = Math.max(0, (createdAtMs || Date.now()) + RING_MS - Date.now());
    this.ringTimer = window.setTimeout(() => {
      if (this.snapshot.phase !== "outgoing" && this.snapshot.phase !== "incoming") return;
      void this.signal?.update(this.callId, { status: "missed" }).catch(() => undefined);
      if (this.role === "caller") void this.postMissed();
      this.finish("missed");
    }, wait);
  }

  private async postMissed() {
    if (this.missedPosted || this.demo || !this.peerId || !this.chatId) return;
    this.missedPosted = true;
    try {
      const { sendMissedCall } = await import("@/lib/firebase/cloud");
      await sendMissedCall(this.peerId, this.callId);
    } catch {
      /* The chat card is optional if the thread cannot be written. */
    }
  }

  private finish(phase: "ended" | "missed" | "declined") {
    if (this.closing || this.snapshot.phase === phase || this.snapshot.phase === "idle") return;
    if (this.snapshot.phase === "ended" || this.snapshot.phase === "missed" || this.snapshot.phase === "declined") return;
    this.closing = true;
    this.stopRing();
    window.clearInterval(this.tickTimer);
    this.closePc();
    const elapsed = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : this.snapshot.elapsed;
    this.role = null;
    this.emit({ phase, elapsed, localStream: null });
    this.closing = false;
  }

  private closePc() {
    this.unsubIce?.();
    this.unsubIce = null;
    this.pc?.getSenders().forEach((sender) => sender.track?.stop());
    this.pc?.close();
    this.pc = null;
    this.local?.getTracks().forEach((track) => track.stop());
    this.local = null;
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }
  }

  private startTone(incoming: boolean) {
    this.stopTone();
    const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const ctx = this.audioCtx ?? new Context();
    this.audioCtx = ctx;
    void ctx.resume().catch(() => undefined);
    const pulse = () => {
      if (ctx.state === "closed") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = incoming ? 440 : 480;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(incoming ? 0.05 : 0.03, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      if (incoming) {
        const second = ctx.createOscillator();
        const gain2 = ctx.createGain();
        second.frequency.value = 480;
        second.type = "sine";
        gain2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        second.connect(gain2);
        gain2.connect(ctx.destination);
        second.start(ctx.currentTime + 0.18);
        second.stop(ctx.currentTime + 0.52);
      }
    };
    pulse();
    this.ringTone = window.setInterval(pulse, incoming ? 1400 : 2000);
  }

  private stopTone() {
    window.clearInterval(this.ringTone);
    this.ringTone = 0;
  }

  private stopRing() {
    window.clearTimeout(this.ringTimer);
    this.stopTone();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
  }

  private release() {
    this.unsubDoc?.();
    this.unsubDoc = null;
    this.stopRing();
    this.closePc();
  }
}

export const callEngine = new CallEngine();

export function formatCallTime(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export { MISSED_CALL_TEXT };
