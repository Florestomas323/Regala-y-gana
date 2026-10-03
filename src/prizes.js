/* =====================================================================
   PREMIOS — EDITA SOLO ESTA LISTA
   ---------------------------------------------------------------------
   id      : identificador fijo (no lo cambies una vez publicado)
   name    : nombre que ve la persona
   image   : foto en public/prizes/
   weight  : probabilidad. Se reparte entre los premios ACTIVOS:
             con 25/25/20/10/10/5/5 cada número es directamente el %.
   active  : false = sale de la ruleta (los que ya lo ganaron lo conservan)
   wheelLabel (opcional): líneas de texto dentro de la ruleta
   retailValue (opcional): valor aproximado en dólares, ej. "45" (se muestra en /terminos)

   El orden de la lista es el orden de la ruleta (en sentido horario,
   empezando bajo la flecha). El premio lo elige SIEMPRE el servidor.
   ===================================================================== */
export const PRIZES = [
  { id: "utensilios", name: "Utensilios",             image: "/prizes/utensilios.jpg", weight: 25, active: true },
  { id: "cuchillo",   name: "Cuchillo",               image: "/prizes/cuchillo.jpg",   weight: 25, active: true },
  { id: "espumador",  name: "Espumador",              image: "/prizes/espumador.jpg",  weight: 20, active: true },
  { id: "bono-300",   name: "Bono de descuento $300", image: "/prizes/bono-300.jpg",   weight: 10, active: true,
    wheelLabel: ["BONO DE", "DESCUENTO", "$300"] },
  { id: "tazas-cafe", name: "Tazas de café",          image: "/prizes/tazas-cafe.jpg", weight: 10, active: true },
  { id: "tazones",    name: "3 tazones",              image: "/prizes/tazones.jpg",    weight: 5,  active: true },
  { id: "tabla",      name: "Tabla",                  image: "/prizes/tabla.jpg",      weight: 5,  active: true },
];
/* ===================== FIN DE LA LISTA DE PREMIOS ===================== */

export function activePrizes() {
  return PRIZES.filter((p) => p.active !== false && Number(p.weight) > 0);
}

export function findPrize(id) {
  return PRIZES.find((p) => p.id === id) || null;
}

/* Selección ponderada. randomInt(n) debe devolver un entero seguro en [0, n).
   El servidor le pasa crypto.randomInt. */
export function pickWeighted(list, randomInt) {
  const scaled = list.map((p) => Math.round(Number(p.weight) * 1000));
  const total = scaled.reduce((a, b) => a + b, 0);
  if (!total) throw new Error("No hay premios activos");
  let r = randomInt(total);
  for (let i = 0; i < list.length; i++) {
    if (r < scaled[i]) return list[i];
    r -= scaled[i];
  }
  return list[list.length - 1];
}
