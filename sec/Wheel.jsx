/* Ruleta: dibujo en canvas + animación.
   Uso: ref.current.start()        → empieza a girar mientras el servidor elige
        ref.current.stopAt(index)  → frena EXACTAMENTE en ese segmento (Promise)
        ref.current.halt()         → frena sin premio (si hubo un error)
   La ruleta nunca decide el premio: solo lo muestra. */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { sound } from "./sound.js";

const TAU = Math.PI * 2;
const VMAX = 1080;                       // grados por segundo a toda velocidad
const norm = (d) => ((d % 360) + 360) % 360;
const ease = (t) => 1 - Math.pow(1 - t, 3);

const Wheel = forwardRef(function Wheel({ prizes, onHub, hubDisabled, hubLabel = "GIRAR", spinning }, ref) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const imgs = useRef([]);
  const st = useRef({ rot: 0, v: 0, raf: 0, mode: "idle", t0: 0, lastSeg: -1, stop: null });
  const n = prizes.length;
  const SEG = 360 / n;
  const segAt = (rot) => Math.floor(norm(-rot) / SEG) % n;

  /* ---------- dibujo ---------- */
  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const size = cv.getBoundingClientRect().width;
    if (!size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = size / 2, R = c * 0.985, rim = R * 0.075, r = R - rim;
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;

    const metal = g.createConicGradient
      ? (() => { const m = g.createConicGradient(-Math.PI / 2, c, c);
          ["#FFFFFF", "#C4C9D0", "#F7F8FA", "#8E949C", "#FFFFFF", "#B8BEC6", "#F1F2F4", "#9AA1AA", "#FFFFFF"].forEach((col, k, a) => m.addColorStop(k / (a.length - 1), col));
          return m; })()
      : (() => { const m = g.createLinearGradient(0, 0, size, size); m.addColorStop(0, "#FFF"); m.addColorStop(0.5, "#9AA1AA"); m.addColorStop(1, "#F1F2F4"); return m; })();

    g.clearRect(0, 0, size, size);
    // aro chrome
    g.beginPath(); g.arc(c, c, R, 0, TAU); g.fillStyle = metal; g.fill();
    g.lineWidth = Math.max(1.5, R * 0.008); g.strokeStyle = "#4A5058"; g.beginPath(); g.arc(c, c, R - g.lineWidth / 2, 0, TAU); g.stroke();
    const bev = g.createRadialGradient(c, c, r, c, c, r + rim * 0.5);
    bev.addColorStop(0, "rgba(40,44,50,.45)"); bev.addColorStop(1, "rgba(40,44,50,0)");
    g.beginPath(); g.arc(c, c, r + rim * 0.5, 0, TAU); g.arc(c, c, r, 0, TAU, true); g.fillStyle = bev; g.fill();

    // segmentos
    prizes.forEach((p, i) => {
      const grd = g.createRadialGradient(c, c, r * 0.1, c, c, r);
      grd.addColorStop(0, "#FFFFFF"); grd.addColorStop(0.82, "#FFFFFF"); grd.addColorStop(1, i % 2 ? "#E6E9ED" : "#EEF0F3");
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, r, rad(i * SEG), rad((i + 1) * SEG)); g.closePath(); g.fillStyle = grd; g.fill();
    });

    // fotos recortadas a su segmento
    prizes.forEach((p, i) => {
      const im = imgs.current[i];
      if (!im || p.wheelLabel) return;                  // los premios con wheelLabel se muestran solo con texto
      g.save();
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, r * 0.97, rad(i * SEG + SEG * 0.04), rad((i + 1) * SEG - SEG * 0.04)); g.closePath(); g.clip();
      g.translate(c, c); g.rotate(rad(i * SEG + SEG / 2) + Math.PI / 2);
      const box = r * 0.54, cy = -r * 0.52;
      const s = Math.max(box / im.naturalWidth, box / im.naturalHeight);
      g.drawImage(im, (-im.naturalWidth * s) / 2, cy - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
      g.restore();
    });

    // divisiones metálicas
    prizes.forEach((p, i) => {
      const a = rad(i * SEG), x1 = c + Math.cos(a) * r * 0.12, y1 = c + Math.sin(a) * r * 0.12, x2 = c + Math.cos(a) * r, y2 = c + Math.sin(a) * r;
      g.lineCap = "round";
      g.strokeStyle = "#B9BEC6"; g.lineWidth = Math.max(1.2, R * 0.006); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    });

    // nombres
    prizes.forEach((p, i) => {
      g.save(); g.translate(c, c); g.rotate(rad(i * SEG + SEG / 2) + Math.PI / 2);
      const fs = Math.max(9, r * 0.06);
      g.font = `800 ${fs}px Montserrat, system-ui, sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#30343A";
      if ("letterSpacing" in g) g.letterSpacing = `${(fs * 0.06).toFixed(1)}px`;
      const lines = p.wheelLabel || wrap(g, p.name.toUpperCase(), 2 * r * 0.84 * Math.sin((SEG / 2) * Math.PI / 180) * 0.82);
      let y = -r * 0.89 + fs * 0.6;
      lines.forEach((ln) => {
        if (p.wheelLabel && /^\$/.test(ln)) {             // el monto ($300) va grande
          const big = fs * 2.3; y += big * 0.35;
          g.font = `900 ${big}px Montserrat, system-ui, sans-serif`; g.fillStyle = "#4A5058";
          if ("letterSpacing" in g) g.letterSpacing = "0px";
          g.fillText(ln, 0, y); y += big;
          return;
        }
        g.fillText(ln, 0, y); y += fs * 1.15;
      });
      if ("letterSpacing" in g) g.letterSpacing = "0px";
      g.restore();
    });

    // filete chrome
    g.lineWidth = Math.max(1.5, R * 0.012); g.strokeStyle = metal; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke();
  }

  function wrap(g, text, maxW) {
    const words = text.split(" "), out = [];
    let line = "";
    words.forEach((w) => {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    });
    if (line) out.push(line);
    return out;
  }

  useEffect(() => {
    let alive = true;
    Promise.all(prizes.map((p) => new Promise((res) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = p.image;
    }))).then((list) => {
      if (!alive) return;
      imgs.current = list;
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fonts.then(() => alive && draw());
      draw();
    });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => draw()) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    return () => { alive = false; ro && ro.disconnect(); cancelAnimationFrame(st.current.raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizes]);

  /* ---------- animación ---------- */
  function apply() {
    const s = st.current;
    if (canvasRef.current) canvasRef.current.style.transform = `rotate(${s.rot}deg)`;
    const seg = segAt(s.rot);
    if (seg !== s.lastSeg) {
      s.lastSeg = seg; sound.tick();
      const p = pointerRef.current;
      if (p) { p.classList.remove("flick"); void p.getBoundingClientRect(); p.classList.add("flick"); }
    }
  }

  function loop(now) {
    const s = st.current;
    const dt = Math.min(0.05, (now - (s.last || now)) / 1000); s.last = now;
    if (s.mode === "free") {
      s.v = Math.min(VMAX, s.v + VMAX * 2.2 * dt);               // acelera rápido
      s.rot += s.v * dt;
    } else if (s.mode === "stopping") {
      const t = Math.min(1, (now - s.stop.t0) / s.stop.dur);
      s.rot = s.stop.from + s.stop.dist * ease(t);
      if (t >= 1) { s.mode = "idle"; apply(); const done = s.stop.done; s.stop = null; done && done(); return; }
    } else return;
    apply();
    s.raf = requestAnimationFrame(loop);
  }

  function decelerateTo(dist) {
    const s = st.current;
    const v0 = Math.max(s.v, 200);
    return new Promise((resolve) => {
      // duración que conserva la velocidad actual al empezar a frenar (sin saltos)
      s.stop = { from: s.rot, dist, dur: Math.max(900, (3 * dist / v0) * 1000), t0: performance.now(), done: resolve };
      s.mode = "stopping";
      cancelAnimationFrame(s.raf); s.last = performance.now(); s.raf = requestAnimationFrame(loop);
    });
  }

  useImperativeHandle(ref, () => ({
    start() {
      const s = st.current;
      if (s.mode !== "idle") return;
      s.mode = "free"; s.v = 0; s.t0 = performance.now(); s.last = s.t0;
      s.lastSeg = segAt(s.rot);
      s.raf = requestAnimationFrame(loop);
    },
    async stopAt(index) {
      const s = st.current;
      // al menos ~0.8 s girando y a toda velocidad antes de frenar
      while (s.mode === "free" && (performance.now() - s.t0 < 800 || s.v < VMAX * 0.98)) await new Promise((r) => setTimeout(r, 30));
      const jitter = (Math.random() - 0.5) * SEG * 0.6;
      const desired = norm(-(index * SEG + SEG / 2 + jitter));   // la flecha (arriba) queda dentro del segmento
      let delta = desired - norm(s.rot);
      if (delta < 0) delta += 360;
      const turns = Math.max(3, Math.round((VMAX * 4.2 / 3 - delta) / 360));
      await decelerateTo(turns * 360 + delta);
      s.rot = norm(s.rot);
      if (canvasRef.current) canvasRef.current.style.transform = `rotate(${s.rot}deg)`;
      return segAt(s.rot);
    },
    async halt() {
      const s = st.current;
      if (s.mode !== "free") return;
      await decelerateTo(Math.max(180, s.v * 0.6));
    },
    segmentUnderPointer: () => segAt(st.current.rot),
  }));

  return (
    <div className={"wheel" + (spinning ? " is-spinning" : "")}>
      <div className="wheel-glow" aria-hidden="true" />
      <div className="wheel-clip"><canvas ref={canvasRef} aria-label="Ruleta de premios" /></div>
      <div className="wheel-gloss" aria-hidden="true" />
      <button type="button" className="hub" onClick={onHub} disabled={hubDisabled} aria-label="Girar la ruleta">
        <span className="hub-face"><span className="hub-text">{hubLabel}</span></span>
      </button>
      <svg ref={pointerRef} className="pointer" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="rgp" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" /><stop offset=".3" stopColor="#D9DCE1" /><stop offset=".55" stopColor="#8E949C" />
            <stop offset=".8" stopColor="#EDEFF2" /><stop offset="1" stopColor="#AEB4BD" />
          </linearGradient>
          <linearGradient id="rgn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5C6168" /><stop offset="1" stopColor="#2A2E34" /></linearGradient>
        </defs>
        <path d="M14 6 H86 Q98 6 92 17 L56 90 Q50 100 44 90 L8 17 Q2 6 14 6 Z" fill="url(#rgp)" stroke="#4A5058" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M24 17 H76 Q82 17 79 23 L53 76 Q50 81 47 76 L21 23 Q18 17 24 17 Z" fill="url(#rgn)" />
      </svg>
    </div>
  );
});

export default Wheel;
