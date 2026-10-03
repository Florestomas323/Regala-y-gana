# REGALA Y GANA

Una persona crea su enlace personal y lo comparte. Quien lo recibe se registra,
gira la ruleta **una sola vez**, ve su premio y pulsa **RECLAMA TU REGALO**
para escribirte por WhatsApp.

**Programa para quien comparte:** si en los **15 días** siguientes a crear su enlace
logra que **4 personas reciban su regalo**, elige uno de **4 regalos** para sí.

```
QR del stand → /regalaygana → nombre + teléfono → CREAR MI ENLACE
            → COPIAR · WHATSAPP · MENSAJE · COMPARTIR
Amigo abre /r/CODIGO → "🎁 Tomás te envió un regalo" → nombre + teléfono + consentimiento
            → se GUARDA → gira (el servidor elige y guarda el premio) → ¡FELICIDADES!
            → condiciones de entrega → RECLAMA TU REGALO → se guarda el clic → WhatsApp a tu número
```

---

## 1. Lo que vas a cambiar más seguido

| Qué | Dónde |
|---|---|
| **Tu WhatsApp** | `src/config.js` → `BUSINESS_WHATSAPP = "16823811576"` (código de país + número, solo dígitos) |
| **Premios, imágenes, probabilidades, activo/inactivo** | `src/prizes.js` (una sola lista) |
| Fotos de los premios | carpeta `public/prizes/` |
| Textos de condiciones de entrega y “No se requiere compra” | `src/config.js` → `DELIVERY` |
| Mensajes de WhatsApp / SMS | `src/config.js` → `MESSAGES` |
| Campaña (para controlar duplicados) | `src/config.js` → `CAMPAIGN_ID` |
| Responsable en Privacidad / Términos | `src/config.js` → `ORGANIZER` |
| **Los 4 regalos para quien comparte** | `src/config.js` → `REFERRER_REWARDS` (hoy dicen `PENDIENTE`) |
| 4 entregas / 15 días | `src/config.js` → `REFERRAL_PROGRAM` |
| Consentimientos y “¿Para qué usamos tus datos?” | `src/config.js` → `CONSENT_TEXT`, `REFERRER_CONSENT_TEXT`, `DATA_USE` |
| **Configuración web de Firebase (entrar con Google)** | `src/firebase-web.js` (hoy dice `PENDIENTE`) |
| Correos que pueden entrar al panel | `src/config.js` → `PANEL_ADMINS` (y/o `ADMIN_EMAILS` en Vercel) |

> `showNoPurchaseNote: true` muestra “No se requiere compra para recibir el obsequio.”
> Déjalo en `true` **solo si en tu programa realmente no se exige compra.**

---

## 2. Estructura

```
regala-y-gana/
├── index.html            página base (vista previa para WhatsApp incluida)
├── package.json          dependencias (React, Vite, firebase-admin)
├── package-lock.json
├── vite.config.js
├── vercel.json           rutas /r/CODIGO, /regalaygana, /panel…
├── firestore.rules       reglas de seguridad (bloquean todo acceso directo)
├── .env.example          variables que van en Vercel
├── README.md
├── src/                  la página (React)
│   ├── config.js         ← TU WHATSAPP y textos
│   ├── prizes.js         ← PREMIOS y probabilidades
│   ├── validate.js       validación de nombre y teléfono (página y servidor)
│   ├── main.jsx · App.jsx            arranque y rutas
│   ├── CreateLink.jsx    /regalaygana: crear y compartir enlace
│   ├── Gift.jsx          /r/CODIGO: registro, ruleta, premio, reclamo
│   ├── Wheel.jsx         la ruleta
│   ├── Panel.jsx         /panel: entrar con Google; quienes comparten con sus prospectos
│   ├── firebase-web.js   ← configuración web de Firebase (solo para entrar con Google)
│   ├── Legal.jsx         /privacidad y /terminos
│   ├── ui.jsx · api.js · sound.js · confetti.js · styles.css
├── api/                  servidor (funciones de Vercel)
│   ├── referrers.js      crea / recupera el enlace de quien comparte
│   ├── referral-open.js  cuenta la visita al enlace
│   ├── leads.js          registra al que recibe (antes de girar)
│   ├── lead.js           estado al recargar
│   ├── spin.js           elige y guarda el premio (1 giro)
│   ├── claim.js          guarda el clic en RECLAMA TU REGALO
│   ├── referrer.js       progreso de quien comparte y elección de su regalo
│   ├── health.js         diagnóstico: abre /api/health para revisar la instalación
│   └── admin.js          panel: acceso con Google, estados, entregas y regalos
├── lib/                  utilidades del servidor (Firebase, límites, códigos)
└── public/
    ├── favicon.png · apple-touch-icon.png · og-image.jpg
    └── prizes/           fotos de los 7 premios
```

