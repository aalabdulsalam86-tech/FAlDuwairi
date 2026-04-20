/* ============================================================
   UNIVERSAL GAME ENGINE — used by every chapter
   Reads: window.GAME_CONFIG = { jsonFile, title, subject }
   Loads questions, randomizes, picks 10, plays, reviews.
   ============================================================ */

// ----- THEMES (10 color schemes) -----
const THEMES = [
  { name: "red",     c: "#f87171", c2: "#b91c1c", bg: "#0a0203", accent: "#fbbf24" },
  { name: "cyan",    c: "#00f5ff", c2: "#0891b2", bg: "#020617", accent: "#c026d3" },
  { name: "emerald", c: "#10b981", c2: "#047857", bg: "#022c22", accent: "#fbbf24" },
  { name: "purple",  c: "#c084fc", c2: "#7e22ce", bg: "#1a0a2e", accent: "#00f5ff" },
  { name: "gold",    c: "#fbbf24", c2: "#b45309", bg: "#1c1917", accent: "#f87171" },
  { name: "rose",    c: "#fb7185", c2: "#be123c", bg: "#1f0812", accent: "#fbbf24" },
  { name: "indigo",  c: "#818cf8", c2: "#4338ca", bg: "#0f0b1f", accent: "#22d3ee" },
  { name: "teal",    c: "#2dd4bf", c2: "#0f766e", bg: "#042f2e", accent: "#fb923c" },
  { name: "orange",  c: "#fb923c", c2: "#c2410c", bg: "#1c0f04", accent: "#22d3ee" },
  { name: "sky",     c: "#38bdf8", c2: "#0369a1", bg: "#020617", accent: "#fbbf24" }
];

// ----- ANIMATION STYLES (4 background effects) -----
const ANIM_STYLES = ["network", "particles", "waves", "stars"];

// ----- state -----
let CURRENT_THEME, CURRENT_ANIM;
let ALL_QUESTIONS = [];          // full pool loaded from JSON
let SESSION_QUESTIONS = [];      // 10 randomized questions for this session
let SESSION_ANSWERS = [];        // tracks each answer for review
let cq = 0, sc = 0, ans = false;
const L = ["أ", "ب", "ج", "د", "هـ", "و"];

// ----- utilities -----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ----- apply theme to CSS variables -----
function applyTheme(t) {
  const r = document.documentElement;
  r.style.setProperty("--c", t.c);
  r.style.setProperty("--c2", t.c2);
  r.style.setProperty("--bg", t.bg);
  r.style.setProperty("--accent", t.accent);
  r.style.setProperty("--brd", `color-mix(in srgb, ${t.c} 18%, transparent)`);
  document.body.style.background = t.bg;
}

// ----- final messages -----
const FN = [
  ["🌟 ممتاز! درجة كاملة!", "أجبت على جميع الأسئلة صحيحة — أداء مشرف!", "⭐⭐⭐⭐⭐"],
  ["🔥 أداء رائع!", "تقريباً مثالي — راجع نقطة أو اثنتين وستكمل الدرجة", "⭐⭐⭐⭐"],
  ["👍 أحسنت!", "نتيجة جيدة — راجع الدروس لتتحسّن أكثر", "⭐⭐⭐"],
  ["💡 حاول مجدداً!", "لا بأس، المراجعة ستساعدك على الفهم", "⭐⭐"]
];

// ============================================================
// QUESTION LOADING
// ============================================================
async function loadQuestions() {
  const cfg = window.GAME_CONFIG;
  if (!cfg || !cfg.jsonFile) {
    document.body.innerHTML = '<div style="color:#f87171;padding:40px;text-align:center;font-family:Tajawal,sans-serif">⚠️ لم يتم تحديد ملف الأسئلة</div>';
    return false;
  }
  try {
    const res = await fetch(cfg.jsonFile);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("لا توجد أسئلة في الملف");
    }
    ALL_QUESTIONS = data.questions;
    return true;
  } catch (e) {
    document.body.innerHTML = `<div style="color:#f87171;padding:40px;text-align:center;font-family:Tajawal,sans-serif;direction:rtl">
      <h2>⚠️ خطأ في تحميل الأسئلة</h2>
      <p style="margin-top:12px;color:#94a3b8">${e.message}</p>
      <p style="margin-top:8px;color:#64748b;font-size:13px">الملف: ${cfg.jsonFile}</p>
    </div>`;
    return false;
  }
}

