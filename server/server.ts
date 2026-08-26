import { db, initDatabase, hashPassword } from "./db";
import crypto from "crypto";
import path from "path";

// Initialize SQLite Tables & Seed Data
initDatabase();

const PORT = Number(process.env.PORT || 3001);

// ---------------------------------------------------------------------------
// Auth Token Store (in-memory) & Login Rate Limiting
// ---------------------------------------------------------------------------
interface SessionUser {
  id: string;
  username: string;
  role: string;
  customerId?: string;
  fullName: string;
  assignedRt?: string | null;
}

const activeTokens = new Map<string, SessionUser>();
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_LOGIN_FAILURES = 8;
const LOGIN_LOCK_MS = 10 * 60 * 1000; // 10 minutes lockout

function generateToken(user: SessionUser): string {
  const token = `sql_token_${crypto.randomBytes(24).toString("hex")}`;
  activeTokens.set(token, user);
  return token;
}

function verifyAuthToken(req: Request): SessionUser | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return activeTokens.get(token) || null;
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function logAudit(userId: string | null, username: string, action: string, details: string, ip = "127.0.0.1") {
  const id = `LOG-${Date.now().toString().slice(-6)}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  db.run(
    "INSERT INTO audit_logs (id, user_id, username, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, userId, username, action, details, ip, now]
  );
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------
function requireAuth(auth: SessionUser | null): SessionUser {
  if (!auth) throw new Error("Diperlukan autentikasi. Silakan login kembali.");
  return auth;
}

function requireStaff(auth: SessionUser | null): SessionUser {
  const a = requireAuth(auth);
  if (a.role !== "admin" && a.role !== "operator") {
    throw new Error("Akses ditolak. Halaman ini hanya untuk Admin dan Operator.");
  }
  return a;
}

function requireAdmin(auth: SessionUser | null): SessionUser {
  const a = requireAuth(auth);
  if (a.role !== "admin") throw new Error("Akses ditolak. Hanya Administrator yang diizinkan.");
  return a;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const nowIso = () => new Date().toISOString();

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function getSetting(key: string, fallback: string): string {
  const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as any;
  return row?.value ?? fallback;
}

/**
 * Build due date for a billing period using configurable due day.
 * NOTE: JS Date month is 0-based while period_month is 1-based -> subtract 1.
 */
function dueDateFor(periodMonth: number, periodYear: number): string {
  const day = Math.min(31, Math.max(1, Number(getSetting("due_day_of_month", "20")) || 20));
  const d = new Date(Date.UTC(periodYear, periodMonth - 1, day));
  return d.toISOString().substring(0, 10);
}

/** Latest period present in bills (fallback: current month). Used by report defaults. */
function latestBillPeriod(): { month: number; year: number } {
  const row = db.query(
    "SELECT period_month as m, period_year as y FROM bills ORDER BY period_year DESC, period_month DESC LIMIT 1"
  ).get() as any;
  if (row?.m && row?.y) return { month: Number(row.m), year: Number(row.y) };
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// Calculate tiered bill breakdown incl. village subsidy rules
function calculateTieredBill(
  usageM3: number,
  tariff: any,
  adminFee: number = 2500,
  subsidy?: { is_subsidized?: boolean | number; subsidy_type?: string; subsidy_max_amount?: number } | null
) {
  const baseFee = Number(tariff?.base_fee || 0);
  const adminFeeVal = Math.max(0, Number(adminFee || 0));
  const tier1Max = Math.max(0, Number(tariff?.tier1_max ?? 10));
  const tier2Max = Math.max(tier1Max, Number(tariff?.tier2_max ?? 20));
  const tier1Rate = Number(tariff?.tier1_rate ?? 2000);
  const tier2Rate = Number(tariff?.tier2_rate ?? 3000);
  const tier3Rate = Number(tariff?.tier3_rate ?? 5000);

  let remaining = Math.max(0, Number(usageM3) || 0);
  let tier1Usage = 0;
  let tier2Usage = 0;
  let tier3Usage = 0;

  tier1Usage = Math.min(remaining, tier1Max);
  remaining -= tier1Usage;

  if (remaining > 0) {
    const tier2Capacity = Math.max(0, tier2Max - tier1Max);
    tier2Usage = Math.min(remaining, tier2Capacity);
    remaining -= tier2Usage;
  }

  if (remaining > 0) {
    tier3Usage = remaining;
  }

  const tier1Amount = tier1Usage * tier1Rate;
  const tier2Amount = tier2Usage * tier2Rate;
  const tier3Amount = tier3Usage * tier3Rate;
  const usageAmount = tier1Amount + tier2Amount + tier3Amount;
  const rawTotal = baseFee + usageAmount + adminFeeVal;

  let totalAmount = rawTotal;
  let subsidyAmount = 0;
  const isSubsidized = Boolean(subsidy?.is_subsidized);
  const subsidyType = isSubsidized ? subsidy?.subsidy_type || "gratis" : "none";

  if (isSubsidized) {
    if (subsidyType === "gratis") {
      subsidyAmount = rawTotal;
      totalAmount = 0;
    } else if (subsidyType === "max_tagihan") {
      const maxCap = Math.max(0, Number(subsidy?.subsidy_max_amount ?? 20000));
      if (rawTotal > maxCap) {
        subsidyAmount = rawTotal - maxCap;
        totalAmount = maxCap;
      }
    }
  }

  return {
    base_fee: baseFee,
    tier1_usage: tier1Usage,
    tier1_amount: tier1Amount,
    tier2_usage: tier2Usage,
    tier2_amount: tier2Amount,
    tier3_usage: tier3Usage,
    tier3_amount: tier3Amount,
    usage_amount: usageAmount,
    admin_fee: adminFeeVal,
    original_amount: rawTotal,
    subsidy_amount: subsidyAmount,
    is_subsidized: isSubsidized ? 1 : 0,
    subsidy_type: subsidyType,
    total_amount: totalAmount
  };
}

function getCustomerSubsidy(customerId: string) {
  return (
    db.query(
      "SELECT is_subsidized, subsidy_type, subsidy_max_amount FROM customers WHERE id = ?"
    ).get(customerId) as any
  ) || null;
}

// ---------------------------------------------------------------------------
// Universal Request Handler
// ---------------------------------------------------------------------------
async function handleApiAction(action: string, data: any, auth: SessionUser | null, req: Request): Promise<any> {
  const now = nowIso();

  // ========================================================================
  // 1. PUBLIC ACTIONS (no authentication)
  // ========================================================================

  // --- Public bill check: exact match only, privacy-safe field whitelist ---
  if (action === "publicCheckBill") {
    const query = String(data.customer_no || "").trim();
    if (!query) throw new Error("Nomor pelanggan harus diisi.");

    const customer = db.query(`
      SELECT c.id, c.customer_no, c.full_name, c.address, c.rt_rw, c.status,
             c.is_subsidized, c.subsidy_type, c.subsidy_max_amount,
             t.name as tariff_name
      FROM customers c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE c.customer_no = ? COLLATE NOCASE OR c.full_name = ? COLLATE NOCASE
      LIMIT 1
    `).get(query, query) as any;

    if (!customer) throw new Error("Pelanggan dengan nomor/nama tersebut tidak ditemukan.");

    const bills = db.query(`
      SELECT bill_no, period_month, period_year, usage_m3, total_amount,
             paid_amount, balance_due, due_date, status
      FROM bills
      WHERE customer_id = ?
      ORDER BY period_year DESC, period_month DESC
      LIMIT 12
    `).all(customer.id) as any[];

    const meter = db.query("SELECT meter_no, current_reading FROM meters WHERE customer_id = ? LIMIT 1").get(customer.id) as any;

    const totalUnpaid = bills
      .filter((b) => b.status !== "Lunas")
      .reduce((sum, b) => sum + (b.balance_due || b.total_amount), 0);

    return {
      success: true,
      customer: {
        customer_no: customer.customer_no,
        full_name: customer.full_name,
        address: customer.address,
        rt_rw: customer.rt_rw,
        status: customer.status,
        tariff_name: customer.tariff_name,
        is_subsidized: !!customer.is_subsidized,
        subsidy_type: customer.subsidy_type,
        subsidy_max_amount: customer.subsidy_max_amount
      },
      meter,
      bills,
      total_unpaid_amount: totalUnpaid
    };
  }

  // --- Login (rate limited, no backdoor passwords, audit failures) ---
  if (action === "login") {
    const { username, password } = data;
    if (!username || !password) throw new Error("Username dan kata sandi wajib diisi.");

    const attemptKey = String(username).trim().toLowerCase();
    const attempt = loginAttempts.get(attemptKey);
    if (attempt && attempt.lockedUntil > Date.now()) {
      const mins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      throw new Error(`Terlalu banyak percobaan gagal. Akun dikunci sementara (~${mins} menit).`);
    }

    let user = db.query("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(String(username).trim()) as any;

    // Allow login using customer number
    if (!user) {
      const cust = db.query("SELECT * FROM customers WHERE customer_no = ? COLLATE NOCASE").get(String(username).trim()) as any;
      if (cust?.user_id) {
        user = db.query("SELECT * FROM users WHERE id = ?").get(cust.user_id) as any;
      }
    }

    if (!user) throw new Error("Pengguna atau nomor pelanggan tidak ditemukan.");
    if (!user.is_active) throw new Error("Akun ini telah dinonaktifkan oleh administrator.");

    // Verify password: supports pbkdf2 hash and legacy plain-text rows
    let isValid = false;
    if (user.salt && user.salt !== "plain") {
      const { hash } = hashPassword(String(password), user.salt);
      isValid = hash === user.password_hash;
    }
    if (!isValid) {
      isValid = user.password_hash === password; // legacy plain-text support
    }

    if (!isValid) {
      const rec = loginAttempts.get(attemptKey) || { count: 0, lockedUntil: 0 };
      rec.count += 1;
      if (rec.count >= MAX_LOGIN_FAILURES) {
        rec.lockedUntil = Date.now() + LOGIN_LOCK_MS;
        rec.count = 0;
      }
      loginAttempts.set(attemptKey, rec);
      logAudit(null, attemptKey, "LOGIN_FAILED", `Percobaan login gagal (${rec.count}x)`, clientIp(req));
      throw new Error("Kata sandi salah. Silakan coba lagi.");
    }

    loginAttempts.delete(attemptKey);

    // Lookup customer ID if customer role
    let customerId: string | undefined;
    if (user.role === "customer") {
      const cust = db.query("SELECT id FROM customers WHERE user_id = ? OR customer_no = ? COLLATE NOCASE").get(user.id, user.username) as any;
      customerId = cust?.id;
    }

    const session: SessionUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      customerId,
      fullName: user.full_name,
      assignedRt: user.assigned_rt
    };
    const token = generateToken(session);
    logAudit(user.id, user.username, "LOGIN", "Login berhasil ke sistem SQLite", clientIp(req));

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        assigned_rt: user.assigned_rt,
        email: user.email,
        phone: user.phone,
        customerId
      }
    };
  }

  // --- Public registration via admin-issued token ---
  if (action === "registerWithToken") {
    const { token: tokenStr, full_name, nik, phone, address, rt_rw, username, password } = data;
    if (!tokenStr || !full_name || !username || !password) {
      throw new Error("Data pendaftaran tidak lengkap.");
    }
    if (String(password).length < 6) throw new Error("Kata sandi minimal 6 karakter.");

    const cleanTokenStr = String(tokenStr).trim().toUpperCase();
    const tok = db.query("SELECT * FROM registration_tokens WHERE token = ? COLLATE NOCASE").get(cleanTokenStr) as any;
    if (!tok) throw new Error("Token tidak valid atau tidak ditemukan.");
    if (tok.is_used) throw new Error("Token ini sudah pernah digunakan.");
    if (tok.token_type && tok.token_type !== "registration") {
      throw new Error("Token yang Anda masukkan adalah Token Reset Password, bukan Token Pendaftaran Akun.");
    }

    const cleanUser = String(username).trim().toLowerCase();
    const existing = db.query("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(cleanUser) as any;
    if (existing) throw new Error(`Username "${username}" sudah digunakan.`);

    const auth_ = hashPassword(String(password));
    const userId = genId("USR");
    db.run(
      "INSERT INTO users (id, username, password_hash, salt, full_name, role, email, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, '', ?, 1, ?, ?)",
      [userId, cleanUser, auth_.hash, auth_.salt, full_name, tok.target_role === "operator" ? "operator" : "customer", phone || "", now, now]
    );

    const customerId = genId("CUST-ID");
    const customerNo = `CUST-${new Date().getFullYear()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const meterId = genId("MTR-ID");
    const meterNo = `MTR-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const tariffId = tok.default_tariff_id || getSetting("default_tariff_id", "TRF-01");

    db.run(
      `INSERT INTO meters (id, meter_no, customer_id, customer_name, customer_no, brand, installation_date, initial_reading, current_reading, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Standard SNI', ?, 0, 0, 'Aktif', ?, ?)`,
      [meterId, meterNo, customerId, full_name, customerNo, now.substring(0, 10), now, now]
    );

    const tariff = db.query("SELECT name FROM tariffs WHERE id = ?").get(tariffId) as any;
    db.run(
      `INSERT INTO customers (id, customer_no, user_id, full_name, nik, phone, address, rt_rw, meter_id, meter_no, current_reading, tariff_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Aktif', ?, ?)`,
      [customerId, customerNo, userId, full_name, nik || "", phone || "", address || "", rt_rw || "", meterId, meterNo, tariffId, now, now]
    );

    db.run(
      "UPDATE registration_tokens SET is_used = 1, used_by_username = ?, used_at = ? WHERE id = ?",
      [cleanUser, now, tok.id]
    );

    logAudit(null, cleanUser, "REGISTER", `Registrasi mandiri via token: ${customerNo}`, clientIp(req));
    return {
      success: true,
      customer_no: customerNo,
      username: cleanUser,
      message: "Registrasi berhasil! Silakan login."
    };
  }

  // --- Public verify token (registration or password_reset) ---
  if (action === "verifyRegistrationToken") {
    const expectedType = data.expectedType || data.expected_type || "registration";
    const clean = String(data.token || "").trim().toUpperCase();
    if (!clean) throw new Error("Token harus diisi.");

    const tok = db.query("SELECT * FROM registration_tokens WHERE token = ? COLLATE NOCASE").get(clean) as any;
    if (!tok) throw new Error("Token tidak valid atau tidak ditemukan.");
    if (tok.is_used) throw new Error("Token ini sudah pernah digunakan.");
    if (expectedType && tok.token_type && tok.token_type !== expectedType) {
      if (expectedType === "password_reset") {
        throw new Error("Token yang Anda masukkan adalah Token Pendaftaran Akun, bukan Token Reset Password.");
      }
      throw new Error("Token yang Anda masukkan adalah Token Reset Password, bukan Token Pendaftaran Akun.");
    }
    return { valid: true, token: tok };
  }

  // --- Public forgot-password reset with server-side identity verification ---
  if (action === "forgotPasswordReset") {
    const { token, identifier, nik_last4, rt_rw_answer, new_password } = data;
    if (!token || !identifier || !new_password) throw new Error("Data reset tidak lengkap.");
    if (String(new_password).length < 6) throw new Error("Kata sandi baru minimal 6 karakter.");

    const clean = String(token).trim().toUpperCase();
    const tok = db.query("SELECT * FROM registration_tokens WHERE token = ? COLLATE NOCASE").get(clean) as any;
    if (!tok) throw new Error("Token reset tidak valid.");
    if (tok.is_used) throw new Error("Token reset sudah pernah digunakan.");
    if (tok.token_type && tok.token_type !== "password_reset") {
      throw new Error("Token yang Anda masukkan adalah Token Pendaftaran Akun, bukan Token Reset Password.");
    }

    const q = String(identifier).trim();
    const customer = db.query(`
      SELECT * FROM customers
      WHERE customer_no = ? COLLATE NOCASE OR phone LIKE ? OR full_name LIKE ?
      LIMIT 1
    `).get(q, `%${q}%`, `%${q}%`) as any;
    if (!customer) throw new Error("Akun pelanggan dengan identitas tersebut tidak ditemukan.");

    // Server-side verification: NIK last-4 OR RT/RW match
    const actualNik = customer.nik || "";
    const actualRtRw = (customer.rt_rw || "").toLowerCase().replace(/\s+/g, "");
    const inputRtRw = String(rt_rw_answer || "").toLowerCase().replace(/\s+/g, "");
    const nikOk = !!(actualNik.length >= 4 && nik_last4 && String(nik_last4).trim() === actualNik.slice(-4));
    const rtOk = !!(actualRtRw && inputRtRw && (actualRtRw.includes(inputRtRw) || inputRtRw.includes(actualRtRw)));
    if (!nikOk && !rtOk) {
      logAudit(null, customer.customer_no, "RESET_PASSWORD_FAILED", "Verifikasi identitas reset sandi gagal.", clientIp(req));
      throw new Error("Jawaban verifikasi NIK atau RT/RW tidak cocok dengan data terdaftar.");
    }

    let user = customer.user_id
      ? db.query("SELECT * FROM users WHERE id = ?").get(customer.user_id) as any
      : db.query("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(customer.customer_no) as any;
    if (!user) throw new Error("Akun login untuk pelanggan ini tidak ditemukan. Hubungi admin.");

    const auth_ = hashPassword(String(new_password));
    db.run("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?", [auth_.hash, auth_.salt, now, user.id]);
    db.run("UPDATE registration_tokens SET is_used = 1, used_by_username = ?, used_at = ? WHERE id = ?", [user.username, now, tok.id]);
    logAudit(user.id, user.username, "RESET_PASSWORD", "Reset kata sandi mandiri via token berhasil.", clientIp(req));

    return { success: true, message: "Kata sandi berhasil diubah! Silakan login dengan kata sandi baru." };
  }

  // ========================================================================
  // 2. AUTHENTICATED ACTIONS
  // ========================================================================

  if (action === "verifyToken") {
    requireAuth(auth);
    return { success: true, valid: true, user: auth };
  }

  if (action === "changePassword") {
    const a = requireAuth(auth);
    const { old_password, new_password } = data;
    if (!new_password || String(new_password).length < 6) {
      throw new Error("Kata sandi baru minimal 6 karakter.");
    }
    const user = db.query("SELECT * FROM users WHERE id = ?").get(a.id) as any;
    if (!user) throw new Error("Pengguna tidak ditemukan.");

    // Verify old password before allowing change
    let oldValid = false;
    if (user.salt && user.salt !== "plain") {
      oldValid = hashPassword(String(old_password || ""), user.salt).hash === user.password_hash;
    }
    if (!oldValid) oldValid = user.password_hash === old_password;
    if (!oldValid) throw new Error("Kata sandi lama tidak cocok.");

    const auth_ = hashPassword(String(new_password));
    db.run("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?", [auth_.hash, auth_.salt, now, a.id]);
    logAudit(a.id, a.username, "CHANGE_PASSWORD", "Pengguna mengubah kata sandi akun.", clientIp(req));
    return { success: true, message: "Kata sandi berhasil diperbarui." };
  }

  // --- Dashboard summary ---
  if (action === "getDashboardSummary") {
    const a = requireAuth(auth);

    if (a.role === "customer") {
      const customerId = a.customerId;
      const customer = db.query(`
        SELECT c.*, t.name as tariff_name
        FROM customers c
        LEFT JOIN tariffs t ON c.tariff_id = t.id
        WHERE c.id = ?
      `).get(customerId) as any;

      const meter = db.query("SELECT * FROM meters WHERE customer_id = ? LIMIT 1").get(customerId) as any;
      const bills = db.query("SELECT * FROM bills WHERE customer_id = ? ORDER BY period_year DESC, period_month DESC").all(customerId) as any[];
      const payments = db.query("SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC LIMIT 5").all(customerId) as any[];
      const readings = db.query("SELECT * FROM meter_readings WHERE customer_id = ? ORDER BY period_year DESC, period_month DESC LIMIT 6").all(customerId) as any[];

      const activeBill = bills.find((b) => b.status !== "Lunas") || bills[0] || null;
      const totalUnpaid = bills.filter((b) => b.status !== "Lunas").reduce((sum, b) => sum + (b.balance_due || b.total_amount), 0);

      const usageHistory = readings.map((r) => ({
        period_name: `${r.period_month}/${r.period_year}`,
        usage_m3: r.usage_m3
      })).reverse();

      return {
        success: true,
        customer,
        meter,
        active_bill: activeBill,
        total_unpaid: totalUnpaid,
        recent_payments: payments,
        usage_history: usageHistory
      };
    }

    // Admin & Operator Dashboard
    const totalCustomers = (db.query("SELECT COUNT(*) as cnt FROM customers").get() as any)?.cnt || 0;
    const activeCustomers = (db.query("SELECT COUNT(*) as cnt FROM customers WHERE status = 'Aktif'").get() as any)?.cnt || 0;
    const totalMeters = (db.query("SELECT COUNT(*) as cnt FROM meters").get() as any)?.cnt || 0;

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const monthBilled = (db.query(`
      SELECT SUM(total_amount) as total, SUM(usage_m3) as usage
      FROM bills
      WHERE period_month = ? AND period_year = ?
    `).get(currentMonth, currentYear) as any) || {};

    const monthCollected = (db.query(`
      SELECT SUM(amount_paid) as total
      FROM payments
      WHERE payment_date LIKE ?
    `).get(`${currentYear}-${String(currentMonth).padStart(2, "0")}%`) as any)?.total || 0;

    const totalArrears = (db.query("SELECT SUM(balance_due) as total FROM bills WHERE status != 'Lunas'").get() as any)?.total || 0;
    const unpaidCount = (db.query("SELECT COUNT(*) as cnt FROM bills WHERE status != 'Lunas'").get() as any)?.cnt || 0;

    const recentPayments = db.query(`
      SELECT p.*, c.full_name as customer_name, c.customer_no, c.rt_rw, b.period_month, b.period_year, b.bill_no
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN bills b ON p.bill_id = b.id
      ORDER BY p.payment_date DESC
      LIMIT 6
    `).all() as any[];

    const recentReadings = db.query(`
      SELECT r.*, c.full_name as customer_name, c.customer_no, c.rt_rw
      FROM meter_readings r
      LEFT JOIN customers c ON r.customer_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 6
    `).all() as any[];

    // Monthly trends for 6 months
    const monthlyTrends: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const bStat = (db.query("SELECT SUM(total_amount) as billed, SUM(usage_m3) as usage FROM bills WHERE period_month = ? AND period_year = ?").get(m, y) as any) || {};
      const pStat = (db.query("SELECT SUM(amount_paid) as collected FROM payments WHERE payment_date LIKE ?").get(`${y}-${String(m).padStart(2, "0")}%`) as any) || {};

      monthlyTrends.push({
        period_name: `${m}/${y}`,
        month: m,
        year: y,
        total_billed: bStat.billed || 0,
        total_collected: pStat.collected || 0,
        usage_m3: bStat.usage || 0
      });
    }

    return {
      success: true,
      stats: {
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        total_meters: totalMeters,
        total_billed_this_month: monthBilled.total || 0,
        total_usage_this_month: monthBilled.usage || 0,
        total_collected_this_month: monthCollected,
        total_arrears: totalArrears,
        total_unpaid_bills: unpaidCount
      },
      monthly_trends: monthlyTrends,
      recent_payments: recentPayments,
      recent_readings: recentReadings
    };
  }

  // ========================================================================
  // 3. CUSTOMERS
  // ========================================================================
  if (action === "getCustomers") {
    const a = requireAuth(auth);
    let sql = `
      SELECT c.*, t.name as tariff_name, m.current_reading, m.brand as meter_brand
      FROM customers c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      LEFT JOIN meters m ON c.id = m.customer_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (a.role === "customer") {
      sql += " AND c.id = ?";
      params.push(a.customerId);
    } else {
      if (data.status) {
        sql += " AND c.status = ?";
        params.push(data.status);
      }
      if (data.rt_rw) {
        sql += " AND c.rt_rw = ?";
        params.push(data.rt_rw);
      }
      // Operator RT isolation
      if (a.role === "operator" && a.assignedRt && a.assignedRt !== "Semua RT") {
        sql += " AND c.rt_rw LIKE ?";
        params.push(`%${a.assignedRt.split("/")[0].trim()}%`);
      }
      if (data.search) {
        sql += " AND (c.full_name LIKE ? OR c.customer_no LIKE ? OR c.phone LIKE ?)";
        const q = `%${data.search}%`;
        params.push(q, q, q);
      }
    }

    sql += " ORDER BY c.customer_no ASC";
    const rows = db.query(sql).all(...params);
    return { success: true, customers: rows };
  }

  if (action === "getCustomerById") {
    const a = requireAuth(auth);
    const id = a.role === "customer" ? a.customerId : (data.id || data.customer_id);
    const customer = db.query(`
      SELECT c.*, t.name as tariff_name
      FROM customers c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE c.id = ?
    `).get(id) as any;
    if (!customer) throw new Error("Pelanggan tidak ditemukan.");

    const meter = db.query("SELECT * FROM meters WHERE customer_id = ? LIMIT 1").get(id) as any;
    const tariff = db.query("SELECT * FROM tariffs WHERE id = ?").get(customer.tariff_id) as any;
    return { success: true, customer, meter, tariff };
  }

  if (action === "createCustomer") {
    const a = requireAdmin(auth);
    const id = genId("CUST-ID");
    const custNo = data.customer_no || `CUST-${new Date().getFullYear()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    const dup = db.query("SELECT id FROM customers WHERE customer_no = ? COLLATE NOCASE").get(custNo) as any;
    if (dup) throw new Error(`Nomor pelanggan "${custNo}" sudah terdaftar.`);

    // Create linked user account with hashed default password
    const defaultAuth = hashPassword(data.password || "warga123");
    const userId = genId("USR-CUST");
    db.run(
      "INSERT INTO users (id, username, password_hash, salt, full_name, role, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'customer', ?, 1, ?, ?)",
      [userId, custNo.toLowerCase(), defaultAuth.hash, defaultAuth.salt, data.full_name, data.phone || "", now, now]
    );

    const meterNo = data.meter_no || `MTR-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    db.run(
      `INSERT INTO customers (id, customer_no, user_id, full_name, nik, phone, address, rt_rw, meter_no, current_reading, tariff_id, status,
        is_subsidized, subsidy_type, subsidy_max_amount, subsidy_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, custNo, userId, data.full_name, data.nik || "", data.phone || "", data.address || "",
        data.rt_rw || "RT 01 / RW 01", meterNo, Number(data.initial_reading || 0),
        data.tariff_id || "TRF-01", data.status || "Aktif",
        data.is_subsidized ? 1 : 0, data.is_subsidized ? (data.subsidy_type || "gratis") : "none",
        Number(data.subsidy_max_amount || 0), data.subsidy_notes || "", now, now
      ]
    );

    const initialReading = Number(data.initial_reading || 0);
    db.run(
      `INSERT INTO meters (id, meter_no, customer_id, brand, installation_date, initial_reading, current_reading, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?)`,
      [genId("MTR-ID"), meterNo, id, data.meter_brand || 'Onda SNI 1/2"', now.substring(0, 10), initialReading, initialReading, now, now]
    );

    logAudit(a.id, a.username, "CREATE_CUSTOMER", `Menambahkan pelanggan baru: ${data.full_name} (${custNo})`, clientIp(req));
    return { success: true, customer_id: id, customer_no: custNo };
  }

  if (action === "updateCustomer") {
    const a = requireAdmin(auth);
    const existing = db.query("SELECT * FROM customers WHERE id = ?").get(data.id) as any;
    if (!existing) throw new Error("Pelanggan tidak ditemukan.");

    db.run(
      `UPDATE customers
       SET full_name = ?, nik = ?, phone = ?, address = ?, rt_rw = ?, tariff_id = ?, status = ?,
           is_subsidized = ?, subsidy_type = ?, subsidy_max_amount = ?, subsidy_notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.full_name ?? existing.full_name, data.nik ?? (existing.nik || ""), data.phone ?? (existing.phone || ""),
        data.address ?? (existing.address || ""), data.rt_rw ?? (existing.rt_rw || ""),
        data.tariff_id || existing.tariff_id || "TRF-01", data.status || existing.status || "Aktif",
        data.is_subsidized !== undefined ? (data.is_subsidized ? 1 : 0) : (existing.is_subsidized ? 1 : 0),
        data.subsidy_type || existing.subsidy_type || "none",
        data.subsidy_max_amount !== undefined ? Number(data.subsidy_max_amount || 0) : Number(existing.subsidy_max_amount || 0),
        data.subsidy_notes ?? (existing.subsidy_notes || ""),
        now, data.id
      ]
    );

    // Keep linked customer login profile in sync
    if (existing.user_id) {
      db.run("UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?", [data.full_name ?? existing.full_name, data.phone ?? (existing.phone || ""), now, existing.user_id]);
    }

    logAudit(a.id, a.username, "UPDATE_CUSTOMER", `Memperbarui pelanggan: ${data.full_name || existing.full_name} (ID: ${data.id})`, clientIp(req));
    return { success: true };
  }

  if (action === "deleteCustomer") {
    const a = requireAdmin(auth);
    const existing = db.query("SELECT * FROM customers WHERE id = ?").get(data.id) as any;
    if (!existing) throw new Error("Pelanggan tidak ditemukan.");

    db.run("DELETE FROM meters WHERE customer_id = ?", [data.id]);
    db.run("DELETE FROM customers WHERE id = ?", [data.id]);
    if (existing.user_id) {
      db.run("DELETE FROM users WHERE id = ?", [existing.user_id]);
    }
    logAudit(a.id, a.username, "DELETE_CUSTOMER", `Menghapus pelanggan ID: ${data.id}`, clientIp(req));
    return { success: true };
  }

  // ========================================================================
  // 4. METERS (staff read, admin write)
  // ========================================================================
  if (action === "getMeters") {
    requireStaff(auth);
    let sql = `
      SELECT m.*, c.full_name as customer_name, c.customer_no
      FROM meters m
      LEFT JOIN customers c ON m.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (data.status) {
      sql += " AND m.status = ?";
      params.push(data.status);
    }
    if (data.search) {
      sql += " AND (m.meter_no LIKE ? OR c.full_name LIKE ?)";
      const q = `%${data.search}%`;
      params.push(q, q);
    }
    sql += " ORDER BY m.meter_no ASC";
    const meters = db.query(sql).all(...params);
    return { success: true, meters };
  }

  if (action === "createMeter") {
    requireAdmin(auth);
    const id = genId("MTR-ID");
    db.run(
      `INSERT INTO meters (id, meter_no, customer_id, brand, installation_date, initial_reading, current_reading, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.meter_no, data.customer_id || null, data.brand || 'Onda SNI 1/2"', data.installation_date || now.substring(0, 10), Number(data.initial_reading || 0), Number(data.current_reading || 0), data.status || "Aktif", now, now]
    );
    return { success: true, meter_id: id };
  }

  if (action === "updateMeter") {
    requireAdmin(auth);
    db.run(
      `UPDATE meters
       SET meter_no = ?, customer_id = ?, brand = ?, installation_date = ?, initial_reading = ?, current_reading = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [data.meter_no, data.customer_id || null, data.brand, data.installation_date, Number(data.initial_reading || 0), Number(data.current_reading || 0), data.status || "Aktif", now, data.id]
    );
    return { success: true };
  }

  if (action === "deleteMeter") {
    requireAdmin(auth);
    db.run("DELETE FROM meters WHERE id = ?", [data.id]);
    return { success: true };
  }

  // ========================================================================
  // 5. READINGS
  // ========================================================================
  if (action === "getReadings") {
    const a = requireAuth(auth);
    let sql = `
      SELECT r.*, c.full_name as customer_name, c.customer_no, c.rt_rw, u.full_name as reader_name
      FROM meter_readings r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON r.reader_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (a.role === "customer") {
      sql += " AND r.customer_id = ?";
      params.push(a.customerId);
    } else {
      if (data.customer_id) {
        sql += " AND r.customer_id = ?";
        params.push(data.customer_id);
      }
      if (data.rt_rw) {
        sql += " AND c.rt_rw = ?";
        params.push(data.rt_rw);
      }
      // Operator RT isolation
      if (a.role === "operator" && a.assignedRt && a.assignedRt !== "Semua RT") {
        sql += " AND c.rt_rw LIKE ?";
        params.push(`%${a.assignedRt.split("/")[0].trim()}%`);
      }
      if (data.period_month) {
        sql += " AND r.period_month = ?";
        params.push(Number(data.period_month));
      }
      if (data.period_year) {
        sql += " AND r.period_year = ?";
        params.push(Number(data.period_year));
      }
    }
    sql += " ORDER BY r.period_year DESC, r.period_month DESC, r.created_at DESC";
    const readings = db.query(sql).all(...params);
    return { success: true, readings };
  }

  if (action === "getPrevReading") {
    requireStaff(auth);
    const customer = db.query("SELECT * FROM customers WHERE id = ?").get(data.customer_id) as any;
    const meter = db.query("SELECT * FROM meters WHERE customer_id = ? LIMIT 1").get(data.customer_id) as any;
    const lastReading = db.query("SELECT * FROM meter_readings WHERE customer_id = ? ORDER BY period_year DESC, period_month DESC LIMIT 1").get(data.customer_id) as any;

    const prevReading = lastReading ? lastReading.current_reading : (meter ? meter.current_reading : 0);
    return {
      success: true,
      prev_reading: prevReading,
      meter_no: meter?.meter_no || customer?.meter_no || "-"
    };
  }

  if (action === "recordReading") {
    const a = requireStaff(auth);
    const { customer_id, period_month, period_year, prev_reading, current_reading, auto_generate_bill, notes } = data;

    const prevVal = Number(prev_reading);
    const currVal = Number(current_reading);
    if (Number.isNaN(prevVal) || Number.isNaN(currVal)) throw new Error("Angka stand meter harus berupa angka.");
    if (currVal < prevVal) throw new Error(`Stand meter baru (${currVal}) lebih kecil dari stand sebelumnya (${prevVal}). Periksa kembali catatan meter.`);

    const month = Number(period_month);
    const year = Number(period_year);
    if (!(month >= 1 && month <= 12)) throw new Error("Periode bulan tidak valid.");
    if (!(year >= 2000 && year <= 2100)) throw new Error("Periode tahun tidak valid.");

    // Prevent duplicate readings for the same period/customer
    const dupe = db.query("SELECT id FROM meter_readings WHERE customer_id = ? AND period_month = ? AND period_year = ?").get(customer_id, month, year) as any;
    if (dupe) throw new Error(`Pencatatan untuk periode ${month}/${year} pelanggan ini sudah ada. Gunakan menu Generate Tagihan bila tagihan belum terbit.`);

    const usageM3 = Math.max(0, currVal - prevVal);
    const readingId = genId("RDM");
    const readingNo = `RDM-${year}${String(month).padStart(2, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    const meter = db.query("SELECT id FROM meters WHERE customer_id = ? LIMIT 1").get(customer_id) as any;

    db.run(
      `INSERT INTO meter_readings (id, reading_no, customer_id, meter_id, period_month, period_year, prev_reading, current_reading, usage_m3, reading_date, reader_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [readingId, readingNo, customer_id, meter?.id || null, month, year, prevVal, currVal, usageM3, now.substring(0, 10), a.id, notes || "", now, now]
    );

    // Update meter current reading
    db.run("UPDATE meters SET current_reading = ?, updated_at = ? WHERE customer_id = ?", [currVal, now, customer_id]);

    let billInfo = null;
    if (auto_generate_bill) {
      const cust = db.query("SELECT tariff_id FROM customers WHERE id = ?").get(customer_id) as any;
      const tariff = db.query("SELECT * FROM tariffs WHERE id = ?").get(cust?.tariff_id || "TRF-01") as any;
      const adminFee = Number(getSetting("admin_fee_flat", "2500"));
      const subsidy = getCustomerSubsidy(customer_id);

      const breakdown = calculateTieredBill(usageM3, tariff, adminFee, subsidy);
      const billId = genId("INV");
      const billNo = `INV-${year}${String(month).padStart(2, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const dueDate = dueDateFor(month, year);
      const isFree = breakdown.total_amount === 0;

      const custFull = db.query("SELECT full_name, customer_no, rt_rw, phone FROM customers WHERE id = ?").get(customer_id) as any;

      db.run(
        `INSERT INTO bills (id, bill_no, customer_id, customer_name, customer_no, rt_rw, phone, reading_id, period_month, period_year,
          prev_reading, current_reading, usage_m3, base_amount, usage_amount, late_fee, admin_fee, original_amount, subsidy_amount,
          is_subsidized, subsidy_type, total_amount, paid_amount, balance_due, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          billId, billNo, customer_id, custFull?.full_name || "", custFull?.customer_no || "", custFull?.rt_rw || "", custFull?.phone || "",
          readingId, month, year, prevVal, currVal, usageM3, breakdown.base_fee, breakdown.usage_amount,
          breakdown.admin_fee, breakdown.original_amount, breakdown.subsidy_amount,
          breakdown.is_subsidized, breakdown.subsidy_type, breakdown.total_amount, breakdown.total_amount,
          dueDate, isFree ? "Lunas" : "Belum Dibayar", now, now
        ]
      );
      billInfo = { bill_id: billId, bill_no: billNo, total_amount: breakdown.total_amount };
    }

    logAudit(a.id, a.username, "RECORD_READING", `Mencatat meter: ${readingNo}, pemakaian: ${usageM3} m³`, clientIp(req));
    return { success: true, reading_id: readingId, reading_no: readingNo, bill: billInfo };
  }

  // ========================================================================
  // 6. BILLS
  // ========================================================================
  if (action === "getBills") {
    const a = requireAuth(auth);
    let sql = `
      SELECT b.*, c.full_name as customer_name, c.customer_no, c.rt_rw, c.address, c.phone, t.name as tariff_name
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (a.role === "customer") {
      sql += " AND b.customer_id = ?";
      params.push(a.customerId);
    } else {
      if (data.customer_id) {
        sql += " AND b.customer_id = ?";
        params.push(data.customer_id);
      }
      if (data.period_month) {
        sql += " AND b.period_month = ?";
        params.push(Number(data.period_month));
      }
      if (data.period_year) {
        sql += " AND b.period_year = ?";
        params.push(Number(data.period_year));
      }
      if (data.status) {
        sql += " AND b.status = ?";
        params.push(data.status);
      }
      // Operator RT isolation
      if (a.role === "operator" && a.assignedRt && a.assignedRt !== "Semua RT") {
        sql += " AND c.rt_rw LIKE ?";
        params.push(`%${a.assignedRt.split("/")[0].trim()}%`);
      }
      if (data.search) {
        sql += " AND (b.bill_no LIKE ? OR c.full_name LIKE ? OR c.customer_no LIKE ?)";
        const q = `%${data.search}%`;
        params.push(q, q, q);
      }
    }
    sql += " ORDER BY b.period_year DESC, b.period_month DESC, b.created_at DESC";
    const bills = db.query(sql).all(...params);
    return { success: true, bills };
  }

  if (action === "getBillById") {
    const a = requireAuth(auth);
    const billId = data.id || data.bill_id;
    const bill = db.query("SELECT * FROM bills WHERE id = ?").get(billId) as any;
    if (!bill) throw new Error("Tagihan tidak ditemukan.");
    if (a.role === "customer" && bill.customer_id !== a.customerId) {
      throw new Error("Akses ditolak.");
    }
    const customer = db.query("SELECT * FROM customers WHERE id = ?").get(bill.customer_id) as any;
    const tariff = db.query("SELECT * FROM tariffs WHERE id = ?").get(customer?.tariff_id) as any;
    const meter = db.query("SELECT * FROM meters WHERE customer_id = ? LIMIT 1").get(bill.customer_id) as any;
    const reading = db.query("SELECT * FROM meter_readings WHERE id = ?").get(bill.reading_id) as any;
    const payments = db.query("SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date ASC").all(billId) as any[];
    return { success: true, bill, customer, tariff, meter, reading, payments };
  }

  if (action === "generateBatchBills") {
    const a = requireStaff(auth);
    const month = Number(data.period_month || new Date().getMonth() + 1);
    const year = Number(data.period_year || new Date().getFullYear());
    if (!(month >= 1 && month <= 12)) throw new Error("Periode bulan tidak valid.");

    // Find readings in this period without an issued bill yet (active customers only)
    const readings = db.query(`
      SELECT r.*, c.tariff_id, c.full_name, c.customer_no, c.rt_rw, c.phone,
             c.is_subsidized, c.subsidy_type, c.subsidy_max_amount
      FROM meter_readings r
      JOIN customers c ON r.customer_id = c.id
      WHERE r.period_month = ? AND r.period_year = ?
        AND c.status = 'Aktif'
        AND r.id NOT IN (SELECT reading_id FROM bills WHERE reading_id IS NOT NULL)
    `).all(month, year) as any[];

    const adminFee = Number(getSetting("admin_fee_flat", "2500"));

    let count = 0;
    for (const r of readings) {
      const tariff = db.query("SELECT * FROM tariffs WHERE id = ?").get(r.tariff_id || "TRF-01") as any;
      const breakdown = calculateTieredBill(r.usage_m3, tariff, adminFee, {
        is_subsidized: r.is_subsidized,
        subsidy_type: r.subsidy_type,
        subsidy_max_amount: r.subsidy_max_amount
      });

      const billId = genId("INV");
      const billNo = `INV-${year}${String(month).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}-${crypto.randomBytes(1).toString("hex").toUpperCase()}`;
      const dueDate = dueDateFor(month, year);
      const isFree = breakdown.total_amount === 0;

      db.run(
        `INSERT INTO bills (id, bill_no, customer_id, customer_name, customer_no, rt_rw, phone, reading_id, period_month, period_year,
          prev_reading, current_reading, usage_m3, base_amount, usage_amount, late_fee, admin_fee, original_amount, subsidy_amount,
          is_subsidized, subsidy_type, total_amount, paid_amount, balance_due, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          billId, billNo, r.customer_id, r.full_name || "", r.customer_no || "", r.rt_rw || "", r.phone || "",
          r.id, month, year, r.prev_reading, r.current_reading, r.usage_m3,
          breakdown.base_fee, breakdown.usage_amount, breakdown.admin_fee, breakdown.original_amount,
          breakdown.subsidy_amount, breakdown.is_subsidized, breakdown.subsidy_type,
          breakdown.total_amount, breakdown.total_amount, dueDate,
          isFree ? "Lunas" : "Belum Dibayar", now, now
        ]
      );
      count++;
    }

    logAudit(a.id, a.username, "GENERATE_BATCH_BILLS", `Generate massal ${count} tagihan untuk periode ${month}/${year}`, clientIp(req));
    return { success: true, generated_count: count };
  }

  if (action === "updateBillStatus") {
    const a = requireStaff(auth);
    const bill = db.query("SELECT * FROM bills WHERE id = ?").get(data.id) as any;
    if (!bill) throw new Error("Tagihan tidak ditemukan.");
    const allowed = ["Belum Dibayar", "Sebagian Dibayar", "Lunas", "Jatuh Tempo"];
    if (!allowed.includes(data.status)) throw new Error("Status tagihan tidak valid.");
    db.run("UPDATE bills SET status = ?, updated_at = ? WHERE id = ?", [data.status, now, data.id]);
    logAudit(a.id, a.username, "UPDATE_BILL_STATUS", `Ubah status ${bill.bill_no} menjadi ${data.status}`, clientIp(req));
    return { success: true };
  }

  // ========================================================================
  // 7. PAYMENTS
  // ========================================================================
  if (action === "getPayments") {
    const a = requireAuth(auth);
    let sql = `
      SELECT p.*, c.full_name as customer_name, c.customer_no, c.rt_rw, b.bill_no, b.period_month, b.period_year, u.full_name as cashier_name
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN bills b ON p.bill_id = b.id
      LEFT JOIN users u ON p.cashier_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (a.role === "customer") {
      sql += " AND p.customer_id = ?";
      params.push(a.customerId);
    } else {
      if (data.customer_id) {
        sql += " AND p.customer_id = ?";
        params.push(data.customer_id);
      }
      if (data.payment_method) {
        sql += " AND p.payment_method = ?";
        params.push(data.payment_method);
      }
      if (data.search) {
        sql += " AND (p.payment_no LIKE ? OR b.bill_no LIKE ? OR c.full_name LIKE ?)";
        const q = `%${data.search}%`;
        params.push(q, q, q);
      }
    }
    sql += " ORDER BY p.payment_date DESC, p.created_at DESC";
    const payments = db.query(sql).all(...params);
    return { success: true, payments };
  }

  if (action === "recordPayment") {
    const a = requireStaff(auth);
    const { bill_id, amount_paid, payment_method, notes, payment_date } = data;
    const bill = db.query("SELECT * FROM bills WHERE id = ?").get(bill_id) as any;
    if (!bill) throw new Error("Tagihan tidak ditemukan.");
    if (bill.status === "Lunas") throw new Error("Tagihan ini sudah Lunas. Tidak ada saldo tertunggak.");

    const payAmount = Number(amount_paid);
    if (!Number.isFinite(payAmount) || payAmount <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");

    const balanceBefore = Math.max(0, Number(bill.balance_due ?? bill.total_amount - (bill.paid_amount || 0)));
    if (payAmount > balanceBefore) {
      throw new Error(`Jumlah pembayaran (Rp ${payAmount.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${balanceBefore.toLocaleString("id-ID")}).`);
    }

    const newPaidAmount = (bill.paid_amount || 0) + payAmount;
    const newBalance = Math.max(0, bill.total_amount - newPaidAmount);
    const newStatus = newBalance === 0 ? "Lunas" : "Sebagian Dibayar";

    db.run(
      "UPDATE bills SET paid_amount = ?, balance_due = ?, status = ?, updated_at = ? WHERE id = ?",
      [newPaidAmount, newBalance, newStatus, now, bill_id]
    );

    const payId = genId("PAY");
    const payNo = `PAY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const payDate = payment_date || now;

    db.run(
      `INSERT INTO payments (id, payment_no, bill_id, bill_no, period_month, period_year, customer_id, amount_paid, payment_date, payment_method, cashier_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payId, payNo, bill_id, bill.bill_no || "", bill.period_month, bill.period_year, bill.customer_id, payAmount, payDate, payment_method || "Tunai", a.id, notes || "", now, now]
    );

    // Fetch full payment info for receipt
    const payment = db.query(`
      SELECT p.*, c.full_name as customer_name, c.customer_no, c.rt_rw, b.bill_no, b.period_month, b.period_year, u.full_name as cashier_name
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN bills b ON p.bill_id = b.id
      LEFT JOIN users u ON p.cashier_id = u.id
      WHERE p.id = ?
    `).get(payId) as any;

    logAudit(a.id, a.username, "RECORD_PAYMENT", `Penerimaan pembayaran: ${payNo}, Rp ${payAmount}`, clientIp(req));
    return { success: true, payment_id: payId, payment_no: payNo, status: newStatus, payment, bill: { ...bill, paid_amount: newPaidAmount, balance_due: newBalance, status: newStatus } };
  }

  if (action === "getPaymentById") {
    const a = requireAuth(auth);
    const payId = data.id || data.payment_id;
    const payment = db.query("SELECT * FROM payments WHERE id = ?").get(payId) as any;
    if (!payment) throw new Error("Pembayaran tidak ditemukan.");
    if (a.role === "customer" && payment.customer_id !== a.customerId) throw new Error("Akses ditolak.");

    const bill = db.query("SELECT * FROM bills WHERE id = ?").get(payment.bill_id) as any;
    const customer = db.query("SELECT * FROM customers WHERE id = ?").get(payment.customer_id) as any;
    const meter = db.query("SELECT * FROM meters WHERE customer_id = ? LIMIT 1").get(payment.customer_id) as any;
    const cashier = db.query("SELECT full_name FROM users WHERE id = ?").get(payment.cashier_id) as any;

    return {
      success: true,
      payment,
      bill,
      customer,
      meter,
      cashier_name: cashier?.full_name || "Petugas Loket",
      village_info: Object.fromEntries((db.query("SELECT key, value FROM settings").all() as any[]).map((r) => [r.key, r.value]))
    };
  }

  // ========================================================================
  // 8. TARIFFS
  // ========================================================================
  if (action === "getTariffs") {
    requireAuth(auth);
    const tariffs = db.query("SELECT * FROM tariffs ORDER BY code ASC").all();
    return { success: true, tariffs };
  }

  if (action === "createTariff") {
    requireAdmin(auth);
    const id = genId("TRF");
    db.run(
      `INSERT INTO tariffs (id, code, name, category, base_fee, tier1_max, tier1_rate, tier2_max, tier2_rate, tier3_rate, late_fee, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, data.code, data.name, data.category || "Rumah Tangga", Number(data.base_fee), Number(data.tier1_max), Number(data.tier1_rate), Number(data.tier2_max), Number(data.tier2_rate), Number(data.tier3_rate), Number(data.late_fee || 5000), data.description || "", now, now]
    );
    logAudit(auth!.id, auth!.username, "CREATE_TARIFF", `Menambah golongan tarif: ${data.name}`, clientIp(req));
    return { success: true, tariff_id: id };
  }

  if (action === "updateTariff") {
    requireAdmin(auth);
    db.run(
      `UPDATE tariffs
       SET code = ?, name = ?, category = ?, base_fee = ?, tier1_max = ?, tier1_rate = ?, tier2_max = ?, tier2_rate = ?, tier3_rate = ?, late_fee = ?, description = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [data.code, data.name, data.category, Number(data.base_fee), Number(data.tier1_max), Number(data.tier1_rate), Number(data.tier2_max), Number(data.tier2_rate), Number(data.tier3_rate), Number(data.late_fee || 5000), data.description || "", data.is_active ? 1 : 0, now, data.id]
    );
    return { success: true };
  }

  // ========================================================================
  // 9. REPORTS (staff only)
  // ========================================================================
  if (action === "getBillingReport") {
    requireStaff(auth);
    const def = latestBillPeriod();
    const m = Number(data.period_month || def.month);
    const y = Number(data.period_year || def.year);
    const rows = db.query(`
      SELECT b.*, c.full_name as customer_name, c.customer_no, c.rt_rw
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.period_month = ? AND b.period_year = ?
      ORDER BY b.bill_no ASC
    `).all(m, y) as any[];

    for (const r of rows) r.period = `${m}/${y}`;

    const totalBilled = rows.reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalPaid = rows.reduce((s, r) => s + (r.paid_amount || 0), 0);
    const totalDue = rows.reduce((s, r) => s + (r.balance_due || 0), 0);
    const totalSubsidy = rows.reduce((s, r) => s + (r.subsidy_amount || 0), 0);

    return {
      success: true,
      summary: {
        period: `${m}/${y}`,
        total_bills: rows.length,
        total_billed: totalBilled,
        total_paid: totalPaid,
        total_balance_due: totalDue,
        total_subsidy: totalSubsidy
      },
      items: rows
    };
  }

  if (action === "getPaymentReport") {
    requireStaff(auth);
    let sql = `
      SELECT p.*, c.full_name as customer_name, c.customer_no
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (data.start_date) {
      sql += " AND p.payment_date >= ?";
      params.push(data.start_date);
    }
    if (data.end_date) {
      sql += " AND date(p.payment_date) <= date(?)";
      params.push(data.end_date);
    }
    if (data.payment_method) {
      sql += " AND p.payment_method = ?";
      params.push(data.payment_method);
    }
    sql += " ORDER BY p.payment_date DESC";
    const rows = db.query(sql).all(...params) as any[];
    const totalRevenue = rows.reduce((s, r) => s + (r.amount_paid || 0), 0);

    return {
      success: true,
      summary: { total_transactions: rows.length, total_revenue: totalRevenue },
      items: rows
    };
  }

  if (action === "getArrearsReport") {
    requireStaff(auth);
    const rows = db.query(`
      SELECT c.id, c.customer_no, c.full_name as customer_name, c.rt_rw, c.phone,
             COUNT(b.id) as unpaid_months_count,
             SUM(b.balance_due) as total_arrears
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.status != 'Lunas'
      GROUP BY c.id
      HAVING total_arrears > 0
      ORDER BY total_arrears DESC
    `).all() as any[];

    const totalArrears = rows.reduce((s, r) => s + (r.total_arrears || 0), 0);
    return {
      success: true,
      summary: { total_defaulters: rows.length, total_arrears_amount: totalArrears },
      items: rows
    };
  }

  if (action === "getUsageReport") {
    requireStaff(auth);
    const def = latestReadingPeriod();
    const m = Number(data.period_month || def.month);
    const y = Number(data.period_year || def.year);
    const rows = db.query(`
      SELECT r.*, c.full_name as customer_name, c.customer_no, c.rt_rw
      FROM meter_readings r
      JOIN customers c ON r.customer_id = c.id
      WHERE r.period_month = ? AND r.period_year = ?
      ORDER BY r.usage_m3 DESC
    `).all(m, y) as any[];

    for (const r of rows) r.period = `${m}/${y}`;

    const totalUsage = rows.reduce((s, r) => s + (r.usage_m3 || 0), 0);
    const avgUsage = rows.length > 0 ? (totalUsage / rows.length).toFixed(1) : "0";

    return {
      success: true,
      summary: { period: `${m}/${y}`, total_usage_m3: totalUsage, avg_usage_m3: avgUsage },
      items: rows
    };
  }

  // ========================================================================
  // 10. SETTINGS & USERS
  // ========================================================================
  if (action === "getSettings") {
    requireAuth(auth);
    const rows = db.query("SELECT key, value FROM settings").all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return { success: true, settings };
  }

  if (action === "updateSettings") {
    const a = requireAdmin(auth);
    const settings = data.settings || data;
    const upsert = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at");
    for (const [k, v] of Object.entries(settings)) {
      if (typeof v === "string" || typeof v === "number") {
        upsert.run(k, String(v), now);
      }
    }
    logAudit(a.id, a.username, "UPDATE_SETTINGS", "Memperbarui konfigurasi sistem.", clientIp(req));
    return { success: true };
  }

  if (action === "getUsers") {
    requireAdmin(auth);
    const users = db.query("SELECT id, username, full_name, role, email, phone, assigned_rt, is_active, created_at, updated_at FROM users").all();
    return { success: true, users };
  }

  if (action === "createUser") {
    const a = requireAdmin(auth);
    if (!data.username || !data.full_name) throw new Error("Username dan nama lengkap wajib diisi.");
    const cleanUsername = String(data.username).trim().toLowerCase();
    const dup = db.query("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(cleanUsername) as any;
    if (dup) throw new Error(`Username "${data.username}" sudah digunakan.`);

    const role = ["admin", "operator"].includes(data.role) ? data.role : "operator";
    const id = genId("USR");
    const auth_ = hashPassword(data.password || "operator123");
    db.run(
      "INSERT INTO users (id, username, password_hash, salt, full_name, role, assigned_rt, email, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      [id, cleanUsername, auth_.hash, auth_.salt, data.full_name, role, data.assigned_rt || "", data.email || "", data.phone || "", now, now]
    );
    logAudit(a.id, a.username, "CREATE_USER", `Menambah pengguna ${cleanUsername} (${role})`, clientIp(req));
    return { success: true, user_id: id };
  }

  if (action === "updateUser") {
    const a = requireAdmin(auth);
    const existing = db.query("SELECT * FROM users WHERE id = ?").get(data.id) as any;
    if (!existing) throw new Error("Pengguna tidak ditemukan.");
    if (existing.role === "admin" && data.is_active === false && existing.id === a.id) {
      throw new Error("Tidak dapat menonaktifkan akun sendiri.");
    }
    db.run(
      "UPDATE users SET full_name = ?, role = ?, assigned_rt = ?, email = ?, phone = ?, is_active = ?, updated_at = ? WHERE id = ?",
      [
        data.full_name ?? existing.full_name,
        ["admin", "operator", "customer"].includes(data.role) ? data.role : existing.role,
        data.assigned_rt ?? (existing.assigned_rt || ""),
        data.email ?? (existing.email || ""),
        data.phone ?? (existing.phone || ""),
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : (existing.is_active ? 1 : 0),
        now, data.id
      ]
    );
    logAudit(a.id, a.username, "UPDATE_USER", `Memperbarui pengguna ${existing.username}`, clientIp(req));
    return { success: true };
  }

  if (action === "deleteUser") {
    const a = requireAdmin(auth);
    const existing = db.query("SELECT * FROM users WHERE id = ?").get(data.id) as any;
    if (!existing) throw new Error("Pengguna tidak ditemukan.");
    if (existing.id === a.id) throw new Error("Tidak dapat menghapus akun sendiri.");
    db.run("DELETE FROM users WHERE id = ?", [data.id]);
    logAudit(a.id, a.username, "DELETE_USER", `Menghapus pengguna ${existing.username}`, clientIp(req));
    return { success: true };
  }

  if (action === "resetUserPassword") {
    const a = requireAdmin(auth);
    const target = db.query("SELECT * FROM users WHERE id = ?").get(data.user_id || data.id) as any;
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    const newPassword = data.new_password || "sandmosquito123";
    const auth_ = hashPassword(String(newPassword));
    db.run("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?", [auth_.hash, auth_.salt, now, target.id]);
    logAudit(a.id, a.username, "RESET_USER_PASSWORD", `Reset sandi pengguna ${target.username}`, clientIp(req));
    return { success: true, new_password: newPassword };
  }

  if (action === "getAuditLogs") {
    requireAdmin(auth);
    let sql = "SELECT * FROM audit_logs WHERE 1=1";
    const params: any[] = [];
    if (data.action) {
      sql += " AND action = ?";
      params.push(data.action);
    }
    if (data.search) {
      sql += " AND (username LIKE ? OR details LIKE ?)";
      const q = `%${data.search}%`;
      params.push(q, q);
    }
    sql += " ORDER BY created_at DESC LIMIT 200";
    const logs = db.query(sql).all(...params);
    return { success: true, logs };
  }

  // ========================================================================
  // 11. ANNOUNCEMENTS
  // ========================================================================
  if (action === "getAnnouncements") {
    const a = requireAuth(auth);
    let sql = "SELECT * FROM announcements WHERE 1=1";
    const params: any[] = [];
    if (a.role === "customer") {
      sql += " AND (target_audience = 'all' OR target_audience = 'customer')";
    } else if (data.target_audience && data.target_audience !== "all") {
      sql += " AND (target_audience = 'all' OR target_audience = ?)";
      params.push(data.target_audience);
    }
    if (data.active_only || a.role === "customer") {
      sql += " AND is_active = 1";
    }
    sql += " ORDER BY created_at DESC";
    const announcements = db.query(sql).all(...params);
    return { success: true, announcements };
  }

  if (action === "createAnnouncement") {
    const a = requireAdmin(auth);
    const id = genId("ANN");
    db.run(
      `INSERT INTO announcements (id, title, content, target_audience, priority, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.title, data.content, data.target_audience || "all", data.priority || "normal", data.is_active === false ? 0 : 1, a.fullName || "Administrator", now, now]
    );
    return { success: true, announcement_id: id };
  }

  if (action === "updateAnnouncement") {
    requireAdmin(auth);
    db.run(
      "UPDATE announcements SET title = ?, content = ?, target_audience = ?, priority = ?, is_active = ?, updated_at = ? WHERE id = ?",
      [data.title, data.content, data.target_audience || "all", data.priority || "normal", data.is_active ? 1 : 0, now, data.id]
    );
    return { success: true };
  }

  if (action === "deleteAnnouncement") {
    requireAdmin(auth);
    db.run("DELETE FROM announcements WHERE id = ?", [data.id]);
    return { success: true };
  }

  // ========================================================================
  // 12. COMPLAINTS
  // ========================================================================
  if (action === "getComplaints") {
    const a = requireAuth(auth);
    let sql = "SELECT * FROM complaints WHERE 1=1";
    const params: any[] = [];
    if (a.role === "customer") {
      sql += " AND customer_id = ?";
      params.push(a.customerId);
    } else {
      if (data.customer_id) {
        sql += " AND customer_id = ?";
        params.push(data.customer_id);
      }
      if (data.status) {
        sql += " AND status = ?";
        params.push(data.status);
      }
      if (data.category) {
        sql += " AND category = ?";
        params.push(data.category);
      }
      if (data.search) {
        sql += " AND (title LIKE ? OR customer_name LIKE ? OR complaint_no LIKE ?)";
        const q = `%${data.search}%`;
        params.push(q, q, q);
      }
    }
    sql += " ORDER BY created_at DESC";
    const complaints = db.query(sql).all(...params);
    return { success: true, complaints };
  }

  if (action === "createComplaint") {
    const a = requireAuth(auth);
    // Customers may only file complaints for themselves
    let customerId = data.customer_id;
    let customerName = data.customer_name;
    let customerNo = data.customer_no;
    if (a.role === "customer") {
      const own = db.query("SELECT id, full_name, customer_no, phone FROM customers WHERE id = ?").get(a.customerId) as any;
      customerId = own?.id;
      customerName = own?.full_name;
      customerNo = own?.customer_no;
    } else if (!customerId || !customerName) {
      const c = db.query("SELECT id, full_name, customer_no, phone FROM customers WHERE id = ?").get(customerId) as any;
      customerName = customerName || c?.full_name || "";
      customerNo = customerNo || c?.customer_no || "";
    }
    if (!customerId) throw new Error("Pelanggan tidak dikenali. Lengkapi data pelanggan pada formulir.");

    const id = genId("CMP");
    const complaintNo = `LAP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    db.run(
      `INSERT INTO complaints (id, complaint_no, customer_id, customer_name, customer_no, phone, title, description, category, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu', ?, ?)`,
      [id, complaintNo, customerId, customerName || "", customerNo || "", data.phone || "", data.title, data.description, data.category || "lainnya", now, now]
    );
    logAudit(a.id, a.username, "CREATE_COMPLAINT", `Pengaduan baru: ${complaintNo}`, clientIp(req));
    return { success: true, complaint_id: id, complaint_no: complaintNo };
  }

  if (action === "updateComplaintStatus") {
    const a = requireStaff(auth);
    const allowed = ["Menunggu", "Diproses", "Selesai", "Ditolak"];
    if (!allowed.includes(data.status)) throw new Error("Status pengaduan tidak valid.");
    db.run(
      "UPDATE complaints SET status = ?, response_notes = ?, handled_by = ?, updated_at = ? WHERE id = ?",
      [data.status, data.response_notes || "", a.fullName || "Petugas", now, data.id]
    );
    logAudit(a.id, a.username, "UPDATE_COMPLAINT", `Ubah status pengaduan ${data.id} -> ${data.status}`, clientIp(req));
    return { success: true };
  }

  // ========================================================================
  // 13. SUBSCRIPTION REQUESTS
  // ========================================================================
  if (action === "getSubscriptionRequests") {
    const a = requireAuth(auth);
    let sql = "SELECT * FROM subscription_requests WHERE 1=1";
    const params: any[] = [];
    if (a.role === "customer") {
      sql += " AND customer_id = ?";
      params.push(a.customerId);
    } else if (data.customer_id) {
      sql += " AND customer_id = ?";
      params.push(data.customer_id);
    }
    if (data.status) {
      sql += " AND status = ?";
      params.push(data.status);
    }
    sql += " ORDER BY created_at DESC";
    const requests = db.query(sql).all(...params);
    return { success: true, requests };
  }

  if (action === "createSubscriptionRequest") {
    const a = requireAuth(auth);
    let customerId = data.customer_id;
    let customerName = data.customer_name;
    let customerNo = data.customer_no;
    if (a.role === "customer") {
      const own = db.query("SELECT id, full_name, customer_no FROM customers WHERE id = ?").get(a.customerId) as any;
      customerId = own?.id;
      customerName = own?.full_name;
      customerNo = own?.customer_no;
    }
    if (!customerId) throw new Error("Pelanggan tidak dikenali.");

    const id = genId("REQ");
    const requestNo = `AJU-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    db.run(
      `INSERT INTO subscription_requests (id, request_no, customer_id, customer_name, customer_no, phone, current_tariff_id, current_tariff_name, requested_tariff_id, requested_tariff_name, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu', ?, ?)`,
      [id, requestNo, customerId, customerName || "", customerNo || "", data.phone || "", data.current_tariff_id || "", data.current_tariff_name || "", data.requested_tariff_id, data.requested_tariff_name, data.reason, now, now]
    );
    return { success: true, request_id: id, request_no: requestNo };
  }

  if (action === "updateSubscriptionRequestStatus") {
    const a = requireAdmin(auth);
    const allowed = ["Menunggu", "Disetujui", "Ditolak"];
    if (!allowed.includes(data.status)) throw new Error("Status pengajuan tidak valid.");

    const reqRow = db.query("SELECT * FROM subscription_requests WHERE id = ?").get(data.id) as any;
    if (!reqRow) throw new Error("Pengajuan tidak ditemukan.");

    db.run(
      "UPDATE subscription_requests SET status = ?, response_notes = ?, handled_by = ?, updated_at = ? WHERE id = ?",
      [data.status, data.response_notes || "", a.fullName || "Administrator", now, data.id]
    );

    // Approval applies requested tariff to the customer
    if (data.status === "Disetujui") {
      db.run(
        "UPDATE customers SET tariff_id = ?, updated_at = ? WHERE id = ?",
        [reqRow.requested_tariff_id, now, reqRow.customer_id]
      );
    }
    logAudit(a.id, a.username, "UPDATE_SUBSCRIPTION_REQUEST", `Pengajuan ${reqRow.request_no}: ${data.status}`, clientIp(req));
    return { success: true };
  }

  // ========================================================================
  // 14. REGISTRATION TOKENS (admin manage, staff view)
  // ========================================================================
  if (action === "getRegistrationTokens") {
    requireStaff(auth);
    const tokens = db.query("SELECT * FROM registration_tokens ORDER BY created_at DESC").all();
    return { success: true, tokens };
  }

  if (action === "createRegistrationToken") {
    requireAdmin(auth);
    const id = genId("TOK");
    const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    const tokenValue = String(data.token || "").trim().toUpperCase() ||
      (data.token_type === "password_reset" ? `RST-${randomSuffix}` : `DESA-${randomSuffix}`);

    const dup = db.query("SELECT id FROM registration_tokens WHERE token = ? COLLATE NOCASE").get(tokenValue) as any;
    if (dup) throw new Error(`Token "${tokenValue}" sudah ada. Gunakan kode lain.`);

    db.run(
      `INSERT INTO registration_tokens (id, token, token_type, recipient_name, target_role, default_tariff_id, is_used, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, tokenValue, data.token_type || "registration", data.recipient_name || "", data.target_role || "customer",
       data.token_type === "password_reset" ? "" : (data.default_tariff_id || "TRF-01"), data.notes || "", now]
    );
    logAudit(auth!.id, auth!.username, "CREATE_TOKEN", `Menerbitkan token ${tokenValue}`, clientIp(req));
    const created = db.query("SELECT * FROM registration_tokens WHERE id = ?").get(id) as any;
    return { success: true, token: created };
  }

  if (action === "deleteRegistrationToken") {
    requireAdmin(auth);
    db.run("DELETE FROM registration_tokens WHERE id = ?", [data.id]);
    return { success: true };
  }

  // ========================================================================
  // 15. MAINTENANCE EXPENSES
  // ========================================================================
  if (action === "getMaintenanceExpenses") {
    requireStaff(auth);
    let sql = "SELECT * FROM maintenance_expenses WHERE 1=1";
    const params: any[] = [];
    if (data.category) {
      sql += " AND category = ?";
      params.push(data.category);
    }
    if (data.start_date) {
      sql += " AND expense_date >= ?";
      params.push(data.start_date);
    }
    if (data.end_date) {
      sql += " AND expense_date <= ?";
      params.push(data.end_date);
    }
    sql += " ORDER BY expense_date DESC, created_at DESC";
    const expenses = db.query(sql).all(...params);
    return { success: true, expenses };
  }

  if (action === "createMaintenanceExpense") {
    const a = requireStaff(auth);
    const count = ((db.query("SELECT COUNT(*) as cnt FROM maintenance_expenses").get() as any)?.cnt || 0) + 1;
    const expenseNo = `MNT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(count).padStart(3, "0")}`;
    const id = genId("EXP");
    db.run(
      `INSERT INTO maintenance_expenses (id, expense_no, category, title, description, amount, expense_date, recorded_by, receipt_photo_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, expenseNo, data.category || "Perbaikan Pipa & Kebocoran", data.title || "Biaya Pemeliharaan Air", data.description || "", Number(data.amount || 0), data.expense_date || now.substring(0, 10), data.recorded_by || a.fullName || "Admin BUMDes", data.receipt_photo_url || "", now]
    );
    logAudit(a.id, a.username, "CREATE_EXPENSE", `Biaya pemeliharaan ${expenseNo}: Rp ${Number(data.amount || 0).toLocaleString("id-ID")}`, clientIp(req));
    const created = db.query("SELECT * FROM maintenance_expenses WHERE id = ?").get(id) as any;
    return { success: true, expense: created };
  }

  if (action === "deleteMaintenanceExpense") {
    requireAdmin(auth);
    db.run("DELETE FROM maintenance_expenses WHERE id = ?", [data.id]);
    return { success: true };
  }

  throw new Error(`Aksi '${action}' tidak dikenali.`);
}

// Helper placed after handler use is fine in ESM (function hoisting).
function latestReadingPeriod(): { month: number; year: number } {
  const row = db.query(
    "SELECT period_month as m, period_year as y FROM meter_readings ORDER BY period_year DESC, period_month DESC LIMIT 1"
  ).get() as any;
  if (row?.m && row?.y) return { month: Number(row.m), year: Number(row.y) };
  return latestBillPeriod();
}

// ---------------------------------------------------------------------------
// HTTP Server for Bun
// ---------------------------------------------------------------------------
const distRoot = path.resolve(process.cwd(), "dist");

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Set CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check / Database info endpoint
    if (url.pathname === "/health" || url.pathname === "/info") {
      const stats = {
        status: "online",
        engine: "SQLite (sandmosquito.db)",
        tables: {
          users: (db.query("SELECT COUNT(*) as c FROM users").get() as any)?.c,
          customers: (db.query("SELECT COUNT(*) as c FROM customers").get() as any)?.c,
          meters: (db.query("SELECT COUNT(*) as c FROM meters").get() as any)?.c,
          bills: (db.query("SELECT COUNT(*) as c FROM bills").get() as any)?.c,
          payments: (db.query("SELECT COUNT(*) as c FROM payments").get() as any)?.c
        },
        time: new Date().toISOString()
      };
      return new Response(JSON.stringify(stats), { headers: corsHeaders });
    }

    // Static Asset & SPA Fallback for GET requests (prevents 404 on refresh)
    if (req.method === "GET" && !url.pathname.startsWith("/api") && !url.searchParams.has("action")) {
      // Path-traversal protection: decode, normalize, and confine inside dist/
      let reqPath = "/";
      try {
        reqPath = decodeURIComponent(url.pathname);
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Path tidak valid." }), { status: 400, headers: corsHeaders });
      }
      reqPath = reqPath.replace(/\\/g, "/");
      if (reqPath.includes("..") || reqPath.includes("\u0000")) {
        return new Response(JSON.stringify({ success: false, error: "Path ditolak." }), { status: 403, headers: corsHeaders });
      }

      const relative = reqPath === "/" ? "/index.html" : reqPath;
      const absTarget = path.resolve(distRoot, "." + relative);
      if (!absTarget.startsWith(distRoot)) {
        return new Response(JSON.stringify({ success: false, error: "Path ditolak." }), { status: 403, headers: corsHeaders });
      }

      const targetFile = Bun.file(absTarget);
      if (await targetFile.exists()) {
        return new Response(targetFile);
      }

      // If route is an SPA subroute (e.g., /admin/dashboard, /login), serve index.html
      const spaIndex = Bun.file(path.resolve(distRoot, "index.html"));
      if (await spaIndex.exists()) {
        return new Response(spaIndex, {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }

    try {
      let body: any = {};
      if (req.method === "POST") {
        const rawText = await req.text();
        if (rawText) {
          try {
            body = JSON.parse(rawText);
          } catch {
            body = {};
          }
        }
      }

      // Extract action
      const action = body.action || url.searchParams.get("action") || url.pathname.replace(/^\/(api\/)?/, "");
      const auth = verifyAuthToken(req);

      const result = await handleApiAction(action, body, auth, req);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: err.message || "Internal Server Error"
        }),
        { status: 400, headers: corsHeaders }
      );
    }
  }
});

console.log(`🚀 Server SQLite Sandmosquito Water Billing berjalan di: http://localhost:${server.port}`);
console.log(`📁 File Database SQLite: sandmosquito.db`);
