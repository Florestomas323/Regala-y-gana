/* POST /api/admin — panel privado
   Acceso:  Authorization: Bearer <token de Google (Firebase Auth)>  → solo correos autorizados
            o  x-admin-key: <ADMIN_KEY>  (respaldo opcional, si definiste ADMIN_KEY en Vercel)
   { action: "overview" }                                       → quienes comparten (con su progreso) + prospectos
   { action: "set-status", leadId, status }                     → estado de un prospecto ("delivered" cuenta para el programa)
   { action: "set-reward", referrerId, rewardStatus, rewardId? } → regalo de quien comparte */
import crypto from "node:crypto";
import { db, now, inc, toIso, toMs, verifyIdToken } from "../lib/firebase.js";
import { route, send, body, rateLimit, underLimit, eventDoc, referrerProgress } from "../lib/server.js";
import { LEAD_STATUSES, REWARD_STATUSES, PANEL_ADMINS, REFERRAL_PROGRAM, findReward } from "../src/config.js";
import { displayPhone } from "../src/validate.js";

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const admins = () =>
  [...PANEL_ADMINS, ...(process.env.ADMIN_EMAILS || "").split(",")].map((s) => s.trim().toLowerCase()).filter(Boolean);

async function authorize(req) {
  const h = String(req.headers.authorization || "");
  if (h.startsWith("Bearer ")) {
    try {
      const t = await verifyIdToken(h.slice(7));
      const email = String(t.email || "").toLowerCase();
      if (t.email_verified && admins().includes(email)) return { ok: true, by: email };
      return { ok: false, code: 403, error: "not_admin", email };
    } catch { return { ok: false, code: 401, error: "token" }; }
  }
  const key = process.env.ADMIN_KEY || "";
  const given = String(req.headers["x-admin-key"] || "");
  if (key.length >= 8 && given) {
    if (crypto.timingSafeEqual(sha(given), sha(key))) return { ok: true, by: "clave" };
    return { ok: false, code: 401, error: "key" };
  }
  return { ok: false, code: 401, error: "login" };
}

export default route(["POST"], async (req, res) => {
  // 10 intentos fallidos en 15 minutos bloquean el panel desde esa conexión
  if (!(await underLimit(req, "adminfail", 10, 15))) return send(res, 429, { ok: false, error: "rate" });
  const auth = await authorize(req);
  if (!auth.ok) {
    if (auth.error === "key" || auth.error === "token") await rateLimit(req, "adminfail", 10, 15);
    return send(res, auth.code, { ok: false, error: auth.error, email: auth.email });
  }
  const b = body(req);
  const store = db();

  /* ---------- todo para el panel ---------- */
  if (b.action === "overview") {
    const [rs, ls] = await Promise.all([
      store.collection("referrers").orderBy("createdAt", "desc").limit(1000).get(),
      store.collection("leads").orderBy("createdAt", "desc").limit(3000).get(),
    ]);
    const referrers = rs.docs.map((d) => {
      const r = d.data();
      return { id: r.id, name: r.name, phone: displayPhone(r.phone), phoneE164: r.phone, code: r.referralCode,
               createdAt: toIso(r.createdAt), progress: referrerProgress(r) };
    });
    const leads = ls.docs.map((d) => {
      const l = d.data();
      return { id: l.id, name: l.name, phone: displayPhone(l.phone), phoneE164: l.phone, referrerId: l.referrerId,
               referrerName: l.referrerName, code: l.referralCode, prize: l.prize, status: l.status,
               createdAt: toIso(l.createdAt), spinDate: toIso(l.spinDate), claimClickedAt: toIso(l.claimClickedAt),
               deliveredAt: toIso(l.deliveredAt), countedForReward: !!l.countedForReward };
    });
    return send(res, 200, { ok: true, by: auth.by, required: REFERRAL_PROGRAM.requiredDeliveries, referrers, leads });
  }

  /* ---------- estado de un prospecto (y conteo del programa) ---------- */
  if (b.action === "set-status") {
    const status = String(b.status || "");
    if (!LEAD_STATUSES.some((s) => s.id === status)) return send(res, 400, { ok: false, error: "status" });
    const leadRef = store.collection("leads").doc(String(b.leadId || ""));
    const out = await store.runTransaction(async (tx) => {
      const snap = await tx.get(leadRef);
      if (!snap.exists) return null;
      const l = snap.data();
      const refRef = store.collection("referrers").doc(l.referrerId);
      const refSnap = await tx.get(refRef);
      const r = refSnap.exists ? refSnap.data() : null;
      const upd = { status, statusUpdatedAt: now(), updatedAt: now() };
      const rUpd = {};
      if (status === "delivered" && l.status !== "delivered") {
        // Regalo entregado: cuenta para quien compartió si fue dentro de su plazo
        const counted = !!r && Date.now() <= toMs(r.deadlineAt);
        upd.deliveredAt = new Date(); upd.countedForReward = counted;
        rUpd["stats.delivered"] = inc(1);
        if (counted) {
          rUpd["stats.deliveredInTime"] = inc(1);
          const after = ((r.stats && r.stats.deliveredInTime) || 0) + 1;
          if (after >= REFERRAL_PROGRAM.requiredDeliveries && !r.qualifiedAt) rUpd.qualifiedAt = now();
        }
      } else if (l.status === "delivered" && status !== "delivered") {
        // Se corrigió una entrega marcada por error
        upd.deliveredAt = null; upd.countedForReward = false;
        rUpd["stats.delivered"] = inc(-1);
        if (l.countedForReward) rUpd["stats.deliveredInTime"] = inc(-1);
      }
      tx.update(leadRef, upd);
      if (r && Object.keys(rUpd).length) tx.update(refRef, rUpd);
      const [e, ev] = eventDoc("status_changed", { referrerId: l.referrerId, leadId: l.id, referralCode: l.referralCode, extra: { status } });
      tx.set(e, ev);
      return { counted: !!upd.countedForReward };
    });
    if (!out) return send(res, 404, { ok: false, error: "lead" });
    return send(res, 200, { ok: true, countedForReward: out.counted });
  }

  /* ---------- regalo de quien comparte ---------- */
  if (b.action === "set-reward") {
    const rewardStatus = String(b.rewardStatus || "");
    if (!REWARD_STATUSES.some((s) => s.id === rewardStatus)) return send(res, 400, { ok: false, error: "reward_status" });
    const ref = store.collection("referrers").doc(String(b.referrerId || ""));
    const snap = await ref.get();
    if (!snap.exists) return send(res, 404, { ok: false, error: "referrer" });
    const upd = { rewardStatus, rewardUpdatedAt: now() };
    if (b.rewardId !== undefined) {
      const rw = b.rewardId ? findReward(String(b.rewardId)) : null;
      if (b.rewardId && !rw) return send(res, 400, { ok: false, error: "reward" });
      upd.rewardId = rw ? rw.id : null; upd.rewardName = rw ? rw.name : null;
    }
    if (rewardStatus === "none") { upd.rewardId = null; upd.rewardName = null; }
    if (rewardStatus === "delivered") upd.rewardDeliveredAt = now();
    const batch = store.batch();
    batch.update(ref, upd);
    const [e, ev] = eventDoc("reward_status_changed", { referrerId: snap.id, referralCode: snap.data().referralCode, extra: { status: rewardStatus } });
    batch.set(e, ev);
    await batch.commit();
    return send(res, 200, { ok: true });
  }

  send(res, 400, { ok: false, error: "action" });
});
