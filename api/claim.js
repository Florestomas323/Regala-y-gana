/* POST /api/claim — la persona pulsó "RECLAMA TU REGALO"
   Se guarda ANTES de abrir WhatsApp: status = claim_started + claimClickedAt */
import { db, now, inc } from "../lib/firebase.js";
import { route, send, body, eventDoc } from "../lib/server.js";

const BEFORE_CLAIM = ["registered", "prize_won", "claim_started"];

export default route(["POST"], async (req, res) => {
  const leadId = String(body(req).leadId || "");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(leadId)) return send(res, 404, { ok: false, error: "lead" });
  const store = db();
  const leadRef = store.collection("leads").doc(leadId);

  const out = await store.runTransaction(async (tx) => {
    const snap = await tx.get(leadRef);
    if (!snap.exists) return { code: 404 };
    const lead = snap.data();
    if (!lead.spinCompleted) return { code: 409 };
    const first = !lead.claimClickedAt;
    const refRef = store.collection("referrers").doc(lead.referrerId);
    const refSnap = first ? await tx.get(refRef) : null;
    const upd = { lastClaimClickAt: now(), claimClicks: inc(1), updatedAt: now() };
    if (first) upd.claimClickedAt = now();
    // no se "baja" un estado más avanzado (contactado, cita, entregado)
    if (BEFORE_CLAIM.includes(lead.status)) upd.status = "claim_started";
    tx.update(leadRef, upd);
    if (first) {
      if (refSnap && refSnap.exists) tx.update(refRef, { "stats.claims": inc(1) });
      const [e, ev] = eventDoc("claim_clicked", { referrerId: lead.referrerId, leadId, referralCode: lead.referralCode });
      tx.set(e, ev);
    }
    return { code: 200 };
  });

  if (out.code !== 200) return send(res, out.code, { ok: false, error: out.code === 409 ? "no_spin" : "lead" });
  send(res, 200, { ok: true });
});
