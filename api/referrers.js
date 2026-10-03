/* POST /api/referrers — Persona A crea (o recupera) su enlace personal
   { name, phone, consent, deviceId } → datos del enlace + progreso del programa
   - Un enlace por teléfono. El plazo de 15 días no se reinicia.
   - Un enlace por dispositivo mientras su plazo esté activo: si el mismo
     dispositivo intenta crear otro con OTRO teléfono, se le devuelve el suyo. */
import { db, now, toMs } from "../lib/firebase.js";
import { route, send, body, rateLimit, newCode, newId, siteUrl, deadlineFrom, referrerView } from "../lib/server.js";
import { cleanName, isValidName, normalizePhone } from "../src/validate.js";
import { REFERRER_CONSENT_TEXT, CONSENT_VERSION } from "../src/config.js";

const validDevice = (d) => /^[A-Za-z0-9-]{16,64}$/.test(String(d || ""));

export default route(["POST"], async (req, res) => {
  const b = body(req);
  if (b.trap) return send(res, 400, { ok: false, error: "invalid" });               // trampa para bots
  const name = cleanName(b.name);
  const phone = normalizePhone(b.phone);
  if (!isValidName(name)) return send(res, 400, { ok: false, error: "name" });
  if (!phone) return send(res, 400, { ok: false, error: "phone" });
  if (b.consent !== true) return send(res, 400, { ok: false, error: "consent" });
  if (!(await rateLimit(req, "referrer", 15, 10))) return send(res, 429, { ok: false, error: "rate" });

  const base = siteUrl(req);
  const store = db();
  const phoneRef = store.collection("referrerPhones").doc(phone);
  const deviceRef = validDevice(b.deviceId) ? store.collection("referrerDevices").doc(String(b.deviceId)) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const result = await store.runTransaction(async (tx) => {
      // --- lecturas (todas antes de escribir) ---
      const idx = await tx.get(phoneRef);
      const dev = deviceRef ? await tx.get(deviceRef) : null;
      let existing = null;
      if (idx.exists) {
        const snap = await tx.get(store.collection("referrers").doc(idx.data().referrerId));
        if (snap.exists) existing = snap.data();
      }
      let deviceOwner = null;
      if (!existing && dev && dev.exists) {
        const snap = await tx.get(store.collection("referrers").doc(dev.data().referrerId));
        if (snap.exists && Date.now() < toMs(snap.data().deadlineAt)) deviceOwner = snap.data();
      }
      const codeRef = store.collection("referralCodes").doc(code);
      const codeTaken = !existing && !deviceOwner ? (await tx.get(codeRef)).exists : false;

      // --- 1. ese teléfono ya tiene enlace: se devuelve el mismo ---
      if (existing) {
        tx.update(store.collection("referrers").doc(existing.id), { lastSeenAt: now() });
        if (deviceRef) tx.set(deviceRef, { referrerId: existing.id, updatedAt: now() });
        return { existing: true, r: existing };
      }
      // --- 2. este dispositivo ya tiene un enlace activo con otro teléfono ---
      if (deviceOwner) return { device: true, r: deviceOwner };
      // --- 3. enlace nuevo ---
      if (codeTaken) return { retry: true };                                  // código repetido (rarísimo)
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
      if (deviceRef) tx.set(deviceRef, { referrerId: id, updatedAt: now() });
      return { existing: false, r: { ...r, createdAt: new Date(createdMs) } };
    });
    if (result.retry) continue;
    if (result.device) {
      return send(res, 409, { ok: false, error: "device_active", existingReferrer: referrerView(result.r, base) });
    }
    return send(res, 200, { ok: true, existing: result.existing, ...referrerView(result.r, base) });
  }
  send(res, 500, { ok: false, error: "code" });
});
