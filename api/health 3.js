/* GET /api/health — diagnóstico de la instalación (no muestra ningún secreto)
   Ábrelo en el navegador: https://TU-DOMINIO/api/health */
import { db, reasonOf, findCredentialVar, parseServiceAccount } from "../lib/firebase.js";
import { route, send } from "../lib/server.js";
import { PANEL_ADMINS } from "../src/config.js";

const short = (m) => String(m || "").split("\n")[0].replace(/-----BEGIN[\s\S]*/g, "[clave]").replace(/[\w.+-]+@[\w.-]+/g, "[correo]").slice(0, 180);

export const TEXT = {
  module: "no se pudo cargar la librería de Firebase en Vercel (Redeploy sin caché)",
  credentials_missing: "no existe la variable FIREBASE_SERVICE_ACCOUNT en Vercel para Production, o falta hacer Redeploy",
  credentials_web: "pegaste la configuración WEB de Firebase (apiKey). Aquí va la CLAVE PRIVADA de la cuenta de servicio (archivo .json)",
  credentials_json: "el texto pegado no es el JSON completo de la clave (se cortó o tiene caracteres de más)",
  credentials_fields: "al JSON le faltan datos (project_id, client_email o private_key): pégalo completo",
  credentials_key: "la clave privada del JSON está dañada: genera una nueva y pégala completa",
  firestore_missing: "no existe la base de datos Firestore: Firebase → Firestore Database → Crear base de datos",
  firestore_mode: "la base se creó en 'modo Datastore'; debe ser Firestore en modo nativo",
  api_disabled: "la API de Cloud Firestore está desactivada en el proyecto",
  permission: "la cuenta de esa clave no tiene permiso sobre la base de datos (usa la clave de 'firebase-adminsdk' del proyecto regala-y-gana)",
  unauthenticated: "Google rechazó la clave (se borró o regeneró): genera una nueva y pégala en Vercel",
  timeout: "Firestore tardó demasiado en responder",
  unavailable: "no se pudo conectar con Firestore",
};

export default route(["GET"], async (req, res) => {
  const checks = {};
  let ok = true;
  const fail = (k, v) => { checks[k] = "ERROR: " + v; ok = false; };

  checks.version = `commit ${(process.env.VERCEL_GIT_COMMIT_SHA || "?").slice(0, 7)} · entorno ${process.env.VERCEL_ENV || "?"}`;
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 18) checks.node = `ok (${process.version})`; else fail("node", `Node ${process.version}; se necesita 18 o más`);

  // Solo NOMBRES de variables (nunca valores)
  const names = Object.keys(process.env).filter((k) => /FIREBASE|GOOGLE|ADMIN_/i.test(k)).sort();
  checks.variables_encontradas = names.length ? names.join(", ") : "ninguna";

  const varName = findCredentialVar();
  if (!varName && !process.env.FIREBASE_PRIVATE_KEY) {
    fail("clave", TEXT.credentials_missing);
  } else if (varName) {
    try {
      const sa = parseServiceAccount(process.env[varName]);
      checks.clave = `ok (variable ${varName}, proyecto ${sa.project_id})`;
      if (sa.project_id !== "regala-y-gana") checks.aviso = `la clave es del proyecto "${sa.project_id}"; la página usa "regala-y-gana"`;
      // Tipo de cuenta (solo el inicio del correo, sin la parte única)
      const user = String(sa.client_email || "").split("@")[0];
      checks.cuenta = /^firebase-adminsdk-/.test(user)
        ? "ok (cuenta firebase-adminsdk, la correcta)"
        : `ERROR: la clave es de la cuenta "${user.replace(/-[a-z0-9]{4,}$/, "-…")}", no de "firebase-adminsdk". Genérala en Firebase → Configuración del proyecto → Cuentas de servicio → SDK de Firebase Admin`;
      if (!/^firebase-adminsdk-/.test(user)) ok = false;
    } catch (e) { fail("clave", TEXT[reasonOf(e)] || short(e.message)); }
  }

  if (ok) {
    try {
      await db().collection("rateLimits").doc("_health").get();
      checks.firestore = "ok";
    } catch (e) {
      const r = reasonOf(e);
      fail("firestore", TEXT[r] || short(e && e.message));
      checks.codigo = r;
      checks.detalle = short(e && e.message);
    }
  } else checks.firestore = "sin probar (primero corrige lo de arriba)";

  checks.panel = `${PANEL_ADMINS.length + (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean).length} correo(s) con acceso` +
                 (process.env.ADMIN_KEY ? " + clave de respaldo" : "");
  send(res, ok ? 200 : 500, { ok, checks });
});
