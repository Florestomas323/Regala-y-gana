/* /r/CODIGO — Persona B: registro → ruleta (1 giro) → premio → WhatsApp */
import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorText } from "./api.js";
import { BUSINESS_WHATSAPP, CONSENT_TEXT, DATA_USE, DELIVERY, MESSAGES } from "./config.js";
import { activePrizes, findPrize } from "./prizes.js";
import { isValidName, normalizePhone, maskPhoneInput, isValidCode } from "./validate.js";
import { Brand, Footer, Field, Spinner, GiftIcon, PolicyLinks } from "./ui.jsx";
import Wheel from "./Wheel.jsx";
import { sound } from "./sound.js";
import { launchConfetti, stopConfetti } from "./confetti.js";

const leadKey = (code) => "rg_lead_" + code;

export default function Gift({ code: rawCode }) {
  const code = String(rawCode || "").toUpperCase();
  const [view, setView] = useState("loading");         // loading | invalid | form | wheel | result | error
  const [referrerName, setReferrerName] = useState("");
  const [lead, setLead] = useState(null);
  const [fresh, setFresh] = useState(false);            // true = acaba de ganar (celebración completa)

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isValidCode(code)) return setView("invalid");
      // La visita se cuenta una vez por sesión del navegador (recargar no infla el número)
      const openKey = "rg_open_" + code;
      const countOpen = !sessionStorage.getItem(openKey);
      if (countOpen) sessionStorage.setItem(openKey, "1");
      const r = await api.openReferral(code, countOpen);
      if (!alive) return;
      if (!r.ok) { if (countOpen) sessionStorage.removeItem(openKey); return setView(r.status === 404 ? "invalid" : "error"); }
      setReferrerName(r.data.referrerName);

      // ¿Esta persona ya se registró desde este teléfono? El estado real lo da el servidor.
      const saved = localStorage.getItem(leadKey(code));
      if (saved) {
        const l = await api.getLead(saved);
        if (!alive) return;
        if (l.ok) { setLead(l.data.lead); return setView(l.data.lead.spinCompleted ? "result" : "wheel"); }
        if (l.status === 404) localStorage.removeItem(leadKey(code));
      }
      setView("form");
    })();
    return () => { alive = false; };
  }, [code]);

  function onRegistered(l) {
    localStorage.setItem(leadKey(code), l.leadId);
    setLead(l);
    setView(l.spinCompleted ? "result" : "wheel");
    window.scrollTo(0, 0);
  }

  function onWon(l) {
    setLead(l); setFresh(true); setView("result"); window.scrollTo(0, 0);
  }

  return (
    <div className="page">
      <main className="wrap">
        {view === "loading" && <div className="center pad"><Spinner /> </div>}
        {view === "invalid" && <Invalid />}
        {view === "error" && <ErrorBox onRetry={() => window.location.reload()} />}
        {view === "form" && <LeadForm code={code} referrerName={referrerName} onDone={onRegistered} />}
        {view === "wheel" && lead && <SpinScreen lead={lead} onWon={onWon} />}
        {view === "result" && lead && <Result lead={lead} fresh={fresh} />}
      </main>
      <Footer />
    </div>
  );
}

function Invalid() {
  return (
    <section className="card center">
      <Brand small />
      <h1 className="h2">Este enlace no está disponible</h1>
      <p className="muted">Puede que esté incompleto o que ya no esté activo. Pide a quien te lo envió que lo revise.</p>
      <a className="btn btn-silver" href="/regalaygana">Crear mi propio enlace</a>
    </section>
  );
}

function ErrorBox({ onRetry }) {
  return (
    <section className="card center">
      <h1 className="h2">No pudimos cargar tu regalo</h1>
      <p className="muted">Revisa tu conexión a internet e inténtalo de nuevo.</p>
      <button className="btn btn-primary" type="button" onClick={onRetry}>REINTENTAR</button>
    </section>
  );
}

/* ---------- 1. Registro (se guarda ANTES de girar) ---------- */
function LeadForm({ code, referrerName, onDone }) {
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
    const r = await api.registerLead({ code, name, phone, consent: true, website: e.target.website.value });
    setBusy(false);
    if (!r.ok) return setError(errorText(r));
    onDone(r.data.lead);
  }

  return (
    <>
      <header className="hero hero--gift">
        <div className="gift-hero"><GiftIcon size={78} /></div>
        <h1 className="hero-title">🎁 {referrerName} te envió un regalo</h1>
        <p className="hero-sub">Regístrate y gira la ruleta para descubrir qué te tocó.</p>
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
          <span>{CONSENT_TEXT}</span>
        </label>
        <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button className="btn btn-primary" type="submit" disabled={busy || !nameOk || !phoneOk || !consent}>
          {busy ? <><Spinner /> Guardando…</> : "DESCUBRIR MI REGALO"}
        </button>
        {error ? <p className="alert">{error}</p> : null}
        <p className="data-use"><b>¿Para qué usamos tus datos?</b> {DATA_USE.recipient}</p>
        <PolicyLinks />
      </form>
    </>
  );
}

