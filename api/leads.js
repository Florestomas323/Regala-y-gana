/* POST /api/leads — Persona B se registra ANTES de girar
   { code, name, phone, consent } → datos del prospecto
   Un solo registro por teléfono y campaña: si ya existe, se devuelve
   el mismo (con su premio si ya giró). */
import { db, now, inc } from "../lib/firebase.js";
import { route, send, body, rateLimit, referrerByCode, eventDoc, newId, leadView } from "../lib/server.js";
import { cleanName, isValidName, normalizePhone, isValidCode } from "../src/validate.js";
import { CAMPAIGN_ID, CONSENT_TEXT, CONSENT_VERSION } from "../src/config.js";

export default route(["POST"], async (req, res) => {
  const b = body(req);
  if (b.website) return send(res, 400, { ok: false, error: "invalid" });
  const code = String(b.code || "").toUpperCase();
  const name = cleanName(b.name);
  const phone = normalizePhone(b.phone);
  if (!isValidCode(code)) return send(res, 404, { ok: false, error: "code" });
  if (!isValidName(name)) return send(res, 400, { ok: false, error: "name" });
  if (!phone) return send(res, 400, { ok: false, error: "phone" });
  if (b.consent !== true) return send(res, 400, { ok: false, error: "consent" });

  const found = await referrerByCode(code);
  if (!found) return send(res, 404, { ok: false, error: "code" });
  const referrer = found.data;
  if (referrer.phone === phone) return send(res, 400, { ok: false, error: "own_link" });
  if (!(await rateLimit(req, "lead", 40, 10))) return send(res, 429, { ok: false, error: "rate" });

  const store = db();
  const idxRef = store.collection("leadPhones").doc(`${CAMPAIGN_ID}__${phone}`);

  const out = await store.runTransaction(async (tx) => {
    const idx = await tx.get(idxRef);
    if (idx.exists) {
      const leadRef = store.collection("leads").doc(idx.data().leadId);
      const snap = await tx.get(leadRef);
      if (snap.exists) {
        const lead = snap.data();
        const upd = { lastSeenAt: now(), visits: inc(1) };
        if (lead.name !== name) upd.lastNameEntered = name;   // se conserva el nombre original
        tx.update(leadRef, upd);
        return { existing: true, lead };
      }
    }
    const id = newId();
    const lead = {
      id, leadId: id, name, phone,
      referralCode: code, referrerId: referrer.id, referrerName: referrer.name, referrerPhone: referrer.phone,
      source: "regalaygana", campaignId: CAMPAIGN_ID,
      prize: null, prizeId: null, prizeImage: null, spinCompleted: false,
      status: "registered", consent: true, consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION, consentAt: now(),
      deliveredAt: null, countedForReward: false,
      createdAt: now(), updatedAt: now(), spinDate: null, claimClickedAt: null, visits: 1,
    };
    tx.create(store.collection("leads").doc(id), lead);
    tx.set(idxRef, { leadId: id, createdAt: now() });
    tx.update(found.ref, { "stats.registrations": inc(1) });
    const [eRef, ev] = eventDoc("lead_registered", { referrerId: referrer.id, leadId: id, referralCode: code });
    tx.set(eRef, ev);
    return { existing: false, lead };
  });

  send(res, 200, { ok: true, existing: out.existing, lead: leadView(out.lead) });
});
