/* POST /api/referral-open — alguien abrió /r/CODIGO
   { code, countOpen } → { referrerName }
   Cuenta la visita (linksOpened + evento) sin guardar datos personales. */
import { db, inc } from "../lib/firebase.js";
import { route, send, body, rateLimit, referrerByCode, eventDoc } from "../lib/server.js";
import { isValidCode } from "../src/validate.js";

export default route(["POST"], async (req, res) => {
  const b = body(req);
  const code = String(b.code || "").toUpperCase();
  if (!isValidCode(code)) return send(res, 404, { ok: false, error: "code" });
  const found = await referrerByCode(code);
  if (!found) return send(res, 404, { ok: false, error: "code" });

  if (b.countOpen && (await rateLimit(req, "open", 60, 10))) {
    const batch = db().batch();
    batch.update(found.ref, { "stats.linksOpened": inc(1) });
    const [ref, ev] = eventDoc("referral_link_opened", { referrerId: found.data.id, referralCode: code });
    batch.set(ref, ev);
    await batch.commit();
  }
  send(res, 200, { ok: true, referrerName: found.data.name, referralCode: code });
});
