/* ============================================================
   FAlDuwairi — بوابة المعلمين  (Cloudflare Worker + D1)
   ------------------------------------------------------------
   Bindings / variables (Worker → Settings):
     DB               D1 database binding (name it exactly DB)
     ADMIN_USER       Text    e.g. Abdullah208
     ADMIN_PASS       Secret  admin password
     SESSION_SECRET   Secret  any long random string (signs login tokens)
     ALLOWED_ORIGINS  Text    https://aalabdulsalam86-tech.github.io
   ============================================================ */

const TOKEN_TTL = 60 * 60 * 24 * 7;   // 7 days
const STATUSES = ["present", "absent", "excused", "sick", "field_trip"];

// ---------- helpers ----------
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ub64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
const clamp = (v, lo, hi) => { v = Number(v); if (!Number.isFinite(v)) return null; return Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)); };

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? ub64u(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return { hash: b64u(bits), salt: b64u(salt) };
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function makeToken(env, payload) {
  const body = b64u(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL })));
  return body + "." + await hmac(env.SESSION_SECRET, body);
}
async function readToken(env, req) {
  const h = req.headers.get("Authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return null;
  const [body, sig] = t.split(".");
  if (!body || !sig || sig !== await hmac(env.SESSION_SECRET, body)) return null;
  const p = JSON.parse(new TextDecoder().decode(ub64u(body)));
  if (p.exp < Math.floor(Date.now() / 1000)) return null;
  if (p.role === "teacher") {
    const row = await env.DB.prepare("SELECT id,email,name,department,classes,active FROM teachers WHERE id=?").bind(p.id).first();
    if (!row || !row.active) return null;
    return { ...p, name: row.name, department: row.department, classes: JSON.parse(row.classes || "[]") };
  }
  return p;
}
const isMoeEmail = (e) => /^[a-z0-9._-]+@moe\.edu\.kw$/i.test(e);

// ---------- main ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (allowed.length && !allowed.includes(origin)) return json({ error: "Origin not allowed: " + (origin || "(none)") }, 403, cors);
    if (!env.DB) return json({ error: "D1 binding DB is missing" }, 500, cors);
    if (!env.SESSION_SECRET) return json({ error: "SESSION_SECRET is not set" }, 500, cors);

    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;
    const body = (method === "GET" || method === "DELETE") ? {} : await request.json().catch(() => ({}));

    try {
      // ---------- public ----------
      if (path === "/" && method === "GET") return json({ ok: true, service: "falduwairi-school" }, 200, cors);
      if (path === "/classes/all" && method === "GET") {
        const r = await env.DB.prepare("SELECT code,grade,grade_label,section FROM classes ORDER BY grade,section").all();
        return json({ classes: r.results }, 200, cors);
      }
      if (path === "/auth/register" && method === "POST") {
        const email = String(body.email || "").trim().toLowerCase();
        const { password, name, department } = body;
        const classes = Array.isArray(body.classes) ? body.classes.map(String) : [];
        if (!isMoeEmail(email)) return json({ error: "البريد يجب أن يكون بريد وزارة التربية الرسمي (…@moe.edu.kw)" }, 400, cors);
        if (!password || password.length < 6) return json({ error: "كلمة المرور يجب ألا تقل عن 6 أحرف" }, 400, cors);
        if (!name || !department) return json({ error: "اسم المعلم والقسم مطلوبان" }, 400, cors);
        if (!classes.length) return json({ error: "اختر شعبة واحدة على الأقل" }, 400, cors);
        const valid = (await env.DB.prepare("SELECT code FROM classes").all()).results.map(r => r.code);
        const bad = classes.filter(c => !valid.includes(c));
        if (bad.length) return json({ error: "شعبة غير معروفة: " + bad.join(", ") }, 400, cors);
        const exists = await env.DB.prepare("SELECT id FROM teachers WHERE email=?").bind(email).first();
        if (exists) return json({ error: "هذا البريد مسجّل مسبقاً — سجّل الدخول" }, 409, cors);
        const { hash, salt } = await hashPassword(password);
        const r = await env.DB.prepare("INSERT INTO teachers(email,name,department,pass_hash,salt,classes) VALUES(?,?,?,?,?,?)")
          .bind(email, String(name).trim(), String(department).trim(), hash, salt, JSON.stringify(classes)).run();
        const id = r.meta.last_row_id;
        const token = await makeToken(env, { role: "teacher", id, email });
        return json({ token, user: { role: "teacher", id, email, name, department, classes } }, 200, cors);
      }
      if (path === "/auth/login" && method === "POST") {
        const user = String(body.email || body.username || "").trim();
        const password = String(body.password || "");
        if (env.ADMIN_USER && user === env.ADMIN_USER) {
          if (password === env.ADMIN_PASS) {
            const token = await makeToken(env, { role: "admin", id: 0, email: user });
            return json({ token, user: { role: "admin", id: 0, email: user, name: "المدير", department: "إدارة المنصة", classes: [] } }, 200, cors);
          }
          return json({ error: "كلمة المرور غير صحيحة" }, 401, cors);
        }
        const row = await env.DB.prepare("SELECT * FROM teachers WHERE email=?").bind(user.toLowerCase()).first();
        if (!row) return json({ error: "لا يوجد حساب بهذا البريد" }, 401, cors);
        if (!row.active) return json({ error: "الحساب موقوف — تواصل مع المدير" }, 403, cors);
        const { hash } = await hashPassword(password, row.salt);
        if (hash !== row.pass_hash) return json({ error: "كلمة المرور غير صحيحة" }, 401, cors);
        const token = await makeToken(env, { role: "teacher", id: row.id, email: row.email });
        return json({ token, user: { role: "teacher", id: row.id, email: row.email, name: row.name, department: row.department, classes: JSON.parse(row.classes || "[]") } }, 200, cors);
      }

      // ---------- authenticated ----------
      const me = await readToken(env, request);
      if (!me) return json({ error: "يلزم تسجيل الدخول" }, 401, cors);
      const isAdmin = me.role === "admin";
      const canSee = (code) => isAdmin || me.classes.includes(code);

      if (path === "/me" && method === "GET") return json({ user: me }, 200, cors);

      if (path === "/me/classes" && method === "PATCH") {       // teacher updates own classes
        if (isAdmin) return json({ error: "n/a" }, 400, cors);
        const classes = Array.isArray(body.classes) ? body.classes.map(String) : [];
        await env.DB.prepare("UPDATE teachers SET classes=? WHERE id=?").bind(JSON.stringify(classes), me.id).run();
        return json({ ok: true, classes }, 200, cors);
      }

      if (path === "/classes" && method === "GET") {
        const r = await env.DB.prepare("SELECT c.code,c.grade,c.grade_label,c.section,(SELECT COUNT(*) FROM students s WHERE s.class_code=c.code AND s.active=1) AS n FROM classes c ORDER BY c.grade,c.section").all();
        return json({ classes: r.results.filter(c => canSee(c.code)) }, 200, cors);
      }

      if (path === "/students" && method === "GET") {
        const code = url.searchParams.get("class");
        if (!code || !canSee(code)) return json({ error: "غير مصرّح بهذه الشعبة" }, 403, cors);
        const r = await env.DB.prepare("SELECT id,class_code,seq,name FROM students WHERE class_code=? AND active=1 ORDER BY seq").bind(code).all();
        return json({ students: r.results }, 200, cors);
      }

      if (path === "/progress" && method === "GET") {
        const code = url.searchParams.get("class");
        if (!code || !canSee(code)) return json({ error: "غير مصرّح بهذه الشعبة" }, 403, cors);
        let tid = isAdmin ? url.searchParams.get("teacher") : me.id;
        let sql = "SELECT p.*,s.name,s.class_code FROM progress p JOIN students s ON s.id=p.student_id WHERE s.class_code=?";
        const args = [code];
        if (tid !== null && tid !== undefined && tid !== "all") { sql += " AND p.teacher_id=?"; args.push(Number(tid)); }
        sql += " ORDER BY s.seq,p.week";
        const r = await env.DB.prepare(sql).bind(...args).all();
        return json({ progress: r.results }, 200, cors);
      }

      if (path === "/progress" && method === "PUT") {            // bulk upsert
        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (!rows.length) return json({ error: "لا توجد بيانات" }, 400, cors);
        const tid = isAdmin && body.teacher_id != null ? Number(body.teacher_id) : me.id;
        const ids = [...new Set(rows.map(r => Number(r.student_id)))];
        const owned = (await env.DB.prepare(`SELECT id,class_code FROM students WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results;
        for (const s of owned) if (!canSee(s.class_code)) return json({ error: "غير مصرّح" }, 403, cors);
        const stmt = env.DB.prepare(`INSERT INTO progress(student_id,teacher_id,week,status,behavior,activities,practical,project,exam,final_result,note,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(student_id,teacher_id,week) DO UPDATE SET status=excluded.status,behavior=excluded.behavior,activities=excluded.activities,
          practical=excluded.practical,project=excluded.project,exam=excluded.exam,final_result=excluded.final_result,note=excluded.note,updated_at=excluded.updated_at`);
        const batch = [];
        for (const r of rows) {
          const week = Number(r.week); if (!(week >= 1 && week <= 12)) continue;
          const status = STATUSES.includes(r.status) ? r.status : "present";
          const present = status === "present";
          batch.push(stmt.bind(Number(r.student_id), tid, week, status,
            present ? (clamp(r.behavior, 0, 1) ?? 0) : 0,
            present ? (clamp(r.activities, 0, 2) ?? 0) : 0,
            present ? (clamp(r.practical, 0, 3) ?? 0) : 0,
            week === 12 ? clamp(r.project, 0, 4) : null,
            week === 12 ? clamp(r.exam, 0, 10) : null,
            week === 12 ? clamp(r.final_result, 0, 20) : null,
            r.note ? String(r.note).slice(0, 300) : null));
        }
        if (batch.length) await env.DB.batch(batch);
        return json({ ok: true, saved: batch.length }, 200, cors);
      }

      // ---------- admin ----------
      if (!isAdmin) return json({ error: "صلاحية المدير مطلوبة" }, 403, cors);

      if (path === "/admin/teachers" && method === "GET") {
        const r = await env.DB.prepare("SELECT id,email,name,department,classes,active,created_at,(SELECT COUNT(*) FROM progress p WHERE p.teacher_id=teachers.id) AS records FROM teachers ORDER BY created_at DESC").all();
        return json({ teachers: r.results.map(t => ({ ...t, classes: JSON.parse(t.classes || "[]") })) }, 200, cors);
      }
      const mT = path.match(/^\/admin\/teachers\/(\d+)$/);
      if (mT && method === "PATCH") {
        const id = Number(mT[1]); const sets = []; const args = [];
        if (body.name) { sets.push("name=?"); args.push(String(body.name)); }
        if (body.department) { sets.push("department=?"); args.push(String(body.department)); }
        if (Array.isArray(body.classes)) { sets.push("classes=?"); args.push(JSON.stringify(body.classes.map(String))); }
        if (body.active !== undefined) { sets.push("active=?"); args.push(body.active ? 1 : 0); }
        if (body.password) { const { hash, salt } = await hashPassword(String(body.password)); sets.push("pass_hash=?", "salt=?"); args.push(hash, salt); }
        if (!sets.length) return json({ error: "لا تغييرات" }, 400, cors);
        await env.DB.prepare(`UPDATE teachers SET ${sets.join(",")} WHERE id=?`).bind(...args, id).run();
        return json({ ok: true }, 200, cors);
      }
      if (mT && method === "DELETE") {
        await env.DB.batch([env.DB.prepare("DELETE FROM progress WHERE teacher_id=?").bind(Number(mT[1])), env.DB.prepare("DELETE FROM teachers WHERE id=?").bind(Number(mT[1]))]);
        return json({ ok: true }, 200, cors);
      }

      if (path === "/admin/students" && method === "POST") {    // add one
        const { class_code, name } = body;
        if (!class_code || !name) return json({ error: "الشعبة والاسم مطلوبان" }, 400, cors);
        const mx = await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS m FROM students WHERE class_code=?").bind(class_code).first();
        const r = await env.DB.prepare("INSERT INTO students(class_code,seq,name) VALUES(?,?,?)").bind(class_code, mx.m + 1, String(name).trim()).run();
        return json({ ok: true, id: r.meta.last_row_id, seq: mx.m + 1 }, 200, cors);
      }
      const mS = path.match(/^\/admin\/students\/(\d+)$/);
      if (mS && method === "PATCH") {
        const sets = []; const args = [];
        if (body.name) { sets.push("name=?"); args.push(String(body.name).trim()); }
        if (body.class_code) { sets.push("class_code=?"); args.push(String(body.class_code)); }
        if (body.seq) { sets.push("seq=?"); args.push(Number(body.seq)); }
        if (body.active !== undefined) { sets.push("active=?"); args.push(body.active ? 1 : 0); }
        if (!sets.length) return json({ error: "لا تغييرات" }, 400, cors);
        await env.DB.prepare(`UPDATE students SET ${sets.join(",")} WHERE id=?`).bind(...args, Number(mS[1])).run();
        return json({ ok: true }, 200, cors);
      }
      if (mS && method === "DELETE") {
        await env.DB.prepare("UPDATE students SET active=0 WHERE id=?").bind(Number(mS[1])).run();
        return json({ ok: true }, 200, cors);
      }
      if (path === "/admin/progress/all" && method === "GET") {  // full export
        const r = await env.DB.prepare("SELECT p.*,s.name,s.class_code,t.name AS teacher_name,t.email AS teacher_email FROM progress p JOIN students s ON s.id=p.student_id LEFT JOIN teachers t ON t.id=p.teacher_id ORDER BY s.class_code,s.seq,p.week").all();
        return json({ progress: r.results }, 200, cors);
      }
      if (path === "/admin/progress" && method === "DELETE") {  // wipe a teacher's records (or all with teacher=all)
        const t = url.searchParams.get("teacher");
        if (t === "all") await env.DB.prepare("DELETE FROM progress").run();
        else if (t) await env.DB.prepare("DELETE FROM progress WHERE teacher_id=?").bind(Number(t)).run();
        else return json({ error: "teacher param required" }, 400, cors);
        return json({ ok: true }, 200, cors);
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (e) {
      return json({ error: e.message || String(e) }, 500, cors);
    }
  }
};
