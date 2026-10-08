/* ===========================================================
   EDIT THESE SETTINGS
   =========================================================== */
const CONFIG = {
  // Your sister's name (leave "" to hide it)
  name: "Sudikshya",

  // Photos (inside the /photos folder). "focus" = which part of the photo
  // stays visible when it is cropped:  "x% y%"
  photos: [
    { src: "photos/photo1.jpg", focus: "30% 40%" }, // landscape photo
    { src: "photos/photo2.jpg", focus: "50% 35%" },
    { src: "photos/photo3.jpg", focus: "50% 35%" },
    { src: "photos/photo4.jpg", focus: "50% 35%" },
    { src: "photos/photo5.jpg", focus: "50% 35%" },
  ],

  // Short wishes, one per photo
  messages: [
    "Happy Birthday to my wonderful sister! 🎉 Congratulations on another beautiful year. 💖",
    "You light up every room you walk into. Wishing you endless smiles today and always! ✨",
    "May every dream you chase come true this year. I'm so proud of you! 🌟",
    "Thank you for being the best sister ever. Love you always! 🥰",
    "Here's to cake, laughter and happy memories. Have the best birthday! 🎂🎈",
  ],

  slideSeconds: 6,
  tempo: 0.62,     // seconds per beat for the music (bigger = slower)
  autoplayMusic: true,
};

/* ===========================================================
   HELPERS
   =========================================================== */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PAL = window.PALETTES || {};
const DEFAULT_PAL = ["#e0568f", "#8b5cf6", "#38bdf8", "#2a1148", "#1c1f4d"];

function hslToHex(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hexToHsl(hex) {
  return rgbToHsl(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
}
const tint = (hex, l) => { const [h, s] = hexToHsl(hex); return hslToHex(h, clamp(s, 0.5, 0.9), l); };
const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };

/* ---------- Colour palette for photos without a saved palette ---------- */
function buildPalette(cols) {
  const picks = [];
  for (const c of cols) {
    if (picks.every((p) => hueDist(p.h, c.h) > 0.07)) picks.push(c);
    if (picks.length === 3) break;
  }
  if (!picks.length) return null;
  const h0 = picks[0].h;
  while (picks.length < 3) picks.push({ h: h0 + (picks.length === 1 ? 0.12 : -0.12), s: 0.6, l: 0.45 });
  const fix = (c) => hslToHex(c.h, clamp(c.s * 1.2, 0.5, 0.85), clamp(c.l, 0.34, 0.52));
  return [fix(picks[0]), fix(picks[1]), fix(picks[2]), hslToHex(picks[0].h, 0.5, 0.15), hslToHex(picks[1].h, 0.5, 0.2)];
}
function extractPalette(src) {
  // Works when the page is hosted online. Opened straight from a folder, some
  // browsers block this - then the default colours are used instead.
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const w = 40, h = Math.max(1, Math.round((40 * im.naturalHeight) / im.naturalWidth));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const x = c.getContext("2d");
        x.drawImage(im, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data;
        const bins = {};
        for (let i = 0; i < d.length; i += 4) {
          const k = (d[i] >> 5) + "," + (d[i + 1] >> 5) + "," + (d[i + 2] >> 5);
          const b = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
          b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
        }
        const cols = Object.values(bins)
          .map((b) => { const [h2, s, l] = rgbToHsl(b.r / b.n, b.g / b.n, b.b / b.n); return { n: b.n, h: h2, s, l }; })
          .filter((c2) => c2.s > 0.12 && c2.l > 0.08 && c2.l < 0.93)
          .sort((a, b) => b.n * (0.4 + b.s) - a.n * (0.4 + a.s));
        resolve(buildPalette(cols));
      } catch (e) { resolve(null); }
    };
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

/* ===========================================================
   BACKGROUND, BALLOONS, SPARKLES
   =========================================================== */
const bgs = [$("bgA"), $("bgB")];
let bgCur = 0;
let confettiColors = ["#ff4d6d", "#ffd23f", "#4cc9f0", "#80ed99", "#c77dff", "#ffffff"];
const balloons = [];

function applyPalette(p) {
  const next = bgs[1 - bgCur];
  next.style.background =
    `radial-gradient(circle at 18% 12%, ${p[0]} 0%, transparent 62%),` +
    `radial-gradient(circle at 88% 80%, ${p[1]} 0%, transparent 58%),` +
    `radial-gradient(circle at 70% 30%, ${p[2]}88 0%, transparent 55%),` +
    `linear-gradient(165deg, ${p[3]}, ${p[4]})`;
  next.classList.add("on");
  bgs[bgCur].classList.remove("on");
  bgCur = 1 - bgCur;

  document.documentElement.style.setProperty("--accent", p[0]);

  const bc = [p[0], p[1], p[2], tint(p[0], 0.7), tint(p[1], 0.7), "#ffffff"];
  balloons.forEach((b, i) => {
    const c = bc[i % bc.length];
    b.style.background = c;
    b.style.borderBottomColor = c;
  });
  confettiColors = [tint(p[0], 0.62), tint(p[1], 0.62), tint(p[2], 0.62), "#ffffff", "#ffe66d"];
}

(function makeDecor() {
  const wrap = $("balloons");
  for (let i = 0; i < 9; i++) {
    const b = document.createElement("div");
    b.className = "balloon";
    const sc = 0.75 + Math.random() * 0.6;
    b.style.width = 34 * sc + "px";
    b.style.height = 43 * sc + "px";
    b.style.left = Math.random() * 94 + "%";
    b.style.animationDuration = 11 + Math.random() * 10 + "s";
    b.style.animationDelay = -Math.random() * 16 + "s";
    wrap.appendChild(b);
    balloons.push(b);
  }
  const sp = $("sparkles");
  const icons = ["✨", "⭐", "💫", "🌟"];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = icons[i % icons.length];
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.animationDuration = 2.5 + Math.random() * 3 + "s";
    s.style.animationDelay = Math.random() * 4 + "s";
    sp.appendChild(s);
  }
})();