// ============================================================
// SESSION BUILDING — random 10, shuffled options
// ============================================================
function buildSession() {
  const pool = shuffle(ALL_QUESTIONS);
  const picked = pool.slice(0, Math.min(10, pool.length));
  SESSION_QUESTIONS = picked.map(q => {
    if (q.type === "tf") {
      // True/False — always 2 fixed options but randomize order
      const opts = Math.random() < 0.5
        ? [{ text: "صح ✓", isCorrect: q.ans === true }, { text: "خطأ ✗", isCorrect: q.ans === false }]
        : [{ text: "خطأ ✗", isCorrect: q.ans === false }, { text: "صح ✓", isCorrect: q.ans === true }];
      return {
        type: "tf",
        q: q.q,
        opts: opts.map(o => o.text),
        ans: opts.findIndex(o => o.isCorrect),
        exp: q.exp || ""
      };
    } else {
      // Multiple choice — shuffle options, track correct index
      const correctText = q.opts[q.ans];
      const shuffled = shuffle(q.opts);
      return {
        type: "mcq",
        q: q.q,
        opts: shuffled,
        ans: shuffled.indexOf(correctText),
        exp: q.exp || ""
      };
    }
  });
  SESSION_ANSWERS = [];
  cq = 0;
  sc = 0;
}

// ============================================================
// UI RENDERING
// ============================================================
function bsb() {
  const sb = document.getElementById("sbar");
  if (!sb) return;
  sb.innerHTML = "";
  for (let i = 0; i < SESSION_QUESTIONS.length; i++) {
    const d = document.createElement("div");
    d.className = "sd" + (i < cq ? " on" : "");
    sb.appendChild(d);
  }
}

function lq() {
  ans = false;
  document.getElementById("nb").classList.remove("show");
  const ex = document.getElementById("ex");
  ex.classList.remove("show");
  ex.style.display = "none";
  const q = SESSION_QUESTIONS[cq];
  document.getElementById("pf").style.width = ((cq / SESSION_QUESTIONS.length) * 100) + "%";
  document.getElementById("pl").textContent = "السؤال " + (cq + 1) + " من " + SESSION_QUESTIONS.length;
  document.getElementById("qn").textContent = "QUESTION " + String(cq + 1).padStart(2, "0");
  const qc = document.getElementById("qc");
  qc.classList.remove("si"); void qc.offsetWidth; qc.classList.add("si");
  document.getElementById("qt").textContent = q.q;
  const og = document.getElementById("og");
  og.innerHTML = "";
  og.className = "opts" + (q.type === "tf" ? " tf" : "");
  q.opts.forEach((o, i) => {
    const b = document.createElement("button");
    b.className = "opt";
    b.innerHTML = q.type === "tf"
      ? `<span>${o}</span>`
      : `<span class="ltr">${L[i]}</span><span>${o}</span>`;
    b.addEventListener("click", () => pick(i, b));
    og.appendChild(b);
  });
  bsb();
}

function pick(idx, btn) {
  if (ans) return;
  ans = true;
  const q = SESSION_QUESTIONS[cq];
  const isCorrect = (idx === q.ans);
  const bs = document.querySelectorAll(".opt");
  bs.forEach(b => b.disabled = true);
  const fb = document.getElementById("fb");
  fb.classList.remove("sc", "wr");

  // record for review
  SESSION_ANSWERS.push({
    q: q.q,
    chosen: q.opts[idx],
    correct: q.opts[q.ans],
    isCorrect,
    exp: q.exp
  });

  if (isCorrect) {
    btn.classList.add("correct");
    sc += 10;
    const sv = document.getElementById("sv");
    sv.textContent = sc;
    sv.classList.remove("pop"); void sv.offsetWidth; sv.classList.add("pop");
    setTimeout(() => sv.classList.remove("pop"), 400);
    fb.textContent = randomOf(["✅", "🎯", "⭐", "🔥", "💥"]);
    fb.classList.add("sc");
    for (let i = 0; i < 3; i++) setTimeout(() => lc(innerWidth * (0.2 + Math.random() * 0.6), innerHeight * .4), i * 80);
  } else {
    btn.classList.add("wrong");
    bs[q.ans].classList.add("correct");
    fb.textContent = randomOf(["❌", "😬", "💭", "🙈"]);
    fb.classList.add("wr");
  }

  // Explanation shown for EVERY answer (correct or wrong)
  if (q.exp) {
    const ex = document.getElementById("ex");
    ex.textContent = "💡 " + q.exp;
    ex.style.display = "block";
    setTimeout(() => ex.classList.add("show"), 50);
  }
  setTimeout(() => document.getElementById("nb").classList.add("show"), 400);
  bsb();
}

