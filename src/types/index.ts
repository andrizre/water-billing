/**
 * Sandmosquito Water Billing - TypeScript Type Definitions
 */

export type UserRole = 'admin' | 'operator' | 'customer';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  assigned_rt?: string;
  is_active: boolean;
  customer_id?: string;
  /** Credential secret. Mock/legacy rows may hold plain text; Supabase rows store sha256 hex. */
  password_hash?: string;
  created_at?: string;
  updated_at?: string;
}

export type SubsidyType = 'gratis' | 'max_tagihan' | 'none';

export interface Customer {
  id: string;
  customer_no: string;
  full_name: string;
  nik?: string;
  phone?: string;
  address?: string;
  rt_rw?: string;
  meter_id?: string;
  meter_no?: string;
  current_reading?: number;
  tariff_id?: string;
  tariff_name?: string;
  status: 'Aktif' | 'Nonaktif' | 'Ditangguhkan';
  is_subsidized?: boolean;
  subsidy_type?: SubsidyType;
  subsidy_max_amount?: number;
  subsidy_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WaterMeter {
  id: string;
  meter_no: string;
  customer_id?: string;
  customer_name?: string;
  customer_no?: string;
  installation_date?: string;
  brand?: string;
  initial_reading: number;
  current_reading: number;
  status: 'Aktif' | 'Rusak' | 'Diganti' | 'Nonaktif';
  created_at?: string;
}

export interface MeterReading {
  id: string;
  reading_no: string;
  customer_id: string;
  customer_name?: string;
  customer_no?: string;
  rt_rw?: string;
  meter_id: string;
  meter_no?: string;
  period_month: number;
  period_year: number;
  prev_reading: number;
  current_reading: number;
  usage_m3: number;
  reading_date: string;
  reader_id?: string;
  reader_name?: string;
  notes?: string;
  photo_url?: string;
  created_at?: string;
}

export interface Tariff {
  id: string;
  code: string;
  name: string;
  category: 'Rumah Tangga' | 'Niaga' | 'Sosial' | 'Industri';
  base_fee: number; // Biaya abodemen / beban tetap
  tier1_max: number; // e.g. 10 m3
  tier1_rate: number; // Rp per m3
  tier2_max: number; // e.g. 20 m3
  tier2_rate: number; // Rp per m3
  tier3_rate: number; // Rp per m3 (di atas tier 2)
  late_fee: number; // Denda flat
  is_active: boolean;
  description?: string;
  created_at?: string;
}

export type BillStatus = 'Belum Dibayar' | 'Sebagian Dibayar' | 'Lunas' | 'Jatuh Tempo';

export interface Bill {
  id: string;
  bill_no: string;
  customer_id: string;
  customer_name?: string;
  customer_no?: string;
  rt_rw?: string;
  phone?: string;
  reading_id?: string;
  period_month: number;
  period_year: number;
  prev_reading: number;
  current_reading: number;
  usage_m3: number;
  base_amount: number;
  usage_amount: number;
  late_fee: number;
  admin_fee?: number;
  original_amount?: number;
  subsidy_amount?: number;
  is_subsidized?: boolean;
  subsidy_type?: SubsidyType | string;
  subsidy_notes?: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  due_date: string;
  status: BillStatus;
  created_at?: string;
  updated_at?: string;
}

export type PaymentMethod = 'Tunai' | 'Transfer Bank' | 'QRIS' | 'Loket Desa';

export interface Payment {
  id: string;
  payment_no: string;
  bill_id: string;
  bill_no?: string;
  period_month?: number | string;
  period_year?: number | string;
  customer_id: string;
  customer_name?: string;
  customer_no?: string;
  rt_rw?: string;
  payment_date: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  cashier_id?: string;
  cashier_name?: string;
  notes?: string;
  created_at?: string;
}

export interface SystemSettings {
  app_name: string;
  village_name: string;
  organization_name: string;
  village_address: string;
  contact_phone: string;
  contact_email: string;
  bank_account_info: string;
  qris_info: string;
  due_day_of_month: string;
  late_fee_flat: string;
  admin_fee_flat?: string;
  bill_footer_notes: string;
  [key: string]: string | undefined;
}

export interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  created_at: string;
}

