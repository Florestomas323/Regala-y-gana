/* /privacidad y /terminos — textos base: revísalos con tu asesor legal antes de publicar */
import { ORGANIZER, SITE_NAME, DELIVERY, CAMPAIGN_ID, REFERRAL_PROGRAM, REFERRER_REWARDS, rewardsReady, CONSENT_VERSION, LEGAL } from "./config.js";
import { activePrizes } from "./prizes.js";
import { Brand, Footer } from "./ui.jsx";

export default function Legal({ page }) {
  return (
    <div className="page"><main className="wrap">
      <a href="/regalaygana" className="back">← {SITE_NAME}</a>
      <article className="card legal">
        <Brand small />
        {page === "privacidad" ? <Privacy /> : <Terms />}
        <p className="fine">Versión {CONSENT_VERSION}</p>
      </article>
    </main><Footer /></div>
  );
}

function Privacy() {
  return (
    <>
      <h1>Aviso de privacidad</h1>
      <p><b>Responsable:</b> {ORGANIZER.name} · {ORGANIZER.phoneDisplay}.</p>

      <h2>¿Para qué usamos tus datos?</h2>
      <p>La única finalidad es <b>ponernos en contacto contigo para entregarte tus regalos</b>: coordinar la cita de entrega,
        confirmar tu participación y, si compartes tu enlace, avisarte de tu avance y entregarte el regalo que ganes.</p>

      <h2>¿Qué datos recogemos?</h2>
      <ul>
        <li><b>Si creas un enlace para compartir:</b> tu nombre, tu teléfono y tu aceptación de este aviso.</li>
        <li><b>Si recibes un regalo:</b> tu nombre, tu teléfono, tu aceptación para ser contactado, el premio que obtuviste
          y el enlace con el que llegaste.</li>
        <li><b>Uso del enlace:</b> contamos visitas, registros y entregas de forma numérica, sin guardar tu dirección IP ni tu ubicación.</li>
      </ul>

      <h2>¿Cómo te contactamos?</h2>
      <p>Por llamada, mensaje de texto o WhatsApp, solo para lo descrito arriba y solo porque tú lo aceptaste al registrarte.</p>

      <h2>Lo que NO hacemos</h2>
      <ul>
        <li>No accedemos a la agenda ni a los contactos de tu teléfono.</li>
        <li>No enviamos mensajes automáticos a tus conocidos: cada persona comparte su enlace por su propia voluntad.</li>
        <li>No vendemos ni rentamos tus datos.</li>
        <li>Quien te compartió el enlace no ve tus datos; solo ve cuántas personas se registraron y cuántas recibieron su regalo.</li>
      </ul>

      <h2>¿Quién guarda la información?</h2>
      <p>Los datos se guardan en servicios de Google Firebase y la página funciona en Vercel, que actúan solo como proveedores técnicos.</p>

      <h2>¿Por cuánto tiempo?</h2>
      <p>Mientras dure la campaña y el tiempo necesario para entregar los regalos y atender tu participación.</p>

      <h2>Tus derechos</h2>
      <p>Puedes pedir ver, corregir o borrar tus datos, o que dejemos de contactarte, en cualquier momento
        escribiendo o llamando al {ORGANIZER.phoneDisplay}. Retirar tu aceptación no afecta un regalo ya entregado.</p>

      <h2>Edad</h2>
      <p>Este programa es para personas mayores de 18 años.</p>
    </>
  );
}

