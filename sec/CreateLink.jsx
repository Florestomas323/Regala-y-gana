/* /regalaygana — Persona A crea su enlace, lo comparte y ve su progreso */
import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "./api.js";
import { MESSAGES, SITE_NAME, BUSINESS_WHATSAPP, REFERRAL_PROGRAM, REFERRER_REWARDS, REFERRER_CONSENT_TEXT, DATA_USE, rewardsReady } from "./config.js";
import { isValidName, normalizePhone, maskPhoneInput } from "./validate.js";
import { Brand, Footer, Field, Spinner, useToast, copyText, smsHref, GiftIcon, PolicyLinks } from "./ui.jsx";

const SAVED = "rg_referrer_v2";
const N = REFERRAL_PROGRAM.requiredDeliveries, DAYS = REFERRAL_PROGRAM.windowDays;
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "long" }) : "");

export default function CreateLink() {
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem(SAVED) || "null"); } catch { return null; } });
  const keep = (me) => { localStorage.setItem(SAVED, JSON.stringify(me)); setSaved(me); };
  return saved
    ? <ShareScreen me={saved} onUpdate={keep} onReset={() => { localStorage.removeItem(SAVED); setSaved(null); }} />
    : <CreateForm onDone={(me) => { keep(me); window.scrollTo(0, 0); }} />;
}

function fromApi(d) {
  return { referrerId: d.referrerId, name: d.name, code: d.referralCode, url: d.referralUrl, progress: d.progress };
}

