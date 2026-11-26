import maskedNumber from "./_masked-number.js";
import twiml from "./_twiml.js";
const routes = { "masked-number": maskedNumber, twiml };
export default async function handler(req, res) {
  const fn = routes[req.query.action];
  if (!fn) return res.status(404).json({ error: "Not found" });
  return fn(req, res);
}
