/* /api/referrer — la página de quien comparte
   GET  ?id=REFERRERID                               → su enlace y su progreso (solo números, nunca datos de sus invitados)
   POST { referrerId, action: "choose-reward", rewardId } → elige su regalo cuando ya logró las 4 entregas */
import { db, now } from "../lib/firebase.js";
import { route, send, body, siteUrl, referrerView, referrerProgress, eventDoc } from "../lib/server.js";
import { rewardsReady, findReward } from "../src/config.js";

const validId = (id) => /^[A-Za-z0-9_-]{16,40}$/.test(id);

export default route(["GET", "POST"], async (req, res) => {
  const store = db();

  if (req.method === "GET") {
    const id = String((req.query && req.query.id) || new URL(req.url, "http://x").searchParams.get("id") || "");
    if (!validId(id)) return send(res, 404, { ok: false, error: "referrer" });
    const snap = await store.collection("referrers").doc(id).get();
    if (!snap.exists) return send(res, 404, { ok: false, error: "referrer" });
    return send(res, 200, { ok: true, ...referrerView(snap.data(), siteUrl(req)) });
  }

  const b = body(req);
  if (b.action !== "choose-reward") return send(res, 400, { ok: false, error: "action" });
  const id = String(b.referrerId || "");
  if (!validId(id)) return send(res, 404, { ok: false, error: "referrer" });
  if (!rewardsReady()) return send(res, 409, { ok: false, error: "rewards_pending" });
  const reward = findReward(String(b.rewardId || ""));
  if (!reward) return send(res, 400, { ok: false, error: "reward" });

  const ref = store.collection("referrers").doc(id);
  const out = await store.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { code: 404, error: "referrer" };
    const r = snap.data();
    const p = referrerProgress(r);
    if (p.state !== "qualified") return { code: 409, error: "not_qualified" };
    if (r.rewardStatus && r.rewardStatus !== "none") return { code: 409, error: "already_chosen" };   // una sola elección
    const upd = { rewardId: reward.id, rewardName: reward.name, rewardStatus: "chosen", rewardChosenAt: now() };
    tx.update(ref, upd);
    const [e, ev] = eventDoc("reward_chosen", { referrerId: id, referralCode: r.referralCode, extra: { rewardId: reward.id } });
    tx.set(e, ev);
    return { code: 200, r: { ...r, ...upd } };
  });
  if (out.code !== 200) return send(res, out.code, { ok: false, error: out.error });
  send(res, 200, { ok: true, ...referrerView(out.r, siteUrl(req)) });
});
