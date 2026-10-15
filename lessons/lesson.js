/* ============================================================
   INTERACTIVE LESSON ENGINE — حصص تفاعلية
   Reads: window.LESSON_CONFIG = { jsonFile, title, color, gameFile }
   Loads the semester's lessons, finds today's lesson, runs it
   as projector-friendly stages (أهداف → تمهيد → شرح → نشاط →
   تحقق → ملخص → واجب). See README.md for the JSON format.
   ============================================================ */

const CFG = window.LESSON_CONFIG || {};
let DATA = { lessons: [] };
let STAGES = [];
let si = 0;                 // current stage index
let curLesson = null;
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

// ---------- helpers ----------
const $ = id => document.getElementById(id);
function ar(n) { return String(n).replace(/\d/g, d => AR_DIGITS[d]); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
// tiny markup: **bold**, `code`, line breaks
function fmt(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
}
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function todayISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" });
}
const LS_KEY = "lesson_today_" + (CFG.jsonFile || "x");

// ---------- today's lesson ----------
function resolveToday() {
  const L = DATA.lessons || [];
  if (!L.length) return null;
  const forced = localStorage.getItem(LS_KEY);
  if (forced && L.find(l => l.id === forced)) return L.find(l => l.id === forced);
  const t = todayISO();
  const byDate = L.find(l => l.date === t);
  if (byDate) return byDate;
  if (DATA.today && L.find(l => l.id === DATA.today)) return L.find(l => l.id === DATA.today);
  const next = L.find(l => l.date && l.date > t);
  return next || null;
}
function lessonStatus(l, today) {
  if (today && l.id === today.id) return "today";
  const t = todayISO();
  if (l.date && l.date < t) return "past";
  return "upcoming";
}

// ---------- LIST SCREEN ----------
function renderList() {
  const today = resolveToday();
  const L = DATA.lessons || [];
  const hero = $("hero");
  if (today) {
    const n = L.indexOf(today) + 1;
    hero.innerHTML = `
      <div class="hero-tag">حصة اليوم</div>
      <div class="hero-meta">${today.date ? esc(fmtDate(today.date)) + " · " : ""}الحصة ${ar(n)} من ${ar(L.length)}${today.unit ? " · " + esc(today.unit) : ""}</div>
      <h1 class="hero-title">${esc(today.title)}</h1>
      <div class="hero-facts">
        ${today.objectives && today.objectives.length ? `<span>🎯 ${ar(today.objectives.length)} أهداف</span>` : ""}
        ${today.pages ? `<span>📕 صفحات ${esc(today.pages)}</span>` : ""}
        ${today.duration ? `<span>⏱ ${ar(today.duration)} دقيقة</span>` : ""}
      </div>
      <button class="start-btn" onclick="openLesson('${esc(today.id)}')">▶ ابدأ الحصة</button>`;
    hero.classList.remove("empty");
  } else {
    hero.innerHTML = `
      <div class="hero-tag">حصة اليوم</div>
      <h1 class="hero-title">${L.length ? "لم تُحدَّد حصة لليوم" : "لم تُضف حصص هذا الفصل بعد"}</h1>
      <p class="hero-sub">${L.length ? "اختر حصة من القائمة واضغط «تعيين كحصة اليوم»، أو أضف تاريخها في ملف الحصص." : "سيظهر المحتوى هنا بعد إضافة الدروس من الكتاب المدرسي وخطة التدريس إلى ملف <code>" + esc(CFG.jsonFile || "") + "</code>."}</p>`;
    hero.classList.add("empty");
  }

  const list = $("list");
  list.innerHTML = "";
  if (!L.length) {
    list.innerHTML = `<div class="empty-list"><span>📂</span><h3>قائمة الحصص فارغة</h3><p>كل حصة تُضاف كعنصر في مصفوفة <code>lessons</code> داخل ملف JSON — انظر <code>_template.json</code> للصيغة.</p></div>`;
  } else {
    L.forEach((l, i) => {
      const st = lessonStatus(l, today);
      const row = document.createElement("div");
      row.className = "row " + st;
      row.innerHTML = `
        <div class="row-n">${ar(i + 1)}</div>
        <div class="row-body">
          ${l.unit ? `<div class="row-unit">${esc(l.unit)}</div>` : ""}
          <div class="row-title">${esc(l.title)}</div>
          <div class="row-meta">${l.date ? esc(fmtDate(l.date)) : "بدون تاريخ"}${l.pages ? " · ص " + esc(l.pages) : ""}</div>
        </div>
        <div class="row-side">
          <span class="pill ${st}">${st === "today" ? "اليوم" : st === "past" ? "سابقة" : "قادمة"}</span>
          ${st !== "today" ? `<button class="pin" title="تعيين كحصة اليوم" onclick="event.stopPropagation();setToday('${esc(l.id)}')">📌 تعيين لليوم</button>` : `<button class="pin" title="إلغاء التعيين" onclick="event.stopPropagation();clearToday()">↺</button>`}
        </div>`;
      row.onclick = () => openLesson(l.id);
      list.appendChild(row);
    });
  }
  const links = [];
  if (DATA.book) links.push(`<a href="${esc(DATA.book)}" target="_blank">📕 الكتاب المدرسي</a>`);
  if (DATA.plan) links.push(`<a href="${esc(DATA.plan)}" target="_blank">🗂 خطة التدريس</a>`);
  if (CFG.gameFile) links.push(`<a href="../games/${esc(CFG.gameFile)}">🎮 لعبة المراجعة</a>`);
  $("list-links").innerHTML = links.join("");
  showScreen("list");
}
function setToday(id) { localStorage.setItem(LS_KEY, id); renderList(); }
function clearToday() { localStorage.removeItem(LS_KEY); renderList(); }

