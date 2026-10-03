/* Piezas visuales compartidas */
import { useEffect, useState } from "react";

export function GiftIcon({ size = 56 }) {
  return (
    <svg className="gift-icon" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F7F8FA" /><stop offset=".55" stopColor="#C9CDD3" /><stop offset="1" stopColor="#8E949C" /></linearGradient>
        <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".55" stopColor="#D9DCE1" /><stop offset="1" stopColor="#9BA2AB" /></linearGradient>
        <linearGradient id="gr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5C6168" /><stop offset=".5" stopColor="#A3AAB2" /><stop offset="1" stopColor="#3B4048" /></linearGradient>
      </defs>
      <rect x="10" y="28" width="44" height="30" rx="4" fill="url(#gb)" stroke="#6C737C" strokeWidth="1.2" />
      <rect x="6" y="19" width="52" height="12" rx="3" fill="url(#gl)" stroke="#6C737C" strokeWidth="1.2" />
      <rect x="28" y="19" width="8" height="39" fill="url(#gr)" />
      <path d="M32 19c-6-2-12-9-9-13 3-3 8 3 9 10 1-7 6-13 9-10 3 4-3 11-9 13z" fill="none" stroke="url(#gr)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ small }) {
  return (
    <div className={"brand" + (small ? " brand--small" : "")}>
      <GiftIcon size={small ? 34 : 54} />
      <span className="brand-name">REGALA <b>Y</b> GANA</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <a href="/privacidad">Privacidad</a><span aria-hidden="true">·</span><a href="/terminos">Términos</a>
    </footer>
  );
}

/* Enlaces a Privacidad y Términos junto a cada formulario */
export function PolicyLinks() {
  return (
    <p className="policy-links">
      Lee nuestro <a href="/privacidad" target="_blank" rel="noopener">Aviso de privacidad</a> y los{" "}
      <a href="/terminos" target="_blank" rel="noopener">Términos y bases del programa</a>.
    </p>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className={"field" + (error ? " has-error" : "")}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Spinner() { return <span className="spinner" aria-hidden="true" />; }

/* Aviso breve tipo "¡Copiado!" */
export function useToast() {
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 1800); return () => clearTimeout(t); }, [msg]);
  const node = <div className={"toast" + (msg ? " show" : "")} role="status" aria-live="polite">{msg}</div>;
  return [node, setMsg];
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}

/* iPhone/iPad usan sms:&body= ; Android y otros sms:?body= */
export function smsHref(text) {
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return (ios ? "sms:&body=" : "sms:?body=") + encodeURIComponent(text);
}