/* ===========================================================
   CONFETTI (capped so it never slows the phone down)
   =========================================================== */
const canvas = $("confetti");
const ctx = canvas.getContext("2d");
const MAX_PIECES = 320;
let W = 0, H = 0, pieces = [];
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

const pick = () => confettiColors[(Math.random() * confettiColors.length) | 0];
function burst(x = W / 2, y = H / 3, count = 90) {
  count = Math.min(count, MAX_PIECES - pieces.length);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 3 + Math.random() * 8;
    pieces.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4,
      w: 5 + Math.random() * 5, h: 3 + Math.random() * 5,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: pick(), life: 0, max: 130 + Math.random() * 80,
    });
  }
}
function rain(count = 40) {
  count = Math.min(count, MAX_PIECES - pieces.length);
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.4,
      vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
      w: 5 + Math.random() * 5, h: 3 + Math.random() * 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: pick(), life: 0, max: 300,
    });
  }
}
(function tick() {
  if (pieces.length) {
    ctx.clearRect(0, 0, W, H);
    pieces = pieces.filter((p) => p.life < p.max && p.y < H + 40);
    for (const p of pieces) {
      p.life++;
      p.vy += 0.17; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (!pieces.length) ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(tick);
})();

/* ===========================================================
   SOUND - light music-box "Happy Birthday"
   Notes are scheduled just a little ahead of time (not all at once),
   so only a handful of audio nodes exist at any moment = no lag.
   =========================================================== */
const BEAT = CONFIG.tempo;
const LOOP_BEATS = 30;      // 28 beats of music + 2 beats rest
const LOOKAHEAD = 0.9;      // seconds scheduled in advance

// [beat, midi note, length in beats]
const MELODY = [
  [0, 67, .75], [.75, 67, .25], [1, 69, 1], [2, 67, 1], [3, 72, 1], [4, 71, 3],
  [7, 67, .75], [7.75, 67, .25], [8, 69, 1], [9, 67, 1], [10, 74, 1], [11, 72, 3],
  [14, 67, .75], [14.75, 67, .25], [15, 79, 1], [16, 76, 1], [17, 72, 1], [18, 71, 1], [19, 69, 2],
  [21, 77, .75], [21.75, 77, .25], [22, 76, 1], [23, 72, 1], [24, 74, 1], [25, 72, 3],
];
const CH = {
  C: { pad: [52, 55], bass: 36 },
  G: { pad: [47, 50], bass: 31 },
  F: { pad: [45, 48], bass: 29 },
};
const CHORDS = [
  [1, "C"], [4, "G"], [8, "G"], [11, "C"],
  [15, "C"], [18, "G"], [22, "F"], [25, "C"],
];
// one time-sorted list of everything that happens in a loop
const EVENTS = [
  ...MELODY.map(([b, m, d]) => ({ b, type: "n", m, d })),
  ...CHORDS.map(([b, n]) => ({ b, type: "c", n })),
].sort((x, y) => x.b - y.b);

const Snd = {
  ctx: null, fx: null, bus: null, on: false, iv: null,
  loopStart: 0, ei: 0, lastPop: 0, noise: null,

  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
  running() { return !!this.ctx && this.ctx.state === "running"; },

  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    let c;
    try { c = new AC({ latencyHint: "playback" }); } catch (e) { c = new AC(); }
    this.ctx = c;
    c.onstatechange = () => setMusicIcon();

    const master = c.createGain();
    master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 4;
    master.connect(comp); comp.connect(c.destination);

    // small, light reverb (mono, 1.3s)
    const len = Math.floor(c.sampleRate * 1.3);
    const ir = c.createBuffer(1, len, c.sampleRate);
    const d = ir.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    const conv = c.createConvolver(); conv.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.3;
    conv.connect(wet); wet.connect(master);

    const fx = c.createGain();
    fx.connect(master); fx.connect(conv);
    this.fx = fx;

    // reusable noise for the confetti pop
    const n = Math.floor(c.sampleRate * 0.1);
    this.noise = c.createBuffer(1, n, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    return true;
  },

  // music-box note: just 2 sine oscillators
  bell(dest, t, midi, ring, vel) {
    const c = this.ctx, f = this.hz(midi);
    [[1, 1, 1], [2, 0.3, 0.5]].forEach(([r, a, df]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel * a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ring * df);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + ring * df + 0.05);
    });
  },

  // soft chord + bass (3 oscillators)
  chord(dest, t, name) {
    const c = this.ctx, len = 3 * BEAT, def = CH[name];
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.3);
    g.gain.setValueAtTime(0.06, t + len - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4);
    lp.connect(g); g.connect(dest);
    def.pad.forEach((m) => {
      const o = c.createOscillator();
      o.type = "triangle"; o.frequency.value = this.hz(m);
      o.connect(lp); o.start(t); o.stop(t + len + 0.45);
    });
    const o = c.createOscillator(), bg = c.createGain();
    o.frequency.value = this.hz(def.bass);
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.1, t + 0.03);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.85);
    o.connect(bg); bg.connect(dest);
    o.start(t); o.stop(t + len);
  },

  schedule(e, t) {
    if (e.type === "n") this.bell(this.bus, t, e.m, Math.max(1.0, e.d * BEAT * 2), 0.2);
    else this.chord(this.bus, t, e.n);
  },

  tick() {
    if (!this.on || !this.running()) return;
    const now = this.ctx.currentTime;
    for (let guard = 0; guard < 40; guard++) {
      const e = EVENTS[this.ei];
      const t = this.loopStart + e.b * BEAT;
      if (t > now + LOOKAHEAD) break;
      if (t > now - 0.05) this.schedule(e, t); // skip anything already late
      this.ei++;
      if (this.ei >= EVENTS.length) { this.ei = 0; this.loopStart += LOOP_BEATS * BEAT; }
    }
  },

  startLoop() {
    clearInterval(this.iv);
    this.iv = setInterval(() => this.tick(), 100);
  },

  start() {
    if (this.on) { this.resume(); return; }
    if (!this.init()) return;
    this.on = true;
    // fresh bus each time so old notes never leak back in
    this.bus = this.ctx.createGain();
    this.bus.connect(this.fx);
    this.ei = 0;
    this.loopStart = this.ctx.currentTime + 0.25;
    this.startLoop();
    this.resume();
    setMusicIcon();
  },

  resume() {
    if (this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {});
  },

  stop() {
    this.on = false;
    clearInterval(this.iv);
    if (this.bus) {
      const b = this.bus, now = this.ctx.currentTime;
      b.gain.cancelScheduledValues(now);
      b.gain.setTargetAtTime(0, now, 0.06);
      setTimeout(() => { try { b.disconnect(); } catch (e) {} }, 1500);
      this.bus = null;
    }
    setMusicIcon();
  },

  pop() {
    if (!this.on || !this.running()) return;
    const now = performance.now();
    if (now - this.lastPop < 160) return;
    this.lastPop = now;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1500 + Math.random() * 900; bp.Q.value = 0.9;
    const g = c.createGain(); g.gain.value = 0.18;
    s.connect(bp); bp.connect(g); g.connect(this.fx);
    s.start();
  },

  chime() {
    if (!this.on || !this.running()) return;
    const t = this.ctx.currentTime;
    [84, 88, 91].forEach((m, i) => this.bell(this.fx, t + i * 0.08, m, 1.2, 0.07));
  },
};

