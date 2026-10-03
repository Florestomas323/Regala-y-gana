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
    try { data = await res.json(); } catch {}
    return { ok: res.ok && data.ok !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  createReferrer: (name, phone, website, consent) => call("/api/referrers", { body: { name, phone, website, consent } }),
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

/* Mensajes de error claros para la persona */
export function errorText(r, fallback = "No pudimos completar la acción. Inténtalo de nuevo.") {
  const e = r && r.data && r.data.error;
  if (r && r.status === 0) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  return ({
    name: "Escribe tu nombre (solo letras).",
    phone: "Escribe un número de teléfono válido.",
    consent: "Debes aceptar el uso de tus datos para continuar.",
    not_qualified: "Todavía no completas las 4 entregas.",
    already_chosen: "Ya elegiste tu regalo.",
    rewards_pending: "Los regalos todavía no están disponibles para elegir.",
    code: "Este enlace no es válido o ya no está activo.",
    own_link: "Este enlace es tuyo: compártelo con alguien especial para que reciba su regalo.",
    rate: "Hay muchos intentos en este momento. Espera un minuto e inténtalo otra vez.",
  })[e] || fallback;
}