---

## 3. Firebase (proyecto NUEVO, solo para Regala y Gana)

Todo se puede hacer desde el iPhone en <https://console.firebase.google.com>.

1. **Agregar proyecto** → nombre `regala-y-gana` (Analytics no es necesario).
2. **Compilación → Firestore Database → Crear base de datos** → modo **producción** → ubicación `nam5 (us-central)`.
3. Pestaña **Reglas** → borra lo que hay → pega el contenido de `firestore.rules` → **Publicar**.
4. ⚙️ **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**.
   Se descarga un archivo `.json`. Ábrelo en Archivos y **copia todo su texto** (lo vas a pegar en Vercel).

5. **Entrar al panel con Google:**
   - **Compilación → Authentication → Comenzar → Método de acceso → Google → Habilitar** (elige tu correo de soporte) → Guardar.
   - **Authentication → Configuración → Dominios autorizados → Agregar dominio**: tu dominio de Vercel
     (ej. `regala-y-gana.vercel.app`) y tu dominio propio si tienes.
   - ⚙️ **Configuración del proyecto → General → Tus apps → Web (`</>`)** → registra la app →
     copia `apiKey`, `authDomain`, `projectId` y `appId` en **`src/firebase-web.js`** (o envíamelos y lo dejo listo).
     Estos 4 datos no son secretos. **La clave privada (paso 4) nunca va en el código ni se envía por chat: solo en Vercel.**

Las colecciones se crean solas con el primer registro. No hace falta crear índices.

> Las reglas bloquean todo acceso desde navegadores. Si usaras un proyecto de Firebase
> compartido con otra app, esas reglas la romperían: por eso va en un proyecto propio.

### Colecciones (se crean solas)

| Colección | Qué guarda |
|---|---|
| `referrers` | quien comparte: `id, name, phone, referralCode, referralUrl, active, createdAt, deadlineAt` (15 días), `consent, consentText, consentVersion, consentAt, stats{linksOpened, registrations, spins, claims, delivered, deliveredInTime}, qualifiedAt, rewardId, rewardName, rewardStatus` |
| `leads` | quien recibe: `leadId, name, phone, referralCode, referrerId, referrerName, referrerPhone, source="regalaygana", campaignId, prize, prizeId, spinCompleted, status, consent, consentText, consentVersion, consentAt, createdAt, spinDate, claimClickedAt, deliveredAt, countedForReward` |
| `events` | `type, referrerId, leadId, referralCode, campaignId, createdAt` (sin datos personales) |
| `referralCodes` · `referrerPhones` · `leadPhones` | índices que garantizan códigos únicos y **un registro por teléfono** |
| `rateLimits` | conteo de intentos por conexión (guarda un hash, no la IP) |

Estados de un prospecto: `registered → prize_won → claim_started → contacted → appointment → delivered`.
Eventos: `referral_link_opened, lead_registered, wheel_spun, prize_won, claim_clicked` (+ `status_changed`, `reward_chosen`, `reward_status_changed`).

