/* GET /api/lead?id=LEADID — estado del prospecto (al recargar la página).
   Así el premio y el "ya giró" vienen de la base de datos, no del navegador. */
import { db } from "../lib/firebase.js";
import { route, send, leadView } from "../lib/server.js";

export default route(["GET"], async (req, res) => {
  const id = String((req.query && req.query.id) || new URL(req.url, "http://x").searchParams.get("id") || "");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) return send(res, 404, { ok: false, error: "lead" });
  const snap = await db().collection("leads").doc(id).get();
  if (!snap.exists) return send(res, 404, { ok: false, error: "lead" });
  send(res, 200, { ok: true, lead: leadView(snap.data()) });
});
