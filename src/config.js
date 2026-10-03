/* =====================================================================
   REGALA Y GANA — CONFIGURACIÓN CENTRAL
   ---------------------------------------------------------------------
   Este archivo lo usan la página y el servidor. Aquí cambias tu
   WhatsApp, la campaña y los textos. Los premios están en prizes.js.
   ===================================================================== */

/* ▼▼▼ TU WHATSAPP: código de país + número, SOLO dígitos ▼▼▼
   Aquí llegan los mensajes de "RECLAMA TU REGALO". */
export const BUSINESS_WHATSAPP = "16823811576";

/* Campaña actual. Los duplicados se controlan por teléfono dentro de
   la campaña: si la cambias (ej. "regalaygana-2027"), cada persona
   puede volver a participar una vez en la nueva campaña. */
export const CAMPAIGN_ID = "regalaygana-2026";

export const SITE_NAME = "Regala y Gana";

/* Responsable que aparece en Privacidad y Términos */
export const ORGANIZER = {
  name: "Tomás Flores",
  phoneDisplay: "(682) 381-1576",
};

/* Condiciones de entrega (visibles ANTES de "RECLAMA TU REGALO").
   Sin afirmaciones médicas: es una charla informativa y una
   demostración comercial. */
export const DELIVERY = {
  title: "Tu regalo se coordina mediante una cita.",
  body:
    "Para recibir tu obsequio coordinaremos una breve charla informativa sobre salud y bienestar, " +
    "acompañada de una demostración de nuestros productos para el cuidado del hogar y el bienestar.",
  /* Deja esto en true SOLO si en tu programa realmente no se exige compra */
  showNoPurchaseNote: true,
  noPurchaseNote: "No se requiere compra para recibir el obsequio.",
};

/* ===================== PROGRAMA PARA QUIEN COMPARTE =====================
   Si en los 15 días siguientes a crear su enlace logra que 4 personas
   RECIBAN su regalo (estado "Entregado" en el panel), gana uno de estos
   regalos a su elección. */
export const REFERRAL_PROGRAM = {
  requiredDeliveries: 4,
  windowDays: 15,
};

/* ▼▼▼ LOS 4 REGALOS PARA QUIEN COMPARTE ▼▼▼
   image (opcional): foto en public/prizes/, ej. "/prizes/hacha.jpg".
   Sin foto se muestra el ícono de regalo.
   Si alguno dice "PENDIENTE", la página muestra "un regalo especial"
   sin la lista y todavía no deja elegir. */
export const REFERRER_REWARDS = [
  { id: "hacha",           name: "Hacha",           image: "" },
  { id: "plancha-redonda", name: "Plancha redonda", image: "" },
  { id: "filtro-ducha",    name: "Filtro de ducha", image: "" },
  { id: "chocolatera",     name: "Chocolatera",     image: "" },
];
export const rewardsReady = () =>
  REFERRER_REWARDS.length > 0 && REFERRER_REWARDS.every((r) => r.name && !/^PENDIENTE$/i.test(r.name));
export const findReward = (id) => REFERRER_REWARDS.find((r) => r.id === id) || null;

/* ===================== CONSENTIMIENTOS Y USO DE DATOS ===================== */
export const CONSENT_VERSION = "2026-10-03";

/* Quien recibe el regalo */
export const CONSENT_TEXT =
  "Acepto ser contactado por llamada, mensaje de texto o WhatsApp para coordinar la entrega de mi regalo.";

/* Quien crea su enlace para compartir */
export const REFERRER_CONSENT_TEXT =
  "Acepto que usen mi nombre y teléfono para crear mi enlace y contactarme por llamada, mensaje de texto o WhatsApp " +
  "sobre mi participación y la entrega de mis regalos. Compartiré el enlace solo con personas que conozco.";

/* Aclaración visible junto a cada formulario */
export const DATA_USE = {
  referrer:
    "Usamos tu nombre y teléfono solo para identificar tu enlace, mostrar tu nombre a quien invites y " +
    "contactarte para entregarte tus regalos. No vendemos ni compartimos tus datos, y no enviamos mensajes a tus contactos.",
  recipient:
    "Usamos tu nombre y teléfono solo para contactarte y coordinar la entrega de tu regalo. " +
    "Quien te envió el enlace no ve tus datos. No los vendemos ni compartimos.",
};

/* ===================== PANEL ===================== */
/* Correos de Google que pueden entrar a /panel (también ADMIN_EMAILS en Vercel) */
export const PANEL_ADMINS = ["florestomas323@gmail.com"];

/* Mensajes (el nombre y el enlace se completan solos) */
export const MESSAGES = {
  shareWhatsApp: (name, url) =>
    `🎁 ¡Hola! ${name} te envía un obsequio especial.\n\n` +
    `Entra en este enlace, registra tus datos y gira la ruleta para descubrir qué regalo te tocó 👇\n\n${url}`,

  shareSms: (name, url) =>
    `🎁 ${name} te envía un obsequio especial.\n\nDescubre cuál te tocó aquí:\n${url}`,

  /* Para el botón COMPARTIR del teléfono (el enlace va aparte) */
  shareNative: (name) =>
    `🎁 ¡Hola! ${name} te envía un obsequio especial. ` +
    `Entra en este enlace, registra tus datos y gira la ruleta para descubrir qué regalo te tocó 👇`,

  /* Quien compartió y ya ganó su regalo */
  rewardClaim: ({ name, code, reward }) =>
    `Hola 👋 Soy ${name}.\n\n` +
    `Logré que 4 personas recibieran su regalo con mi enlace de Regala y Gana.\n\n` +
    `Elegí mi regalo:\n🎁 ${reward}\n\nCódigo: ${code}\n\nQuiero coordinar la entrega.`,

  claim: ({ name, prize, phone, referrerName, code }) =>
    `Hola 👋 Mi nombre es ${name}.\n\n` +
    `Participé en Regala y Gana y gané:\n🎁 ${prize}\n\n` +
    `Quiero coordinar la cita para recibir mi regalo.\n\n` +
    `Mi número registrado es:\n${phone}\n\n` +
    `Referido por: ${referrerName}\nCódigo: ${code}`,
};

/* Estados del regalo de quien comparte */
export const REWARD_STATUSES = [
  { id: "none",      label: "Sin elegir" },
  { id: "chosen",    label: "Eligió regalo" },
  { id: "delivered", label: "Regalo entregado" },
];

/* Estados de un prospecto (en este orden). "delivered" = recibió su regalo:
   es el que cuenta para el programa de quien comparte. */
export const LEAD_STATUSES = [
  { id: "registered",    label: "Registrado" },
  { id: "prize_won",     label: "Ganó premio" },
  { id: "claim_started", label: "Pidió su regalo" },
  { id: "contacted",     label: "Contactado" },
  { id: "appointment",   label: "Cita agendada" },
  { id: "delivered",     label: "Entregado" },
];
