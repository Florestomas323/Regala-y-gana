/* Firebase Admin (SOLO servidor). La clave de servicio vive en Vercel,
   nunca en la página. Acepta una de estas dos formas:
   - FIREBASE_SERVICE_ACCOUNT = el JSON completo de la cuenta de servicio
   - FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function credentials() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) return JSON.parse(json);
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail } = process.env;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  throw new Error("Falta FIREBASE_SERVICE_ACCOUNT en las variables de Vercel");
}

let cached = null;

/* globalThis.__REGALA_TEST__ solo existe en las pruebas locales */
export function db() {
  if (globalThis.__REGALA_TEST__) return globalThis.__REGALA_TEST__.db;
  if (!cached) {
    if (!getApps().length) initializeApp({ credential: cert(credentials()) });
    cached = getFirestore();
  }
  return cached;
}

/* Verifica el inicio de sesión con Google del panel (token de Firebase Auth) */
export async function verifyIdToken(token) {
  if (globalThis.__REGALA_TEST__) return globalThis.__REGALA_TEST__.verifyIdToken(token);
  db();                                   // asegura que la app esté iniciada
  return getAuth().verifyIdToken(token);
}

export const now = () =>
  globalThis.__REGALA_TEST__ ? globalThis.__REGALA_TEST__.now() : FieldValue.serverTimestamp();

export const inc = (n = 1) =>
  globalThis.__REGALA_TEST__ ? globalThis.__REGALA_TEST__.inc(n) : FieldValue.increment(n);

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
