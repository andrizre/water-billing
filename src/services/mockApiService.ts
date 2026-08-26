import {
  initialCustomers,
  initialMeters,
  initialTariffs,
  initialUsers,
  initialReadings,
  initialBills,
  initialPayments,
  initialSettings,
  initialAuditLogs,
  initialAnnouncements,
  initialComplaints,
  initialSubscriptionRequests,
  initialRegistrationTokens,
  initialMaintenanceExpenses
} from './mockData';
import { storage } from './storage';
import { calculateTieredBillBreakdown } from '../utils/calculator';
import {
  User,
  Customer,
  WaterMeter,
  MeterReading,
  Tariff,
  Bill,
  Payment,
  SystemSettings,
  AuditLog,
  AdminDashboardData,
  CustomerDashboardData,
  Announcement,
  Complaint,
  SubscriptionRequest,
  RegistrationToken,
  MaintenanceExpense
} from '../types';

interface MockDatabase {
  users: User[];
  customers: Customer[];
  meters: WaterMeter[];
  readings: MeterReading[];
  tariffs: Tariff[];
  bills: Bill[];
  payments: Payment[];
  settings: SystemSettings;
  auditLogs: AuditLog[];
  announcements: Announcement[];
  complaints: Complaint[];
  subscriptionRequests: SubscriptionRequest[];
  registrationTokens: RegistrationToken[];
  maintenanceExpenses: MaintenanceExpense[];
}

let _cachedDb: MockDatabase | null = null;
let _saveTimeout: any = null;

/**
 * Upgrade older mock databases whose seeded accounts predate credentials.
 * Assigns the documented demo passwords so admin/operator/warga logins keep
 * working after the removal of master-password fallbacks. Mock mode only —
 * this is a local browser simulator, not a real credential store.
 */
function ensureUserCredentials(db: MockDatabase): boolean {
  let changed = false;
  for (const u of db.users || []) {
    const hasSecret = Boolean((u as any).password_hash || (u as any).password);
    if (hasSecret) continue;
    let defaultPassword = 'warga123';
    if (u.username.toLowerCase() === 'admin') defaultPassword = 'admin123';
    else if (u.username.toLowerCase().startsWith('operator')) defaultPassword = 'operator123';
    (u as any).password_hash = defaultPassword;
    changed = true;
  }
  return changed;
}

function getDatabase(): MockDatabase {
  if (_cachedDb) return _cachedDb;

  let db = storage.getMockDb();
  let freshlySeeded = false;
  if (!db || !db.users || db.users.length === 0) {
    db = {
      users: [...initialUsers],
      customers: [...initialCustomers],
      meters: [...initialMeters],
      readings: [...initialReadings],
      tariffs: [...initialTariffs],
      bills: [...initialBills],
      payments: [...initialPayments],
      settings: { ...initialSettings },
      auditLogs: [...initialAuditLogs],
      announcements: [...initialAnnouncements],
      complaints: [...initialComplaints],
      subscriptionRequests: [...initialSubscriptionRequests],
      registrationTokens: [...initialRegistrationTokens],
      maintenanceExpenses: [...initialMaintenanceExpenses]
    };
    freshlySeeded = true;
    storage.setMockDb(db);
  }
  if (!db.announcements) db.announcements = [...initialAnnouncements];
  if (!db.complaints) db.complaints = [...initialComplaints];
  if (!db.subscriptionRequests) db.subscriptionRequests = [...initialSubscriptionRequests];
  if (!db.registrationTokens) db.registrationTokens = [...initialRegistrationTokens];
  if (!db.maintenanceExpenses) db.maintenanceExpenses = [...initialMaintenanceExpenses];

  // Migrate stale databases (seeded before password support) on first load
  if (!freshlySeeded && ensureUserCredentials(db)) {
    storage.setMockDb(db);
  }

  _cachedDb = db;
  return db;
}

function saveDatabase(db: MockDatabase): void {
  _cachedDb = db;
  // Non-blocking microtask flush to LocalStorage
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(() => {
    storage.setMockDb(db);
  }, 10);
}

