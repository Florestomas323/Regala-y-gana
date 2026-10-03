/* Confeti + estrellas + destellos en un canvas fijo. Termina solo. */
const COLORS = ["#FFFFFF", "#F2F3F5", "#D9DCE1", "#C4C9D0", "#9AA1AA", "#FFFFFF", "#2A2E34", "#E8C9A0", "#D9A890"];
let canvas = null, cx = null, parts = [], raf = 0, t0 = 0;
const rand = (a, b) => a + Math.random() * (b - a);

function star(x, y, ro, ri, n) {
  cx.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const r = k % 2 ? ri : ro, a = (k * Math.PI) / n - Math.PI / 2;
    k ? cx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : cx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  cx.closePath();
}

export function launchConfetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
    document.body.appendChild(canvas);
    cx = canvas.getContext("2d");
  }
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  parts = []; t0 = performance.now();
  const kinds = ["rect", "rect", "circle", "star", "ribbon", "rect"];
  const add = (x, y, vx, vy, k) => parts.push({ x, y, vx, vy, k: kinds[k % kinds.length], c: COLORS[k % COLORS.length],
    w: rand(5, 10), h: rand(8, 15), r: rand(5, 9), len: rand(22, 40), rot: rand(0, 6.3), vr: rand(-0.2, 0.2), ph: rand(0, 6), life: 0 });
  for (let k = 0; k < 140; k++) { const L = k % 2 === 0; add(L ? -10 : W + 10, H * rand(0.5, 0.9), (L ? 1 : -1) * rand(4, 12), -rand(10, 18), k); }
  for (let k = 0; k < 90; k++) add(rand(0, W), -rand(10, H * 0.8), rand(-1.4, 1.4), rand(1, 3), k + 2);
  for (let k = 0; k < 26; k++) parts.push({ k: "spark", x: rand(0, W), y: rand(0, H * 0.75), r: rand(6, 13), life: 0, delay: rand(0, 110) | 0, dur: rand(40, 80) | 0 });
  cancelAnimationFrame(raf);
  const step = () => {
    cx.clearRect(0, 0, W, H);
    const old = performance.now() - t0 > 6500;
    let alive = 0;
    for (const p of parts) {
      p.life++;
      if (p.k === "spark") {
        if (p.life < p.delay) { alive++; continue; }
        const u = (p.life - p.delay) / p.dur; if (u > 1 || old) continue;
        alive++; const a = Math.sin(u * Math.PI);
        cx.save(); cx.translate(p.x, p.y); cx.rotate(u); cx.globalAlpha = a; cx.fillStyle = "#fff";
        cx.shadowColor = "rgba(255,255,255,.9)"; cx.shadowBlur = 12; star(0, 0, p.r * (0.6 + a * 0.6), p.r * 0.18, 4); cx.fill(); cx.restore();
        continue;
      }
      p.vy += p.k === "ribbon" ? 0.2 : 0.3; p.vx *= 0.985; p.vy *= 0.985; if (p.vy > 4.5) p.vy = 4.5;
      p.x += p.vx + Math.sin(p.life * 0.05 + p.ph) * 0.6; p.y += p.vy; p.rot += p.vr;
      if (p.y > H + 40 || old) continue;
      alive++;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = cx.strokeStyle = p.c;
      if (p.k === "ribbon") {
        cx.lineWidth = 3; cx.lineCap = "round"; cx.beginPath();
        for (let s = 0; s <= 10; s++) { const u = s / 10, X = (u - 0.5) * p.len, Y = Math.sin(u * 6.28 + p.life * 0.15 + p.ph) * 5; s ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }
        cx.stroke();
      } else if (p.k === "circle") { cx.beginPath(); cx.arc(0, 0, p.w * 0.45, 0, 6.29); cx.fill(); }
      else if (p.k === "star") { star(0, 0, p.r, p.r * 0.45, 5); cx.fill(); }
      else { const hh = p.h * Math.abs(Math.cos(p.life * 0.12 + p.ph)); cx.fillRect(-p.w / 2, -hh / 2, p.w, hh); }
      cx.restore();
    }
    if (alive) raf = requestAnimationFrame(step); else { cx.clearRect(0, 0, W, H); parts = []; }
  };
  step();
}

export function stopConfetti() {
  cancelAnimationFrame(raf); parts = [];
  if (cx && canvas) cx.clearRect(0, 0, canvas.width, canvas.height);
}
