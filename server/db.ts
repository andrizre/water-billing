import { Database } from "bun:sqlite";
import crypto from "crypto";
import path from "path";

// Initialize SQLite database file on disk
const dbPath = path.resolve(process.cwd(), "sandmosquito.db");
export const db = new Database(dbPath);

// Enable WAL mode for high performance & concurrency
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA foreign_keys = ON;");

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, finalSalt, 1000, 32, "sha256").toString("hex");
  return { hash, salt: finalSalt };
}

export function initDatabase() {
  // 1. Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'customer')),
      assigned_rt TEXT,
      email TEXT,
      phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Tariffs Table
  db.run(`
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
  `);

  // 3. Customers Table
  db.run(`
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
  `);

  // 4. Water Meters Table
  db.run(`
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
  `);

  // 5. Meter Readings Table
  db.run(`
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
  `);

  // 6. Bills Table
  db.run(`
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
  `);

  // 7. Payments Table
  db.run(`
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
  `);

  // 8. Settings Table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 9. Audit Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 10. Announcements Table
  db.run(`
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
  `);

  // 11. Complaints Table
  db.run(`
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
  `);

  // 12. Subscription Requests Table
  db.run(`
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
  `);

  // 13. Registration Tokens Table
  db.run(`
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
  `);

  // 14. Maintenance Expenses Table
  db.run(`
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
  `);

  // Seed Initial Demo Data if Database is Empty
  seedInitialData();
}

