/* GET /api/health — diagnóstico de la instalación (no muestra ningún secreto)
   Ábrelo en el navegador: https://TU-DOMINIO/api/health */
import { db } from "../lib/firebase.js";
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
      const m = short(e && e.message);
      checks.firestore = /NOT_FOUND|does not exist/i.test(m) ? "ERROR: no existe la base Firestore (créala en Firebase → Firestore Database)"
        : /PERMISSION_DENIED/i.test(m) ? "ERROR: la clave no tiene permiso sobre este proyecto"
        : "ERROR: " + m;
      ok = false;
    }
  } else checks.firestore = "sin probar (primero corrige lo de arriba)";

  checks.panel = `${PANEL_ADMINS.length + (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean).length} correo(s) con acceso` +
                 (process.env.ADMIN_KEY ? " + clave de respaldo" : "");
  send(res, ok ? 200 : 500, { ok, checks });
});
