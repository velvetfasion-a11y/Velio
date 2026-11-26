import { applyCors } from "../../lib/cors.js";
import { bolagsverketConfigured, lookupOrganisation, orgDigits, validOrg } from "../../lib/bolagsverket.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const q = String(req.query.q || "").trim().slice(0, 80);
  const digits = orgDigits(q);
  if (!bolagsverketConfigured()) {
    return res.status(200).json({
      configured: false,
      nameSearch: false,
      results: [],
      message: "Vi hämtar företagsuppgifterna automatiskt.",
    });
  }
  if (digits.length === 10 && validOrg(digits)) {
    try {
      const company = await lookupOrganisation(digits);
      return res.status(200).json({
        configured: true,
        nameSearch: false,
        results: company ? [company] : [],
        message: company ? "" : "Inget verksamt bolag med det organisationsnumret.",
      });
    } catch (error) {
      return res.status(error.status || 502).json({
        configured: true,
        nameSearch: false,
        results: [],
        message: "Vi hämtar företagsuppgifterna automatiskt.",
      });
    }
  }
  return res.status(200).json({
    configured: true,
    nameSearch: false,
    results: [],
    message: "Vi hämtar företagsuppgifterna automatiskt.",
  });
}
