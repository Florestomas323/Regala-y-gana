/* /panel — consulta privada: entrar con Google (o clave de respaldo) */
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { LEAD_STATUSES, REWARD_STATUSES, REFERRER_REWARDS, rewardsReady } from "./config.js";
import { firebaseWebReady, onAdminChange, signInWithGoogle, signOutAdmin, currentToken } from "./firebase-web.js";
import { Brand, Spinner } from "./ui.jsx";

const KEY = "rg_admin_key";
const fmt = (iso) => (iso ? new Date(iso).toLocaleString("es-US", { dateStyle: "medium", timeStyle: "short" }) : "—");
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "short" }) : "—");
const wa = (e164) => "https://wa.me/" + String(e164 || "").replace(/\D/g, "");
const STATE = { active: "En curso", qualified: "Lo logró", expired: "Plazo vencido" };

export default function Panel() {
  const [user, setUser] = useState(undefined);            // undefined = revisando sesión
  const [key, setKey] = useState(() => sessionStorage.getItem(KEY) || "");
  const [mode, setMode] = useState(() => (sessionStorage.getItem(KEY) ? "key" : "google"));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const auth = async (m = mode) => (m === "google" ? { token: await currentToken() } : { key });

  async function load(m = mode) {
    setBusy(true); setError("");
    const r = await api.admin(await auth(m), { action: "overview" });
    setBusy(false);
    if (!r.ok) {
      setData(null);
      const e = r.data && r.data.error;
      return setError(
        e === "not_admin" ? `La cuenta ${r.data.email || ""} no tiene permiso para el panel.` :
        e === "key" ? "Clave incorrecta." : e === "token" ? "Tu sesión venció. Entra de nuevo." :
        r.status === 429 ? "Demasiados intentos. Espera 15 minutos." : "No se pudo cargar el panel.");
    }
    if (m === "key") sessionStorage.setItem(KEY, key);
    setData(r.data);
  }

  useEffect(() => {
    let off = () => {};
    onAdminChange((u) => { setUser(u || null); }).then((f) => { off = f; });
    return () => off();
  }, []);
  useEffect(() => { if (mode === "google" && user) load("google"); /* eslint-disable-next-line */ }, [user]);
  useEffect(() => { if (mode === "key" && key && !data) load("key"); /* eslint-disable-next-line */ }, []);

  /* guarda un cambio y recarga los datos */
  async function act(body) {
    const r = await api.admin(await auth(), body);
    if (!r.ok) { setError("No se pudo guardar el cambio."); return false; }
    await load();
    return true;
  }

  if (!data) {
    return (
      <div className="page"><main className="wrap">
        <section className="card login">
          <Brand small />
          <h1 className="h2">Panel privado</h1>
          {user === undefined && mode === "google" ? <p className="center"><Spinner /></p> : null}
          {firebaseWebReady() ? (
            user ? (
              <>
                <p className="muted">Sesión: {user.email}</p>
                {busy ? <p className="center"><Spinner /></p> : <button className="btn btn-primary" onClick={() => { setMode("google"); load("google"); }}>ABRIR PANEL</button>}
                <button className="btn btn-ghost" onClick={() => signOutAdmin()}>Cambiar de cuenta</button>
              </>
            ) : (
              <button className="btn btn-google" type="button" onClick={async () => { setMode("google"); setError(""); try { await signInWithGoogle(); } catch (e) { setError("No se pudo entrar con Google."); } }}>
                <GoogleIcon /> Entrar con Google
              </button>
            )
          ) : <p className="alert">Para entrar con Google falta pegar la configuración web de Firebase en <b>src/firebase-web.js</b>.</p>}
          <details className="keylogin" open={!firebaseWebReady()}>
            <summary>Entrar con clave</summary>
            <form onSubmit={(e) => { e.preventDefault(); setMode("key"); load("key"); }}>
              <label className="field"><span className="field-label">Clave (ADMIN_KEY)</span>
                <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" /></label>
              <button className="btn btn-silver" type="submit" disabled={busy || !key}>{busy && mode === "key" ? <Spinner /> : "ENTRAR CON CLAVE"}</button>
            </form>
          </details>
          {error ? <p className="alert">{error}</p> : null}
        </section>
      </main></div>
    );
  }

  return <Dashboard data={data} busy={busy} error={error} onReload={() => load()} act={act}
            onLogout={async () => { sessionStorage.removeItem(KEY); setKey(""); setData(null); await signOutAdmin(); }} />;
}

