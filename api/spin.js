/* POST /api/spin — UN solo giro por prospecto
   El servidor elige el premio (aleatorio seguro y ponderado), lo guarda
   y lo devuelve. La página solo anima la ruleta hasta ese premio.
   Si ya giró, devuelve el mismo premio: nunca hay segundo giro. */
import crypto from "node:crypto";
import { db, now, inc } from "../lib/firebase.js";
import { route, send, body, eventDoc, leadView } from "../lib/server.js";
import { activePrizes, pickWeighted } from "../src/prizes.js";

export default route(["POST"], async (req, res) => {
  const leadId = String(body(req).leadId || "");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(leadId)) return send(res, 404, { ok: false, error: "lead" });
  const store = db();
  const leadRef = store.collection("leads").doc(leadId);

  const out = await store.runTransaction(async (tx) => {
    const snap = await tx.get(leadRef);
    if (!snap.exists) return null;
    const lead = snap.data();
    if (lead.spinCompleted) return { already: true, lead };

    const refRef = store.collection("referrers").doc(lead.referrerId);
    const refSnap = await tx.get(refRef);
    const prize = pickWeighted(activePrizes(), (n) => crypto.randomInt(n));
    const upd = {
      prize: prize.name, prizeId: prize.id, prizeImage: prize.image,
      spinCompleted: true, status: "prize_won", spinDate: now(), updatedAt: now(),
    };
    tx.update(leadRef, upd);
    if (refSnap.exists) tx.update(refRef, { "stats.spins": inc(1) });
    const meta = { referrerId: lead.referrerId, leadId, referralCode: lead.referralCode };
    const [e1, ev1] = eventDoc("wheel_spun", meta);
    const [e2, ev2] = eventDoc("prize_won", { ...meta, extra: { prizeId: prize.id } });
    tx.set(e1, ev1); tx.set(e2, ev2);
    return { already: false, lead: { ...lead, ...upd } };
  });

  if (!out) return send(res, 404, { ok: false, error: "lead" });
  const view = leadView(out.lead);
  send(res, 200, { ok: true, alreadySpun: out.already, prize: view.prize, lead: view });
});
