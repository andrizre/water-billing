import { db, initDatabase, hashPassword } from "./db";
import crypto from "crypto";

// Initialize SQLite Tables & Seed Data
initDatabase();

const PORT = Number(process.env.PORT || 3001);

// Simple Token Store for Local Auth
const activeTokens = new Map<string, { id: string; username: string; role: string; customerId?: string; fullName: string }>();

function generateToken(user: any): string {
  const token = `sql_token_${crypto.randomBytes(24).toString("hex")}`;
  activeTokens.set(token, {
    id: user.id,
    username: user.username,
    role: user.role,
    customerId: user.customerId,
    fullName: user.full_name
  });
  return token;
}

function verifyAuthToken(req: Request): { id: string; username: string; role: string; customerId?: string; fullName: string } | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return activeTokens.get(token) || null;
}

function logAudit(userId: string | null, username: string, action: string, details: string, ip = "127.0.0.1") {
  const id = `LOG-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();
  db.run(
    "INSERT INTO audit_logs (id, user_id, username, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, userId, username, action, details, ip, now]
  );
}

// Calculate tiered bill breakdown
function calculateTieredBill(usageM3: number, tariff: any) {
  const baseFee = Number(tariff.base_fee || 0);
  const tier1Max = Number(tariff.tier1_max || 10);
  const tier1Rate = Number(tariff.tier1_rate || 2000);
  const tier2Max = Number(tariff.tier2_max || 20);
  const tier2Rate = Number(tariff.tier2_rate || 3000);
  const tier3Rate = Number(tariff.tier3_rate || 5000);

  let remaining = Math.max(0, usageM3);
  let tier1Usage = 0;
  let tier2Usage = 0;
  let tier3Usage = 0;

  if (remaining > 0) {
    tier1Usage = Math.min(remaining, tier1Max);
    remaining -= tier1Usage;
  }

  if (remaining > 0) {
    const tier2Capacity = tier2Max - tier1Max;
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
  const totalAmount = baseFee + usageAmount;

  return {
    base_fee: baseFee,
    tier1_usage: tier1Usage,
    tier1_amount: tier1Amount,
    tier2_usage: tier2Usage,
    tier2_amount: tier2Amount,
    tier3_usage: tier3Usage,
    tier3_amount: tier3Amount,
    usage_amount: usageAmount,
    total_amount: totalAmount
  };
}

// Universal Request Handler
async function handleApiAction(action: string, data: any, auth: any): Promise<any> {
  const now = new Date().toISOString();

  // 1. PUBLIC ACTIONS
  if (action === "publicCheckBill") {
    const query = String(data.customer_no || "").trim();
    if (!query) throw new Error("Nomor pelanggan harus diisi.");

    const customer = db.query(`
      SELECT c.*, t.name as tariff_name
      FROM customers c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE c.customer_no = ? OR c.full_name LIKE ?
      LIMIT 1
    `).get(query, `%${query}%`) as any;

    if (!customer) throw new Error("Pelanggan dengan nomor/nama tersebut tidak ditemukan.");

    const bills = db.query(`
      SELECT * FROM bills
      WHERE customer_id = ?
      ORDER BY period_year DESC, period_month DESC
    `).all(customer.id) as any[];

    const meter = db.query("SELECT * FROM meters WHERE customer_id = ? LIMIT 1").get(customer.id) as any;

    const totalUnpaid = bills
      .filter((b) => b.status !== "Lunas")
      .reduce((sum, b) => sum + (b.balance_due || b.total_amount), 0);

    return {
      success: true,
      customer,
      meter,
      bills,
      total_unpaid_amount: totalUnpaid
    };
  }

  // 2. AUTHENTICATION
  if (action === "login") {
    const { username, password } = data;
    if (!username || !password) throw new Error("Username dan kata sandi wajib diisi.");

    // Check user by username or customer_no
    let user = db.query("SELECT * FROM users WHERE username = ?").get(username) as any;

    // Check if username is a customer_no
    if (!user) {
      const cust = db.query("SELECT * FROM customers WHERE customer_no = ?").get(username) as any;
      if (cust && cust.user_id) {
        user = db.query("SELECT * FROM users WHERE id = ?").get(cust.user_id) as any;
      }
    }

    if (!user) throw new Error("Pengguna atau nomor pelanggan tidak ditemukan.");
    if (!user.is_active) throw new Error("Akun ini telah dinonaktifkan oleh administrator.");

    // Verify Password
    const { hash } = hashPassword(password, user.salt);
    if (hash !== user.password_hash) {
      throw new Error("Kata sandi salah. Silakan coba lagi.");
    }

    // Lookup customer ID if customer
    let customerId: string | undefined;
    if (user.role === "customer") {
      const cust = db.query("SELECT id FROM customers WHERE user_id = ? OR customer_no = ?").get(user.id, user.username) as any;
      customerId = cust?.id;
    }

    const token = generateToken({ ...user, customerId });
    logAudit(user.id, user.username, "LOGIN", "Login berhasil ke sistem SQLite");

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        customerId
      }
    };
  }

  if (action === "verifyToken") {
    if (!auth) throw new Error("Sesi tidak valid atau telah berakhir.");
    return {
      success: true,
      valid: true,
      user: auth
    };
  }

  if (action === "changePassword") {
    if (!auth) throw new Error("Diperlukan autentikasi.");
    const { old_password, new_password } = data;
    if (!new_password || new_password.length < 6) throw new Error("Password baru minimal 6 karakter.");

    const user = db.query("SELECT * FROM users WHERE id = ?").get(auth.id) as any;
    if (!user) throw new Error("Pengguna tidak ditemukan.");

    const { hash } = hashPassword(old_password, user.salt);
    if (hash !== user.password_hash) throw new Error("Kata sandi lama tidak cocok.");

    const updated = hashPassword(new_password);
    db.run("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?", [updated.hash, updated.salt, now, auth.id]);
    logAudit(auth.id, auth.username, "CHANGE_PASSWORD", "Pengguna mengubah kata sandi akun.");

    return { success: true, message: "Kata sandi berhasil diperbarui." };
  }

  // 3. DASHBOARD SUMMARY
  if (action === "getDashboardSummary") {
    if (!auth) throw new Error("Diperlukan autentikasi.");

    if (auth.role === "customer") {
      const customerId = auth.customerId;
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
        total_unpaid,
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
        total_arrears: totalArrears
      },
      monthly_trends: monthlyTrends,
      recent_payments: recentPayments,
      recent_readings: recentReadings
    };
  }

  // 4. CUSTOMERS CRUD
  if (action === "getCustomers") {
    let sql = `
      SELECT c.*, t.name as tariff_name, m.current_reading, m.brand as meter_brand
      FROM customers c
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      LEFT JOIN meters m ON c.id = m.customer_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Backend Isolation for Customer
    if (auth?.role === "customer") {
      sql += " AND c.id = ?";
      params.push(auth.customerId);
    } else {
      if (data.status) {
        sql += " AND c.status = ?";
        params.push(data.status);
      }
      if (data.rt_rw) {
        sql += " AND c.rt_rw = ?";
        params.push(data.rt_rw);
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
    const id = data.id || auth?.customerId;
    const customer = db.query("SELECT * FROM customers WHERE id = ?").get(id) as any;
    if (!customer) throw new Error("Pelanggan tidak ditemukan.");

    const meter = db.query("SELECT * FROM meters WHERE customer_id = ?").get(id) as any;
    const tariff = db.query("SELECT * FROM tariffs WHERE id = ?").get(customer.tariff_id) as any;
    return { success: true, customer, meter, tariff };
  }

  if (action === "createCustomer") {
    if (auth?.role !== "admin") throw new Error("Hanya admin yang dapat menambah pelanggan.");
    const id = `CUST-ID-${Date.now().toString().slice(-6)}`;
    const custNo = data.customer_no || `CUST-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const userId = `USR-CUST-${Date.now().toString().slice(-4)}`;

    // Create User Account
    const defaultAuth = hashPassword("warga123");
    db.run(
      "INSERT INTO users (id, username, password_hash, salt, full_name, role, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'customer', ?, 1, ?, ?)",
      [userId, custNo, defaultAuth.hash, defaultAuth.salt, data.full_name, data.phone || "", now, now]
    );

    const meterNo = data.meter_no || `MTR-${Date.now().toString().slice(-4)}`;

    // Create Customer
    db.run(
      `INSERT INTO customers (id, customer_no, user_id, full_name, nik, phone, address, rt_rw, meter_no, tariff_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?)`,
      [id, custNo, userId, data.full_name, data.nik || "", data.phone || "", data.address || "", data.rt_rw || "RT 01 / RW 01", meterNo, data.tariff_id || "TRF-01", now, now]
    );

    // Create Linked Meter
    const initialReading = Number(data.initial_reading || 0);
    db.run(
      `INSERT INTO meters (id, meter_no, customer_id, brand, installation_date, initial_reading, current_reading, status, created_at, updated_at)
       VALUES (?, ?, ?, 'Onda SNI 1/2"', ?, ?, ?, 'Aktif', ?, ?)`,
      [`MTR-ID-${Date.now().toString().slice(-4)}`, meterNo, id, now.substring(0, 10), initialReading, initialReading, now, now]
    );

    logAudit(auth.id, auth.username, "CREATE_CUSTOMER", `Menambahkan pelanggan baru: ${data.full_name} (${custNo})`);
    return { success: true, customer_id: id, customer_no: custNo };
  }

  if (action === "updateCustomer") {
    if (auth?.role !== "admin") throw new Error("Akses ditolak.");
    db.run(
      `UPDATE customers
       SET full_name = ?, nik = ?, phone = ?, address = ?, rt_rw = ?, tariff_id = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [data.full_name, data.nik || "", data.phone || "", data.address || "", data.rt_rw || "", data.tariff_id || "TRF-01", data.status || "Aktif", now, data.id]
    );
    logAudit(auth.id, auth.username, "UPDATE_CUSTOMER", `Memperbarui pelanggan: ${data.full_name} (ID: ${data.id})`);
    return { success: true };
  }

  if (action === "deleteCustomer") {
    if (auth?.role !== "admin") throw new Error("Akses ditolak.");
    db.run("DELETE FROM customers WHERE id = ?", [data.id]);
    db.run("DELETE FROM meters WHERE customer_id = ?", [data.id]);
    logAudit(auth.id, auth.username, "DELETE_CUSTOMER", `Menghapus pelanggan ID: ${data.id}`);
    return { success: true };
  }

  // 5. METERS
  if (action === "getMeters") {
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
    const id = `MTR-ID-${Date.now().toString().slice(-6)}`;
    db.run(
      `INSERT INTO meters (id, meter_no, customer_id, brand, installation_date, initial_reading, current_reading, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.meter_no, data.customer_id || null, data.brand || 'Onda SNI 1/2"', data.installation_date || now.substring(0, 10), Number(data.initial_reading || 0), Number(data.current_reading || 0), data.status || "Aktif", now, now]
    );
    return { success: true, meter_id: id };
  }

  if (action === "updateMeter") {
    db.run(
      `UPDATE meters
       SET meter_no = ?, customer_id = ?, brand = ?, installation_date = ?, initial_reading = ?, current_reading = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [data.meter_no, data.customer_id || null, data.brand, data.installation_date, Number(data.initial_reading || 0), Number(data.current_reading || 0), data.status || "Aktif", now, data.id]
    );
    return { success: true };
  }

  if (action === "deleteMeter") {
    db.run("DELETE FROM meters WHERE id = ?", [data.id]);
    return { success: true };
  }

  // 6. READINGS
  if (action === "getReadings") {
    let sql = `
      SELECT r.*, c.full_name as customer_name, c.customer_no, c.rt_rw, u.full_name as reader_name
      FROM meter_readings r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON r.reader_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (auth?.role === "customer") {
      sql += " AND r.customer_id = ?";
      params.push(auth.customerId);
    } else {
      if (data.customer_id) {
        sql += " AND r.customer_id = ?";
        params.push(data.customer_id);
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
    const customer = db.query("SELECT * FROM customers WHERE id = ?").get(data.customer_id) as any;
    const meter = db.query("SELECT * FROM meters WHERE customer_id = ?").get(data.customer_id) as any;
    const lastReading = db.query("SELECT * FROM meter_readings WHERE customer_id = ? ORDER BY period_year DESC, period_month DESC LIMIT 1").get(data.customer_id) as any;

    const prevReading = lastReading ? lastReading.current_reading : (meter ? meter.current_reading : 0);
    return {
      success: true,
      prev_reading: prevReading,
      meter_no: meter?.meter_no || customer?.meter_no || "-"
    };
  }

  if (action === "recordReading") {
    const { customer_id, period_month, period_year, prev_reading, current_reading, auto_generate_bill, notes } = data;
    const usageM3 = Math.max(0, Number(current_reading) - Number(prev_reading));

    const readingId = `RDM-${Date.now().toString().slice(-6)}`;
    const readingNo = `RDM-${period_year}${String(period_month).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;

    const meter = db.query("SELECT id FROM meters WHERE customer_id = ?").get(customer_id) as any;

    db.run(
      `INSERT INTO meter_readings (id, reading_no, customer_id, meter_id, period_month, period_year, prev_reading, current_reading, usage_m3, reading_date, reader_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [readingId, readingNo, customer_id, meter?.id || null, Number(period_month), Number(period_year), Number(prev_reading), Number(current_reading), usageM3, now.substring(0, 10), auth?.id || "USR-002", notes || "", now, now]
    );

    // Update meter current reading
    db.run("UPDATE meters SET current_reading = ?, updated_at = ? WHERE customer_id = ?", [Number(current_reading), now, customer_id]);

    let billInfo = null;
    if (auto_generate_bill) {
      // Lookup customer tariff
      const cust = db.query("SELECT tariff_id FROM customers WHERE id = ?").get(customer_id) as any;
      const tariff = db.query("SELECT * FROM tariffs WHERE id = ?").get(cust?.tariff_id || "TRF-01") as any;

      const breakdown = calculateTieredBill(usageM3, tariff);
      const billId = `INV-${Date.now().toString().slice(-6)}`;
      const billNo = `INV-${period_year}${String(period_month).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;

      const dueDate = new Date(Number(period_year), Number(period_month), 20).toISOString().substring(0, 10);

      db.run(
        `INSERT INTO bills (id, bill_no, customer_id, reading_id, period_month, period_year, prev_reading, current_reading, usage_m3, base_fee, usage_amount, penalty_fee, total_amount, paid_amount, balance_due, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, 'Belum Dibayar', ?, ?)`,
        [billId, billNo, customer_id, readingId, Number(period_month), Number(period_year), Number(prev_reading), Number(current_reading), usageM3, breakdown.base_fee, breakdown.usage_amount, breakdown.total_amount, breakdown.total_amount, dueDate, now, now]
      );
      billInfo = { bill_id: billId, bill_no: billNo, total_amount: breakdown.total_amount };
    }

    logAudit(auth?.id, auth?.username || "operator", "RECORD_READING", `Mencatat meter: ${readingNo}, pemakaian: ${usageM3} m³`);
    return { success: true, reading_id: readingId, reading_no: readingNo, bill: billInfo };
  }

  // 7. BILLS
  if (action === "getBills") {
    let sql = `
      SELECT b.*, c.full_name as customer_name, c.customer_no, c.rt_rw, c.address, c.phone, t.name as tariff_name
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN tariffs t ON c.tariff_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (auth?.role === "customer") {
      sql += " AND b.customer_id = ?";
      params.push(auth.customerId);
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

  if (action === "generateBatchBills") {
    const month = Number(data.period_month || new Date().getMonth() + 1);
    const year = Number(data.period_year || new Date().getFullYear());

    // Find readings in this period without bill
    const readings = db.query(`
      SELECT r.*, c.tariff_id
      FROM meter_readings r
      JOIN customers c ON r.customer_id = c.id
      WHERE r.period_month = ? AND r.period_year = ?
      AND r.id NOT IN (SELECT reading_id FROM bills WHERE period_month = ? AND period_year = ?)
    `).all(month, year, month, year) as any[];

    let count = 0;
    for (const r of readings) {
      const tariff = db.query("SELECT * FROM tariffs WHERE id = ?").get(r.tariff_id || "TRF-01") as any;
      const breakdown = calculateTieredBill(r.usage_m3, tariff);

      const billId = `INV-${Date.now().toString().slice(-4)}${count}`;
      const billNo = `INV-${year}${String(month).padStart(2, "0")}-${String(count + 100).padStart(4, "0")}`;
      const dueDate = new Date(year, month, 20).toISOString().substring(0, 10);

      db.run(
        `INSERT INTO bills (id, bill_no, customer_id, reading_id, period_month, period_year, prev_reading, current_reading, usage_m3, base_fee, usage_amount, penalty_fee, total_amount, paid_amount, balance_due, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, 'Belum Dibayar', ?, ?)`,
        [billId, billNo, r.customer_id, r.id, month, year, r.prev_reading, r.current_reading, r.usage_m3, breakdown.base_fee, breakdown.usage_amount, breakdown.total_amount, breakdown.total_amount, dueDate, now, now]
      );
      count++;
    }

    logAudit(auth?.id, auth?.username || "operator", "GENERATE_BATCH_BILLS", `Generate massal ${count} tagihan untuk periode ${month}/${year}`);
    return { success: true, generated_count: count };
  }

  // 8. PAYMENTS
  if (action === "getPayments") {
    let sql = `
      SELECT p.*, c.full_name as customer_name, c.customer_no, c.rt_rw, b.bill_no, b.period_month, b.period_year, u.full_name as cashier_name
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN bills b ON p.bill_id = b.id
      LEFT JOIN users u ON p.cashier_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (auth?.role === "customer") {
      sql += " AND p.customer_id = ?";
      params.push(auth.customerId);
    } else {
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
    const { bill_id, amount_paid, payment_method, notes, payment_date } = data;
    const bill = db.query("SELECT * FROM bills WHERE id = ?").get(bill_id) as any;
    if (!bill) throw new Error("Tagihan tidak ditemukan.");

    const payAmount = Number(amount_paid);
    const newPaidAmount = (bill.paid_amount || 0) + payAmount;
    const newBalance = Math.max(0, bill.total_amount - newPaidAmount);
    const newStatus = newBalance === 0 ? "Lunas" : "Sebagian Dibayar";

    // Update Bill
    db.run(
      "UPDATE bills SET paid_amount = ?, balance_due = ?, status = ?, updated_at = ? WHERE id = ?",
      [newPaidAmount, newBalance, newStatus, now, bill_id]
    );

    // Create Payment Record
    const payId = `PAY-${Date.now().toString().slice(-6)}`;
    const payNo = `PAY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;

    const payDate = payment_date ? `${payment_date} ${new Date().toLocaleTimeString("id-ID")}` : now;

    db.run(
      `INSERT INTO payments (id, payment_no, bill_id, customer_id, amount_paid, payment_date, payment_method, cashier_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payId, payNo, bill_id, bill.customer_id, payAmount, payDate, payment_method || "Tunai", auth?.id || "USR-002", notes || "", now, now]
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

    logAudit(auth?.id, auth?.username || "operator", "RECORD_PAYMENT", `Penerimaan pembayaran: ${payNo}, Rp ${payAmount}`);
    return { success: true, payment_id: payId, payment_no: payNo, status: newStatus, payment };
  }

  // 9. TARIFFS
  if (action === "getTariffs") {
    const tariffs = db.query("SELECT * FROM tariffs ORDER BY code ASC").all();
    return { success: true, tariffs };
  }

  if (action === "createTariff") {
    const id = `TRF-${Date.now().toString().slice(-4)}`;
    db.run(
      `INSERT INTO tariffs (id, code, name, category, base_fee, tier1_max, tier1_rate, tier2_max, tier2_rate, tier3_rate, late_fee, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, data.code, data.name, data.category || "Rumah Tangga", Number(data.base_fee), Number(data.tier1_max), Number(data.tier1_rate), Number(data.tier2_max), Number(data.tier2_rate), Number(data.tier3_rate), Number(data.late_fee || 5000), data.description || "", now, now]
    );
    return { success: true, tariff_id: id };
  }

  if (action === "updateTariff") {
    db.run(
      `UPDATE tariffs
       SET code = ?, name = ?, category = ?, base_fee = ?, tier1_max = ?, tier1_rate = ?, tier2_max = ?, tier2_rate = ?, tier3_rate = ?, late_fee = ?, description = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [data.code, data.name, data.category, Number(data.base_fee), Number(data.tier1_max), Number(data.tier1_rate), Number(data.tier2_max), Number(data.tier2_rate), Number(data.tier3_rate), Number(data.late_fee || 5000), data.description || "", data.is_active ? 1 : 0, now, data.id]
    );
    return { success: true };
  }

  // 10. REPORTS
  if (action === "getBillingReport") {
    const m = Number(data.period_month || 8);
    const y = Number(data.period_year || 2026);
    const rows = db.query(`
      SELECT b.*, c.full_name as customer_name, c.customer_no, c.rt_rw, '${m}/${y}' as period
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.period_month = ? AND b.period_year = ?
      ORDER BY b.bill_no ASC
    `).all(m, y) as any[];

    const totalBilled = rows.reduce((s, r) => s + r.total_amount, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paid_amount, 0);
    const totalDue = rows.reduce((s, r) => s + r.balance_due, 0);

    return {
      success: true,
      summary: { total_bills: rows.length, total_billed: totalBilled, total_paid: totalPaid, total_balance_due: totalDue },
      items: rows
    };
  }

  if (action === "getPaymentReport") {
    let sql = `
      SELECT p.*, c.full_name as customer_name, c.customer_no
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (data.payment_method) {
      sql += " AND p.payment_method = ?";
      params.push(data.payment_method);
    }
    sql += " ORDER BY p.payment_date DESC";
    const rows = db.query(sql).all(...params) as any[];
    const totalRevenue = rows.reduce((s, r) => s + r.amount_paid, 0);

    return {
      success: true,
      summary: { total_transactions: rows.length, total_revenue: totalRevenue },
      items: rows
    };
  }

  if (action === "getArrearsReport") {
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

    const totalArrears = rows.reduce((s, r) => s + r.total_arrears, 0);
    return {
      success: true,
      summary: { total_defaulters: rows.length, total_arrears_amount: totalArrears },
      items: rows
    };
  }

  if (action === "getUsageReport") {
    const m = Number(data.period_month || 8);
    const y = Number(data.period_year || 2026);
    const rows = db.query(`
      SELECT r.*, c.full_name as customer_name, c.customer_no, c.rt_rw, '${m}/${y}' as period
      FROM meter_readings r
      JOIN customers c ON r.customer_id = c.id
      WHERE r.period_month = ? AND r.period_year = ?
      ORDER BY r.usage_m3 DESC
    `).all(m, y) as any[];

    const totalUsage = rows.reduce((s, r) => s + r.usage_m3, 0);
    const avgUsage = rows.length > 0 ? (totalUsage / rows.length).toFixed(1) : "0";

    return {
      success: true,
      summary: { total_usage_m3: totalUsage, avg_usage_m3: avgUsage },
      items: rows
    };
  }

  // 11. SETTINGS & USERS
  if (action === "getSettings") {
    const rows = db.query("SELECT key, value FROM settings").all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return { success: true, settings };
  }

  if (action === "updateSettings") {
    const settings = data.settings || data;
    const upsert = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at");
    for (const [k, v] of Object.entries(settings)) {
      if (typeof v === "string" || typeof v === "number") {
        upsert.run(k, String(v), now);
      }
    }
    return { success: true };
  }

  if (action === "getUsers") {
    const users = db.query("SELECT id, username, full_name, role, email, phone, is_active, created_at, updated_at FROM users").all();
    return { success: true, users };
  }

  if (action === "createUser") {
    const id = `USR-${Date.now().toString().slice(-4)}`;
    const authData = hashPassword(data.password || "operator123");
    db.run(
      "INSERT INTO users (id, username, password_hash, salt, full_name, role, email, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      [id, data.username, authData.hash, authData.salt, data.full_name, data.role || "operator", data.email || "", data.phone || "", now, now]
    );
    return { success: true, user_id: id };
  }

  if (action === "resetUserPassword") {
    const authData = hashPassword(data.new_password || "operator123");
    db.run("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?", [authData.hash, authData.salt, now, data.user_id]);
    return { success: true };
  }

  if (action === "getAuditLogs") {
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
    sql += " ORDER BY created_at DESC LIMIT 100";
    const logs = db.query(sql).all(...params);
    return { success: true, logs };
  }

  throw new Error(`Aksi '${action}' tidak dikenali.`);
}

// HTTP Server for Bun
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

      const result = await handleApiAction(action, body, auth);
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