function nowTimeString(): string {
  const d = new Date();
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

export const mockApiService = {
  // 1. AUTH
  async login(username: string, password: string): Promise<any> {
    const db = getDatabase();
    const cleanUser = username.trim().toLowerCase();

    // Check user in users table
    let user = db.users.find(
      (u) => u.username.toLowerCase() === cleanUser || (u.customer_id && cleanUser.includes(u.customer_id.toLowerCase()))
    );

    // If not found in users, check customer table
    let customer: Customer | undefined;
    if (!user) {
      customer = db.customers.find(
        (c) => c.customer_no.toLowerCase() === cleanUser || (c.phone && c.phone === cleanUser)
      );
      if (customer) {
        user = db.users.find((u) => u.customer_id === customer?.id);
        if (!user) {
          // Create customer user on the fly with an UNUSABLE password:
          // knowing only a phone number must never yield a working session.
          const lockedUser = {
            id: `USR-CUST-${Date.now()}`,
            username: customer.customer_no.toLowerCase(),
            full_name: customer.full_name,
            role: 'customer' as const,
            customer_id: customer.id,
            phone: customer.phone,
            is_active: true,
            password_hash: `locked-${Math.random().toString(36).slice(2)}`,
            created_at: nowTimeString()
          };
          user = lockedUser as User;
          db.users.push(lockedUser as User);
          saveDatabase(db);
        }
      }
    } else if (user.role === 'customer' && user.customer_id) {
      customer = db.customers.find((c) => c.id === user?.customer_id);
    }

    if (!user) {
      throw new Error('Akun atau nomor pelanggan tidak ditemukan.');
    }

    if (!user.is_active) {
      throw new Error('Akun Anda telah dinonaktifkan.');
    }

    // Password check: exact match against the stored secret only.
    // There are NO master/default passwords in any role.
    const dbPassword = String((user as any).password_hash || (user as any).password || '');
    if (!dbPassword) {
      throw new Error('Akun ini belum memiliki kata sandi. Minta admin menerbitkan Token Reset Password.');
    }
    if (dbPassword !== password) {
      throw new Error('Kata sandi salah.');
    }

    const token = `mock_token_${user.id}_${Date.now()}`;
    const sessionData = {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        assigned_rt: user.assigned_rt,
        email: user.email,
        phone: user.phone,
        customerId: user.customer_id,
        customer: customer || null
      }
    };

    // Log audit
    db.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user_id: user.id,
      username: user.username,
      action: 'LOGIN',
      details: `Login berhasil sebagai ${user.role}`,
      created_at: nowTimeString()
    });
    saveDatabase(db);

    return sessionData;
  },

  async verifyAuth(token: string): Promise<any> {
    const user = storage.getUser();
    if (!user) throw new Error('Sesi tidak valid.');
    return { user };
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Kata sandi baru minimal 6 karakter.');
    }
    const db = getDatabase();
    const currentUser = storage.getUser();
    if (currentUser) {
      const targetUser = db.users.find((u) => u.id === currentUser.id);
      const stored = String(((targetUser as any)?.password_hash) || ((targetUser as any)?.password) || '');
      if (!oldPassword || stored !== oldPassword) {
        throw new Error('Kata sandi lama tidak cocok.');
      }
      if (targetUser) {
        (targetUser as any).password_hash = newPassword;
        (targetUser as any).password = newPassword;
      }
      db.auditLogs.unshift({
        id: `LOG-${Date.now()}`,
        user_id: currentUser.id,
        username: currentUser.username,
        action: 'CHANGE_PASSWORD',
        details: 'Kata sandi berhasil diubah',
        created_at: nowTimeString()
      });
      saveDatabase(db);
    }
  },

  async publicCheckBill(customerNo: string): Promise<any> {
    const db = getDatabase();
    const cleanNo = customerNo.trim().toUpperCase();
    const customer = db.customers.find((c) => c.customer_no.toUpperCase() === cleanNo);

    if (!customer) {
      throw new Error(`Nomor pelanggan "${customerNo}" tidak ditemukan.`);
    }

    const customerBills = db.bills
      .filter((b) => b.customer_id === customer.id)
      .sort((a, b) => b.period_year * 100 + b.period_month - (a.period_year * 100 + a.period_month));

    const unpaidBills = customerBills.filter((b) => b.status !== 'Lunas');
    const totalUnpaid = unpaidBills.reduce((acc, b) => acc + (b.balance_due || b.total_amount), 0);
    const meter = db.meters.find((m) => m.id === customer.meter_id);
    const tariff = db.tariffs.find((t) => t.id === customer.tariff_id);

    return {
      customer: {
        customer_no: customer.customer_no,
        full_name: customer.full_name,
        address: customer.address,
        rt_rw: customer.rt_rw,
        status: customer.status,
        tariff_name: tariff?.name || 'Rumah Tangga Standar',
        is_subsidized: !!(customer as any).is_subsidized,
        subsidy_type: (customer as any).subsidy_type,
        subsidy_max_amount: (customer as any).subsidy_max_amount
      },
      meter: meter ? { meter_no: meter.meter_no, current_reading: meter.current_reading } : null,
      total_unpaid_amount: totalUnpaid,
      unpaid_count: unpaidBills.length,
      bills: customerBills.slice(0, 6)
    };
  },

  // 2. USERS (Admin only)
  async getUsers(params: any = {}): Promise<User[]> {
    const db = getDatabase();
    let res = [...db.users];
    if (params.role) res = res.filter((u) => u.role === params.role);
    if (params.search) {
      const q = params.search.toLowerCase();
      res = res.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }
    return res;
  },

  async createUser(data: Partial<User> & { password?: string }): Promise<User> {
    const db = getDatabase();
    const id = `USR-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUser: User = {
      id,
      username: data.username || '',
      full_name: data.full_name || '',
      role: data.role || 'operator',
      assigned_rt: data.assigned_rt || '',
      email: data.email || '',
      phone: data.phone || '',
      is_active: data.is_active !== undefined ? data.is_active : true,
      password_hash: data.password || 'operator123',
      created_at: nowTimeString()
    };
    db.users.push(newUser);
    saveDatabase(db);
    return newUser;
  },

  async updateUser(data: Partial<User>): Promise<void> {
    const db = getDatabase();
    const idx = db.users.findIndex((u) => u.id === data.id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...data, updated_at: nowTimeString() };
      saveDatabase(db);
    }
  },

  async deleteUser(id: string): Promise<void> {
    const db = getDatabase();
    db.users = db.users.filter((u) => u.id !== id);
    saveDatabase(db);
  },

  async resetUserPassword(id: string, newPassword?: string): Promise<{ new_password: string }> {
    const db = getDatabase();
    const targetUser = db.users.find((u) => u.id === id);
    if (!targetUser) throw new Error('Akun tidak ditemukan.');
    const pw = newPassword || `sm${Math.random().toString(36).slice(2, 10)}A1`;
    (targetUser as any).password_hash = pw;
    saveDatabase(db);
    return { new_password: pw };
  },

  // 3. CUSTOMERS
  async getCustomers(params: any = {}): Promise<Customer[]> {
    const db = getDatabase();
    let res = [...db.customers];
    if (params.status) res = res.filter((c) => c.status === params.status);
    if (params.rt_rw) res = res.filter((c) => c.rt_rw === params.rt_rw);
    if (params.search) {
      const q = params.search.toLowerCase();
      res = res.filter(
        (c) =>
          c.customer_no.toLowerCase().includes(q) ||
          c.full_name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
      );
    }
    return res;
  },

  async getCustomerById(id: string): Promise<any> {
    const db = getDatabase();
    const customer = db.customers.find((c) => c.id === id);
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');
    const meter = db.meters.find((m) => m.id === customer.meter_id);
    const tariff = db.tariffs.find((t) => t.id === customer.tariff_id);
    return { customer, meter, tariff };
  },

  async createCustomer(data: any): Promise<Customer> {
    const db = getDatabase();
    const customerId = `CUST-ID-${Date.now().toString().slice(-4)}`;
    const customerNo = data.customer_no || `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const tariff = db.tariffs.find((t) => t.id === data.tariff_id) || db.tariffs[0];

    let meterId = data.meter_id || '';
    if (!meterId && (data.meter_no || data.create_meter)) {
      meterId = `MTR-ID-${Date.now().toString().slice(-4)}`;
      const meterNo = data.meter_no || `MTR-${Math.floor(1000 + Math.random() * 9000)}`;
      const newMeter: WaterMeter = {
        id: meterId,
        meter_no: meterNo,
        customer_id: customerId,
        customer_name: data.full_name,
        customer_no: customerNo,
        installation_date: data.installation_date || new Date().toISOString().substring(0, 10),
        brand: data.brand || 'Standard SNI',
        initial_reading: Number(data.initial_reading || 0),
        current_reading: Number(data.initial_reading || 0),
        status: 'Aktif',
        created_at: nowTimeString()
      };
      db.meters.push(newMeter);
    }

    const newCust: Customer = {
      id: customerId,
      customer_no: customerNo,
      full_name: data.full_name,
      nik: data.nik || '',
      phone: data.phone || '',
      address: data.address || '',
      rt_rw: data.rt_rw || '',
      meter_id: meterId,
      meter_no: data.meter_no || '',
      current_reading: Number(data.initial_reading || 0),
      tariff_id: tariff?.id || 'TRF-01',
      tariff_name: tariff?.name || 'Rumah Tangga Standar',
      status: 'Aktif',
      is_subsidized: Boolean(data.is_subsidized),
      subsidy_type: data.subsidy_type || (data.is_subsidized ? 'gratis' : 'none'),
      subsidy_max_amount: Number(data.subsidy_max_amount || 0),
      subsidy_notes: data.subsidy_notes || '',
      created_at: nowTimeString()
    };

    db.customers.push(newCust);

    // Auto create customer login
    db.users.push({
      id: `USR-CUST-${Date.now()}`,
      username: customerNo.toLowerCase(),
      full_name: data.full_name,
      role: 'customer',
      customer_id: customerId,
      phone: data.phone || '',
      is_active: true,
      created_at: nowTimeString()
    });

    saveDatabase(db);
    return newCust;
  },

  async updateCustomer(data: Partial<Customer>): Promise<void> {
    const db = getDatabase();
    const idx = db.customers.findIndex((c) => c.id === data.id);
    if (idx !== -1) {
      db.customers[idx] = { ...db.customers[idx], ...data, updated_at: nowTimeString() };
      saveDatabase(db);
    }
  },

  async deleteCustomer(id: string): Promise<void> {
    const db = getDatabase();
    db.customers = db.customers.filter((c) => c.id !== id);
    saveDatabase(db);
  },

  // 4. METERS
  async getMeters(params: any = {}): Promise<WaterMeter[]> {
    const db = getDatabase();
    let res = [...db.meters];
    if (params.status) res = res.filter((m) => m.status === params.status);
    if (params.search) {
      const q = params.search.toLowerCase();
      res = res.filter(
        (m) =>
          m.meter_no.toLowerCase().includes(q) ||
          (m.customer_name && m.customer_name.toLowerCase().includes(q))
      );
    }
    return res;
  },

  async createMeter(data: Partial<WaterMeter>): Promise<WaterMeter> {
    const db = getDatabase();
    const id = `MTR-ID-${Date.now().toString().slice(-4)}`;
    const newMeter: WaterMeter = {
      id,
      meter_no: data.meter_no || `MTR-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: data.customer_id || '',
      customer_name: data.customer_name || '',
      customer_no: data.customer_no || '',
      installation_date: data.installation_date || new Date().toISOString().substring(0, 10),
      brand: data.brand || 'Standard SNI',
      initial_reading: Number(data.initial_reading || 0),
      current_reading: Number(data.initial_reading || 0),
      status: data.status || 'Aktif',
      created_at: nowTimeString()
    };
    db.meters.push(newMeter);
    saveDatabase(db);
    return newMeter;
  },

  async updateMeter(data: Partial<WaterMeter>): Promise<void> {
    const db = getDatabase();
    const idx = db.meters.findIndex((m) => m.id === data.id);
    if (idx !== -1) {
      db.meters[idx] = { ...db.meters[idx], ...data };
      saveDatabase(db);
    }
  },

  async deleteMeter(id: string): Promise<void> {
    const db = getDatabase();
    db.meters = db.meters.filter((m) => m.id !== id);
    saveDatabase(db);
  },

  // 5. READINGS
  async getReadings(params: any = {}): Promise<MeterReading[]> {
    const db = getDatabase();
    let res = [...db.readings];
    if (params.customer_id) res = res.filter((r) => r.customer_id === params.customer_id);
    if (params.period_month) res = res.filter((r) => r.period_month === Number(params.period_month));
    if (params.period_year) res = res.filter((r) => r.period_year === Number(params.period_year));
    return res.sort((a, b) => b.period_year * 100 + b.period_month - (a.period_year * 100 + a.period_month));
  },

  async getPrevReading(customerId: string): Promise<any> {
    const db = getDatabase();
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');

    const readings = db.readings
      .filter((r) => r.customer_id === customerId)
      .sort((a, b) => b.period_year * 100 + b.period_month - (a.period_year * 100 + a.period_month));

    const meter = db.meters.find((m) => m.id === customer.meter_id);
    const prevReading = readings.length > 0 ? readings[0].current_reading : (meter?.initial_reading || 0);

    return {
      customer_id: customerId,
      customer_name: customer.full_name,
      customer_no: customer.customer_no,
      meter_id: customer.meter_id,
      meter_no: meter?.meter_no || '',
      prev_reading: prevReading,
      meter_current_reading: meter?.current_reading || prevReading
    };
  },

  async recordReading(data: any): Promise<any> {
    const db = getDatabase();
    const customer = db.customers.find((c) => c.id === data.customer_id);
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');

    const month = Number(data.period_month);
    const year = Number(data.period_year);
    const prev = Number(data.prev_reading || 0);
    const cur = Number(data.current_reading || 0);

    if (cur < prev) {
      throw new Error(`Angka meter (${cur}) tidak boleh lebih kecil dari meter sebelumnya (${prev}).`);
    }

    const usage = cur - prev;
    const meter = db.meters.find((m) => m.id === customer.meter_id);
    const readingId = `RDM-${year}${String(month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    const newReading: MeterReading = {
      id: readingId,
      reading_no: `RDM-${year}${String(month).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_no: customer.customer_no,
      rt_rw: customer.rt_rw,
      meter_id: customer.meter_id || '',
      meter_no: meter?.meter_no || '',
      period_month: month,
      period_year: year,
      prev_reading: prev,
      current_reading: cur,
      usage_m3: usage,
      reading_date: data.reading_date || new Date().toISOString().substring(0, 10),
      reader_name: 'Petugas Lapangan',
      notes: data.notes || '',
      created_at: nowTimeString()
    };

    db.readings.unshift(newReading);

    if (meter) {
      meter.current_reading = cur;
    }
    customer.current_reading = cur;

    let generatedBill: Bill | null = null;
    if (data.auto_generate_bill) {
      const tariff = db.tariffs.find((t) => t.id === customer.tariff_id) || db.tariffs[0];
      const adminFee = Number(db.settings?.admin_fee_flat || 2500);
      const subsidyOpts = {
        isSubsidized: customer.is_subsidized,
        subsidyType: customer.subsidy_type,
        subsidyMaxAmount: customer.subsidy_max_amount,
        subsidyNotes: customer.subsidy_notes
      };
      const calc = calculateTieredBillBreakdown(usage, tariff, false, adminFee, subsidyOpts);
      const billId = `BILL-${year}${String(month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
      const isSubsidized = Boolean(calc.is_subsidized);
      const isFree = isSubsidized && calc.total_amount === 0;

      generatedBill = {
        id: billId,
        bill_no: `INV-${year}${String(month).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_no: customer.customer_no,
        rt_rw: customer.rt_rw,
        phone: customer.phone,
        reading_id: readingId,
        period_month: month,
        period_year: year,
        prev_reading: prev,
        current_reading: cur,
        usage_m3: usage,
        base_amount: calc.base_fee,
        usage_amount: calc.usage_amount,
        late_fee: 0,
        admin_fee: adminFee,
        original_amount: calc.raw_total || calc.total_amount,
        subsidy_amount: calc.subsidy_amount || 0,
        is_subsidized: isSubsidized,
        subsidy_type: calc.subsidy_type,
        subsidy_notes: calc.subsidy_notes,
        total_amount: calc.total_amount,
        paid_amount: 0,
        balance_due: calc.total_amount,
        due_date: `${year}-${String(month).padStart(2, '0')}-20`,
        status: isFree ? 'Lunas' : 'Belum Dibayar',
        created_at: nowTimeString()
      };
      db.bills.unshift(generatedBill);
    }

    saveDatabase(db);
    return { reading: newReading, bill: generatedBill };
  },

  // 6. TARIFFS
  async getTariffs(): Promise<Tariff[]> {
    const db = getDatabase();
    return db.tariffs;
  },

  async createTariff(data: Partial<Tariff>): Promise<Tariff> {
    const db = getDatabase();
    const newTariff: Tariff = {
      id: `TRF-0${db.tariffs.length + 1}`,
      code: data.code || `TRF-${Date.now().toString().slice(-4)}`,
      name: data.name || '',
      category: data.category || 'Rumah Tangga',
      base_fee: Number(data.base_fee || 0),
      tier1_max: Number(data.tier1_max || 10),
      tier1_rate: Number(data.tier1_rate || 2000),
      tier2_max: Number(data.tier2_max || 20),
      tier2_rate: Number(data.tier2_rate || 3000),
      tier3_rate: Number(data.tier3_rate || 5000),
      late_fee: Number(data.late_fee || 5000),
      is_active: data.is_active !== undefined ? data.is_active : true,
      description: data.description || '',
      created_at: nowTimeString()
    };
    db.tariffs.push(newTariff);
    saveDatabase(db);
    return newTariff;
  },

  async updateTariff(data: Partial<Tariff>): Promise<void> {
    const db = getDatabase();
    const idx = db.tariffs.findIndex((t) => t.id === data.id);
    if (idx !== -1) {
      db.tariffs[idx] = { ...db.tariffs[idx], ...data };
      saveDatabase(db);
    }
  },

  // 7. BILLS
  async getBills(params: any = {}): Promise<Bill[]> {
    const db = getDatabase();
    let res = [...db.bills];
    if (params.customer_id) res = res.filter((b) => b.customer_id === params.customer_id);
    if (params.period_month) res = res.filter((b) => b.period_month === Number(params.period_month));
    if (params.period_year) res = res.filter((b) => b.period_year === Number(params.period_year));
    if (params.status) res = res.filter((b) => b.status === params.status);
    if (params.search) {
      const q = params.search.toLowerCase();
      res = res.filter(
        (b) =>
          b.bill_no.toLowerCase().includes(q) ||
          (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
          (b.customer_no && b.customer_no.toLowerCase().includes(q))
      );
    }
    return res.sort((a, b) => b.period_year * 100 + b.period_month - (a.period_year * 100 + a.period_month));
  },

  async getBillById(id: string): Promise<any> {
    const db = getDatabase();
    const bill = db.bills.find((b) => b.id === id);
    if (!bill) throw new Error('Tagihan tidak ditemukan.');
    const customer = db.customers.find((c) => c.id === bill.customer_id);
    const tariff = db.tariffs.find((t) => t.id === customer?.tariff_id) || db.tariffs[0];
    const meter = db.meters.find((m) => m.id === customer?.meter_id);
    const reading = db.readings.find((r) => r.id === bill.reading_id);
    const payments = db.payments.filter((p) => p.bill_id === bill.id);
    const breakdown = calculateTieredBillBreakdown(bill.usage_m3, tariff);

    return { bill, customer, tariff, meter, reading, payments, breakdown };
  },

  async generateBatchBills(periodMonth: number, periodYear: number): Promise<any> {
    const db = getDatabase();
    const customers = db.customers.filter((c) => c.status === 'Aktif');
    let generatedCount = 0;

    for (const cust of customers) {
      const exists = db.bills.some(
        (b) => b.customer_id === cust.id && b.period_month === periodMonth && b.period_year === periodYear
      );
      if (exists) continue;

      const reading = db.readings.find(
        (r) => r.customer_id === cust.id && r.period_month === periodMonth && r.period_year === periodYear
      );
      if (!reading) continue;

      const tariff = db.tariffs.find((t) => t.id === cust.tariff_id) || db.tariffs[0];
      const adminFee = Number(db.settings?.admin_fee_flat || 2500);
      const subsidyOpts = {
        isSubsidized: cust.is_subsidized,
        subsidyType: cust.subsidy_type,
        subsidyMaxAmount: cust.subsidy_max_amount,
        subsidyNotes: cust.subsidy_notes
      };
      const calc = calculateTieredBillBreakdown(reading.usage_m3, tariff, false, adminFee, subsidyOpts);
      const billId = `BILL-${periodYear}${String(periodMonth).padStart(2, '0')}-${Date.now().toString().slice(-4)}-${generatedCount}`;
      const isSubsidized = Boolean(calc.is_subsidized);
      const isFree = isSubsidized && calc.total_amount === 0;

      const newBill: Bill = {
        id: billId,
        bill_no: `INV-${periodYear}${String(periodMonth).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_id: cust.id,
        customer_name: cust.full_name,
        customer_no: cust.customer_no,
        rt_rw: cust.rt_rw,
        phone: cust.phone,
        reading_id: reading.id,
        period_month: periodMonth,
        period_year: periodYear,
        prev_reading: reading.prev_reading,
        current_reading: reading.current_reading,
        usage_m3: reading.usage_m3,
        base_amount: calc.base_fee,
        usage_amount: calc.usage_amount,
        late_fee: 0,
        admin_fee: adminFee,
        original_amount: calc.raw_total || calc.total_amount,
        subsidy_amount: calc.subsidy_amount || 0,
        is_subsidized: isSubsidized,
        subsidy_type: calc.subsidy_type,
        subsidy_notes: calc.subsidy_notes,
        total_amount: calc.total_amount,
        paid_amount: 0,
        balance_due: calc.total_amount,
        due_date: `${periodYear}-${String(periodMonth).padStart(2, '0')}-20`,
        status: isFree ? 'Lunas' : 'Belum Dibayar',
        created_at: nowTimeString()
      };

      db.bills.unshift(newBill);
      generatedCount++;
    }

    saveDatabase(db);
    return { generated_count: generatedCount };
  },

  async updateBillStatus(id: string, status: any): Promise<void> {
    const db = getDatabase();
    const bill = db.bills.find((b) => b.id === id);
    if (bill) {
      bill.status = status;
      saveDatabase(db);
    }
  },

  // 8. PAYMENTS
  async getPayments(params: any = {}): Promise<Payment[]> {
    const db = getDatabase();
    let res = [...db.payments];
    if (params.customer_id) res = res.filter((p) => p.customer_id === params.customer_id);
    if (params.payment_method) res = res.filter((p) => p.payment_method === params.payment_method);
    if (params.search) {
      const q = params.search.toLowerCase();
      res = res.filter(
        (p) =>
          p.payment_no.toLowerCase().includes(q) ||
          (p.customer_name && p.customer_name.toLowerCase().includes(q))
      );
    }
    return res.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async recordPayment(data: any): Promise<any> {
    const db = getDatabase();
    const bill = db.bills.find((b) => b.id === data.bill_id);
    if (!bill) throw new Error('Tagihan tidak ditemukan.');

    const amount = Number(data.amount_paid);
    if (amount <= 0) throw new Error('Jumlah pembayaran harus lebih dari 0.');

    const prevPaid = Number(bill.paid_amount || 0);
    const newPaidTotal = prevPaid + amount;
    const newBalance = Math.max(0, bill.total_amount - newPaidTotal);
    const newStatus = newBalance <= 0 ? 'Lunas' : 'Sebagian Dibayar';

    bill.paid_amount = newPaidTotal;
    bill.balance_due = newBalance;
    bill.status = newStatus;

    const paymentId = `PAY-${Date.now().toString().slice(-6)}`;
    const newPayment: Payment = {
      id: paymentId,
      payment_no: `PAY-${Date.now().toString().slice(-8)}`,
      bill_id: bill.id,
      bill_no: bill.bill_no,
      period_month: bill.period_month,
      period_year: bill.period_year,
      customer_id: bill.customer_id,
      customer_name: bill.customer_name,
      customer_no: bill.customer_no,
      rt_rw: bill.rt_rw,
      payment_date: data.payment_date || nowTimeString(),
      amount_paid: amount,
      payment_method: data.payment_method || 'Tunai',
      cashier_name: 'Petugas Loket',
      notes: data.notes || '',
      created_at: nowTimeString()
    };

    db.payments.unshift(newPayment);
    saveDatabase(db);

    return { payment: newPayment, bill, status: newStatus };
  },

  async getPaymentReceipt(id: string): Promise<any> {
    const db = getDatabase();
    const payment = db.payments.find((p) => p.id === id);
    if (!payment) throw new Error('Pembayaran tidak ditemukan.');
    const bill = db.bills.find((b) => b.id === payment.bill_id);
    const customer = db.customers.find((c) => c.id === payment.customer_id);
    const meter = db.meters.find((m) => m.id === customer?.meter_id);

    return {
      payment,
      bill,
      customer,
      meter,
      cashier_name: payment.cashier_name || 'Petugas Loket',
      village_info: db.settings
    };
  },

  // 9. DASHBOARDS & REPORTS
  async getDashboardSummary(userRole: string, customerId?: string): Promise<any> {
    const db = getDatabase();
    const now = new Date();
    const currentMonth = 8;
    const currentYear = 2026;

    if (userRole === 'customer' && customerId) {
      const customer = db.customers.find((c) => c.id === customerId) || db.customers[0];
      const meter = db.meters.find((m) => m.id === customer?.meter_id) || null;
      const custBills = db.bills.filter((b) => b.customer_id === customer.id);
      const custPayments = db.payments.filter((p) => p.customer_id === customer.id);
      const totalUnpaid = custBills
        .filter((b) => b.status !== 'Lunas')
        .reduce((acc, b) => acc + (b.balance_due || b.total_amount), 0);

      const activeBill = custBills.find(
        (b) => b.period_month === currentMonth && b.period_year === currentYear
      ) || custBills[0] || null;

      const usageHistory = [
        { month: 3, year: 2026, period_name: 'Maret 2026', usage_m3: 18 },
        { month: 4, year: 2026, period_name: 'April 2026', usage_m3: 20 },
        { month: 5, year: 2026, period_name: 'Mei 2026', usage_m3: 21 },
        { month: 6, year: 2026, period_name: 'Juni 2026', usage_m3: 19 },
        { month: 7, year: 2026, period_name: 'Juli 2026', usage_m3: 23 },
        { month: 8, year: 2026, period_name: 'Agustus 2026', usage_m3: 22 }
      ];

      const res: CustomerDashboardData = {
        customer,
        meter,
        total_unpaid: totalUnpaid,
        active_bill: activeBill,
        recent_payments: custPayments.slice(0, 5),
        usage_history: usageHistory
      };
      return res;
    }

    // Admin & Operator
    const totalCustomers = db.customers.length;
    const activeCustomers = db.customers.filter((c) => c.status === 'Aktif').length;
    const totalMeters = db.meters.length;
    const currentMonthBills = db.bills.filter((b) => b.period_month === currentMonth && b.period_year === currentYear);
    const totalBilledThisMonth = currentMonthBills.reduce((acc, b) => acc + b.total_amount, 0);
    const totalUsageThisMonth = currentMonthBills.reduce((acc, b) => acc + b.usage_m3, 0);
    const totalCollectedThisMonth = db.payments.reduce((acc, p) => acc + p.amount_paid, 0);
    const totalArrears = db.bills
      .filter((b) => b.status !== 'Lunas')
      .reduce((acc, b) => acc + (b.balance_due || b.total_amount), 0);

    const monthlyTrends = [
      { month: 3, year: 2026, period_name: 'Mar 2026', billed_amount: 420000, collected_amount: 410000, usage_m3: 135 },
      { month: 4, year: 2026, period_name: 'Apr 2026', billed_amount: 450000, collected_amount: 440000, usage_m3: 142 },
      { month: 5, year: 2026, period_name: 'Mei 2026', billed_amount: 480000, collected_amount: 470000, usage_m3: 150 },
      { month: 6, year: 2026, period_name: 'Jun 2026', billed_amount: 460000, collected_amount: 455000, usage_m3: 145 },
      { month: 7, year: 2026, period_name: 'Jul 2026', billed_amount: 490000, collected_amount: 480000, usage_m3: 155 },
      { month: 8, year: 2026, period_name: 'Ags 2026', billed_amount: totalBilledThisMonth, collected_amount: totalCollectedThisMonth, usage_m3: totalUsageThisMonth }
    ];

    const adminRes: AdminDashboardData = {
      stats: {
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        total_meters: totalMeters,
        total_billed_this_month: totalBilledThisMonth,
        total_collected_this_month: totalCollectedThisMonth,
        total_usage_this_month: totalUsageThisMonth,
        total_arrears: totalArrears,
        total_unpaid_bills: db.bills.filter((b) => b.status !== 'Lunas').length
      },
      monthly_trends: monthlyTrends,
      recent_payments: db.payments.slice(0, 5),
      recent_readings: db.readings.slice(0, 5)
    };
    return adminRes;
  },

  async getReports(type: 'billing' | 'payment' | 'arrears' | 'usage', params: any = {}): Promise<any> {
    const db = getDatabase();

    if (type === 'billing') {
      let items = [...db.bills];
      if (params.period_month) items = items.filter((b) => b.period_month === Number(params.period_month));
      if (params.period_year) items = items.filter((b) => b.period_year === Number(params.period_year));
      return {
        summary: {
          total_bills: items.length,
          total_billed: items.reduce((acc, b) => acc + b.total_amount, 0),
          total_paid: items.reduce((acc, b) => acc + b.paid_amount, 0),
          total_balance_due: items.reduce((acc, b) => acc + (b.balance_due || 0), 0),
          total_usage_m3: items.reduce((acc, b) => acc + b.usage_m3, 0)
        },
        items
      };
    }

    if (type === 'payment') {
      const items = [...db.payments];
      return {
        summary: {
          total_transactions: items.length,
          total_revenue: items.reduce((acc, p) => acc + p.amount_paid, 0)
        },
        items
      };
    }

    if (type === 'arrears') {
      const unpaid = db.bills.filter((b) => b.status !== 'Lunas');
      const map: Record<string, any> = {};
      for (const b of unpaid) {
        if (!map[b.customer_id]) {
          map[b.customer_id] = {
            customer_id: b.customer_id,
            customer_no: b.customer_no,
            customer_name: b.customer_name,
            rt_rw: b.rt_rw,
            phone: b.phone,
            total_arrears: 0,
            unpaid_months_count: 0,
            unpaid_periods: []
          };
        }
        map[b.customer_id].total_arrears += (b.balance_due || b.total_amount);
        map[b.customer_id].unpaid_months_count++;
        map[b.customer_id].unpaid_periods.push(`${b.period_month}/${b.period_year}`);
      }
      const items = Object.values(map);
      return {
        summary: {
          total_defaulters: items.length,
          total_arrears_amount: items.reduce((acc, i: any) => acc + i.total_arrears, 0)
        },
        items
      };
    }

    if (type === 'usage') {
      const items = [...db.readings];
      return {
        summary: {
          total_readings: items.length,
          total_usage_m3: items.reduce((acc, r) => acc + r.usage_m3, 0)
        },
        items
      };
    }

    return { items: [] };
  },

  // 10. SETTINGS & AUDIT
  async getSettings(): Promise<SystemSettings> {
    const db = getDatabase();
    return db.settings;
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const db = getDatabase();
    db.settings = { ...db.settings, ...settings } as SystemSettings;
    saveDatabase(db);
    return db.settings;
  },

  async getAuditLogs(params: any = {}): Promise<AuditLog[]> {
    const db = getDatabase();
    let res = [...db.auditLogs];
    if (params.action) res = res.filter((l) => l.action === params.action);
    if (params.search) {
      const q = String(params.search).toLowerCase();
      res = res.filter(
        (l) =>
          (l.username || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q)
      );
    }
    return res.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  // 11. ANNOUNCEMENTS
  async getAnnouncements(params: any = {}): Promise<Announcement[]> {
    const db = getDatabase();
    let res = [...db.announcements];
    if (params.target_audience && params.target_audience !== 'all') {
      res = res.filter((a) => a.target_audience === 'all' || a.target_audience === params.target_audience);
    }
    if (params.active_only) {
      res = res.filter((a) => a.is_active);
    }
    return res.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async createAnnouncement(data: any): Promise<Announcement> {
    const db = getDatabase();
    const id = `ANN-${Date.now().toString().slice(-6)}`;
    const newAnn: Announcement = {
      id,
      title: data.title,
      content: data.content,
      target_audience: data.target_audience || 'all',
      priority: data.priority || 'normal',
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: 'Administrator',
      created_at: nowTimeString()
    };
    db.announcements.unshift(newAnn);
    saveDatabase(db);
    return newAnn;
  },

  async updateAnnouncement(data: Partial<Announcement>): Promise<void> {
    const db = getDatabase();
    const idx = db.announcements.findIndex((a) => a.id === data.id);
    if (idx !== -1) {
      db.announcements[idx] = { ...db.announcements[idx], ...data, updated_at: nowTimeString() };
      saveDatabase(db);
    }
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const db = getDatabase();
    db.announcements = db.announcements.filter((a) => a.id !== id);
    saveDatabase(db);
  },

  // 12. COMPLAINTS
  async getComplaints(params: any = {}): Promise<Complaint[]> {
    const db = getDatabase();
    let res = [...db.complaints];
    if (params.customer_id) res = res.filter((c) => c.customer_id === params.customer_id);
    if (params.status) res = res.filter((c) => c.status === params.status);
    if (params.category) res = res.filter((c) => c.category === params.category);
    if (params.search) {
      const q = params.search.toLowerCase();
      res = res.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.customer_name.toLowerCase().includes(q) ||
          c.complaint_no.toLowerCase().includes(q)
      );
    }
    return res.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async createComplaint(data: any): Promise<Complaint> {
    const db = getDatabase();
    const id = `CMP-${Date.now().toString().slice(-6)}`;
    const complaintNo = `LAP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newComp: Complaint = {
      id,
      complaint_no: complaintNo,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      customer_no: data.customer_no,
      phone: data.phone || '',
      title: data.title,
      description: data.description,
      category: data.category || 'lainnya',
      status: 'Menunggu',
      created_at: nowTimeString()
    };
    db.complaints.unshift(newComp);
    saveDatabase(db);
    return newComp;
  },

  async updateComplaintStatus(id: string, status: any, responseNotes?: string): Promise<void> {
    const db = getDatabase();
    const idx = db.complaints.findIndex((c) => c.id === id);
    const user = storage.getUser();
    if (idx !== -1) {
      db.complaints[idx] = {
        ...db.complaints[idx],
        status,
        response_notes: responseNotes || undefined,
        handled_by: user?.fullName || 'Petugas',
        updated_at: nowTimeString()
      };
      saveDatabase(db);
    }
  },

  // 13. SUBSCRIPTION REQUESTS
  async getSubscriptionRequests(params: any = {}): Promise<SubscriptionRequest[]> {
    const db = getDatabase();
    let res = [...db.subscriptionRequests];
    if (params.customer_id) res = res.filter((r) => r.customer_id === params.customer_id);
    if (params.status) res = res.filter((r) => r.status === params.status);
    return res.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async createSubscriptionRequest(data: any): Promise<SubscriptionRequest> {
    const db = getDatabase();
    const id = `REQ-${Date.now().toString().slice(-6)}`;
    const requestNo = `AJU-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReq: SubscriptionRequest = {
      id,
      request_no: requestNo,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      customer_no: data.customer_no,
      phone: data.phone || '',
      current_tariff_id: data.current_tariff_id,
      current_tariff_name: data.current_tariff_name,
      requested_tariff_id: data.requested_tariff_id,
      requested_tariff_name: data.requested_tariff_name,
      reason: data.reason,
      status: 'Menunggu',
      created_at: nowTimeString()
    };
    db.subscriptionRequests.unshift(newReq);
    saveDatabase(db);
    return newReq;
  },

  async updateSubscriptionRequestStatus(id: string, status: any, responseNotes?: string): Promise<void> {
    const db = getDatabase();
    const idx = db.subscriptionRequests.findIndex((r) => r.id === id);
    const user = storage.getUser();
    if (idx !== -1) {
      const req = db.subscriptionRequests[idx];
      req.status = status;
      req.response_notes = responseNotes || undefined;
      req.handled_by = user?.fullName || 'Administrator';
      req.updated_at = nowTimeString();

      // If approved, update customer tariff
      if (status === 'Disetujui') {
        const custIdx = db.customers.findIndex((c) => c.id === req.customer_id);
        if (custIdx !== -1) {
          db.customers[custIdx].tariff_id = req.requested_tariff_id;
          db.customers[custIdx].tariff_name = req.requested_tariff_name;
        }
      }
      saveDatabase(db);
    }
  },

  // 14. REGISTRATION TOKENS & REGISTER
  async getRegistrationTokens(): Promise<RegistrationToken[]> {
    const db = getDatabase();
    if (!db.registrationTokens) {
      db.registrationTokens = [
        {
          id: 'TOK-001',
          token: 'DESA-AIR-2026',
          token_type: 'registration',
          recipient_name: 'Warga Baru Dusun Krajan',
          target_role: 'customer',
          default_tariff_id: 'TRF-01',
          is_used: false,
          notes: 'Token pendaftaran umum warga',
          created_at: nowTimeString()
        },
        {
          id: 'TOK-RST-001',
          token: 'RESET-BUDI-2026',
          token_type: 'password_reset',
          recipient_name: 'Bpk. Budi Santoso',
          customer_id: 'CUST-ID-01',
          customer_no: 'CUST-2026-0001',
          target_role: 'customer',
          is_used: false,
          notes: 'Token reset sandi khusus Bpk Budi',
          created_at: nowTimeString()
        }
      ];
      saveDatabase(db);
    }
    return db.registrationTokens;
  },

  async createRegistrationToken(data: any): Promise<RegistrationToken> {
    const db = getDatabase();
    if (!db.registrationTokens) db.registrationTokens = [];
    const id = `TOK-${Date.now().toString().slice(-6)}`;
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const token = data.token?.trim().toUpperCase() || (data.token_type === 'password_reset' ? `RST-${randomSuffix}` : `DESA-${randomSuffix}`);

    const newTok: RegistrationToken = {
      id,
      token,
      token_type: data.token_type || 'registration',
      customer_id: data.customer_id || undefined,
      customer_no: data.customer_no || undefined,
      recipient_name: data.recipient_name || '',
      target_role: data.target_role || 'customer',
      default_tariff_id: data.default_tariff_id || 'TRF-01',
      is_used: false,
      notes: data.notes || '',
      created_at: nowTimeString()
    };
    db.registrationTokens.unshift(newTok);
    saveDatabase(db);
    return newTok;
  },

  async deleteRegistrationToken(id: string): Promise<void> {
    const db = getDatabase();
    if (db.registrationTokens) {
      db.registrationTokens = db.registrationTokens.filter((t) => t.id !== id);
      saveDatabase(db);
    }
  },

  async verifyRegistrationToken(tokenStr: string, expectedType: string = 'registration'): Promise<any> {
    const tokens = await this.getRegistrationTokens();
    const clean = tokenStr.trim().toUpperCase();
    const tok = tokens.find((t) => t.token === clean);

    if (!tok) {
      throw new Error('Token tidak valid atau tidak ditemukan.');
    }
    if (tok.is_used) {
      throw new Error('Token ini sudah pernah digunakan.');
    }
    if (expectedType && tok.token_type && tok.token_type !== expectedType) {
      if (expectedType === 'password_reset') {
        throw new Error('Token yang Anda masukkan adalah Token Pendaftaran Akun, bukan Token Reset Password.');
      } else {
        throw new Error('Token yang Anda masukkan adalah Token Reset Password, bukan Token Pendaftaran Akun.');
      }
    }
    return { valid: true, token: tok };
  },

  async registerWithToken(data: any): Promise<any> {
    const db = getDatabase();
    // RegisterPage sends snake_case keys; accept both for safety.
    const tokenStr = data.token ?? data.tokenStr;
    const fullName = data.full_name ?? data.fullName;
    const nik = data.nik;
    const phone = data.phone;
    const address = data.address;
    const rtRw = data.rt_rw ?? data.rtRw;
    const username = data.username;
    const password = data.password;

    if (!password || String(password).length < 6) {
      throw new Error('Kata sandi minimal 6 karakter.');
    }

    // 1. Verify token
    const { token: tok } = await this.verifyRegistrationToken(tokenStr);

    // 2. Check username
    const cleanUser = username.trim().toLowerCase();
    if (db.users.some((u) => u.username.toLowerCase() === cleanUser)) {
      throw new Error(`Username "${username}" sudah digunakan.`);
    }

    // 3. Create customer
    const customerId = `CUST-ID-${Date.now().toString().slice(-4)}`;
    const customerNo = `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const tariff = db.tariffs.find((t) => t.id === tok.default_tariff_id) || db.tariffs[0];

    const meterId = `MTR-ID-${Date.now().toString().slice(-4)}`;
    const meterNo = `MTR-${Math.floor(1000 + Math.random() * 9000)}`;

    db.meters.push({
      id: meterId,
      meter_no: meterNo,
      customer_id: customerId,
      customer_name: fullName,
      customer_no: customerNo,
      installation_date: new Date().toISOString().substring(0, 10),
      brand: 'Standard SNI',
      initial_reading: 0,
      current_reading: 0,
      status: 'Aktif',
      created_at: nowTimeString()
    });

    db.customers.push({
      id: customerId,
      customer_no: customerNo,
      full_name: fullName,
      nik: nik || '',
      phone: phone || '',
      address: address || '',
      rt_rw: rtRw || '',
      meter_id: meterId,
      meter_no: meterNo,
      current_reading: 0,
      tariff_id: tariff.id,
      tariff_name: tariff.name,
      status: 'Aktif',
      created_at: nowTimeString()
    });

    db.users.push({
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      username: cleanUser,
      full_name: fullName,
      role: tok.target_role === 'operator' ? 'operator' : 'customer',
      customer_id: customerId,
      phone: phone || '',
      is_active: true,
      password_hash: String(password),
      created_at: nowTimeString()
    } as any);

    // Mark token used
    tok.is_used = true;
    tok.used_by_username = cleanUser;
    tok.used_at = nowTimeString();

    saveDatabase(db);

    return {
      success: true,
      customer_no: customerNo,
      username: cleanUser,
      message: 'Registrasi berhasil! Silakan login.'
    };
  },

  /**
   * Public self-service password reset: verifies the admin-issued reset token,
   * the requester's identity (NIK last-4 OR RT/RW), then updates the password.
   */
  async forgotResetPassword(data: {
    token: string;
    identifier: string;
    nik_last4?: string;
    rt_rw_answer?: string;
    new_password: string;
  }): Promise<any> {
    const db = getDatabase();
    const { token, identifier, nik_last4, rt_rw_answer, new_password } = data;
    if (!token || !identifier || !new_password) throw new Error('Data reset tidak lengkap.');
    if (String(new_password).length < 6) throw new Error('Kata sandi baru minimal 6 karakter.');

    // 1. Token must exist, be unused, and be a password_reset token
    const clean = String(token).trim().toUpperCase();
    const tok = (db.registrationTokens || []).find((t) => t.token.toUpperCase() === clean);
    if (!tok) throw new Error('Token reset tidak valid.');
    if (tok.is_used) throw new Error('Token reset sudah pernah digunakan.');
    if ((tok as any).token_type && (tok as any).token_type !== 'password_reset') {
      throw new Error('Token yang Anda masukkan adalah Token Pendaftaran Akun, bukan Token Reset Password.');
    }

    // 2. Find the customer by identifier
    const q = String(identifier).trim().toLowerCase();
    const customer = db.customers.find(
      (c) =>
        c.customer_no.toLowerCase() === q ||
        (c.phone && c.phone.includes(q)) ||
        c.full_name.toLowerCase().includes(q)
    );
    if (!customer) throw new Error('Akun pelanggan dengan identitas tersebut tidak ditemukan.');

    // 3. Identity proof: NIK last-4 OR RT/RW match
    const actualNik = (customer as any).nik || '';
    const actualRtRw = (customer.rt_rw || '').toLowerCase().replace(/\s+/g, '');
    const inputRtRw = String(rt_rw_answer || '').toLowerCase().replace(/\s+/g, '');
    const nikOk = !!(actualNik.length >= 4 && nik_last4 && String(nik_last4).trim() === actualNik.slice(-4));
    const rtOk = !!(actualRtRw && inputRtRw && (actualRtRw.includes(inputRtRw) || inputRtRw.includes(actualRtRw)));
    if (!nikOk && !rtOk) {
      throw new Error('Jawaban verifikasi NIK atau RT/RW tidak cocok dengan data terdaftar.');
    }

    // 4. Update the linked user's password
    let targetUser = db.users.find((u) => u.customer_id === customer.id)
      || db.users.find((u) => u.username.toLowerCase() === customer.customer_no.toLowerCase());
    if (!targetUser) throw new Error('Akun login untuk pelanggan ini tidak ditemukan. Hubungi admin.');
    (targetUser as any).password_hash = String(new_password);

    // 5. Consume the token
    (tok as any).is_used = true;
    (tok as any).used_by_username = targetUser.username;
    (tok as any).used_at = nowTimeString();

    saveDatabase(db);
    return { success: true, message: 'Kata sandi berhasil diubah! Silakan login dengan kata sandi baru.' };
  },

  async resetToDefault(): Promise<void> {
    _cachedDb = null;
    localStorage.removeItem('sandmosquito_mock_database_v1');
    getDatabase(); // reinitialize
  },

  // 17. MAINTENANCE & EXPENSES
  async getMaintenanceExpenses(params?: { category?: string; start_date?: string; end_date?: string }): Promise<MaintenanceExpense[]> {
    const db = getDatabase();
    let list = [...(db.maintenanceExpenses || [])];
    if (params?.category) {
      list = list.filter((e) => e.category === params.category);
    }
    if (params?.start_date) {
      list = list.filter((e) => e.expense_date >= params.start_date!);
    }
    if (params?.end_date) {
      list = list.filter((e) => e.expense_date <= params.end_date!);
    }
    return list.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
  },

  async createMaintenanceExpense(data: Partial<MaintenanceExpense>): Promise<MaintenanceExpense> {
    const db = getDatabase();
    const count = (db.maintenanceExpenses?.length || 0) + 1;
    const expense_no = `MNT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count).padStart(3, '0')}`;
    const newExpense: MaintenanceExpense = {
      id: `EXP-${Date.now()}`,
      expense_no,
      category: data.category || 'Perbaikan Pipa & Kebocoran',
      title: data.title || 'Biaya Pemeliharaan Air',
      description: data.description || '',
      amount: Number(data.amount || 0),
      expense_date: data.expense_date || new Date().toISOString().substring(0, 10),
      recorded_by: data.recorded_by || 'Admin BUMDes',
      receipt_photo_url: data.receipt_photo_url || '',
      created_at: nowTimeString()
    };
    db.maintenanceExpenses.unshift(newExpense);
    saveDatabase(db);
    return newExpense;
  },

  async deleteMaintenanceExpense(id: string): Promise<{ success: boolean }> {
    const db = getDatabase();
    db.maintenanceExpenses = (db.maintenanceExpenses || []).filter((e) => e.id !== id);
    saveDatabase(db);
    return { success: true };
  }
};