function nxt() {
  cq++;
  if (cq < SESSION_QUESTIONS.length) lq();
  else sf();
}

function sf() {
  document.getElementById("qs").style.display = "none";
  const fs = document.getElementById("fs");
  fs.classList.add("vis");
  document.getElementById("fsn").textContent = sc;
  const total = SESSION_QUESTIONS.length * 10;
  const p = sc / total;
  const f = p === 1 ? FN[0] : p >= .75 ? FN[1] : p >= .5 ? FN[2] : FN[3];
  document.getElementById("ftl").textContent = f[0];
  document.getElementById("fmg").textContent = f[1];
  document.getElementById("fst").textContent = f[2];

  // Build the review list
  const rv = document.getElementById("review");
  rv.innerHTML = "<h3 class='rvh'>📝 مراجعة الإجابات</h3>";
  SESSION_ANSWERS.forEach((a, i) => {
    const item = document.createElement("div");
    item.className = "rv-item " + (a.isCorrect ? "ok" : "bad");
    item.innerHTML = `
      <div class="rv-head">
        <span class="rv-num">${i + 1}</span>
        <span class="rv-mark">${a.isCorrect ? "✅" : "❌"}</span>
        <span class="rv-q">${a.q}</span>
      </div>
      <div class="rv-body">
        ${a.isCorrect
          ? `<div class="rv-line"><strong>إجابتك:</strong> ${a.chosen}</div>`
          : `<div class="rv-line wrong-line"><strong>إجابتك:</strong> ${a.chosen}</div>
             <div class="rv-line right-line"><strong>الصواب:</strong> ${a.correct}</div>`
        }
        ${a.exp ? `<div class="rv-exp">💡 ${a.exp}</div>` : ""}
      </div>`;
    rv.appendChild(item);
  });

  setTimeout(() => {
    for (let i = 0; i < 8; i++) setTimeout(() => lc(innerWidth * Math.random(), -20, 20), i * 100);
  }, 250);
}

function rst() {
  // New session: new random theme, new animation, new random questions
  CURRENT_THEME = randomOf(THEMES);
  CURRENT_ANIM = randomOf(ANIM_STYLES);
  applyTheme(CURRENT_THEME);
  startAnimation(CURRENT_ANIM);
  buildSession();
  document.getElementById("sv").textContent = "0";
  document.getElementById("fs").classList.remove("vis");
  document.getElementById("qs").style.display = "flex";
  cf = [];
  lq();
}

// ============================================================
// CONFETTI (used on correct answers + final screen)
// ============================================================
const cc = document.getElementById("cfc"), cx = cc.getContext("2d");
cc.width = innerWidth; cc.height = innerHeight;
let cf = [];
function lc(x, y, n = 15) {
  const cl = [CURRENT_THEME.c, "#fff", CURRENT_THEME.accent, CURRENT_THEME.c2, "#22c55e"];
  for (let i = 0; i < n; i++) cf.push({
    x, y, vx: (Math.random() - .5) * 11, vy: (Math.random() - 1) * 9,
    r: Math.random() * 4 + 2, c: cl[Math.floor(Math.random() * cl.length)],
    l: 1, s: Math.random() * 4 - 2, a: Math.random() * 360
  });
}
function dcf() {
  cx.clearRect(0, 0, cc.width, cc.height);
  cf = cf.filter(p => p.l > 0);
  cf.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += .35; p.l -= .022; p.a += p.s;
    cx.save(); cx.globalAlpha = p.l;
    cx.translate(p.x, p.y); cx.rotate(p.a * Math.PI / 180);
    cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 2);
    cx.restore();
  });
  requestAnimationFrame(dcf);
}
dcf();

// ============================================================
// BACKGROUND ANIMATIONS — 4 styles, chosen randomly
// ============================================================
const bc = document.getElementById("bgc"), bx = bc.getContext("2d");
let bgItems = [];
let currentAnimLoop = null;

function resizeBg() { bc.width = innerWidth; bc.height = innerHeight; }