// ---------- STAGE BUILDING ----------
function buildStages(l) {
  const S = [];
  if (l.objectives && l.objectives.length || l.vocab && l.vocab.length) S.push({ group: "🎯 الأهداف", kind: "objectives" });
  if (l.warmup && l.warmup.length) S.push({ group: "🔥 التمهيد", kind: "warmup" });
  (l.content || []).forEach((c, i) => S.push({ group: "📖 الشرح", kind: "content", sec: c, idx: i, total: l.content.length }));
  if (l.activity && l.activity.type) S.push({ group: "🧩 النشاط", kind: "activity" });
  (l.check || []).forEach((q, i) => S.push({ group: "✅ التحقق", kind: "check", q: q, idx: i, total: l.check.length }));
  if (l.summary && l.summary.length) S.push({ group: "📝 الملخص", kind: "summary" });
  if (l.homework) S.push({ group: "🏠 الواجب", kind: "homework" });
  if (!S.length) S.push({ group: "📖 الحصة", kind: "blank" });
  return S;
}

function openLesson(id) {
  curLesson = (DATA.lessons || []).find(l => l.id === id);
  if (!curLesson) return;
  STAGES = buildStages(curLesson);
  si = 0;
  $("ls-title").textContent = curLesson.title;
  $("ls-unit").textContent = curLesson.unit || "";
  setupTimer((curLesson.duration || 45) * 60);
  renderRail();
  renderStage();
  showScreen("lesson");
}

function renderRail() {
  const rail = $("rail");
  rail.innerHTML = "";
  const groups = [];
  STAGES.forEach((s, i) => {
    let g = groups[groups.length - 1];
    if (!g || g.name !== s.group) { g = { name: s.group, idx: [] }; groups.push(g); }
    g.idx.push(i);
  });
  groups.forEach(g => {
    const chip = document.createElement("button");
    const active = g.idx.includes(si);
    const done = g.idx[g.idx.length - 1] < si;
    chip.className = "chip" + (active ? " on" : done ? " done" : "");
    chip.innerHTML = esc(g.name) + (g.idx.length > 1 ? `<span class="dots">${g.idx.map(i => `<i class="${i < si ? "d" : i === si ? "c" : ""}"></i>`).join("")}</span>` : "");
    chip.onclick = () => { si = active ? si : g.idx[0]; renderRail(); renderStage(); };
    rail.appendChild(chip);
  });
  $("counter").textContent = ar(si + 1) + " / " + ar(STAGES.length);
  $("prev").disabled = si === 0;
  $("next").textContent = si === STAGES.length - 1 ? "إنهاء الحصة ✓" : "التالي ←";
}

