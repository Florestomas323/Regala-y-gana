/* Llamadas al servidor (/api). La página nunca toca la base de datos directo. */
async function call(path, { method = "POST", body, headers = {}, timeout = 15000, keepalive = false } = {}) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    const res = await fetch(path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
      keepalive,
    });
    let data = {};
    try { data = await res.json(); } catch { if (res.status >= 500) data = { error: "platform" }; }   // Vercel respondió sin pasar por nuestro código
    return { ok: res.ok && data.ok !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  createReferrer: (name, phone, trap, consent) => call("/api/referrers", { body: { name, phone, trap, consent, deviceId: deviceId() } }),
  openReferral: (code, countOpen) => call("/api/referral-open", { body: { code, countOpen } }),
  registerLead: (payload) => call("/api/leads", { body: payload }),
  getLead: (id) => call("/api/lead?id=" + encodeURIComponent(id), { method: "GET" }),
  spin: (leadId) => call("/api/spin", { body: { leadId }, timeout: 20000 }),
  claim: (leadId) => call("/api/claim", { body: { leadId }, timeout: 4000, keepalive: true }),
  getReferrer: (id) => call("/api/referrer?id=" + encodeURIComponent(id), { method: "GET" }),
  chooseReward: (referrerId, rewardId) => call("/api/referrer", { body: { action: "choose-reward", referrerId, rewardId } }),
  /* auth = { token } (Google) o { key } (clave de respaldo) */
  admin: (auth, body) => call("/api/admin", {
    body, headers: auth.token ? { Authorization: "Bearer " + auth.token } : { "x-admin-key": auth.key || "" },
  }),
};

/* Identificador de este dispositivo (para un enlace activo por dispositivo).
   Se guarda en el navegador; no contiene datos personales. */
export function deviceId() {
  const K = "rg_device";
  try {
    let id = localStorage.getItem(K) || (document.cookie.match(/(?:^|; )rg_device=([^;]+)/) || [])[1];
    if (!id) id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    localStorage.setItem(K, id);
    document.cookie = `${K}=${id}; max-age=${60 * 60 * 24 * 400}; path=/; SameSite=Lax; Secure`;
    return id;
  } catch { return ""; }
}

/* Problemas de instalación: se explican en español (no hay datos secretos) */
const CONFIG_HINTS = {
  module: "falta una librería en Vercel (Redeploy sin caché)",
  credentials_missing: "falta la variable FIREBASE_SERVICE_ACCOUNT en Vercel (o hacer Redeploy)",
  credentials_web: "en Vercel se pegó la configuración web (apiKey) en vez de la clave privada de la cuenta de servicio",
  credentials_json: "la clave de Firebase en Vercel está incompleta o mal pegada",
  credentials_fields: "a la clave de Firebase en Vercel le faltan datos",
  credentials_key: "la clave privada de Firebase está dañada",
  firestore_missing: "falta crear la base de datos Firestore",
  firestore_mode: "la base de datos está en modo Datastore",
  api_disabled: "la API de Firestore está desactivada",
  permission: "la clave de Firebase no tiene permiso sobre la base de datos (genera la clave en Firebase → Cuentas de servicio)",
  unauthenticated: "Google rechazó la clave de Firebase (genera una nueva)",
};

/* Mensajes de error claros para la persona. Si es un error inesperado,
   se agrega un código corto para poder revisarlo. */
export function errorText(r, fallback = "No pudimos completar la acción. Inténtalo de nuevo.") {
  const e = r && r.data && r.data.error;
  if (r && r.status === 0) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  const known = {
    name: "Escribe tu nombre (solo letras).",
    phone: "Escribe un número de teléfono válido.",
    consent: "Debes aceptar el uso de tus datos para continuar.",
    not_qualified: "Todavía no completas las 4 entregas.",
    already_chosen: "Ya elegiste tu regalo.",
    rewards_pending: "Los regalos todavía no están disponibles para elegir.",
    code: "Este enlace no es válido o ya no está activo.",
    own_link: "Este enlace es tuyo: compártelo con alguien especial para que reciba su regalo.",
    rate: "Hay muchos intentos en este momento. Espera un minuto e inténtalo otra vez.",
    invalid: "Revisa el formulario e inténtalo de nuevo.",
  }[e];
  const reason = r && r.data && r.data.reason;
  const config = CONFIG_HINTS[reason];
  const code = `(código ${r ? r.status : "?"}${e ? "-" + e : ""}${reason ? "-" + reason : ""})`;
  if (config) return `El sistema no está configurado todavía: ${config}. ${code}`;
  return known || `${fallback} ${code}`;
}