---

## 4. GitHub + Vercel

1. En GitHub crea un repositorio nuevo, por ejemplo `regala-y-gana`.
2. Sube los archivos **carpeta por carpeta** (te los entrego en un ZIP por carpeta):
   raíz → `src/` → `api/` → `lib/` → `public/` → `public/prizes/`.
   Para crear una carpeta en GitHub móvil: *Add file → Create new file →* `src/temp.txt` → *Commit*;
   entra a la carpeta, *Add file → Upload files*, y luego borra `temp.txt`.
   Si el iPhone no te muestra `.env.example` o `.gitignore`, no pasa nada: no son necesarios para funcionar.
3. En <https://vercel.com> → **Add New → Project** → importa el repositorio.
   Vercel detecta **Vite** solo (Build: `vite build`, Output: `dist`). No cambies nada.
4. **Environment Variables** (antes de *Deploy*, o después en *Settings*):

| Variable | Obligatoria | Valor |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | todo el texto del JSON de la cuenta de servicio |
| `ADMIN_EMAILS` | opcional | más correos de Google con acceso al panel, separados por coma (el tuyo ya está en `PANEL_ADMINS`) |
| `ADMIN_KEY` | opcional | clave de respaldo para entrar al panel sin Google (16+ caracteres) |
| `SITE_URL` | opcional | tu dominio final sin barra, ej. `https://regalaygana.com` |
| `HASH_SALT` | opcional | cualquier texto |
| `ALLOWED_ORIGINS` | opcional | otros dominios autorizados, separados por coma |

5. **Deploy**. Si cambias una variable después, haz *Redeploy*.
   El proyecto usa **Node 22** (lo fija `package.json`; no hace falta tocarlo en Vercel).
   **Comprueba la instalación** abriendo `https://TU-DOMINIO/api/health`: todo debe decir `ok`.
6. En Vercel: *Settings → Deployment Protection* → desactívala (si no, tus invitados verían un login de Vercel).
7. Si usas dominio propio: *Settings → Domains*.

**QR del stand:** apúntalo a `https://TU-DOMINIO/regalaygana`.

---

## 5. Panel privado

`https://TU-DOMINIO/panel` → **Entrar con Google** (solo los correos de `PANEL_ADMINS` / `ADMIN_EMAILS`).
Si definiste `ADMIN_KEY`, también puedes entrar con esa clave.

- **Quienes comparten**: nombre, teléfono, código, fecha de creación, días que le quedan, progreso **X/4 entregados a tiempo**,
  estado (*En curso · Lo logró · Plazo vencido*), sus números y su regalo (cuál eligió y si ya se entregó).
  Toca **Ver sus prospectos** para ver debajo a cada persona que llegó con su enlace.
- **Prospectos**: todos, con referido por, premio, fecha y estado.
- **Marca “Entregado” el mismo día en que la persona recibe su regalo**: esa fecha decide si cuenta dentro de los 15 días.
  Si te equivocas, cámbialo y el conteo se corrige solo.

## 6. Programa para quien comparte

- El plazo de **15 días** empieza al crear el enlace y no se reinicia si la persona vuelve a registrarse.
- Cuenta solo cuando un invitado **recibe su regalo** (estado *Entregado* en el panel) dentro del plazo.
  Registrarse, girar o pedir el regalo todavía no cuenta. Cada invitado cuenta una vez.
- Al llegar a **4**, en su página aparece **¡Lo lograste!** con los 4 regalos para elegir (una sola elección)
  y un botón para coordinar contigo por WhatsApp. Tú marcas en el panel cuando se lo entregas.
- Mientras `REFERRER_REWARDS` diga `PENDIENTE`, la página dice “un regalo especial” y no deja elegir:
  te avisa que la contactarás. En el panel también puedes asignarle el regalo tú mismo.