function setMusicIcon() {
  $("musicBtn").textContent = Snd.on && Snd.running() ? "🔊" : "🔇";
}

/* ---- Autoplay: start as soon as the browser allows it ----
   Browsers block sound until the first touch/click/key, so the music
   starts immediately on load if allowed, otherwise on the very first tap. */
function unlockAudio(e) {
  if (e && e.target && e.target.closest && e.target.closest("#musicBtn")) return;
  if (CONFIG.autoplayMusic && !Snd.userMuted) Snd.start();
  Snd.resume();
  if (Snd.running()) ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => removeEventListener(ev, unlockAudio, true));
}
["pointerdown", "touchend", "click", "keydown"].forEach((ev) => addEventListener(ev, unlockAudio, true));
if (CONFIG.autoplayMusic) { try { Snd.start(); } catch (e) {} }

document.addEventListener("visibilitychange", () => {
  if (!Snd.ctx) return;
  if (document.hidden) { clearInterval(Snd.iv); Snd.ctx.suspend(); }
  else if (Snd.on) { Snd.ctx.resume().then(() => Snd.startLoop()).catch(() => {}); }
});

/* ===========================================================
   SLIDESHOW
   =========================================================== */
let idx = 0, slideTimer = null, typeToken = 0;
const photoEl = $("photo"), msg = $("message"), dots = $("dots");
const cache = {};
CONFIG.photos.forEach(() => dots.appendChild(document.createElement("span")));

