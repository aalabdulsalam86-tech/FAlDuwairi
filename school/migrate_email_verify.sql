-- ============================================================
-- تفعيل الحساب بالبريد — نفّذ هذا مرة واحدة في D1 → Console
-- (لقاعدة البيانات الموجودة مسبقاً؛ لا يحذف أي بيانات)
-- ============================================================
ALTER TABLE teachers ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE teachers ADD COLUMN verify_hash TEXT;
ALTER TABLE teachers ADD COLUMN verify_exp INTEGER;
ALTER TABLE teachers ADD COLUMN verify_tries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE teachers ADD COLUMN verify_sent INTEGER;
-- المعلمون المسجّلون حالياً سيُطلب منهم التفعيل عند الدخول التالي.
-- لاعتمادهم مباشرة دون رمز، احذف الشرطتين من السطر التالي:
-- UPDATE teachers SET verified=1;