// 1. Pengumuman / Broadcast
export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: 'all' | 'operator' | 'customer';
  priority: 'normal' | 'urgent';
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// 2. Keluhan / Pengaduan Pelanggan
export type ComplaintCategory =
  | 'pipa_bocor'
  | 'air_mati'
  | 'meter_rusak'
  | 'tagihan_salah'
  | 'kualitas_air'
  | 'lainnya';

export type ComplaintStatus = 'Menunggu' | 'Diproses' | 'Selesai' | 'Ditolak';

export interface Complaint {
  id: string;
  complaint_no: string;
  customer_id: string;
  customer_name: string;
  customer_no: string;
  phone?: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  response_notes?: string;
  handled_by?: string;
  created_at?: string;
  updated_at?: string;
}

// 3. Pengajuan Perubahan Langganan / Golongan Tarif
export type SubscriptionRequestStatus = 'Menunggu' | 'Disetujui' | 'Ditolak';

export interface SubscriptionRequest {
  id: string;
  request_no: string;
  customer_id: string;
  customer_name: string;
  customer_no: string;
  phone?: string;
  current_tariff_id: string;
  current_tariff_name: string;
  requested_tariff_id: string;
  requested_tariff_name: string;
  reason: string;
  status: SubscriptionRequestStatus;
  response_notes?: string;
  handled_by?: string;
  created_at?: string;
  updated_at?: string;
}

// 4. Token Pendaftaran & Reset Sandi (Undangan Admin)
export type TokenType = 'registration' | 'password_reset';

export interface RegistrationToken {
  id: string;
  token: string;
  token_type: TokenType;
  customer_id?: string;
  customer_no?: string;
  recipient_name?: string;
  target_role: 'customer' | 'operator';
  default_tariff_id?: string;
  is_used: boolean;
  used_by_username?: string;
  used_at?: string;
  created_by?: string;
  notes?: string;
  created_at?: string;
}

export interface MonthlyTrend {
  month: number;
  year: number;
  period_name: string;
  billed_amount: number;
  collected_amount: number;
  usage_m3: number;
}

export interface DashboardStats {
  total_customers: number;
  active_customers: number;
  total_meters: number;
  total_billed_this_month: number;
  total_collected_this_month: number;
  total_usage_this_month: number;
  total_arrears: number;
  total_unpaid_bills?: number;
}

export interface AdminDashboardData {
  stats: DashboardStats;
  monthly_trends: MonthlyTrend[];
  recent_payments: Payment[];
  recent_readings: MeterReading[];
}

export interface CustomerDashboardData {
  customer: Customer;
  meter: WaterMeter | null;
  total_unpaid: number;
  active_bill: Bill | null;
  recent_payments: Payment[];
  usage_history: {
    month: number;
    year: number;
    period_name: string;
    usage_m3: number;
  }[];
}

export interface BillBreakdown {
  usage_m3: number;
  base_fee: number;
  tier1_usage: number;
  tier1_rate: number;
  tier1_amount: number;
  tier2_usage: number;
  tier2_rate: number;
  tier2_amount: number;
  tier3_usage: number;
  tier3_rate: number;
  tier3_amount: number;
  usage_amount: number;
  late_fee: number;
  admin_fee?: number;
  raw_total?: number;
  original_amount?: number;
  subsidy_amount?: number;
  is_subsidized?: boolean;
  subsidy_type?: SubsidyType | string;
  subsidy_notes?: string;
  total_amount: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data: T;
  timestamp?: string;
}

export interface AuthSession {
  token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: UserRole;
    assigned_rt?: string;
    email?: string;
    phone?: string;
    customerId?: string;
    customer?: Customer | null;
  };
}

export type MaintenanceExpenseCategory =
  | 'Perbaikan Pipa & Kebocoran'
  | 'Listrik PLN Pompa'
  | 'Obat & Klorin Air'
  | 'Suku Cadang & Meteran'
  | 'Honor & Operasional Lapangan'
  | 'Lainnya';

export interface MaintenanceExpense {
  id: string;
  expense_no: string;
  category: MaintenanceExpenseCategory;
  title: string;
  description?: string;
  amount: number;
  expense_date: string;
  recorded_by?: string;
  receipt_photo_url?: string;
  created_at?: string;
}

