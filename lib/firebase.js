/* Firebase Admin (SOLO servidor). La clave de servicio vive en Vercel,
   nunca en la página. Acepta una de estas dos formas:
   - FIREBASE_SERVICE_ACCOUNT = el JSON completo de la cuenta de servicio
   - FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY

   Firebase se carga de forma protegida: si algo falla al cargarlo, la
   función NO se cae; responde con un código que dice qué pasó. */

let A = null, F = null, U = null, loadError = null;
try {
  [A, F, U] = await Promise.all([import("firebase-admin/app"), import("firebase-admin/firestore"), import("firebase-admin/auth")]);
} catch (e) {
  loadError = e;
  console.error("[regalaygana] no se pudo cargar firebase-admin:", e && e.message);
}

function ensureLoaded() {
  if (loadError) throw new Error("firebase_load: " + (loadError.message || loadError));
}

function credentials() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    let sa;
    try { sa = JSON.parse(json); } catch { throw new Error("credentials_json: FIREBASE_SERVICE_ACCOUNT no es un JSON válido"); }
    if (sa.private_key) sa.private_key = String(sa.private_key).replace(/\\n/g, "\n");
    return sa;
  }
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail } = process.env;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  throw new Error("credentials_missing: Falta FIREBASE_SERVICE_ACCOUNT en las variables de Vercel");
}

let cached = null;

/* globalThis.__REGALA_TEST__ solo existe en las pruebas locales */
export function db() {
  if (globalThis.__REGALA_TEST__) return globalThis.__REGALA_TEST__.db;
  ensureLoaded();
  if (!cached) {
    if (!A.getApps().length) A.initializeApp({ credential: A.cert(credentials()) });
    cached = F.getFirestore();
  }
  return cached;
}

/* Verifica el inicio de sesión con Google del panel (token de Firebase Auth) */
export async function verifyIdToken(token) {
  if (globalThis.__REGALA_TEST__) return globalThis.__REGALA_TEST__.verifyIdToken(token);
  db();                                   // asegura que la app esté iniciada
  return U.getAuth().verifyIdToken(token);
}

export const now = () => {
  if (globalThis.__REGALA_TEST__) return globalThis.__REGALA_TEST__.now();
  ensureLoaded(); return F.FieldValue.serverTimestamp();
};

export const inc = (n = 1) => {
  if (globalThis.__REGALA_TEST__) return globalThis.__REGALA_TEST__.inc(n);
  ensureLoaded(); return F.FieldValue.increment(n);
};

/* Traduce cualquier error a un código corto y seguro (sin secretos) */
export function reasonOf(e) {
  const m = String((e && (e.message || e)) || ""), c = e && e.code;
  if (/^firebase_load|Cannot find module|ERR_MODULE_NOT_FOUND/i.test(m)) return "module";
  if (/^credentials_missing/.test(m)) return "credentials_missing";
  if (/^credentials_json/.test(m)) return "credentials_json";
  if (/private key|PEM|DECODER|Invalid key|asn1/i.test(m)) return "credentials_key";
  if (/project_id|"project_id"|client_email/i.test(m)) return "credentials_fields";
  if (c === 5 || /NOT_FOUND|does not exist/i.test(m)) return "firestore_missing";
  if (c === 7 || /PERMISSION_DENIED/i.test(m)) return "permission";
  if (c === 16 || /UNAUTHENTICATED|invalid_grant|account not found|Invalid JWT/i.test(m)) return "unauthenticated";
  if (c === 4 || /DEADLINE_EXCEEDED|timed? ?out/i.test(m)) return "timeout";
  if (c === 14 || /UNAVAILABLE|ECONNRESET|ENOTFOUND/i.test(m)) return "unavailable";
  return "unknown";
}

export function toMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") return Date.parse(v) || 0;
  return 0;
}

export function toIso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : null;
}
