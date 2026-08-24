-- ============================================================================
-- SANDMOSQUITO WATER BILLING - SQLITE MIGRATION SCRIPT
-- ============================================================================
-- Skrip ini otomatis dieksekusi saat server SQLite lokal dijalankan
-- File database SQLite: sandmosquito.db (WAL mode)
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT 'demo',
  salt TEXT NOT NULL DEFAULT 'demo',
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'customer')),
  assigned_rt TEXT,
  email TEXT,
  phone TEXT,
  customer_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Tariffs Table
CREATE TABLE IF NOT EXISTS tariffs (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_fee REAL NOT NULL DEFAULT 0,
  tier1_max REAL NOT NULL DEFAULT 10,
  tier1_rate REAL NOT NULL DEFAULT 2000,
  tier2_max REAL NOT NULL DEFAULT 20,
  tier2_rate REAL NOT NULL DEFAULT 3000,
  tier3_rate REAL NOT NULL DEFAULT 5000,
  late_fee REAL NOT NULL DEFAULT 5000,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_no TEXT UNIQUE NOT NULL,
  user_id TEXT,
  full_name TEXT NOT NULL,
  nik TEXT,
  phone TEXT,
  address TEXT,
  rt_rw TEXT,
  meter_id TEXT,
  meter_no TEXT,
  current_reading REAL DEFAULT 0,
  tariff_id TEXT,
  tariff_name TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif',
  is_subsidized INTEGER NOT NULL DEFAULT 0,
  subsidy_type TEXT DEFAULT 'none',
  subsidy_max_amount REAL DEFAULT 0,
  subsidy_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Meters Table
CREATE TABLE IF NOT EXISTS meters (
  id TEXT PRIMARY KEY,
  meter_no TEXT UNIQUE NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  customer_no TEXT,
  brand TEXT,
  installation_date TEXT,
  initial_reading REAL NOT NULL DEFAULT 0,
  current_reading REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Aktif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Meter Readings Table
CREATE TABLE IF NOT EXISTS meter_readings (
  id TEXT PRIMARY KEY,
  reading_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  customer_no TEXT,
  rt_rw TEXT,
  meter_id TEXT,
  meter_no TEXT,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  prev_reading REAL NOT NULL DEFAULT 0,
  current_reading REAL NOT NULL DEFAULT 0,
  usage_m3 REAL NOT NULL DEFAULT 0,
  reading_date TEXT NOT NULL,
  reader_id TEXT,
  reader_name TEXT,
  notes TEXT,
  photo_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Bills Table
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  customer_no TEXT,
  rt_rw TEXT,
  phone TEXT,
  reading_id TEXT,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  prev_reading REAL NOT NULL DEFAULT 0,
  current_reading REAL NOT NULL DEFAULT 0,
  usage_m3 REAL NOT NULL DEFAULT 0,
  base_amount REAL NOT NULL DEFAULT 0,
  usage_amount REAL NOT NULL DEFAULT 0,
  late_fee REAL NOT NULL DEFAULT 0,
  admin_fee REAL NOT NULL DEFAULT 0,
  original_amount REAL DEFAULT 0,
  subsidy_amount REAL DEFAULT 0,
  is_subsidized INTEGER NOT NULL DEFAULT 0,
  subsidy_type TEXT DEFAULT 'none',
  subsidy_notes TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Belum Dibayar',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payment_no TEXT UNIQUE NOT NULL,
  bill_id TEXT NOT NULL,
  bill_no TEXT,
  period_month INTEGER,
  period_year INTEGER,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  customer_no TEXT,
  rt_rw TEXT,
  payment_date TEXT NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Tunai',
  cashier_id TEXT,
  cashier_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

-- 10. Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all',
  priority TEXT NOT NULL DEFAULT 'normal',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT DEFAULT 'Administrator',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 11. Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  complaint_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_no TEXT NOT NULL,
  phone TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Menunggu',
  response_notes TEXT,
  handled_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 12. Subscription Requests Table
CREATE TABLE IF NOT EXISTS subscription_requests (
  id TEXT PRIMARY KEY,
  request_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_no TEXT NOT NULL,
  phone TEXT,
  current_tariff_id TEXT,
  current_tariff_name TEXT NOT NULL,
  requested_tariff_id TEXT NOT NULL,
  requested_tariff_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Menunggu',
  response_notes TEXT,
  handled_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 13. Registration Tokens Table
CREATE TABLE IF NOT EXISTS registration_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  recipient_name TEXT,
  target_role TEXT NOT NULL DEFAULT 'customer',
  default_tariff_id TEXT,
  is_used INTEGER NOT NULL DEFAULT 0,
  used_by_username TEXT,
  used_at TEXT,
  created_by TEXT DEFAULT 'Administrator',
  notes TEXT,
  created_at TEXT NOT NULL
);

-- 14. Maintenance Expenses Table
CREATE TABLE IF NOT EXISTS maintenance_expenses (
  id TEXT PRIMARY KEY,
  expense_no TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  expense_date TEXT NOT NULL,
  recorded_by TEXT DEFAULT 'Admin BUMDes',
  receipt_photo_url TEXT,
  created_at TEXT NOT NULL
);

