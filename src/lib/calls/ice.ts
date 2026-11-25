export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];
  const raw = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  if (!raw) return servers;
  const urls = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (!urls.length) return servers;
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();
  servers.push({
    urls,
    ...(username ? { username } : {}),
    ...(credential ? { credential } : {}),
  });
  return servers;
}

export const MISSED_CALL_TEXT = "Missat samtal";
export const RING_MS = 30_000;