$("nameIntro").textContent = CONFIG.name ? ", " + CONFIG.name : "";
$("nameShow").textContent = CONFIG.name ? ", " + CONFIG.name : "";

function typeText(text) {
  const my = ++typeToken;
  msg.textContent = "";
  let i = 0;
  (function step() {
    if (typeToken !== my) return;
    msg.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(step, 22);
  })();
}

function paletteFor(src) {
  const p = PAL[src] || cache[src];
  if (p) return p;
  extractPalette(src).then((r) => {
    if (!r) return;
    cache[src] = r;
    if (CONFIG.photos[idx].src === src) applyPalette(r);
  });
  return DEFAULT_PAL;
}

function show(i, quiet) {
  idx = (i + CONFIG.photos.length) % CONFIG.photos.length;
  const item = CONFIG.photos[idx];
  photoEl.classList.remove("swap");
  void photoEl.offsetWidth;
  photoEl.src = item.src;
  photoEl.style.objectPosition = item.focus || "50% 35%";
  photoEl.classList.add("swap");
  [...dots.children].forEach((d, k) => d.classList.toggle("on", k === idx));
  typeText(CONFIG.messages[idx % CONFIG.messages.length]);
  applyPalette(paletteFor(item.src));
  if (!quiet) {
    burst(innerWidth / 2, innerHeight / 2.6, 50);
    Snd.chime();
  }
}
function restartTimer() {
  clearInterval(slideTimer);
  slideTimer = setInterval(() => show(idx + 1), CONFIG.slideSeconds * 1000);
}

/* ===========================================================
   WIRING
   =========================================================== */
applyPalette(paletteFor(CONFIG.photos[0].src)); // intro already uses photo colours

$("startBtn").addEventListener("click", () => {
  $("intro").classList.remove("active");
  $("show").classList.add("active");
  if (CONFIG.autoplayMusic && !Snd.userMuted) Snd.start();
  Snd.resume();
  show(0, true);
  burst(innerWidth / 2, innerHeight / 3, 130);
  rain(50);
  Snd.pop();
  restartTimer();
});
$("nextBtn").addEventListener("click", () => { show(idx + 1); restartTimer(); });
$("prevBtn").addEventListener("click", () => { show(idx - 1); restartTimer(); });
$("burstBtn").addEventListener("click", () => { burst(innerWidth / 2, innerHeight / 2, 110); rain(30); Snd.pop(); });
$("musicBtn").addEventListener("click", () => {
  if (Snd.on && !Snd.running()) { Snd.resume(); return; } // first tap just unlocks the sound
  if (Snd.on) { Snd.userMuted = true; Snd.stop(); }
  else { Snd.userMuted = false; Snd.start(); }
  setMusicIcon();
});
addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  burst(e.clientX, e.clientY, 25);
  Snd.pop();
});
addEventListener("keydown", (e) => {
  if (!$("show").classList.contains("active")) return;
  if (e.key === "ArrowRight") { show(idx + 1); restartTimer(); }
  if (e.key === "ArrowLeft") { show(idx - 1); restartTimer(); }
});
setMusicIcon();
