/* GET /api/health — diagnóstico de la instalación (no muestra ningún secreto)
   Ábrelo en el navegador: https://TU-DOMINIO/api/health */
import { db, reasonOf } from "../lib/firebase.js";
import { route, send } from "../lib/server.js";
import { PANEL_ADMINS } from "../src/config.js";

const short = (m) => String(m || "").replace(/\s+/g, " ").slice(0, 160);

export default route(["GET"], async (req, res) => {
  const checks = {};
  let ok = true;

  const major = Number(process.versions.node.split(".")[0]);
  checks.node = major >= 22 ? `ok (${process.version})` : `ERROR: Node ${process.version}; se necesita 22.x`;
  if (major < 22) ok = false;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw && !process.env.FIREBASE_PRIVATE_KEY) {
    checks.FIREBASE_SERVICE_ACCOUNT = "ERROR: no existe en Vercel (o falta hacer Redeploy)"; ok = false;
  } else if (raw) {
    try {
      const sa = JSON.parse(raw);
      const missing = ["project_id", "client_email", "private_key"].filter((k) => !sa[k]);
      checks.FIREBASE_SERVICE_ACCOUNT = missing.length ? `ERROR: al JSON le falta ${missing.join(", ")}` : `ok (proyecto ${sa.project_id})`;
      if (missing.length) ok = false;
    } catch {
      checks.FIREBASE_SERVICE_ACCOUNT = "ERROR: el texto no es un JSON válido (¿se copió incompleto o con comillas “curvas”?)"; ok = false;
    }
  }

  if (ok) {
    try {
      await db().collection("rateLimits").doc("_health").get();
      checks.firestore = "ok";
    } catch (e) {
      const r = reasonOf(e);
      checks.firestore = ({
        module: "ERROR: no se pudo cargar la librería de Firebase en Vercel (redeploy sin caché)",
        credentials_key: "ERROR: la clave privada del JSON está dañada (vuelve a generarla y pégala completa)",
        credentials_fields: "ERROR: al JSON le faltan datos (vuelve a pegarlo completo)",
        firestore_missing: "ERROR: no existe la base Firestore (Firebase → Firestore Database → Crear)",
        permission: "ERROR: la clave no tiene permiso sobre este proyecto (¿es de regala-y-gana?)",
        unauthenticated: "ERROR: Google rechazó la clave (¿la borraste o regeneraste? pega la nueva en Vercel)",
        timeout: "ERROR: Firestore tardó demasiado en responder",
        unavailable: "ERROR: no se pudo conectar con Firestore",
      })[r] || "ERROR: " + short(e && e.message);
      checks.codigo = r;
      ok = false;
    }
  } else checks.firestore = "sin probar (primero corrige lo de arriba)";

  checks.panel = `${PANEL_ADMINS.length + (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean).length} correo(s) con acceso` +
                 (process.env.ADMIN_KEY ? " + clave de respaldo" : "");
  send(res, ok ? 200 : 500, { ok, checks });
});