function renderStage() {
  const s = STAGES[si], l = curLesson, box = $("stage");
  box.className = "stage";
  void box.offsetWidth;
  box.classList.add("in");
  let h = "";
  switch (s.kind) {
    case "objectives":
      h += `<div class="st-head">🎯 بنهاية الحصة سيكون الطالب قادراً على</div>`;
      h += `<ol class="objs">${(l.objectives || []).map(o => `<li>${fmt(o)}</li>`).join("")}</ol>`;
      if (l.vocab && l.vocab.length) h += `<div class="st-sub">🔑 مفردات الحصة</div><div class="vocab">${l.vocab.map(v => `<div class="v"><b>${esc(v.term)}</b><span>${fmt(v.def)}</span></div>`).join("")}</div>`;
      break;
    case "warmup":
      h += `<div class="st-head">🔥 التمهيد — أسئلة للنقاش</div><div class="warm" id="warm">${l.warmup.map((q, i) => `<div class="wq${i === 0 ? " show" : ""}"><span class="wn">${ar(i + 1)}</span>${fmt(q)}</div>`).join("")}</div>`;
      if (l.warmup.length > 1) h += `<button class="ghost" id="warm-more" onclick="revealWarm()">اعرض السؤال التالي</button>`;
      break;
    case "content": {
      const c = s.sec;
      h += `<div class="st-head">📖 الشرح ${s.total > 1 ? ar(s.idx + 1) + "/" + ar(s.total) : ""}</div>`;
      h += `<h2 class="sec-t">${esc(c.title || "")}</h2>`;
      if (c.image) h += `<img class="sec-img" src="${esc(c.image)}" alt="">`;
      if (c.text) h += `<p class="sec-p">${fmt(c.text)}</p>`;
      if (c.points && c.points.length) h += `<ul class="sec-pts">${c.points.map(p => `<li>${fmt(p)}</li>`).join("")}</ul>`;
      if (c.code) h += `<pre class="sec-code" dir="ltr">${esc(c.code)}</pre>`;
      if (c.example) h += `<div class="sec-ex"><b>مثال</b>${fmt(c.example)}</div>`;
      if (c.note) h += `<div class="sec-note">💡 ${fmt(c.note)}</div>`;
      break;
    }
    case "activity":
      h += renderActivity(l.activity);
      break;
    case "check": {
      const q = s.q, tf = q.type === "tf";
      const opts = tf ? ["صح", "خطأ"] : (q.opts || []);
      h += `<div class="st-head">✅ تحقق من الفهم ${ar(s.idx + 1)}/${ar(s.total)}</div>`;
      h += `<div class="qt">${fmt(q.q)}</div>`;
      h += `<div class="opts${tf ? " tf" : ""}">${opts.map((o, i) => `<button class="opt" onclick="pickOpt(this,${i})"><span class="ltr">${tf ? (i === 0 ? "✓" : "✗") : "أبجدهـ"[i]}</span><span>${fmt(o)}</span></button>`).join("")}</div>`;
      h += `<div class="exp" id="exp">${q.exp ? fmt(q.exp) : ""}</div>`;
      box.dataset.ans = tf ? (q.ans === true || q.ans === "true" || q.ans === 0 ? 0 : 1) : q.ans;
      break;
    }
    case "summary":
      h += `<div class="st-head">📝 خلاصة الحصة</div><ul class="sum">${l.summary.map(x => `<li>${fmt(x)}</li>`).join("")}</ul>`;
      break;
    case "homework":
      h += `<div class="st-head">🏠 الواجب المنزلي</div><div class="hw">${fmt(l.homework)}</div>`;
      if (CFG.gameFile) h += `<a class="game-link" href="../games/${esc(CFG.gameFile)}">🎮 راجع بلعبة الفصل</a>`;
      break;
    default:
      h += `<div class="st-head">📖 ${esc(l.title)}</div><p class="sec-p">لم تُضف تفاصيل هذه الحصة بعد.</p>`;
  }
  box.innerHTML = h;
  if (s.kind === "activity") initActivity(l.activity);
}

function revealWarm() {
  const qs = $("warm").querySelectorAll(".wq:not(.show)");
  if (qs.length) qs[0].classList.add("show");
  if (qs.length <= 1) { const b = $("warm-more"); if (b) b.remove(); }
}

