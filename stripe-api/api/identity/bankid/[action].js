import start from "./_start.js";
import collect from "./_collect.js";
const routes = { start, collect };
export default async function handler(req, res) {
  const fn = routes[req.query.action];
  if (!fn) return res.status(404).json({ error: "Not found" });
  return fn(req, res);
}
