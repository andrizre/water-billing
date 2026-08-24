-- ============================================================================
-- SANDMOSQUITO WATER BILLING - SUPABASE / POSTGRESQL MIGRATION SCRIPT
-- ============================================================================
-- Jalankan skrip ini langsung di SQL Editor Dashboard Supabase Anda
-- (https://supabase.com/dashboard/project/<project-ref>/sql)
-- ============================================================================

-- 1. Tabel Pengguna Sistem (Users)
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL DEFAULT 'demo',
  salt text NOT NULL DEFAULT 'demo',
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'operator', 'customer')),
  assigned_rt text,
  email text,
  phone text,
  customer_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabel Tarif Air Bertingkat (Tariffs)
CREATE TABLE IF NOT EXISTS public.tariffs (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Rumah Tangga', 'Niaga', 'Sosial', 'Industri')),
  base_fee numeric NOT NULL DEFAULT 0,
  tier1_max numeric NOT NULL DEFAULT 10,
  tier1_rate numeric NOT NULL DEFAULT 2000,
  tier2_max numeric NOT NULL DEFAULT 20,
  tier2_rate numeric NOT NULL DEFAULT 3000,
  tier3_rate numeric NOT NULL DEFAULT 5000,
  late_fee numeric NOT NULL DEFAULT 5000,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 3. Tabel Pelanggan Air (Customers)
CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  customer_no text UNIQUE NOT NULL,
  full_name text NOT NULL,
  nik text,
  phone text,
  address text,
  rt_rw text,
  meter_id text,
  meter_no text,
  current_reading numeric DEFAULT 0,
  tariff_id text REFERENCES public.tariffs(id),
  tariff_name text,
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif', 'Ditangguhkan')),
  is_subsidized boolean NOT NULL DEFAULT false,
  subsidy_type text DEFAULT 'none' CHECK (subsidy_type IN ('gratis', 'max_tagihan', 'none')),
  subsidy_max_amount numeric DEFAULT 0,
  subsidy_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 4. Tabel Meter Air (Meters)
CREATE TABLE IF NOT EXISTS public.meters (
  id text PRIMARY KEY,
  meter_no text UNIQUE NOT NULL,
  customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_no text,
  installation_date date,
  brand text,
  initial_reading numeric NOT NULL DEFAULT 0,
  current_reading numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Rusak', 'Diganti', 'Nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 5. Tabel Pencatatan Meter Bulanan (Meter Readings)
CREATE TABLE IF NOT EXISTS public.meter_readings (
  id text PRIMARY KEY,
  reading_no text UNIQUE NOT NULL,
  customer_id text NOT NULL REFERENCES public.customers(id),
  customer_name text,
  customer_no text,
  rt_rw text,
  meter_id text REFERENCES public.meters(id),
  meter_no text,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year >= 2020),
  prev_reading numeric NOT NULL DEFAULT 0,
  current_reading numeric NOT NULL DEFAULT 0,
  usage_m3 numeric NOT NULL DEFAULT 0,
  reading_date date NOT NULL,
  reader_id text,
  reader_name text,
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 6. Tabel Tagihan Rekening Air (Bills)
CREATE TABLE IF NOT EXISTS public.bills (
  id text PRIMARY KEY,
  bill_no text UNIQUE NOT NULL,
  customer_id text NOT NULL REFERENCES public.customers(id),
  customer_name text,
  customer_no text,
  rt_rw text,
  phone text,
  reading_id text REFERENCES public.meter_readings(id),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year >= 2020),
  prev_reading numeric NOT NULL DEFAULT 0,
  current_reading numeric NOT NULL DEFAULT 0,
  usage_m3 numeric NOT NULL DEFAULT 0,
  base_amount numeric NOT NULL DEFAULT 0,
  usage_amount numeric NOT NULL DEFAULT 0,
  late_fee numeric NOT NULL DEFAULT 0,
  admin_fee numeric NOT NULL DEFAULT 0,
  original_amount numeric NOT NULL DEFAULT 0,
  subsidy_amount numeric NOT NULL DEFAULT 0,
  is_subsidized boolean NOT NULL DEFAULT false,
  subsidy_type text DEFAULT 'none',
  subsidy_notes text,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  due_date text NOT NULL,
  status text NOT NULL DEFAULT 'Belum Dibayar' CHECK (status IN ('Belum Dibayar', 'Sebagian Dibayar', 'Lunas', 'Jatuh Tempo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 7. Tabel Transaksi Pembayaran (Payments)
CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY,
  payment_no text UNIQUE NOT NULL,
  bill_id text NOT NULL REFERENCES public.bills(id),
  bill_no text,
  period_month integer,
  period_year integer,
  customer_id text NOT NULL REFERENCES public.customers(id),
  customer_name text,
  customer_no text,
  rt_rw text,
  payment_date text NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Tunai' CHECK (payment_method IN ('Tunai', 'Transfer Bank', 'QRIS', 'Loket Desa')),
  cashier_id text,
  cashier_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 8. Tabel Pengaturan Sistem (Settings)
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Tabel Log Aktivitas (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  user_id text,
  username text NOT NULL,
  action text NOT NULL,
  details text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Tabel Pengumuman / Broadcast (Announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'operator', 'customer')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  is_active boolean NOT NULL DEFAULT true,
  created_by text DEFAULT 'Administrator',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 11. Tabel Pengaduan / Keluhan Warga (Complaints)
CREATE TABLE IF NOT EXISTS public.complaints (
  id text PRIMARY KEY,
  complaint_no text UNIQUE NOT NULL,
  customer_id text NOT NULL REFERENCES public.customers(id),
  customer_name text NOT NULL,
  customer_no text NOT NULL,
  phone text,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('pipa_bocor', 'air_mati', 'meter_rusak', 'tagihan_salah', 'kualitas_air', 'lainnya')),
  status text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Diproses', 'Selesai', 'Ditolak')),
  response_notes text,
  handled_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 12. Tabel Pengajuan Pindah Golongan (Subscription Requests)
CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id text PRIMARY KEY,
  request_no text UNIQUE NOT NULL,
  customer_id text NOT NULL REFERENCES public.customers(id),
  customer_name text NOT NULL,
  customer_no text NOT NULL,
  phone text,
  current_tariff_id text REFERENCES public.tariffs(id),
  current_tariff_name text NOT NULL,
  requested_tariff_id text NOT NULL REFERENCES public.tariffs(id),
  requested_tariff_name text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Disetujui', 'Ditolak')),
  response_notes text,
  handled_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 13. Tabel Token Undangan Pendaftaran (Registration Tokens)
CREATE TABLE IF NOT EXISTS public.registration_tokens (
  id text PRIMARY KEY,
  token text UNIQUE NOT NULL,
  recipient_name text,
  target_role text NOT NULL DEFAULT 'customer' CHECK (target_role IN ('customer', 'operator')),
  default_tariff_id text REFERENCES public.tariffs(id),
  is_used boolean NOT NULL DEFAULT false,
  used_by_username text,
  used_at timestamptz,
  created_by text DEFAULT 'Administrator',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14. Tabel Biaya Pemeliharaan & Operasional (Maintenance Expenses)
CREATE TABLE IF NOT EXISTS public.maintenance_expenses (
  id text PRIMARY KEY,
  expense_no text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('Perbaikan Pipa & Kebocoran', 'Listrik PLN Pompa', 'Obat & Klorin Air', 'Suku Cadang & Meteran', 'Honor & Operasional Lapangan', 'Lainnya')),
  title text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL,
  recorded_by text DEFAULT 'Admin BUMDes',
  receipt_photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEKS PERFORMA
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_customers_tariff_id ON public.customers(tariff_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_meters_customer_id ON public.meters(customer_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_customer_id ON public.meter_readings(customer_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_period ON public.meter_readings(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON public.bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_period ON public.bills(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON public.announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_complaints_customer_id ON public.complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_requests_customer_id ON public.subscription_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_reg_tokens_token ON public.registration_tokens(token);
CREATE INDEX IF NOT EXISTS idx_maintenance_category ON public.maintenance_expenses(category);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON public.maintenance_expenses(expense_date);

-- ============================================================================
-- KEAMANAN ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_expenses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow anon full access to users" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to users" ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to tariffs" ON public.tariffs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to tariffs" ON public.tariffs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to customers" ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to meters" ON public.meters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to meters" ON public.meters FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to meter_readings" ON public.meter_readings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to meter_readings" ON public.meter_readings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to bills" ON public.bills FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to bills" ON public.bills FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to payments" ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to settings" ON public.settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to audit_logs" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to announcements" ON public.announcements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to announcements" ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to complaints" ON public.complaints FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to complaints" ON public.complaints FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to subscription_requests" ON public.subscription_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to subscription_requests" ON public.subscription_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to registration_tokens" ON public.registration_tokens FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to registration_tokens" ON public.registration_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to maintenance_expenses" ON public.maintenance_expenses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to maintenance_expenses" ON public.maintenance_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant privileges ke peran anon & authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- SEED DATA AWAL (DEMO DESA)
-- ============================================================================
INSERT INTO public.settings (key, value) VALUES
  ('app_name', 'Sandmosquito Water Billing'),
  ('village_name', 'Desa Sandmosquito'),
  ('organization_name', 'BUMDes Tirta Sandmosquito'),
  ('village_address', 'Jl. Melati No. 07, RT 02 / RW 01, Desa Sandmosquito'),
  ('contact_phone', '0812-3456-7890'),
  ('contact_email', 'bumdes.sandmosquito@desa.id'),
  ('bank_account_info', 'Bank BRI: 1234-01-000123-53-0 a.n BUMDes Tirta Sandmosquito'),
  ('qris_info', 'Tersedia di loket kantor desa atau scan barcode resmi'),
  ('due_day_of_month', '20'),
  ('late_fee_flat', '5000'),
  ('admin_fee_flat', '2500'),
  ('bill_footer_notes', 'Harap membayar tagihan tepat waktu sebelum tanggal 20. Terima kasih atas partisipasi Anda membangun desa.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.tariffs (id, code, name, category, base_fee, tier1_max, tier1_rate, tier2_max, tier2_rate, tier3_rate, late_fee, description, is_active) VALUES
  ('TRF-01', 'R1-DESA', 'Rumah Tangga Standar', 'Rumah Tangga', 5000, 10, 2000, 20, 3000, 5000, 5000, 'Tarif untuk rumah tangga umum warga desa', true),
  ('TRF-02', 'N1-DESA', 'Niaga & UMKM Desa', 'Niaga', 15000, 10, 3500, 20, 5000, 7500, 10000, 'Tarif untuk toko, ruko, bengkel, dan usaha warga', true),
  ('TRF-03', 'S1-DESA', 'Sosial & Tempat Ibadah', 'Sosial', 0, 10, 1000, 20, 1500, 2000, 0, 'Tarif subsidi untuk tempat ibadah dan posyandu', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, full_name, role, assigned_rt, email, phone, is_active, customer_id) VALUES
  ('USR-0001', 'admin', 'Administrator Utama', 'admin', NULL, 'admin@sandmosquito.desa.id', '081234567890', true, NULL),
  ('USR-0002', 'operator', 'Petugas Lapangan RT 01', 'operator', 'RT 01 / RW 01', 'operator@sandmosquito.desa.id', '081298765432', true, NULL),
  ('USR-0003', 'operator2', 'Petugas Lapangan RT 02', 'operator', 'RT 02 / RW 01', 'operator2@sandmosquito.desa.id', '081298765433', true, NULL),
  ('USR-CUST-01', 'cust-2026-0001', 'Bpk. Budi Santoso', 'customer', NULL, '', '081234567801', true, 'CUST-ID-01'),
  ('USR-CUST-02', 'cust-2026-0002', 'Ibu Siti Aminah', 'customer', NULL, '', '081234567802', true, 'CUST-ID-02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, customer_no, full_name, nik, phone, address, rt_rw, meter_id, meter_no, current_reading, tariff_id, tariff_name, status, is_subsidized, subsidy_type, subsidy_max_amount, subsidy_notes) VALUES
  ('CUST-ID-01', 'CUST-2026-0001', 'Bpk. Budi Santoso', '3201012345670001', '081234567801', 'RT 01 / RW 01 Dusun Krajan', 'RT 01 / RW 01', 'MTR-ID-01', 'MTR-8801', 142, 'TRF-01', 'Rumah Tangga Standar', 'Aktif', false, 'none', 0, NULL),
  ('CUST-ID-02', 'CUST-2026-0002', 'Ibu Siti Aminah', '3201012345670002', '081234567802', 'RT 01 / RW 01 Dusun Krajan', 'RT 01 / RW 01', 'MTR-ID-02', 'MTR-8802', 111, 'TRF-01', 'Rumah Tangga Standar', 'Aktif', true, 'max_tagihan', 20000, 'Subsidi BUMDes: Plafon Maks. Rp 20.000 / bln'),
  ('CUST-ID-03', 'CUST-2026-0003', 'Bpk. Slamet Riyadi', '3201012345670003', '081234567803', 'RT 02 / RW 01 Dusun Sukamaju', 'RT 02 / RW 01', 'MTR-ID-03', 'MTR-8803', 235, 'TRF-01', 'Rumah Tangga Standar', 'Aktif', false, 'none', 0, NULL),
  ('CUST-ID-04', 'CUST-2026-0004', 'Warung Makan Bu Joko', '3201012345670004', '081234567804', 'Jl. Pasar Desa RT 03 / RW 01', 'RT 03 / RW 01', 'MTR-ID-04', 'MTR-8804', 348, 'TRF-02', 'Niaga & UMKM Desa', 'Aktif', false, 'none', 0, NULL),
  ('CUST-ID-05', 'CUST-2026-0005', 'Masjid Jami Al-Ikhlas', '3201012345670005', '081234567805', 'Alun-alun Desa RT 01 / RW 02', 'RT 01 / RW 02', 'MTR-ID-05', 'MTR-8805', 585, 'TRF-03', 'Sosial & Tempat Ibadah', 'Aktif', true, 'gratis', 0, 'Subsidi 100% Gratis (Tempat Ibadah Warga)')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.registration_tokens (id, token, recipient_name, target_role, default_tariff_id, is_used, notes) VALUES
  ('TOK-001', 'DESA-AIR-2026', 'Warga Baru Dusun Krajan', 'customer', 'TRF-01', false, 'Token pendaftaran umum warga'),
  ('TOK-002', 'WARGA-MANDIRI-88', 'Bpk. Ahmad Dahlan', 'customer', 'TRF-01', false, 'Token pendaftaran sambungan baru')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.maintenance_expenses (id, expense_no, category, title, description, amount, expense_date, recorded_by) VALUES
  ('EXP-001', 'MNT-202608-001', 'Perbaikan Pipa & Kebocoran', 'Perbaikan Pipa PVC 2 Inch Dusun Timur', 'Pembelian sambungan soket pipa dan lem PVC', 175000, '2026-08-10', 'Admin BUMDes'),
  ('EXP-002', 'MNT-202608-002', 'Listrik PLN Pompa', 'Token Listrik PLN Pompa Sumur Bor 1', 'Pembelian token listrik pompa utama tandon desa', 450000, '2026-08-05', 'Admin BUMDes'),
  ('EXP-003', 'MNT-202608-003', 'Obat & Klorin Air', 'Kaporit / Klorin Penjernih Tandon Air', 'Pengisian zat disinfektan klorin tandon pusat', 120000, '2026-08-02', 'Admin BUMDes')
ON CONFLICT (id) DO NOTHING;