/* ---------- 1. Crear enlace ---------- */
function CreateForm({ onDone }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameOk = isValidName(name), phoneOk = !!normalizePhone(phone);

  async function submit(e) {
    e.preventDefault();
    setTouched({ name: true, phone: true, consent: true });
    if (!nameOk || !phoneOk || !consent || busy) return;
    setBusy(true); setError("");
    const r = await api.createReferrer(name, phone, e.target.website.value, true);
    setBusy(false);
    if (!r.ok) return setError(errorText(r));
    onDone(fromApi(r.data));
  }

  return (
    <div className="page">
      <main className="wrap">
        <header className="hero">
          <Brand />
          <h1 className="hero-title">Comparte un regalo con tus familiares y amigos.</h1>
          <p className="hero-sub">Crea tu enlace personal en segundos.</p>
        </header>
        <form className="card" onSubmit={submit} noValidate>
          <Field label="Nombre" error={touched.name && !nameOk ? "Escribe tu nombre (solo letras)." : ""}>
            <input type="text" name="name" autoComplete="name" autoCapitalize="words" maxLength={60} placeholder="Tu nombre"
              value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
          </Field>
          <Field label="Teléfono" error={touched.phone && !phoneOk ? "Escribe un teléfono válido de 10 dígitos." : ""}>
            <input type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="(000) 000-0000"
              value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} onBlur={() => setTouched((t) => ({ ...t, phone: true }))} />
          </Field>
          <label className={"check" + (touched.consent && !consent ? " has-error" : "")}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{REFERRER_CONSENT_TEXT}</span>
          </label>
          <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button className="btn btn-primary" type="submit" disabled={busy || !nameOk || !phoneOk || !consent}>
            {busy ? <><Spinner /> Creando…</> : "CREAR MI ENLACE"}
          </button>
          {error ? <p className="alert">{error}</p> : null}
          <p className="data-use"><b>¿Para qué usamos tus datos?</b> {DATA_USE.referrer}</p>
          <PolicyLinks />
        </form>
        <section className="teaser">
          <GiftIcon size={34} />
          <p><b>¡Tú también ganas!</b> Si {N} personas reciben su regalo con tu enlace en los próximos {DAYS} días, eliges un regalo para ti.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- 2. Compartir + progreso ---------- */
function ShareScreen({ me, onUpdate, onReset }) {
  const [toast, showToast] = useToast();
  const [loading, setLoading] = useState(false);
  const waText = useMemo(() => MESSAGES.shareWhatsApp(me.name, me.url), [me.name, me.url]);
  const smsText = useMemo(() => MESSAGES.shareSms(me.name, me.url), [me.name, me.url]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function refresh() {
    if (!me.referrerId) return;
    setLoading(true);
    const r = await api.getReferrer(me.referrerId);
    setLoading(false);
    if (r.ok) onUpdate(fromApi(r.data));
    else if (r.status === 404) onReset();
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  async function nativeShare() {
    try { await navigator.share({ title: SITE_NAME, text: MESSAGES.shareNative(me.name), url: me.url }); } catch {}
  }
  const copy = async (text, ok) => showToast((await copyText(text)) ? ok : "No se pudo copiar");

  return (
    <div className="page">
      <main className="wrap">
        <header className="hero hero--tight">
          <Brand small />
          <div className="ready-badge"><GiftIcon size={40} /></div>
          <h1 className="hero-title">¡Tu enlace está listo!</h1>
          <p className="hero-sub">Ahora comparte un regalo con alguien especial.</p>
        </header>

        <section className="card">
          <div className="link-box" aria-label="Tu enlace personal"><span className="link-text">{me.url}</span></div>
          <div className="share-grid">
            <button type="button" className="btn btn-primary" onClick={() => copy(me.url, "¡Enlace copiado!")}>COPIAR ENLACE</button>
            <a className="btn btn-wa" href={"https://wa.me/?text=" + encodeURIComponent(waText)} target="_blank" rel="noopener noreferrer">
              <WaIcon /> COMPARTIR POR WHATSAPP
            </a>
            <a className="btn btn-silver" href={smsHref(smsText)}><SmsIcon /> COMPARTIR POR MENSAJE</a>
            {canShare ? <button type="button" className="btn btn-silver" onClick={nativeShare}><ShareIcon /> COMPARTIR</button> : null}
            <button type="button" className="btn btn-ghost" onClick={() => copy(waText, "¡Mensaje copiado!")}>COPIAR MENSAJE</button>
          </div>
        </section>

        {me.progress ? <Program me={me} onUpdate={onUpdate} loading={loading} onRefresh={refresh} /> : null}

        <section className="preview">
          <p className="preview-label">Así lo recibirá tu conocido</p>
          <div className="bubble">
            <p className="bubble-text">{waText.replace(me.url, "").trim()}</p>
            <div className="bubble-link">
              <img src="/og-image.jpg" alt="" />
              <div><b>🎁 {me.name} te envió un obsequio especial.</b><span>{me.url.replace(/^https?:\/\//, "")}</span></div>
            </div>
          </div>
        </section>

        <p className="center fine">¿No eres {me.name}? <button type="button" className="linklike" onClick={onReset}>Crear otro enlace</button></p>
      </main>
      <Footer />
      {toast}
    </div>
  );
}

/* Tarjeta del programa: 4 regalos entregados en 15 días */
function Program({ me, onUpdate, loading, onRefresh }) {
  const p = me.progress;
  const ready = rewardsReady();
  const [picking, setPicking] = useState("");
  const [error, setError] = useState("");
  const done = Math.min(p.deliveredInTime, p.required);

  async function choose(id) {
    if (picking) return;
    setPicking(id); setError("");
    const r = await api.chooseReward(me.referrerId, id);
    setPicking("");
    if (!r.ok) return setError(errorText(r));
    onUpdate(fromApi(r.data));
  }
  const waReward = p.rewardName
    ? "https://wa.me/" + BUSINESS_WHATSAPP + "?text=" + encodeURIComponent(MESSAGES.rewardClaim({ name: me.name, code: me.code, reward: p.rewardName }))
    : "";

  return (
    <section className={"card program program--" + p.state} aria-live="polite">
      <div className="program-head">
        <h2>🎁 Tu regalo por compartir</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>{loading ? <Spinner /> : "Actualizar"}</button>
      </div>

      {p.state === "active" && (
        <p className="program-goal">Logra que <b>{p.required} personas reciban su regalo</b> antes del <b>{shortDate(p.deadlineAt)}</b> y elige un regalo para ti.</p>
      )}

      <div className="slots" role="img" aria-label={`${done} de ${p.required} regalos entregados`}>
        {Array.from({ length: p.required }, (_, i) => (
          <span key={i} className={"slot" + (i < done ? " on" : "")}>{i < done ? "✓" : i + 1}</span>
        ))}
      </div>
      <p className="program-count"><b>{done} de {p.required}</b> regalos entregados</p>

      {p.state === "active" && (
        <p className="program-time">{p.daysLeft === 1 ? "Te queda 1 día" : `Te quedan ${p.daysLeft} días`} · {p.registrations} {p.registrations === 1 ? "persona registrada" : "personas registradas"} con tu enlace</p>
      )}

      {p.state === "qualified" && p.rewardStatus === "none" && (
        ready ? (
          <>
            <p className="program-win">¡Lo lograste! Elige tu regalo:</p>
            <div className="rewards">
              {REFERRER_REWARDS.map((rw) => (
                <button key={rw.id} type="button" className="reward" onClick={() => choose(rw.id)} disabled={!!picking}>
                  {rw.image ? <img src={rw.image} alt="" /> : <GiftIcon size={34} />}
                  <span>{rw.name}</span>
                  {picking === rw.id ? <Spinner /> : null}
                </button>
              ))}
            </div>
          </>
        ) : <p className="program-win">¡Lo lograste! Muy pronto te contactaremos para que elijas tu regalo.</p>
      )}

      {p.rewardName && p.rewardStatus === "chosen" && (
        <>
          <p className="program-win">Elegiste: <b>{p.rewardName}</b></p>
          <a className="btn btn-wa" href={waReward}><WaIcon /> COORDINAR MI REGALO</a>
        </>
      )}
      {p.rewardStatus === "delivered" && <p className="program-win">✓ Tu regalo {p.rewardName ? <b>{p.rewardName}</b> : null} ya fue entregado. ¡Gracias por compartir!</p>}

      {p.state === "expired" && (
        <p className="program-time">Tu plazo terminó el {shortDate(p.deadlineAt)}. Tu enlace sigue funcionando para que tus conocidos reciban su regalo.</p>
      )}

      {error ? <p className="alert">{error}</p> : null}
      <p className="fine">Un regalo cuenta cuando la persona lo recibe en su cita. Tus invitados no aparecen aquí: solo ves cuántos van.
        {ready && p.state === "active" ? ` Podrás elegir entre: ${REFERRER_REWARDS.map((r) => r.name).join(", ")}.` : ""}</p>
    </section>
  );
}

const WaIcon = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.6.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.3 0-.4.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z"/></svg>);
const SmsIcon = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>);
const ShareIcon = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6"/></svg>);
