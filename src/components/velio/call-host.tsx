"use client";

import { useEffect, useState } from "react";
import { CallActionSheet, CallOverlay, useCall } from "@/components/velio/call-screen";
import { callEngine } from "@/lib/calls/engine";
import { maskedCallsConfigured, requestMaskedNumber } from "@/lib/calls/masked";
import { useVelio } from "@/lib/velio/store";

type Target = { peerId: string; peerName: string; chatId?: string; jobId?: string };

let openTarget: (target: Target) => void = () => undefined;

export function openCallSheet(target: Target) {
  openTarget(target);
}

export function CallHost() {
  const loggedIn = useVelio((state) => state.loggedIn);
  const accountId = useVelio((state) => state.accountId);
  const name = useVelio((state) => state.profile.name);
  const view = useCall();
  const [target, setTarget] = useState<Target | null>(null);
  const [masked, setMasked] = useState(false);
  const [proxy, setProxy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    openTarget = (next) => {
      setProxy("");
      setError("");
      setTarget(next);
      void maskedCallsConfigured().then(setMasked);
    };
    return () => {
      openTarget = () => undefined;
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || !accountId) return;
    return callEngine.listenForIncoming(accountId, name || "VELIO");
  }, [loggedIn, accountId, name]);

  const close = () => {
    setTarget(null);
    setProxy("");
    setError("");
  };

  const ringInApp = async () => {
    if (!target || !accountId) return;
    const peerId = target.peerId;
    const peerName = target.peerName;
    close();
    let chatId = target.chatId;
    let jobId = target.jobId;
    try {
      const { chatForPeer } = await import("@/lib/firebase/cloud");
      const meta = chatForPeer(peerId);
      chatId = chatId || meta?.id;
      jobId = jobId || meta?.jobId;
    } catch {
      /* The call still rings. The missed-call card needs a chat id. */
    }
    await callEngine.placeCall({
      selfId: accountId,
      selfName: name || "VELIO",
      peerId,
      peerName,
      chatId,
      jobId,
    });
  };

  const ringPhone = async () => {
    if (!target) return;
    setError("");
    try {
      const { chatForPeer } = await import("@/lib/firebase/cloud");
      const meta = chatForPeer(target.peerId);
      const number = await requestMaskedNumber({ chatId: target.chatId || meta?.id, jobId: target.jobId || meta?.jobId });
      setProxy(number);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Numret kunde inte hämtas");
    }
  };

  return (
    <>
      {target && view.phase === "idle" ? (
        <CallActionSheet name={target.peerName} masked={masked} proxyNumber={proxy} error={error} onApp={() => void ringInApp()} onPhone={() => void ringPhone()} onClose={close} />
      ) : null}
      <CallOverlay contained />
    </>
  );
}
