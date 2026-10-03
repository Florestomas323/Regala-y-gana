/* =====================================================================
   FIREBASE PARA LA PÁGINA — solo se usa para ENTRAR AL PANEL CON GOOGLE
   ---------------------------------------------------------------------
   Pega aquí la configuración web de tu proyecto:
   Firebase → ⚙️ Configuración del proyecto → General → Tus apps → Web (</>)
   Estos datos NO son secretos (Google los diseñó para ir en la página).
   La clave privada (cuenta de servicio) va SOLO en Vercel, nunca aquí.
   ===================================================================== */
export const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyD-n6YJkDzKV5WmfTf6AvKPcxUN5aJ9PFo",
  authDomain: "regala-y-gana.firebaseapp.com",
  projectId: "regala-y-gana",
  storageBucket: "regala-y-gana.firebasestorage.app",
  messagingSenderId: "724617545533",
  appId: "1:724617545533:web:e9b6b03e3abb11e2f5a754",
};
/* ===================================================================== */

export const firebaseWebReady = () =>
  Object.values(FIREBASE_WEB_CONFIG).every((v) => v && !/^PENDIENTE$/i.test(v));

let authPromise = null;

/* Firebase se carga solo al abrir el panel (no pesa en las demás páginas) */
async function getAuthInstance() {
  if (!authPromise) {
    authPromise = (async () => {
      const [{ initializeApp, getApps }, authMod] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
      const app = getApps()[0] || initializeApp(FIREBASE_WEB_CONFIG);
      const auth = authMod.getAuth(app);
      await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => {});
      return { auth, m: authMod };
    })();
  }
  return authPromise;
}

export async function onAdminChange(cb) {
  if (!firebaseWebReady()) { cb(null); return () => {}; }
  const { auth, m } = await getAuthInstance();
  return m.onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  const { auth, m } = await getAuthInstance();
  const provider = new m.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return await m.signInWithPopup(auth, provider);
  } catch (e) {
    // si el navegador bloquea la ventana emergente, se usa redirección
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
      return m.signInWithRedirect(auth, provider);
    }
    throw e;
  }
}

export async function signOutAdmin() {
  if (!firebaseWebReady()) return;
  const { auth, m } = await getAuthInstance();
  await m.signOut(auth);
}

export async function currentToken() {
  if (!firebaseWebReady()) return null;
  const { auth } = await getAuthInstance();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
