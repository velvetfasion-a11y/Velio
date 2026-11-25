import { scanStuckJobs } from "../../lib/alerts.js";
import { adminDb } from "../../lib/firebase.js";
import { releaseDuePayouts } from "../../lib/payouts.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.authorization || "";
    if (header !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const results = await releaseDuePayouts();
    const stuck = await scanStuckJobs(adminDb());
    return res.status(200).json({ ok: true, count: results.length, results, stuck });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Cron failed" });
  }
}