function seedInitialData() {
  const userCount = (db.query("SELECT COUNT(*) as cnt FROM users").get() as any)?.cnt || 0;
  if (userCount > 0) return; // Already seeded

  console.log("🌱 Inisialisasi data awal SQLite (Sandmosquito Water Billing)...");

  const now = new Date().toISOString();

  // 1. Insert Default Settings
  const defaultSettings: Record<string, string> = {
    app_name: "Sandmosquito Water Billing",
    village_name: "Desa Sandmosquito",
    organization_name: "BUMDes Tirta Sandmosquito Sejahtera",
    village_address: "Jl. Raya Sandmosquito No. 01, Kec. Tirta Makmur, Jawa Timur",
    contact_phone: "0812-3456-7890",
    contact_email: "bumdes@sandmosquito.desa.id",
    bank_account_info: "Bank BRI: 1234-01-000123-53-0 a.n BUMDes Tirta Sandmosquito",
    qris_info: "Tersedia di loket kantor desa atau scan barcode resmi",
    due_day_of_month: "20",
    late_fee_flat: "5000",
    bill_footer_notes: "Terima kasih atas pembayaran tepat waktu demi kelancaran pasokan air desa."
  };

  const insertSetting = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value, now);
  }

  // 2. Insert Default Tariffs
  const insertTariff = db.prepare(`
    INSERT INTO tariffs (id, code, name, category, base_fee, tier1_max, tier1_rate, tier2_max, tier2_rate, tier3_rate, late_fee, description, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  insertTariff.run("TRF-01", "R1", "Rumah Tangga Standar", "Rumah Tangga", 5000, 10, 2000, 20, 3000, 5000, 5000, "Tarif standar rumah warga", now, now);
  insertTariff.run("TRF-02", "B1", "Niaga / Usaha Kecil", "Niaga", 10000, 10, 3500, 20, 5000, 8000, 10000, "Tarif toko dan warung", now, now);
  insertTariff.run("TRF-03", "S1", "Fasilitas Sosial / Masjid", "Sosial", 0, 10, 1000, 20, 1500, 2500, 0, "Tarif tempat ibadah", now, now);

  // 3. Insert Users & Customers
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, salt, full_name, role, email, phone, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, customer_no, user_id, full_name, nik, phone, address, rt_rw, meter_no, tariff_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?)
  `);

  const insertMeter = db.prepare(`
    INSERT INTO meters (id, meter_no, customer_id, brand, installation_date, initial_reading, current_reading, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?)
  `);

  // Admin & Operator Users
  const adminAuth = hashPassword("admin123");
  insertUser.run("USR-001", "admin", adminAuth.hash, adminAuth.salt, "Administrator BUMDes", "admin", "admin@sandmosquito.desa.id", "0811111111", now, now);

  const opAuth = hashPassword("operator123");
  insertUser.run("USR-002", "operator", opAuth.hash, opAuth.salt, "Budi Santoso (Petugas Loket)", "operator", "budi@sandmosquito.desa.id", "0812222222", now, now);

  // Customers Data
  const customersData = [
    { id: "CUST-ID-001", no: "CUST-2026-0001", name: "Bpk. Supardi", nik: "3501010101800001", phone: "081234567890", addr: "Jl. Mawar No. 12", rtrw: "RT 01 / RW 01", meter: "MTR-8801", reading: 154, tariff: "TRF-01" },
    { id: "CUST-ID-002", no: "CUST-2026-0002", name: "Ibu Siti Aminah", nik: "3501010202850002", phone: "081234567891", addr: "Jl. Melati No. 05", rtrw: "RT 02 / RW 01", meter: "MTR-8802", reading: 218, tariff: "TRF-01" },
    { id: "CUST-ID-003", no: "CUST-2026-0003", name: "Warung Berkah Jaya", nik: "3501010303780003", phone: "081234567892", addr: "Jl. Pasar Desa No. 88", rtrw: "RT 03 / RW 01", meter: "MTR-8803", reading: 435, tariff: "TRF-02" },
    { id: "CUST-ID-004", no: "CUST-2026-0004", name: "Ibu Nurul Hidayah", nik: "3501010404900004", phone: "081234567893", addr: "Jl. Kenanga No. 19", rtrw: "RT 01 / RW 02", meter: "MTR-8804", reading: 89, tariff: "TRF-01" },
    { id: "CUST-ID-005", no: "CUST-2026-0005", name: "Masjid Al-Ikhlas", nik: "3501010505700005", phone: "081234567894", addr: "Jl. Utama Dusun II", rtrw: "RT 02 / RW 02", meter: "MTR-8805", reading: 320, tariff: "TRF-03" }
  ];

  for (let i = 0; i < customersData.length; i++) {
    const c = customersData[i];
    const userId = `USR-CUST-00${i + 1}`;
    const custAuth = hashPassword("warga123");

    insertUser.run(userId, c.no, custAuth.hash, custAuth.salt, c.name, "customer", "", c.phone, now, now);
    insertCustomer.run(c.id, c.no, userId, c.name, c.nik, c.phone, c.addr, c.rtrw, c.meter, c.tariff, now, now);
    insertMeter.run(`MTR-ID-00${i + 1}`, c.meter, c.id, 'Onda SNI 1/2"', "2025-01-10", 0, c.reading, now, now);
  }

  // 4. Insert Meter Readings, Bills, and Payments
  const insertReading = db.prepare(`
    INSERT INTO meter_readings (id, reading_no, customer_id, meter_id, period_month, period_year, prev_reading, current_reading, usage_m3, reading_date, reader_id, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USR-002', 'Pencatatan normal', ?, ?)
  `);

  const insertBill = db.prepare(`
    INSERT INTO bills (id, bill_no, customer_id, reading_id, period_month, period_year, prev_reading, current_reading, usage_m3, base_fee, usage_amount, penalty_fee, total_amount, paid_amount, balance_due, due_date, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (id, payment_no, bill_id, customer_id, amount_paid, payment_date, payment_method, cashier_id, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'USR-002', 'Pelunasan loket kasir', ?, ?)
  `);

  // Sample Bills & Readings for Period 8 / 2026
  insertReading.run("RDM-001", "RDM-202608-0001", "CUST-ID-001", "MTR-ID-001", 8, 2026, 136, 154, 18, "2026-08-05", now, now);
  insertBill.run("INV-001", "INV-202608-0001", "CUST-ID-001", "RDM-001", 8, 2026, 136, 154, 18, 5000, 44000, 0, 49000, 49000, 0, "2026-08-20", "Lunas", now, now);
  insertPayment.run("PAY-001", "PAY-202608-0001", "INV-001", "CUST-ID-001", 49000, "2026-08-10 09:30:00", "Tunai", now, now);

  insertReading.run("RDM-002", "RDM-202608-0002", "CUST-ID-002", "MTR-ID-002", 8, 2026, 204, 218, 14, "2026-08-05", now, now);
  insertBill.run("INV-002", "INV-202608-0002", "CUST-ID-002", "RDM-002", 8, 2026, 204, 218, 14, 5000, 32000, 0, 37000, 37000, 0, "2026-08-12 14:15:00", "Lunas", now, now);
  insertPayment.run("PAY-002", "PAY-202608-0002", "INV-002", "CUST-ID-002", 37000, "2026-08-12 14:15:00", "Transfer Bank", now, now);

  // Unpaid Bill Example
  insertReading.run("RDM-003", "RDM-202608-0004", "CUST-ID-004", "MTR-ID-004", 8, 2026, 73, 89, 16, "2026-08-05", now, now);
  insertBill.run("INV-003", "INV-202608-0004", "CUST-ID-004", "RDM-003", 8, 2026, 73, 89, 16, 5000, 38000, 0, 43000, 0, 43000, "2026-08-20", "Belum Dibayar", now, now);

  // 5. Initial Audit Log
  db.run(`
    INSERT INTO audit_logs (id, user_id, username, action, details, ip_address, created_at)
    VALUES ('LOG-001', 'USR-001', 'admin', 'SYSTEM_INIT', 'Inisialisasi database SQLite lokal berhasil dibuat.', '127.0.0.1', '${now}')
  `);

  console.log("✅ Data awal SQLite berhasil disiapkan di: " + dbPath);
}
