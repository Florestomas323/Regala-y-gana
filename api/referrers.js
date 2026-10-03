/* POST /api/referrers — Persona A crea (o recupera) su enlace personal
   { name, phone, consent } → datos del enlace + progreso del programa
   El plazo de 15 días empieza al crear el enlace y no se reinicia. */
import { db, now } from "../lib/firebase.js";
import { route, send, body, rateLimit, newCode, newId, siteUrl, deadlineFrom, referrerView } from "../lib/server.js";
import { cleanName, isValidName, normalizePhone } from "../src/validate.js";
import { REFERRER_CONSENT_TEXT, CONSENT_VERSION } from "../src/config.js";

export default route(["POST"], async (req, res) => {
  const b = body(req);
  if (b.website) return send(res, 400, { ok: false, error: "invalid" });          // trampa para bots
  const name = cleanName(b.name);
  const phone = normalizePhone(b.phone);
  if (!isValidName(name)) return send(res, 400, { ok: false, error: "name" });
  if (!phone) return send(res, 400, { ok: false, error: "phone" });
  if (b.consent !== true) return send(res, 400, { ok: false, error: "consent" });
  if (!(await rateLimit(req, "referrer", 15, 10))) return send(res, 429, { ok: false, error: "rate" });

  const base = siteUrl(req);
  const store = db();
  const phoneRef = store.collection("referrerPhones").doc(phone);

  // Un enlace por teléfono: si ya existe, se devuelve el mismo (con su plazo original)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const result = await store.runTransaction(async (tx) => {
      const idx = await tx.get(phoneRef);
      if (idx.exists) {
        const ref = store.collection("referrers").doc(idx.data().referrerId);
        const snap = await tx.get(ref);
        if (snap.exists) {
          tx.update(ref, { lastSeenAt: now() });
          return { existing: true, r: snap.data() };
        }
      }
      const codeRef = store.collection("referralCodes").doc(code);
      if ((await tx.get(codeRef)).exists) return { retry: true };            // código repetido (rarísimo)
      const id = newId();
      const createdMs = Date.now();
      const r = {
        id, name, phone, referralCode: code, referralUrl: `${base}/r/${code}`,
        active: true, createdAt: now(), lastSeenAt: now(),
        deadlineAt: deadlineFrom(createdMs),                                 // 15 días para lograr las entregas
        consent: true, consentText: REFERRER_CONSENT_TEXT, consentVersion: CONSENT_VERSION, consentAt: now(),
        stats: { linksOpened: 0, registrations: 0, spins: 0, claims: 0, delivered: 0, deliveredInTime: 0 },
        rewardStatus: "none", rewardId: null, rewardName: null,
      };
      tx.create(store.collection("referrers").doc(id), r);
      tx.create(codeRef, { referrerId: id, createdAt: now() });
      tx.set(phoneRef, { referrerId: id, createdAt: now() });
      return { existing: false, r: { ...r, createdAt: new Date(createdMs) } };
    });
    if (result.retry) continue;
    return send(res, 200, { ok: true, existing: result.existing, ...referrerView(result.r, base) });
  }
  send(res, 500, { ok: false, error: "code" });
});
