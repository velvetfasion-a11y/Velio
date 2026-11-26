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
      message: "Bolagsverket är inte kopplat. Fyll i namn och adress själv.",
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
        message: "Bolagsverket gick inte att nå. Fyll i uppgifterna själv.",
      });
    }
  }
  return res.status(200).json({
    configured: true,
    nameSearch: false,
    results: [],
    message:
      digits.length > 0
        ? "Skriv hela organisationsnumret, 10 siffror."
        : "Bolagsverkets gratis-API söker på organisationsnummer, inte på namn. Skriv numret, eller fyll i namn och adress själv.",
  });
}
