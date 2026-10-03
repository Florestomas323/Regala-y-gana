/* Sonido con Web Audio (sin archivos). Se activa con el primer toque. */
let ctx = null, out = null, noise = null;

function makeNoise(c) {
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export const sound = {
  unlock() {
    try {
      if (!ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return;
        ctx = new A();
        noise = makeNoise(ctx);
      }
      if (ctx.state === "suspended") ctx.resume();
    } catch { ctx = null; }
  },
  tick() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(2000, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.05);
  },
  celebrate() {
    if (!ctx) return;
    this.stop();
    out = ctx.createGain(); out.connect(ctx.destination);
    const t = ctx.currentTime;
    // campana
    [[1046.5, 0], [1318.5, 0.13], [1568, 0.26], [2093, 0.39]].forEach(([f, dt]) => {
      [1, 2.01].forEach((h, k) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f * h;
        g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.12 / (k + 1), t + dt + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.0);
        o.connect(g).connect(out); o.start(t + dt); o.stop(t + dt + 1.05);
      });
    });
    // aplausos suaves
    for (let i = 0; i < 70; i++) {
      const when = t + 0.5 + Math.pow(i / 70, 1.2) * 2.6 + Math.random() * 0.03;
      const s = ctx.createBufferSource(); s.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1300 + Math.random() * 1500; bp.Q.value = 1.2;
      const g = ctx.createGain(); const a = (0.08 + Math.random() * 0.07) * (1 - i / 110);
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(a, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07 + Math.random() * 0.05);
      s.connect(bp).connect(g).connect(out); s.start(when, Math.random() * 1.5); s.stop(when + 0.14);
    }
  },
  stop() {
    if (ctx && out) {
      const g = out, t = ctx.currentTime;
      try { g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); } catch {}
      setTimeout(() => { try { g.disconnect(); } catch {} }, 200);
      out = null;
    }
  },
};
