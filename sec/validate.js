/* Validaciones compartidas por la página y el servidor */

export const digitsOnly = (s) => String(s || "").replace(/\D/g, "");

/* Teléfono → formato E.164.
   EE. UU.: 10 dígitos (o 11 empezando en 1) → +1XXXXXXXXXX
   Otros países: escribirlo con "+" y el código de país. */
export function normalizePhone(input) {
  const raw = String(input || "").trim();
  const intl = raw.startsWith("+");
  let d = digitsOnly(raw);
  if (!intl || d.startsWith("1")) {
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    if (d.length === 10) {
      // área y central no pueden empezar en 0 o 1
      return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? "+1" + d : null;
    }
    if (!intl) return null;
  }
  return d.length >= 8 && d.length <= 15 && d[0] !== "0" ? "+" + d : null;
}

/* +12145550134 → (214) 555-0134 */
export function displayPhone(e164) {
  const d = digitsOnly(e164);
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return e164 ? "+" + d : "";
}

/* Máscara mientras se escribe (EE. UU.); si empieza con + se deja libre */
export function maskPhoneInput(value) {
  const v = String(value || "");
  if (v.trim().startsWith("+")) return "+" + digitsOnly(v).slice(0, 15);
  let d = digitsOnly(v);
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d.length ? "(" + d : "";
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/* Nombre: solo letras (con acentos), espacios, punto, apóstrofo y guion */
export function cleanName(input) {
  return String(input || "").replace(/\s+/g, " ").trim().slice(0, 60);
}
export function isValidName(input) {
  const n = cleanName(input);
  if (n.length < 2) return false;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(n)) return false;
  const letters = n.match(/\p{L}/gu) || [];
  return letters.length >= 2;
}

export const isValidCode = (c) => /^[A-HJ-NP-Z2-9]{8}$/.test(String(c || ""));
