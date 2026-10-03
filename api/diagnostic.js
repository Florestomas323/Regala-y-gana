// api/diagnostic.js
// Diagnóstico seguro para Vercel: no muestra secretos.
// Prueba variables, imports de Firebase Admin e inicialización de Firestore.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const checks = {
    node: process.version,
    env_present: false,
    env_json_valid: false,
    project_id: null,
    firebase_app_import: null,
    firebase_firestore_import: null,
    firebase_admin_init: null,
    firestore_read: null,
  };

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
    checks.env_present = !!raw;

    if (!raw) {
      return res.status(200).json({
        ok: false,
        stage: "environment",
        checks,
        error: "FIREBASE_SERVICE_ACCOUNT no está disponible para esta función."
      });
    }

    let serviceAccount;

    try {
      serviceAccount = JSON.parse(raw);
      checks.env_json_valid = true;
      checks.project_id = serviceAccount.project_id || null;
    } catch (e) {
      return res.status(200).json({
        ok: false,
        stage: "parse_env",
        checks,
        error: String(e?.message || e).slice(0, 500)
      });
    }

    let appMod;

    try {
      appMod = await import("firebase-admin/app");
      checks.firebase_app_import = "ok";
    } catch (e) {
      checks.firebase_app_import = "ERROR";
      return res.status(200).json({
        ok: false,
        stage: "import_firebase_admin_app",
        checks,
        error: String(e?.stack || e?.message || e).slice(0, 1200)
      });
    }

    let fsMod;

    try {
      fsMod = await import("firebase-admin/firestore");
      checks.firebase_firestore_import = "ok";
    } catch (e) {
      checks.firebase_firestore_import = "ERROR";
      return res.status(200).json({
        ok: false,
        stage: "import_firebase_admin_firestore",
        checks,
        error: String(e?.stack || e?.message || e).slice(0, 1200)
      });
    }

    try {
      const { initializeApp, cert, getApps } = appMod;

      if (!getApps().length) {
        initializeApp({
          credential: cert(serviceAccount)
        });
      }

      checks.firebase_admin_init = "ok";
    } catch (e) {
      checks.firebase_admin_init = "ERROR";
      return res.status(200).json({
        ok: false,
        stage: "firebase_admin_init",
        checks,
        error: String(e?.stack || e?.message || e).slice(0, 1200)
      });
    }

    try {
      const { getFirestore } = fsMod;
      const db = getFirestore();

      await db.collection("_diagnostic").doc("_ping").get();
      checks.firestore_read = "ok";
    } catch (e) {
      checks.firestore_read = "ERROR";
      return res.status(200).json({
        ok: false,
        stage: "firestore_read",
        checks,
        error: String(e?.stack || e?.message || e).slice(0, 1200)
      });
    }

    return res.status(200).json({
      ok: true,
      stage: "complete",
      checks
    });

  } catch (e) {
    return res.status(200).json({
      ok: false,
      stage: "unexpected",
      checks,
      error: String(e?.stack || e?.message || e).slice(0, 1200)
    });
  }
}
