import { createHash } from "crypto";
import { sql } from "@/lib/db";

/** Persist simple rate limits in auth_challenges payload table-adjacent store. */
export async function assertRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const id = `rl_${createHash("sha256").update(input.key).digest("hex").slice(0, 24)}`;
  const now = Date.now();
  const rows = await sql<{ payload: string | Record<string, unknown>; expires_at: string }>(
    `select payload, expires_at from auth_challenges where id = $1 limit 1`,
    [id],
  );
  let hits: number[] = [];
  if (rows[0]) {
    const payload =
      typeof rows[0].payload === "string"
        ? (JSON.parse(rows[0].payload) as { hits?: number[] })
        : ((rows[0].payload as { hits?: number[] }) ?? {});
    hits = (payload.hits ?? []).filter((ts) => now - ts < input.windowMs);
  }
  if (hits.length >= input.limit) {
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfterSec: Math.ceil((input.windowMs - (now - oldest)) / 1000) };
  }
  hits.push(now);
  const expiresAt = new Date(now + input.windowMs).toISOString();
  await sql(
    `insert into auth_challenges (id, kind, target, code_hash, payload, expires_at)
     values ($1, 'rate', $2, '0', $3::jsonb, $4::timestamptz)
     on conflict (id) do update set payload = $3::jsonb, expires_at = $4::timestamptz, attempts = 0, consumed_at = null`,
    [id, input.key.slice(0, 120), JSON.stringify({ hits }), expiresAt],
  );
  return { ok: true };
}

export function clientKey(request: Request, extra: string): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || request.headers.get("x-real-ip") || "local";
  return `${ip}:${extra}`;
}