function startAnimation(style) {
  resizeBg();
  currentAnimLoop = style;
  if (style === "network") initNetwork();
  else if (style === "particles") initParticles();
  else if (style === "waves") initWaves();
  else if (style === "stars") initStars();
  if (!window._bgRunning) {
    window._bgRunning = true;
    requestAnimationFrame(drawBg);
  }
}

function initNetwork() {
  bgItems = Array.from({ length: 38 }, () => ({
    x: Math.random() * bc.width, y: Math.random() * bc.height,
    vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
    r: Math.random() * 2 + 1
  }));
}
function initParticles() {
  bgItems = Array.from({ length: 70 }, () => ({
    x: Math.random() * bc.width, y: Math.random() * bc.height,
    vy: -Math.random() * .5 - .2, r: Math.random() * 2 + .5,
    opacity: Math.random() * .5 + .2
  }));
}
function initWaves() {
  bgItems = Array.from({ length: 5 }, (_, i) => ({
    amp: 25 + i * 15, freq: 0.005 + i * 0.002,
    phase: Math.random() * Math.PI * 2, speed: 0.015 + i * 0.005,
    y: bc.height * (0.4 + i * 0.12), opacity: 0.08 - i * 0.012
  }));
}
function initStars() {
  bgItems = Array.from({ length: 110 }, () => ({
    x: Math.random() * bc.width, y: Math.random() * bc.height,
    r: Math.random() * 1.5 + .3, twinkle: Math.random() * Math.PI * 2,
    speed: Math.random() * .04 + .01
  }));
}

function drawBg() {
  bx.clearRect(0, 0, bc.width, bc.height);
  const color = CURRENT_THEME ? CURRENT_THEME.c : "#fff";
  const rgb = hexToRgb(color);

  if (currentAnimLoop === "network") {
    bgItems.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > bc.width) n.vx *= -1;
      if (n.y < 0 || n.y > bc.height) n.vy *= -1;
    });
    for (let i = 0; i < bgItems.length; i++) {
      for (let j = i + 1; j < bgItems.length; j++) {
        const dx = bgItems[i].x - bgItems[j].x, dy = bgItems[i].y - bgItems[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 130) {
          bx.beginPath();
          bx.moveTo(bgItems[i].x, bgItems[i].y);
          bx.lineTo(bgItems[j].x, bgItems[j].y);
          bx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${(1 - d / 130) * .08})`;
          bx.lineWidth = .5; bx.stroke();
        }
      }
    }
    bgItems.forEach(n => {
      bx.beginPath();
      bx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      bx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},.15)`;
      bx.fill();
    });
  } else if (currentAnimLoop === "particles") {
    bgItems.forEach(p => {
      p.y += p.vy;
      if (p.y < -5) { p.y = bc.height + 5; p.x = Math.random() * bc.width; }
      bx.beginPath();
      bx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${p.opacity})`;
      bx.fill();
    });
  } else if (currentAnimLoop === "waves") {
    bgItems.forEach(w => {
      w.phase += w.speed;
      bx.beginPath();
      bx.moveTo(0, w.y);
      for (let x = 0; x <= bc.width; x += 8) {
        const y = w.y + Math.sin(x * w.freq + w.phase) * w.amp;
        bx.lineTo(x, y);
      }
      bx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${w.opacity})`;
      bx.lineWidth = 1.5;
      bx.stroke();
    });
  } else if (currentAnimLoop === "stars") {
    bgItems.forEach(s => {
      s.twinkle += s.speed;
      const alpha = (Math.sin(s.twinkle) + 1) * .25 + .1;
      bx.beginPath();
      bx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      bx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
      bx.fill();
    });
  }
  requestAnimationFrame(drawBg);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

window.addEventListener("resize", () => {
  resizeBg();
  cc.width = innerWidth; cc.height = innerHeight;
  if (currentAnimLoop) startAnimation(currentAnimLoop);
});

// ============================================================
// BOOT
// ============================================================
(async function boot() {
  CURRENT_THEME = randomOf(THEMES);
  CURRENT_ANIM = randomOf(ANIM_STYLES);
  applyTheme(CURRENT_THEME);
  startAnimation(CURRENT_ANIM);

  // Set chapter title/logo if config provided
  if (window.GAME_CONFIG && window.GAME_CONFIG.title) {
    const logo = document.querySelector(".logo");
    if (logo) logo.textContent = window.GAME_CONFIG.title;
    document.title = window.GAME_CONFIG.title;
  }

  const loaded = await loadQuestions();
  if (!loaded) return;
  buildSession();
  lq();
})();