function pickOpt(btn, i) {
  const box = $("stage"), ans = Number(box.dataset.ans);
  const opts = box.querySelectorAll(".opt");
  if (opts[0].disabled) return;
  opts.forEach(o => o.disabled = true);
  opts[ans].classList.add("correct");
  if (i !== ans) btn.classList.add("wrong");
  const e = $("exp"); if (e && e.innerHTML.trim()) e.classList.add("show");
}

// ---------- ACTIVITIES ----------
let ACT = {};
function renderActivity(a) {
  if (a.type === "match") {
    const pairs = a.pairs || [];
    ACT = { left: shuffle(pairs.map((p, i) => ({ t: p[0], i }))), right: shuffle(pairs.map((p, i) => ({ t: p[1], i }))), pick: null, done: 0, total: pairs.length };
    return `<div class="st-head">🧩 ${esc(a.title || "نشاط التوصيل")}</div>${a.instructions ? `<p class="act-i">${fmt(a.instructions)}</p>` : ""}
      <div class="match">
        <div class="col">${ACT.left.map(x => `<button class="mc" data-side="l" data-i="${x.i}" onclick="matchPick(this)">${fmt(x.t)}</button>`).join("")}</div>
        <div class="col">${ACT.right.map(x => `<button class="mc" data-side="r" data-i="${x.i}" onclick="matchPick(this)">${fmt(x.t)}</button>`).join("")}</div>
      </div><div class="act-done" id="act-done"></div>`;
  }
  if (a.type === "order") {
    const items = a.items || [];
    ACT = { items, next: 0 };
    return `<div class="st-head">🧩 ${esc(a.title || "رتّب الخطوات")}</div>${a.instructions ? `<p class="act-i">${fmt(a.instructions)}</p>` : "<p class='act-i'>اضغط على العناصر بالترتيب الصحيح</p>"}
      <div class="slots">${items.map((_, i) => `<div class="slot" id="slot${i}"><span>${ar(i + 1)}</span></div>`).join("")}</div>
      <div class="pool" id="pool">${shuffle(items.map((t, i) => ({ t, i }))).map(x => `<button class="chipo" data-i="${x.i}" onclick="orderPick(this)">${fmt(x.t)}</button>`).join("")}</div>
      <div class="act-done" id="act-done"></div><button class="ghost" onclick="renderStage()">↺ إعادة النشاط</button>`;
  }
  if (a.type === "sort") {
    const groups = a.groups || [];
    const all = [];
    groups.forEach((g, gi) => (g.items || []).forEach(t => all.push({ t, gi })));
    ACT = { groups, left: all.length, picked: null };
    return `<div class="st-head">🧩 ${esc(a.title || "صنّف العناصر")}</div><p class="act-i">${a.instructions ? fmt(a.instructions) : "اختر عنصراً ثم اضغط على المجموعة المناسبة"}</p>
      <div class="pool" id="pool">${shuffle(all).map(x => `<button class="chipo" data-g="${x.gi}" onclick="sortPick(this)">${fmt(x.t)}</button>`).join("")}</div>
      <div class="buckets">${groups.map((g, gi) => `<div class="bucket" onclick="sortDrop(${gi})"><div class="b-t">${esc(g.name)}</div><div class="b-items" id="bk${gi}"></div></div>`).join("")}</div>
      <div class="act-done" id="act-done"></div><button class="ghost" onclick="renderStage()">↺ إعادة النشاط</button>`;
  }
  return `<div class="st-head">🧩 النشاط</div><p class="sec-p">نوع النشاط «${esc(a.type)}» غير معروف — الأنواع المدعومة: match, order, sort.</p>`;
}
function initActivity() { }
function matchPick(btn) {
  if (btn.classList.contains("ok")) return;
  if (ACT.pick && ACT.pick === btn) { btn.classList.remove("sel"); ACT.pick = null; return; }
  if (!ACT.pick || ACT.pick.dataset.side === btn.dataset.side) {
    if (ACT.pick) ACT.pick.classList.remove("sel");
    ACT.pick = btn; btn.classList.add("sel"); return;
  }
  const a = ACT.pick, b = btn;
  a.classList.remove("sel");
  if (a.dataset.i === b.dataset.i) {
    a.classList.add("ok"); b.classList.add("ok"); ACT.done++;
    if (ACT.done === ACT.total) $("act-done").innerHTML = "🎉 أحسنتم! اكتمل التوصيل";
  } else { a.classList.add("bad"); b.classList.add("bad"); setTimeout(() => { a.classList.remove("bad"); b.classList.remove("bad"); }, 450); }
  ACT.pick = null;
}
function orderPick(btn) {
  const i = Number(btn.dataset.i);
  if (i === ACT.next) {
    const slot = $("slot" + i); slot.classList.add("filled"); slot.innerHTML = `<span>${ar(i + 1)}</span>${btn.innerHTML}`;
    btn.remove(); ACT.next++;
    if (ACT.next === ACT.items.length) $("act-done").innerHTML = "🎉 الترتيب صحيح!";
  } else { btn.classList.add("bad"); setTimeout(() => btn.classList.remove("bad"), 450); }
}
function sortPick(btn) {
  if (ACT.picked) ACT.picked.classList.remove("sel");
  ACT.picked = btn === ACT.picked ? null : btn;
  if (ACT.picked) ACT.picked.classList.add("sel");
}
function sortDrop(gi) {
  const b = ACT.picked; if (!b) return;
  if (Number(b.dataset.g) === gi) {
    b.classList.remove("sel"); b.classList.add("ok"); b.onclick = null; $("bk" + gi).appendChild(b); ACT.picked = null; ACT.left--;
    if (ACT.left === 0) $("act-done").innerHTML = "🎉 التصنيف مكتمل!";
  } else { b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 450); }
}

