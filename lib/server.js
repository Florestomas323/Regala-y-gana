/* Utilidades compartidas por las funciones de /api */
import crypto from "node:crypto";
import { db, now, toIso, toMs, reasonOf } from "./firebase.js";
import { CAMPAIGN_ID, REFERRAL_PROGRAM, findReward } from "../src/config.js";
import { displayPhone } from "../src/validate.js";

/* ---------- respuesta y protección ---------- */
export function send(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(data);
}

/* Solo se aceptan peticiones desde el mismo dominio (o ALLOWED_ORIGINS) */
function originOk(req) {
  const origin = req.headers.origin;
  if (!origin) return req.method === "GET";
  const extra = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

/* Envoltura: método permitido, origen y errores inesperados */
export function route(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return send(res, 405, { ok: false, error: "method" });
    if (!originOk(req)) return send(res, 403, { ok: false, error: "origin" });
    try {
      await handler(req, res);
    } catch (e) {
      const reason = reasonOf(e);
      console.error("[regalaygana]", req.url, reason, e && e.message);
      try { send(res, 500, { ok: false, error: "server", reason }); } catch {}
    }
  };
}

/* ---------- límite de solicitudes por IP (solo se guarda un hash) ---------- */
function ipHash(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(xf) ? xf[0] : xf || "").split(",")[0].trim() || req.socket?.remoteAddress || "0";
  return crypto.createHash("sha256").update(ip + (process.env.HASH_SALT || "regalaygana")).digest("hex").slice(0, 32);
}

/* ¿Sigue por debajo del límite? (consulta sin contar) */
export async function underLimit(req, bucket, limit, windowMinutes) {
  const snap = await db().collection("rateLimits").doc(bucket + "_" + ipHash(req)).get();
  const since = Date.now() - windowMinutes * 60 * 1000;
  return (snap.exists ? (snap.data().hits || []).filter((t) => t > since).length : 0) < limit;
}

export async function rateLimit(req, bucket, limit, windowMinutes) {
  const ref = db().collection("rateLimits").doc(bucket + "_" + ipHash(req));
  const since = Date.now() - windowMinutes * 60 * 1000;
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const hits = (snap.exists ? snap.data().hits || [] : []).filter((t) => t > since);
    if (hits.length >= limit) return false;
    hits.push(Date.now());
    tx.set(ref, { hits, updatedAt: Date.now() });
    return true;
  });
}

/* ---------- identificadores ---------- */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I
export function newCode(length = 8) {
  let s = "";
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}
export function newId() {
  return crypto.randomBytes(15).toString("base64url"); // 20 caracteres, imposible de adivinar
}

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${proto}://${req.headers.host}`;
}

/* ---------- eventos (sin datos personales) ---------- */
export function eventDoc(type, { referrerId = null, leadId = null, referralCode = null, extra = {} } = {}) {
  const ref = db().collection("events").doc();
  return [ref, { id: ref.id, type, referrerId, leadId, referralCode, campaignId: CAMPAIGN_ID, createdAt: now(), ...extra }];
}

/* ---------- búsquedas ---------- */
export async function referrerByCode(code) {
  const idx = await db().collection("referralCodes").doc(code).get();
  if (!idx.exists) return null;
  const snap = await db().collection("referrers").doc(idx.data().referrerId).get();
  if (!snap.exists || snap.data().active === false) return null;
  return { ref: snap.ref, data: snap.data() };
}

/* ---------- programa: 4 regalos entregados en 15 días ---------- */
export const DAY_MS = 24 * 60 * 60 * 1000;
export const deadlineFrom = (ms) => new Date(ms + REFERRAL_PROGRAM.windowDays * DAY_MS);

export function referrerProgress(r, nowMs = Date.now()) {
  const s = r.stats || {};
  const required = REFERRAL_PROGRAM.requiredDeliveries;
  const deadline = toMs(r.deadlineAt) || toMs(deadlineFrom(toMs(r.createdAt) || nowMs));
  const inTime = s.deliveredInTime || 0;
  const qualified = inTime >= required;
  const state = qualified ? "qualified" : nowMs > deadline ? "expired" : "active";
  const reward = r.rewardId ? findReward(r.rewardId) : null;
  return {
    required, windowDays: REFERRAL_PROGRAM.windowDays,
    deliveredInTime: Math.min(inTime, required), deliveredTotal: s.delivered || 0,
    registrations: s.registrations || 0, linksOpened: s.linksOpened || 0, spins: s.spins || 0, claims: s.claims || 0,
    deadlineAt: new Date(deadline).toISOString(),
    daysLeft: state === "active" ? Math.max(0, Math.ceil((deadline - nowMs) / DAY_MS)) : 0,
    state,
    rewardId: r.rewardId || null,
    rewardName: r.rewardName || (reward ? reward.name : null),
    rewardStatus: r.rewardStatus || "none",
  };
}

/* Lo que la página de quien comparte puede ver de sí mismo */
export function referrerView(r, base) {
  return {
    referrerId: r.id, name: r.name, referralCode: r.referralCode,
    referralUrl: r.referralUrl || `${base}/r/${r.referralCode}`,
    createdAt: toIso(r.createdAt), progress: referrerProgress(r),
  };
}

/* Lo que la página puede ver de un prospecto */
export function leadView(lead) {
  return {
    leadId: lead.id,
    name: lead.name,
    phoneDisplay: displayPhone(lead.phone),
    referralCode: lead.referralCode,
    referrerName: lead.referrerName,
    status: lead.status,
    spinCompleted: !!lead.spinCompleted,
    prize: lead.spinCompleted ? { id: lead.prizeId, name: lead.prize, image: lead.prizeImage || null } : null,
    createdAt: toIso(lead.createdAt),
  };
}
