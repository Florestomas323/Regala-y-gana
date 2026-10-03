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

/* Busca la clave de la cuenta de servicio. Primero FIREBASE_SERVICE_ACCOUNT;
   si no existe, cualquier variable con "FIREBASE" o "GOOGLE" en el nombre
   cuyo valor sea una cuenta de servicio (por si se le puso otro nombre). */
export function findCredentialVar() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return "FIREBASE_SERVICE_ACCOUNT";
  return Object.keys(process.env).find((k) => /FIREBASE|GOOGLE/i.test(k) && /service_account/.test(process.env[k] || "")) || null;
}

/* Acepta las formas típicas de pegar el JSON desde el iPhone */
export function parseServiceAccount(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^[A-Z_]*FIREBASE[A-Z_]*\s*=\s*/, "");                 // "FIREBASE_SERVICE_ACCOUNT={...}"
  s = s.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'");                    // comillas curvas del iPhone
  if (/apiKey|authDomain|firebaseConfig/.test(s) && !/private_key/.test(s)) {
    throw new Error("credentials_web: se pegó la configuración web (apiKey) y no la clave de la cuenta de servicio");
  }
  if (!/^[{"]/.test(s) && /^[A-Za-z0-9+/=\s]+$/.test(s)) {                // por si se pegó en base64
    try { s = Buffer.from(s, "base64").toString("utf8").trim(); } catch {}
  }
  let v;
  try { v = JSON.parse(s); } catch { throw new Error("credentials_json: la clave no es un JSON válido (¿se copió incompleta?)"); }
  if (typeof v === "string") {                                           // JSON envuelto entre comillas
    try { v = JSON.parse(v); } catch { throw new Error("credentials_json: la clave no es un JSON válido"); }
  }
  if (!v || typeof v !== "object") throw new Error("credentials_json: la clave no es un JSON válido");
  const missing = ["project_id", "client_email", "private_key"].filter((k) => !v[k]);
  if (missing.length) throw new Error("credentials_fields: al JSON le falta " + missing.join(", "));
  v.private_key = String(v.private_key).replace(/\\n/g, "\n");
  return v;
}

function credentials() {
  const name = findCredentialVar();
  if (name) return parseServiceAccount(process.env[name]);
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
  if (/^credentials_web/.test(m)) return "credentials_web";
  if (/^credentials_json|Failed to parse service account json|ENOENT/.test(m)) return "credentials_json";
  if (/^credentials_fields|must contain a string/.test(m)) return "credentials_fields";
  if (/private key|PEM|DECODER|Invalid key|asn1/i.test(m)) return "credentials_key";
  if (c === 9 || /FAILED_PRECONDITION|Datastore Mode/i.test(m)) return "firestore_mode";
  if (c === 5 || /NOT_FOUND|does not exist/i.test(m)) return "firestore_missing";
  if (/has not been used|is disabled|SERVICE_DISABLED|API has not/i.test(m)) return "api_disabled";
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