- Quien comparte ve sus **visitas al enlace, registrados y entregados** (solo números, nunca nombres ni teléfonos).
- **Un enlace activo por dispositivo:** mientras su plazo esté activo, desde ese teléfono no se puede crear
  otro enlace con otro número (se le muestra el suyo). Al vencer el plazo, puede crear otro.
  Nota: si alguien borra los datos del navegador o usa navegación privada, el dispositivo no se reconoce;
  el control fuerte es por número de teléfono (un enlace por número, con su plazo original).

## 7. Consentimientos y privacidad

- Quien crea el enlace acepta el uso de su nombre y teléfono y se compromete a compartir solo con personas que conoce.
- Quien recibe acepta ser contactado para coordinar la entrega de su regalo.
- Cada formulario muestra “**¿Para qué usamos tus datos?**” y enlaces a **Aviso de privacidad** y **Términos y bases del programa**.
- Se guarda el texto aceptado, su versión (`CONSENT_VERSION`) y la fecha.

---

## 8. Seguridad y reglas de negocio

- **La página nunca toca la base de datos**: todo pasa por `/api`, con la clave de Firebase guardada en Vercel (nunca en el navegador).
- **El premio lo elige el servidor** con aleatorio seguro y ponderado (`crypto.randomInt`), lo guarda y solo después la ruleta gira hasta él.
  Ningún parámetro de la URL ni de la petición puede elegir el premio.
- **Un solo giro**: el giro es una transacción. Si ya giró, el servidor devuelve el mismo premio.
  Probado con 10 giros simultáneos del mismo prospecto: un solo premio.
- **Borrar el navegador no da otro giro**: al volver a registrarse con el mismo teléfono se recupera su registro y su premio.
- **Duplicados**: un prospecto por teléfono normalizado (`+1XXXXXXXXXX`) por campaña; un enlace por teléfono para quien comparte.
- El código del enlace es aleatorio (8 caracteres, sin 0/O ni 1/I): no contiene nombre ni teléfono.
- Las visitas se cuentan sin guardar datos personales.
- Se rechazan peticiones desde otros dominios, hay límite de intentos por conexión y un campo trampa para bots.
- El panel valida en el servidor el inicio de sesión de Google y que el correo esté autorizado y verificado.
- El panel se bloquea 15 minutos tras 10 intentos fallidos.

---

## 9. Decisiones que tomé (puedes cambiarlas)

1. **Premios iniciales**: los 7 de tu ruleta del stand (25/25/20/10/10/5/5) con sus fotos. Se cambian en `src/prizes.js`.
2. **Quien comparte no puede usar su propio enlace** (evita que alguien se regale a sí mismo). Está en `api/leads.js` (`own_link`).
3. **El primer enlace gana el crédito**: si una persona ya registrada abre el enlace de otro referidor, conserva su registro y su referidor original.
4. **Visitas**: se cuenta una por sesión del navegador (recargar la página no infla el número).
5. **Si alguien se registra de nuevo con otro nombre**, se conserva el nombre original y el nuevo queda en `lastNameEntered`.
6. **RECLAMA TU REGALO** espera hasta 2.5 s a que se guarde el clic y luego abre WhatsApp en la misma pestaña (así el iPhone no lo bloquea).
7. **Teléfonos**: EE. UU. con 10 dígitos; otros países escribiéndolos con `+` y el código de país.
8. **Una persona que comparte gana un regalo por campaña**, y lo elige una sola vez (tú puedes cambiarlo desde el panel).
9. Después de los 15 días su enlace **sigue funcionando** para que sus conocidos reciban su regalo; solo deja de sumar para su premio.
10. Privacidad y Términos son textos base: **revísalos con tu asesor legal.**

---

## 10. Probarlo en una computadora (opcional)

```bash
npm install
npm run build
```

Las funciones de `/api` corren en Vercel (o con `vercel dev` si tienes la herramienta de Vercel).