/* ---------- 2. Ruleta: el servidor elige, la ruleta muestra ---------- */
function SpinScreen({ lead, onWon }) {
  const prizes = useMemo(() => activePrizes(), []);
  const wheel = useRef(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");

  async function spin() {
    if (spinning) return;
    sound.unlock();
    setSpinning(true); setError("");
    wheel.current.start();
    const r = await api.spin(lead.leadId);
    if (!r.ok || !r.data.prize) {
      await wheel.current.halt();
      setSpinning(false);
      return setError(errorText(r, "No pudimos completar el giro. Toca GIRAR para intentarlo de nuevo."));
    }
    let index = prizes.findIndex((p) => p.id === r.data.prize.id);
    if (index < 0) index = 0;                         // (premio ya inactivo: igual se muestra el ganado)
    await wheel.current.stopAt(index);
    sound.celebrate();
    launchConfetti();
    setTimeout(() => onWon(r.data.lead), 450);
  }

  return (
    <>
      <header className="hero hero--tight">
        <h1 className="hero-title hero-title--xl">¡TU REGALO TE ESTÁ ESPERANDO!</h1>
        <p className="hero-sub">Gira la ruleta</p>
      </header>
      <div className="wheel-stage">
        <Wheel ref={wheel} prizes={prizes} onHub={spin} hubDisabled={spinning} spinning={spinning} hubLabel="GIRAR" />
      </div>
      <p className="center muted">{spinning ? "Girando…" : "Toca el centro para girar. Tienes un solo giro."}</p>
      {error ? <p className="alert center">{error}</p> : null}
    </>
  );
}

/* ---------- 3. Premio + condiciones + RECLAMA TU REGALO ---------- */
function Result({ lead, fresh }) {
  const [busy, setBusy] = useState(false);
  const prize = lead.prize || {};
  const image = prize.image || (findPrize(prize.id) || {}).image;

  useEffect(() => () => { stopConfetti(); sound.stop(); }, []);

  const waUrl = "https://wa.me/" + BUSINESS_WHATSAPP + "?text=" + encodeURIComponent(MESSAGES.claim({
    name: lead.name, prize: prize.name, phone: lead.phoneDisplay, referrerName: lead.referrerName, code: lead.referralCode,
  }));

  async function claim() {
    if (busy) return;
    setBusy(true);
    // Primero se guarda el clic (claim_started); luego se abre WhatsApp
    await Promise.race([api.claim(lead.leadId), new Promise((r) => setTimeout(r, 2500))]);
    window.location.href = waUrl;
    setTimeout(() => setBusy(false), 2500);
  }

  return (
    <>
      <section className={"win" + (fresh ? " win--fresh" : "")}>
        <h1 className="win-title">¡FELICIDADES!</h1>
        <p className="win-en">CONGRATULATIONS!</p>
        {!fresh ? <p className="muted center">Ya giraste la ruleta. Este es tu regalo:</p> : null}
        <p className="win-label">GANASTE</p>
        <h2 className="win-prize">{prize.name}</h2>
        <div className="win-media">
          <div className="rays" aria-hidden="true" />
          {image ? <img src={image} alt={prize.name} /> : null}
          <svg className="spark s1" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" /></svg>
          <svg className="spark s2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" /></svg>
          <svg className="spark s3" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" /></svg>
        </div>
      </section>

      <section className="card info">
        <h3 className="info-title">{DELIVERY.title}</h3>
        <p>{DELIVERY.body}</p>
        {DELIVERY.showNoPurchaseNote ? <p className="info-note">{DELIVERY.noPurchaseNote}</p> : null}
      </section>

      <button type="button" className="btn btn-primary btn-xl" onClick={claim} disabled={busy}>
        {busy ? <><Spinner /> Abriendo WhatsApp…</> : <>🎁 RECLAMA TU REGALO</>}
      </button>
      <p className="center fine">Se abrirá WhatsApp con tu mensaje listo para coordinar la cita.</p>
    </>
  );
}