// ---------- NAVIGATION ----------
function go(d) {
  const n = si + d;
  if (n < 0) return;
  if (n >= STAGES.length) { finishLesson(); return; }
  si = n; renderRail(); renderStage();
}
function finishLesson() {
  stopTimer();
  const box = $("stage"); box.className = "stage in";
  box.innerHTML = `<div class="fin"><div class="fin-ic">🎓</div><h2>انتهت الحصة</h2><p>${esc(curLesson.title)}</p>
    <div class="fin-btns">${CFG.gameFile ? `<a class="start-btn" href="../games/${esc(CFG.gameFile)}">🎮 لعبة المراجعة</a>` : ""}<button class="ghost" onclick="renderList()">📋 جميع الحصص</button></div></div>`;
  $("next").disabled = true;
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("on"));
  $("scr-" + id).classList.add("on");
  window.scrollTo(0, 0);
  if (id === "list") { stopTimer(); $("next").disabled = false; }
}
document.addEventListener("keydown", e => {
  if (!$("scr-lesson").classList.contains("on")) return;
  if (e.key === "ArrowLeft" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
  else if (e.key === "ArrowRight" || e.key === "PageUp") { e.preventDefault(); go(-1); }
  else if (e.key.toLowerCase() === "f") toggleFS();
  else if (e.key === "Escape" && !document.fullscreenElement) renderList();
});
function toggleFS() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
}

// ---------- PERIOD TIMER ----------
let T = { total: 2700, left: 2700, iv: null };
function setupTimer(sec) { stopTimer(); T.total = T.left = sec; drawTimer(); }
function drawTimer() {
  const m = Math.floor(T.left / 60), s = T.left % 60, el = $("timer");
  el.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  el.className = "tb timer" + (T.iv ? " run" : "") + (T.left <= 60 ? " red" : T.left <= 300 ? " warn" : "");
}
function toggleTimer() {
  if (T.iv) { stopTimer(); return; }
  if (T.left <= 0) T.left = T.total;
  T.iv = setInterval(() => { T.left--; if (T.left <= 0) { T.left = 0; stopTimer(); } drawTimer(); }, 1000);
  drawTimer();
}
function stopTimer() { if (T.iv) clearInterval(T.iv); T.iv = null; drawTimer(); }
function resetTimer() { stopTimer(); T.left = T.total; drawTimer(); }

// ---------- BOOT ----------
(async function boot() {
  if (CFG.color) document.documentElement.style.setProperty("--c", CFG.color);
  if (CFG.title) { document.title = CFG.title; $("brand").textContent = CFG.title; }
  try {
    const r = await fetch(CFG.jsonFile);
    if (!r.ok) throw new Error("HTTP " + r.status);
    DATA = await r.json();
    if (!Array.isArray(DATA.lessons)) DATA.lessons = [];
  } catch (e) {
    DATA = { lessons: [] };
    console.warn("lesson json:", e.message);
  }
  renderList();
})();
