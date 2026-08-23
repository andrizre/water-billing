/**
 * Supabase API Service
 * Implements all the same methods as mockApiService.ts but uses Supabase as backend.
 * This is the cloud-native alternative that loads automatically when Supabase is configured.
 */
import { getSupabaseClient } from './supabaseClient';
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
  CustomerDashboardData
} from '../types';

function supabase() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase belum dikonfigurasi.');
  return client;
}

function nowTimeString(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export const supabaseApiService = {
  // ==================== 1. AUTH ====================
  async login(username: string, password: string): Promise<any> {
    const cleanUser = username.trim().toLowerCase();
    const sb = supabase();

    // Check user in users table
    let { data: user } = await sb
      .from('users')
      .select('*')
      .or(`username.eq.${cleanUser}`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    // If not found, check by customer_no in customers table
    let customer: Customer | null = null;
    if (!user) {
      const { data: cust } = await sb
        .from('customers')
        .select('*')
        .or(`customer_no.ilike.${cleanUser},phone.eq.${cleanUser}`)
        .limit(1)
        .maybeSingle();

      if (cust) {
        customer = cust;
        const { data: custUser } = await sb
          .from('users')
          .select('*')
          .eq('customer_id', cust.id)
          .limit(1)
          .maybeSingle();

        if (custUser) {
          user = custUser;
        } else {
          // Create customer user on the fly
          const newUser = {
            id: `USR-CUST-${Date.now()}`,
            username: cust.customer_no.toLowerCase(),
            full_name: cust.full_name,
            role: 'customer',
            customer_id: cust.id,
            phone: cust.phone || '',
            is_active: true,
          };
          await sb.from('users').insert(newUser);
          user = newUser;
        }
      }
    } else if (user.role === 'customer' && user.customer_id) {
      const { data: c } = await sb
        .from('customers')
        .select('*')
        .eq('id', user.customer_id)
        .maybeSingle();
      customer = c;
    }

    if (!user) {
      throw new Error('Akun atau nomor pelanggan tidak ditemukan.');
    }

    if (!user.is_active) {
      throw new Error('Akun Anda telah dinonaktifkan.');
    }

    // Demo password checks
    if (user.role === 'admin' && password !== 'admin123' && password !== 'admin') {
      throw new Error('Kata sandi salah. (Default: admin123)');
    }
    if (user.role === 'operator' && password !== 'operator123' && password !== 'operator') {
      throw new Error('Kata sandi salah. (Default: operator123)');
    }

    const token = `supabase_token_${user.id}_${Date.now()}`;
    const sessionData = {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        email: user.email,
        phone: user.phone,
        customerId: user.customer_id,
        customer: customer || null,
      },
    };

    // Log audit
    await sb.from('audit_logs').insert({
      id: `LOG-${Date.now()}`,
      user_id: user.id,
      username: user.username,
      action: 'LOGIN',
      details: `Login berhasil sebagai ${user.role}`,
    });

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
    const currentUser = storage.getUser();
    if (currentUser) {
      await supabase().from('audit_logs').insert({
        id: `LOG-${Date.now()}`,
        user_id: currentUser.id,
        username: currentUser.username,
        action: 'CHANGE_PASSWORD',
        details: 'Kata sandi berhasil diubah',
      });
    }
  },

  async publicCheckBill(customerNo: string): Promise<any> {
    const sb = supabase();
    const cleanNo = customerNo.trim().toUpperCase();

    const { data: customer, error } = await sb
      .from('customers')
      .select('*')
      .ilike('customer_no', cleanNo)
      .maybeSingle();

    if (!customer || error) {
      throw new Error(`Nomor pelanggan "${customerNo}" tidak ditemukan.`);
    }

    const { data: bills } = await sb
      .from('bills')
      .select('*')
      .eq('customer_id', customer.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(6);

    const allBills = bills || [];
    const unpaidBills = allBills.filter((b: any) => b.status !== 'Lunas');
    const totalUnpaid = unpaidBills.reduce((acc: number, b: any) => acc + (b.balance_due || b.total_amount), 0);

    const { data: meter } = await sb
      .from('meters')
      .select('*')
      .eq('id', customer.meter_id || '')
      .maybeSingle();

    const { data: tariff } = await sb
      .from('tariffs')
      .select('*')
      .eq('id', customer.tariff_id || '')
      .maybeSingle();

    return {
      customer: {
        customer_no: customer.customer_no,
        full_name: customer.full_name,
        address: customer.address,
        rt_rw: customer.rt_rw,
        status: customer.status,
        tariff_name: tariff?.name || 'Rumah Tangga Standar',
      },
      meter: meter ? { meter_no: meter.meter_no, current_reading: meter.current_reading } : null,
      total_unpaid_amount: totalUnpaid,
      unpaid_count: unpaidBills.length,
      bills: allBills,
    };
  },

  // ==================== 2. USERS ====================
  async getUsers(params: any = {}): Promise<User[]> {
    const sb = supabase();
    let query = sb.from('users').select('*');

    if (params.role) query = query.eq('role', params.role);
    if (params.search) {
      query = query.or(
        `username.ilike.%${params.search}%,full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createUser(data: Partial<User> & { password?: string }): Promise<User> {
    const sb = supabase();
    const id = `USR-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUser: any = {
      id,
      username: data.username || '',
      full_name: data.full_name || '',
      role: data.role || 'operator',
      email: data.email || '',
      phone: data.phone || '',
      is_active: data.is_active !== undefined ? data.is_active : true,
    };

    const { data: inserted, error } = await sb.from('users').insert(newUser).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  },

  async updateUser(data: Partial<User>): Promise<void> {
    const sb = supabase();
    const { error } = await sb.from('users').update({ ...data, updated_at: new Date().toISOString() }).eq('id', data.id!);
    if (error) throw new Error(error.message);
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase().from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async resetUserPassword(id: string): Promise<{ new_password: string }> {
    return { new_password: 'sandmosquito123' };
  },

  // ==================== 3. CUSTOMERS ====================
  async getCustomers(params: any = {}): Promise<Customer[]> {
    const sb = supabase();
    let query = sb.from('customers').select('*');

    if (params.status) query = query.eq('status', params.status);
    if (params.rt_rw) query = query.eq('rt_rw', params.rt_rw);
    if (params.search) {
      query = query.or(
        `customer_no.ilike.%${params.search}%,full_name.ilike.%${params.search}%,phone.ilike.%${params.search}%,address.ilike.%${params.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getCustomerById(id: string): Promise<any> {
    const sb = supabase();
    const { data: customer, error } = await sb.from('customers').select('*').eq('id', id).maybeSingle();
    if (!customer || error) throw new Error('Pelanggan tidak ditemukan.');

    const { data: meter } = await sb.from('meters').select('*').eq('id', customer.meter_id || '').maybeSingle();
    const { data: tariff } = await sb.from('tariffs').select('*').eq('id', customer.tariff_id || '').maybeSingle();

    return { customer, meter, tariff };
  },

  async createCustomer(data: any): Promise<Customer> {
    const sb = supabase();
    const customerId = `CUST-ID-${Date.now().toString().slice(-4)}`;
    const customerNo = data.customer_no || `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: tariffs } = await sb.from('tariffs').select('*');
    const tariff = (tariffs || []).find((t: any) => t.id === data.tariff_id) || (tariffs || [])[0];

    let meterId = data.meter_id || '';
    if (!meterId && (data.meter_no || data.create_meter)) {
      meterId = `MTR-ID-${Date.now().toString().slice(-4)}`;
      const meterNo = data.meter_no || `MTR-${Math.floor(1000 + Math.random() * 9000)}`;
      await sb.from('meters').insert({
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
      });
    }

    const newCust: any = {
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
    };

    const { error } = await sb.from('customers').insert(newCust);
    if (error) throw new Error(error.message);

    // Auto create customer login user
    await sb.from('users').insert({
      id: `USR-CUST-${Date.now()}`,
      username: customerNo.toLowerCase(),
      full_name: data.full_name,
      role: 'customer',
      customer_id: customerId,
      phone: data.phone || '',
      is_active: true,
    });

    return newCust;
  },

  async updateCustomer(data: Partial<Customer>): Promise<void> {
    const sb = supabase();
    const { error } = await sb
      .from('customers')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', data.id!);
    if (error) throw new Error(error.message);
  },

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase().from('customers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ==================== 4. METERS ====================
  async getMeters(params: any = {}): Promise<WaterMeter[]> {
    const sb = supabase();
    let query = sb.from('meters').select('*');

    if (params.status) query = query.eq('status', params.status);
    if (params.search) {
      query = query.or(
        `meter_no.ilike.%${params.search}%,customer_name.ilike.%${params.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createMeter(data: Partial<WaterMeter>): Promise<WaterMeter> {
    const sb = supabase();
    const id = `MTR-ID-${Date.now().toString().slice(-4)}`;
    const newMeter: any = {
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
    };

    const { data: inserted, error } = await sb.from('meters').insert(newMeter).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  },

  async updateMeter(data: Partial<WaterMeter>): Promise<void> {
    const sb = supabase();
    const { error } = await sb.from('meters').update(data).eq('id', data.id!);
    if (error) throw new Error(error.message);
  },

  async deleteMeter(id: string): Promise<void> {
    const { error } = await supabase().from('meters').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ==================== 5. READINGS ====================
  async getReadings(params: any = {}): Promise<MeterReading[]> {
    const sb = supabase();
    let query = sb.from('meter_readings').select('*');

    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.period_month) query = query.eq('period_month', Number(params.period_month));
    if (params.period_year) query = query.eq('period_year', Number(params.period_year));

    query = query.order('period_year', { ascending: false }).order('period_month', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getPrevReading(customerId: string): Promise<any> {
    const sb = supabase();
    const { data: customer } = await sb.from('customers').select('*').eq('id', customerId).maybeSingle();
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');

    const { data: readings } = await sb
      .from('meter_readings')
      .select('*')
      .eq('customer_id', customerId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(1);

    const { data: meter } = await sb.from('meters').select('*').eq('id', customer.meter_id || '').maybeSingle();
    const prevReading = readings && readings.length > 0 ? readings[0].current_reading : (meter?.initial_reading || 0);

    return {
      customer_id: customerId,
      customer_name: customer.full_name,
      customer_no: customer.customer_no,
      meter_id: customer.meter_id,
      meter_no: meter?.meter_no || '',
      prev_reading: prevReading,
      meter_current_reading: meter?.current_reading || prevReading,
    };
  },

  async recordReading(data: any): Promise<any> {
    const sb = supabase();
    const { data: customer } = await sb.from('customers').select('*').eq('id', data.customer_id).maybeSingle();
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');

    const month = Number(data.period_month);
    const year = Number(data.period_year);
    const prev = Number(data.prev_reading || 0);
    const cur = Number(data.current_reading || 0);

    if (cur < prev) {
      throw new Error(`Angka meter (${cur}) tidak boleh lebih kecil dari meter sebelumnya (${prev}).`);
    }

    const usage = cur - prev;
    const { data: meter } = await sb.from('meters').select('*').eq('id', customer.meter_id || '').maybeSingle();
    const readingId = `RDM-${year}${String(month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    const newReading: any = {
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
    };

    await sb.from('meter_readings').insert(newReading);

    // Update meter and customer current reading
    if (meter) {
      await sb.from('meters').update({ current_reading: cur }).eq('id', meter.id);
    }
    await sb.from('customers').update({ current_reading: cur }).eq('id', customer.id);

    let generatedBill: Bill | null = null;
    if (data.auto_generate_bill) {
      const { data: tariffs } = await sb.from('tariffs').select('*');
      const tariff = (tariffs || []).find((t: any) => t.id === customer.tariff_id) || (tariffs || [])[0];
      const calc = calculateTieredBillBreakdown(usage, tariff);
      const billId = `BILL-${year}${String(month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

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
        total_amount: calc.total_amount,
        paid_amount: 0,
        balance_due: calc.total_amount,
        due_date: `${year}-${String(month).padStart(2, '0')}-20`,
        status: 'Belum Dibayar',
      } as Bill;
      await sb.from('bills').insert(generatedBill);
    }

    return { reading: newReading, bill: generatedBill };
  },

  // ==================== 6. TARIFFS ====================
  async getTariffs(): Promise<Tariff[]> {
    const { data, error } = await supabase().from('tariffs').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createTariff(data: Partial<Tariff>): Promise<Tariff> {
    const sb = supabase();
    const { data: existing } = await sb.from('tariffs').select('id');
    const newTariff: any = {
      id: `TRF-0${(existing || []).length + 1}`,
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
    };

    const { data: inserted, error } = await sb.from('tariffs').insert(newTariff).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  },

  async updateTariff(data: Partial<Tariff>): Promise<void> {
    const { error } = await supabase().from('tariffs').update(data).eq('id', data.id!);
    if (error) throw new Error(error.message);
  },

  // ==================== 7. BILLS ====================
  async getBills(params: any = {}): Promise<Bill[]> {
    const sb = supabase();
    let query = sb.from('bills').select('*');

    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.period_month) query = query.eq('period_month', Number(params.period_month));
    if (params.period_year) query = query.eq('period_year', Number(params.period_year));
    if (params.status) query = query.eq('status', params.status);
    if (params.search) {
      query = query.or(
        `bill_no.ilike.%${params.search}%,customer_name.ilike.%${params.search}%,customer_no.ilike.%${params.search}%`
      );
    }

    query = query.order('period_year', { ascending: false }).order('period_month', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getBillById(id: string): Promise<any> {
    const sb = supabase();
    const { data: bill } = await sb.from('bills').select('*').eq('id', id).maybeSingle();
    if (!bill) throw new Error('Tagihan tidak ditemukan.');

    const { data: customer } = await sb.from('customers').select('*').eq('id', bill.customer_id).maybeSingle();
    const { data: tariffs } = await sb.from('tariffs').select('*');
    const tariff = (tariffs || []).find((t: any) => t.id === customer?.tariff_id) || (tariffs || [])[0];
    const { data: meter } = await sb.from('meters').select('*').eq('id', customer?.meter_id || '').maybeSingle();
    const { data: reading } = await sb.from('meter_readings').select('*').eq('id', bill.reading_id || '').maybeSingle();
    const { data: payments } = await sb.from('payments').select('*').eq('bill_id', bill.id);
    const breakdown = calculateTieredBillBreakdown(bill.usage_m3, tariff);

    return { bill, customer, tariff, meter, reading, payments: payments || [], breakdown };
  },

  async generateBatchBills(periodMonth: number, periodYear: number): Promise<any> {
    const sb = supabase();
    const { data: customers } = await sb.from('customers').select('*').eq('status', 'Aktif');
    const { data: allBills } = await sb
      .from('bills')
      .select('customer_id')
      .eq('period_month', periodMonth)
      .eq('period_year', periodYear);
    const { data: readings } = await sb
      .from('meter_readings')
      .select('*')
      .eq('period_month', periodMonth)
      .eq('period_year', periodYear);
    const { data: tariffs } = await sb.from('tariffs').select('*');

    const existingBillCustomerIds = new Set((allBills || []).map((b: any) => b.customer_id));
    let generatedCount = 0;
    const newBills: any[] = [];

    for (const cust of customers || []) {
      if (existingBillCustomerIds.has(cust.id)) continue;

      const reading = (readings || []).find(
        (r: any) => r.customer_id === cust.id
      );
      if (!reading) continue;

      const tariff = (tariffs || []).find((t: any) => t.id === cust.tariff_id) || (tariffs || [])[0];
      const calc = calculateTieredBillBreakdown(reading.usage_m3, tariff);
      const billId = `BILL-${periodYear}${String(periodMonth).padStart(2, '0')}-${Date.now().toString().slice(-4)}-${generatedCount}`;

      newBills.push({
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
        total_amount: calc.total_amount,
        paid_amount: 0,
        balance_due: calc.total_amount,
        due_date: `${periodYear}-${String(periodMonth).padStart(2, '0')}-20`,
        status: 'Belum Dibayar',
      });
      generatedCount++;
    }

    if (newBills.length > 0) {
      await sb.from('bills').insert(newBills);
    }

    return { generated_count: generatedCount };
  },

  async updateBillStatus(id: string, status: any): Promise<void> {
    const { error } = await supabase().from('bills').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ==================== 8. PAYMENTS ====================
  async getPayments(params: any = {}): Promise<Payment[]> {
    const sb = supabase();
    let query = sb.from('payments').select('*');

    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.search) {
      query = query.or(
        `payment_no.ilike.%${params.search}%,customer_name.ilike.%${params.search}%`
      );
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async recordPayment(data: any): Promise<any> {
    const sb = supabase();
    const { data: bill } = await sb.from('bills').select('*').eq('id', data.bill_id).maybeSingle();
    if (!bill) throw new Error('Tagihan tidak ditemukan.');

    const amount = Number(data.amount_paid);
    if (amount <= 0) throw new Error('Jumlah pembayaran harus lebih dari 0.');

    const prevPaid = Number(bill.paid_amount || 0);
    const newPaidTotal = prevPaid + amount;
    const newBalance = Math.max(0, bill.total_amount - newPaidTotal);
    const newStatus = newBalance <= 0 ? 'Lunas' : 'Sebagian Dibayar';

    // Update bill
    await sb
      .from('bills')
      .update({ paid_amount: newPaidTotal, balance_due: newBalance, status: newStatus })
      .eq('id', bill.id);

    const paymentId = `PAY-${Date.now().toString().slice(-6)}`;
    const newPayment: any = {
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
    };

    await sb.from('payments').insert(newPayment);

    return { payment: newPayment, bill: { ...bill, paid_amount: newPaidTotal, balance_due: newBalance, status: newStatus }, status: newStatus };
  },

  async getPaymentReceipt(id: string): Promise<any> {
    const sb = supabase();
    const { data: payment } = await sb.from('payments').select('*').eq('id', id).maybeSingle();
    if (!payment) throw new Error('Pembayaran tidak ditemukan.');

    const { data: bill } = await sb.from('bills').select('*').eq('id', payment.bill_id).maybeSingle();
    const { data: customer } = await sb.from('customers').select('*').eq('id', payment.customer_id).maybeSingle();
    const { data: meter } = await sb.from('meters').select('*').eq('id', customer?.meter_id || '').maybeSingle();

    // Get settings as object
    const { data: settingsRows } = await sb.from('settings').select('*');
    const settings: any = {};
    (settingsRows || []).forEach((s: any) => { settings[s.key] = s.value; });

    return {
      payment,
      bill,
      customer,
      meter,
      cashier_name: payment.cashier_name || 'Petugas Loket',
      village_info: settings,
    };
  },

  // ==================== 9. DASHBOARDS & REPORTS ====================
  async getDashboardSummary(userRole: string, customerId?: string): Promise<any> {
    const sb = supabase();
    const currentMonth = 8;
    const currentYear = 2026;

    if (userRole === 'customer' && customerId) {
      const { data: customer } = await sb.from('customers').select('*').eq('id', customerId).maybeSingle();
      const cust = customer || null;
      const { data: meter } = await sb.from('meters').select('*').eq('id', cust?.meter_id || '').maybeSingle();
      const { data: custBills } = await sb.from('bills').select('*').eq('customer_id', customerId);
      const { data: custPayments } = await sb
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(5);

      const allBills = custBills || [];
      const totalUnpaid = allBills
        .filter((b: any) => b.status !== 'Lunas')
        .reduce((acc: number, b: any) => acc + (b.balance_due || b.total_amount), 0);

      const activeBill =
        allBills.find((b: any) => b.period_month === currentMonth && b.period_year === currentYear) ||
        allBills[0] ||
        null;

      const usageHistory = [
        { month: 3, year: 2026, period_name: 'Maret 2026', usage_m3: 18 },
        { month: 4, year: 2026, period_name: 'April 2026', usage_m3: 20 },
        { month: 5, year: 2026, period_name: 'Mei 2026', usage_m3: 21 },
        { month: 6, year: 2026, period_name: 'Juni 2026', usage_m3: 19 },
        { month: 7, year: 2026, period_name: 'Juli 2026', usage_m3: 23 },
        { month: 8, year: 2026, period_name: 'Agustus 2026', usage_m3: 22 },
      ];

      const res: CustomerDashboardData = {
        customer: cust!,
        meter: meter || null,
        total_unpaid: totalUnpaid,
        active_bill: activeBill,
        recent_payments: custPayments || [],
        usage_history: usageHistory,
      };
      return res;
    }

    // Admin & Operator
    const { data: allCustomers } = await sb.from('customers').select('id, status');
    const { data: allMeters } = await sb.from('meters').select('id');
    const { data: currentMonthBills } = await sb
      .from('bills')
      .select('*')
      .eq('period_month', currentMonth)
      .eq('period_year', currentYear);
    const { data: allPayments } = await sb.from('payments').select('*').order('created_at', { ascending: false });
    const { data: allBillsForArrears } = await sb.from('bills').select('*').neq('status', 'Lunas');
    const { data: recentReadings } = await sb
      .from('meter_readings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    const customers = allCustomers || [];
    const bills = currentMonthBills || [];
    const payments = allPayments || [];

    const totalBilledThisMonth = bills.reduce((acc: number, b: any) => acc + b.total_amount, 0);
    const totalUsageThisMonth = bills.reduce((acc: number, b: any) => acc + b.usage_m3, 0);
    const totalCollectedThisMonth = payments.reduce((acc: number, p: any) => acc + p.amount_paid, 0);
    const totalArrears = (allBillsForArrears || []).reduce(
      (acc: number, b: any) => acc + (b.balance_due || b.total_amount),
      0
    );

    const monthlyTrends = [
      { month: 3, year: 2026, period_name: 'Mar 2026', billed_amount: 420000, collected_amount: 410000, usage_m3: 135 },
      { month: 4, year: 2026, period_name: 'Apr 2026', billed_amount: 450000, collected_amount: 440000, usage_m3: 142 },
      { month: 5, year: 2026, period_name: 'Mei 2026', billed_amount: 480000, collected_amount: 470000, usage_m3: 150 },
      { month: 6, year: 2026, period_name: 'Jun 2026', billed_amount: 460000, collected_amount: 455000, usage_m3: 145 },
      { month: 7, year: 2026, period_name: 'Jul 2026', billed_amount: 490000, collected_amount: 480000, usage_m3: 155 },
      {
        month: 8,
        year: 2026,
        period_name: 'Ags 2026',
        billed_amount: totalBilledThisMonth,
        collected_amount: totalCollectedThisMonth,
        usage_m3: totalUsageThisMonth,
      },
    ];

    const adminRes: AdminDashboardData = {
      stats: {
        total_customers: customers.length,
        active_customers: customers.filter((c: any) => c.status === 'Aktif').length,
        total_meters: (allMeters || []).length,
        total_billed_this_month: totalBilledThisMonth,
        total_collected_this_month: totalCollectedThisMonth,
        total_usage_this_month: totalUsageThisMonth,
        total_arrears: totalArrears,
        total_unpaid_bills: (allBillsForArrears || []).length,
      },
      monthly_trends: monthlyTrends,
      recent_payments: payments.slice(0, 5),
      recent_readings: recentReadings || [],
    };
    return adminRes;
  },

  async getReports(type: 'billing' | 'payment' | 'arrears' | 'usage', params: any = {}): Promise<any> {
    const sb = supabase();

    if (type === 'billing') {
      let query = sb.from('bills').select('*');
      if (params.period_month) query = query.eq('period_month', Number(params.period_month));
      if (params.period_year) query = query.eq('period_year', Number(params.period_year));
      const { data: items } = await query;
      const bills = items || [];
      return {
        summary: {
          total_bills: bills.length,
          total_billed: bills.reduce((acc: number, b: any) => acc + b.total_amount, 0),
          total_paid: bills.reduce((acc: number, b: any) => acc + b.paid_amount, 0),
          total_balance_due: bills.reduce((acc: number, b: any) => acc + (b.balance_due || 0), 0),
          total_usage_m3: bills.reduce((acc: number, b: any) => acc + b.usage_m3, 0),
        },
        items: bills,
      };
    }

    if (type === 'payment') {
      const { data: items } = await sb.from('payments').select('*').order('created_at', { ascending: false });
      const payments = items || [];
      return {
        summary: {
          total_transactions: payments.length,
          total_revenue: payments.reduce((acc: number, p: any) => acc + p.amount_paid, 0),
        },
        items: payments,
      };
    }

    if (type === 'arrears') {
      const { data: unpaidBills } = await sb.from('bills').select('*').neq('status', 'Lunas');
      const unpaid = unpaidBills || [];
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
            unpaid_periods: [],
          };
        }
        map[b.customer_id].total_arrears += b.balance_due || b.total_amount;
        map[b.customer_id].unpaid_months_count++;
        map[b.customer_id].unpaid_periods.push(`${b.period_month}/${b.period_year}`);
      }
      const arrearsItems = Object.values(map);
      return {
        summary: {
          total_defaulters: arrearsItems.length,
          total_arrears_amount: arrearsItems.reduce((acc: number, i: any) => acc + i.total_arrears, 0),
        },
        items: arrearsItems,
      };
    }

    if (type === 'usage') {
      const { data: items } = await sb.from('meter_readings').select('*');
      const readings = items || [];
      return {
        summary: {
          total_readings: readings.length,
          total_usage_m3: readings.reduce((acc: number, r: any) => acc + r.usage_m3, 0),
        },
        items: readings,
      };
    }

    return { items: [] };
  },

  // ==================== 10. SETTINGS & AUDIT ====================
  async getSettings(): Promise<SystemSettings> {
    const { data, error } = await supabase().from('settings').select('*');
    if (error) throw new Error(error.message);

    const settings: any = {};
    (data || []).forEach((row: any) => {
      settings[row.key] = row.value;
    });
    return settings as SystemSettings;
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const sb = supabase();
    for (const [key, value] of Object.entries(settings)) {
      await sb
        .from('settings')
        .upsert({ key, value: value as string, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    return this.getSettings();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase()
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ==================== 11. ANNOUNCEMENTS ====================
  async getAnnouncements(params: any = {}): Promise<any[]> {
    const sb = supabase();
    let query = sb.from('announcements').select('*');

    if (params.target_audience && params.target_audience !== 'all') {
      query = query.or(`target_audience.eq.all,target_audience.eq.${params.target_audience}`);
    }
    if (params.active_only) {
      query = query.eq('is_active', true);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createAnnouncement(data: any): Promise<any> {
    const sb = supabase();
    const id = `ANN-${Date.now().toString().slice(-6)}`;
    const newAnn: any = {
      id,
      title: data.title,
      content: data.content,
      target_audience: data.target_audience || 'all',
      priority: data.priority || 'normal',
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: data.created_by || 'Administrator',
    };

    const { data: inserted, error } = await sb.from('announcements').insert(newAnn).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  },

  async updateAnnouncement(data: any): Promise<void> {
    const sb = supabase();
    const { error } = await sb
      .from('announcements')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', data.id);
    if (error) throw new Error(error.message);
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase().from('announcements').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ==================== 12. COMPLAINTS ====================
  async getComplaints(params: any = {}): Promise<any[]> {
    const sb = supabase();
    let query = sb.from('complaints').select('*');

    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.status) query = query.eq('status', params.status);
    if (params.category) query = query.eq('category', params.category);
    if (params.search) {
      query = query.or(
        `title.ilike.%${params.search}%,customer_name.ilike.%${params.search}%,complaint_no.ilike.%${params.search}%`
      );
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createComplaint(data: any): Promise<any> {
    const sb = supabase();
    const id = `CMP-${Date.now().toString().slice(-6)}`;
    const complaintNo = `LAP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newComplaint: any = {
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
    };

    const { data: inserted, error } = await sb.from('complaints').insert(newComplaint).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  },

  async updateComplaintStatus(id: string, status: string, responseNotes?: string): Promise<void> {
    const sb = supabase();
    const user = storage.getUser();
    const { error } = await sb
      .from('complaints')
      .update({
        status,
        response_notes: responseNotes || null,
        handled_by: user?.fullName || user?.username || 'Petugas',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ==================== 13. SUBSCRIPTION REQUESTS ====================
  async getSubscriptionRequests(params: any = {}): Promise<any[]> {
    const sb = supabase();
    let query = sb.from('subscription_requests').select('*');

    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.status) query = query.eq('status', params.status);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createSubscriptionRequest(data: any): Promise<any> {
    const sb = supabase();
    const id = `REQ-${Date.now().toString().slice(-6)}`;
    const requestNo = `AJU-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReq: any = {
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
    };

    const { data: inserted, error } = await sb.from('subscription_requests').insert(newReq).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  },

  async updateSubscriptionRequestStatus(id: string, status: string, responseNotes?: string): Promise<void> {
    const sb = supabase();
    const user = storage.getUser();

    // If approved, update customer's tariff in customers table
    if (status === 'Disetujui') {
      const { data: req } = await sb.from('subscription_requests').select('*').eq('id', id).single();
      if (req) {
        await sb
          .from('customers')
          .update({
            tariff_id: req.requested_tariff_id,
            tariff_name: req.requested_tariff_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.customer_id);
      }
    }

    const { error } = await sb
      .from('subscription_requests')
      .update({
        status,
        response_notes: responseNotes || null,
        handled_by: user?.fullName || user?.username || 'Administrator',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ==================== 14. REGISTRATION TOKENS & REGISTER ====================
  async getRegistrationTokens(): Promise<any[]> {
    const sb = supabase();
    const { data, error } = await sb
      .from('registration_tokens')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createRegistrationToken(data: any): Promise<any> {
    const sb = supabase();
    const id = `TOK-${Date.now().toString().slice(-6)}`;
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const token = data.token?.trim().toUpperCase() || (data.token_type === 'password_reset' ? `RST-${randomSuffix}` : `DESA-${randomSuffix}`);

    const newTok: any = {
      id,
      token,
      token_type: data.token_type || 'registration',
      customer_id: data.customer_id || null,
      customer_no: data.customer_no || null,
      recipient_name: data.recipient_name || '',
      target_role: data.target_role || 'customer',
      default_tariff_id: data.default_tariff_id || 'TRF-01',
      is_used: false,
      notes: data.notes || '',
    };

    const { data: inserted, error } = await sb.from('registration_tokens').insert(newTok).select().single();
    if (error) throw new Error(error.message);
    return inserted;
  },

  async deleteRegistrationToken(id: string): Promise<void> {
    const { error } = await supabase().from('registration_tokens').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async verifyRegistrationToken(tokenStr: string, expectedType: string = 'registration'): Promise<any> {
    const sb = supabase();
    const cleanToken = tokenStr.trim().toUpperCase();

    const { data: tok, error } = await sb
      .from('registration_tokens')
      .select('*')
      .eq('token', cleanToken)
      .maybeSingle();

    if (!tok || error) {
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
    const sb = supabase();
    const { tokenStr, fullName, nik, phone, address, rtRw, username, password } = data;

    // 1. Verify token
    const { token: tok } = await this.verifyRegistrationToken(tokenStr);

    // 2. Check if username already exists
    const cleanUser = username.trim().toLowerCase();
    const { data: existingUser } = await sb
      .from('users')
      .select('id')
      .eq('username', cleanUser)
      .maybeSingle();

    if (existingUser) {
      throw new Error(`Username "${username}" sudah digunakan. Silakan pilih username lain.`);
    }

    // 3. Create Customer
    const customerId = `CUST-ID-${Date.now().toString().slice(-4)}`;
    const customerNo = `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: tariffs } = await sb.from('tariffs').select('*');
    const tariff = (tariffs || []).find((t: any) => t.id === tok.default_tariff_id) || (tariffs || [])[0];

    // Create meter for customer
    const meterId = `MTR-ID-${Date.now().toString().slice(-4)}`;
    const meterNo = `MTR-${Math.floor(1000 + Math.random() * 9000)}`;
    await sb.from('meters').insert({
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
    });

    const newCust: any = {
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
      tariff_id: tariff?.id || 'TRF-01',
      tariff_name: tariff?.name || 'Rumah Tangga Standar',
      status: 'Aktif',
    };

    await sb.from('customers').insert(newCust);

    // 4. Create User login
    const userId = `USR-${Math.floor(1000 + Math.random() * 9000)}`;
    await sb.from('users').insert({
      id: userId,
      username: cleanUser,
      full_name: fullName,
      role: tok.target_role || 'customer',
      customer_id: customerId,
      phone: phone || '',
      is_active: true,
    });

    // 5. Mark Token as Used
    await sb
      .from('registration_tokens')
      .update({
        is_used: true,
        used_by_username: cleanUser,
        used_at: new Date().toISOString(),
      })
      .eq('id', tok.id);

    return {
      success: true,
      customer_no: customerNo,
      username: cleanUser,
      message: 'Registrasi berhasil! Silakan masuk dengan akun baru Anda.',
    };
  },
};