function Dashboard({ data, busy, error, onReload, act, onLogout }) {
  const [tab, setTab] = useState("refs");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState({});

  const byRef = useMemo(() => {
    const m = {};
    data.leads.forEach((l) => { (m[l.referrerId] = m[l.referrerId] || []).push(l); });
    return m;
  }, [data]);
  const match = (s) => !q || s.toLowerCase().includes(q.toLowerCase());
  const refs = data.referrers.filter((r) => (filter === "all" || r.progress.state === filter) &&
    match(r.name + r.phone + r.code + (byRef[r.id] || []).map((l) => l.name + l.phone).join(" ")));
  const leads = data.leads.filter((l) => match(l.name + l.phone + l.referrerName + (l.prize || "")));

  const t = data.referrers.reduce((a, r) => { const p = r.progress; a.o += p.linksOpened; a.r += p.registrations; a.c += p.claims; a.d += p.deliveredTotal; a.q += p.state === "qualified" ? 1 : 0; return a; }, { o: 0, r: 0, c: 0, d: 0, q: 0 });

  const setStatus = (leadId, status) => act({ action: "set-status", leadId, status });
  const setReward = (referrerId, rewardStatus, rewardId) =>
    act({ action: "set-reward", referrerId, rewardStatus, ...(rewardId !== undefined ? { rewardId } : {}) });

  return (
    <div className="page"><main className="wrap wrap--wide">
      <div className="panel-top">
        <Brand small />
        <div className="panel-actions">
          <button className="btn btn-ghost btn-sm" onClick={onReload}>{busy ? <Spinner /> : "Actualizar"}</button>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </div>
      <p className="fine">Sesión: {data.by}</p>
      <div className="kpis">
        <div><b>{data.referrers.length}</b><span>Comparten</span></div>
        <div><b>{t.r}</b><span>Prospectos</span></div>
        <div><b>{t.c}</b><span>Pidieron regalo</span></div>
        <div><b>{t.d}</b><span>Entregados</span></div>
        <div><b>{t.q}</b><span>Ganaron su regalo</span></div>
      </div>
      <div className="tabs">
        <button className={tab === "refs" ? "on" : ""} onClick={() => setTab("refs")}>Quienes comparten ({data.referrers.length})</button>
        <button className={tab === "leads" ? "on" : ""} onClick={() => setTab("leads")}>Prospectos ({data.leads.length})</button>
      </div>
      <input className="search" placeholder="Buscar nombre, teléfono o código…" value={q} onChange={(e) => setQ(e.target.value)} />
      {tab === "refs" ? (
        <div className="chips">
          {[["all", "Todos"], ["active", "En curso"], ["qualified", "Lo lograron"], ["expired", "Vencidos"]].map(([id, lb]) => (
            <button key={id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{lb}</button>
          ))}
        </div>
      ) : null}
      {error ? <p className="alert">{error}</p> : null}

      {tab === "refs" && refs.map((r) => {
        const p = r.progress, mine = byRef[r.id] || [];
        return (
          <article className="ref" key={r.id}>
            <div className="ref-head">
              <div className="row-main">
                <b>{r.name}</b>
                <a href={wa(r.phoneE164)} target="_blank" rel="noopener noreferrer">{r.phone}</a>
                <span className="muted">Código <span className="mono">{r.code}</span> · creado {day(r.createdAt)}</span>
              </div>
              <span className={"badge badge--" + p.state}>{STATE[p.state]}</span>
            </div>
            <div className="bar" aria-label={`${p.deliveredInTime} de ${p.required}`}><i style={{ width: `${(p.deliveredInTime / p.required) * 100}%` }} /></div>
            <p className="ref-line"><b>{p.deliveredInTime}/{p.required}</b> entregados a tiempo · {p.state === "active" ? `quedan ${p.daysLeft} días (hasta ${day(p.deadlineAt)})` : `plazo: ${day(p.deadlineAt)}`}</p>
            <p className="ref-stats">{p.linksOpened} abiertos · {p.registrations} registrados · {p.spins} giraron · {p.claims} pidieron · {p.deliveredTotal} entregados</p>
            {(p.state === "qualified" || p.rewardStatus !== "none") ? (
              <div className="reward-admin">
                <span>🎁 Su regalo:</span>
                <select value={p.rewardId || ""} onChange={(e) => setReward(r.id, e.target.value ? (p.rewardStatus === "delivered" ? "delivered" : "chosen") : "none", e.target.value || null)} disabled={!rewardsReady()}>
                  <option value="">{rewardsReady() ? "Sin elegir" : "Regalos pendientes de definir"}</option>
                  {REFERRER_REWARDS.map((rw) => <option key={rw.id} value={rw.id}>{rw.name}</option>)}
                </select>
                <select value={p.rewardStatus} onChange={(e) => setReward(r.id, e.target.value)}>
                  {REWARD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            ) : null}
            <button className="linklike" onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>
              {open[r.id] ? "Ocultar" : "Ver"} sus prospectos ({mine.length})
            </button>
            {open[r.id] ? (mine.length ? mine.map((l) => <LeadRow key={l.id} l={l} onStatus={setStatus} compact />) : <p className="muted fine">Todavía nadie se registró con su enlace.</p>) : null}
          </article>
        );
      })}
      {tab === "refs" && !refs.length ? <p className="center muted pad">No hay personas en esta lista.</p> : null}

      {tab === "leads" && leads.map((l) => <LeadRow key={l.id} l={l} onStatus={setStatus} />)}
      {tab === "leads" && !leads.length ? <p className="center muted pad">Sin prospectos todavía.</p> : null}

      <p className="center fine">Marca <b>Entregado</b> el mismo día en que la persona recibe su regalo: así cuenta para quien la invitó (si fue dentro de sus {data.referrers[0] ? data.referrers[0].progress.windowDays : 15} días).</p>
    </main></div>
  );
}

function LeadRow({ l, onStatus, compact }) {
  return (
    <div className={"row" + (compact ? " row--compact" : "")}>
      <div className="row-main">
        <b>{l.name}</b>
        <a href={wa(l.phoneE164)} target="_blank" rel="noopener noreferrer">{l.phone}</a>
        {!compact ? <span className="muted">Referido por {l.referrerName} · {l.code}</span> : null}
        <span>🎁 {l.prize || "Aún no gira"}</span>
        <span className="muted">{fmt(l.createdAt)}{l.status === "delivered" ? (l.countedForReward ? " · ✓ cuenta para su referidor" : " · fuera de plazo") : ""}</span>
      </div>
      <select value={l.status} onChange={(e) => onStatus(l.id, e.target.value)} aria-label="Estado">
        {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </div>
  );
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);