function Terms() {
  const N = REFERRAL_PROGRAM.requiredDeliveries, D = REFERRAL_PROGRAM.windowDays;
  return (
    <>
      <h1>Términos y bases del programa</h1>

      <h2>Información sobre los regalos</h2>
      <Disclosure />

      <h2>Para quien recibe un regalo</h2>
      <ul>
        <li>Un giro por persona y por número de teléfono en esta campaña ({CAMPAIGN_ID}).</li>
        <li>El premio lo determina el sistema al girar la ruleta y queda guardado; no se puede volver a girar.</li>
        <li>{DELIVERY.title} {DELIVERY.body}</li>
        {DELIVERY.showNoPurchaseNote ? <li>{DELIVERY.noPurchaseNote}</li> : null}
        <li>Los premios están sujetos a disponibilidad y a la coordinación de la cita.</li>
      </ul>

      <h2>Para quien comparte su enlace</h2>
      <ul>
        <li>Tienes <b>{D} días</b> desde que creas tu enlace.</li>
        <li>Si en ese plazo <b>{N} personas distintas</b> que llegaron con tu enlace <b>reciben su regalo</b> en su cita, ganas un regalo para ti.</li>
        <li>{rewardsReady()
          ? <>Podrás elegir uno de estos: {REFERRER_REWARDS.map((r) => r.name).join(", ")}.</>
          : <>Podrás elegir uno de los {REFERRER_REWARDS.length} regalos disponibles para el programa.</>}</li>
        <li>Una persona cuenta una sola vez y solo cuando ya recibió su regalo. Registrarse o girar la ruleta todavía no cuenta.</li>
        <li>No puedes usar tu propio enlace para registrarte.</li>
        <li>Un regalo por persona que comparte en esta campaña. Tu enlace sigue funcionando después del plazo para que tus conocidos reciban su regalo.</li>
        <li>Coordinamos la entrega de tu regalo por WhatsApp o llamada.</li>
      </ul>

      <h2>Para todos</h2>
      <ul>
        <li>{LEGAL.eligibility}</li>
      </ul>
      <ul>
        <li>Datos falsos, registros duplicados o el uso indebido del programa pueden anular los regalos.</li>
        <li>El uso de tus datos se explica en el <a href="/privacidad">Aviso de privacidad</a>.</li>
        <li>Dudas: {ORGANIZER.name} · {ORGANIZER.phoneDisplay}.</li>
      </ul>
    </>
  );
}

/* Divulgación exigida en Texas para regalos ligados a una presentación de ventas */
function Disclosure() {
  const prizes = activePrizes();
  const total = prizes.reduce((a, p) => a + Number(p.weight), 0);
  const addr = LEGAL.sponsorAddress && !/PENDIENTE/i.test(LEGAL.sponsorAddress) ? `, ${LEGAL.sponsorAddress}` : "";
  const mins = LEGAL.presentationMinutes && !/PENDIENTE/i.test(LEGAL.presentationMinutes) ? ` de aproximadamente ${LEGAL.presentationMinutes} minutos` : "";
  const values = LEGAL.showValuesInTerms && prizes.some((p) => p.retailValue);
  return (
    <ul>
      <li><b>Quién los ofrece:</b> {LEGAL.sponsorName || ORGANIZER.name}{addr} · {ORGANIZER.phoneDisplay}.</li>
      <li><b>Para recibir el regalo es necesario asistir a una cita</b> con una charla informativa sobre bienestar y una
        demostración{mins} de nuestros productos para el cuidado del hogar y el bienestar.</li>
      {DELIVERY.showNoPurchaseNote ? <li><b>No se requiere compra</b> para participar ni para recibir el regalo.</li> : null}
      <li><b>Regalos de la ruleta</b>{LEGAL.showOddsInTerms ? " y probabilidad de obtener cada uno" : ""}{values ? " (valor aproximado)" : ""}:
        <ul>
          {prizes.map((p) => (
            <li key={p.id}>{p.name}
              {LEGAL.showOddsInTerms && total ? ` — ${Math.round((Number(p.weight) / total) * 1000) / 10}%` : ""}
              {values && p.retailValue ? ` — aprox. $${p.retailValue}` : ""}
            </li>
          ))}
        </ul>
      </li>
      <li>Todos los participantes reciben un regalo. El regalo se entrega en la cita, sujeto a disponibilidad; si no hubiera
        existencias, se entrega otro de valor igual o similar.</li>
    </ul>
  );
}
