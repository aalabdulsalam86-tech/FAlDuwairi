-- ============================================================
-- بوابة المعلمين — مخطط قاعدة البيانات (Cloudflare D1 / SQLite)
-- نفّذ هذا الملف مرة واحدة في D1 → Console
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  classes TEXT NOT NULL DEFAULT '[]',   -- JSON array of class codes e.g. ["10-1","11S-3"]
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,                -- "10-1", "11S-2", "11A-1", "12S-6", "12A-1"
  grade TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  section INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_code TEXT NOT NULL REFERENCES classes(code),
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_code);
CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  teacher_id INTEGER NOT NULL,          -- 0 = admin
  week INTEGER NOT NULL,                -- 1..12
  status TEXT NOT NULL DEFAULT 'present',  -- present | absent | excused | sick | field_trip
  behavior REAL NOT NULL DEFAULT 0,     -- 0..1
  activities REAL NOT NULL DEFAULT 0,   -- 0..2
  practical REAL NOT NULL DEFAULT 0,    -- 0..3
  project REAL,                         -- 0..4  (week 12)
  exam REAL,                            -- 0..10 (week 12)
  final_result REAL,                    -- /20   (week 12)
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, teacher_id, week)
);
CREATE INDEX IF NOT EXISTS idx_progress_teacher ON progress(teacher_id, week);
