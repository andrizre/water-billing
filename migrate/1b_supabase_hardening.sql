-- ============================================================================
-- Sandmosquito Water Billing — Supabase Hardening Addendum (OPTIONAL but safe)
-- Jalankan SETELAH 1_supabase.sql. Semua statement di bagian aktif aman untuk
-- mode operasi saat ini dan tidak mengubah perilaku aplikasi.
--
-- KONTEKS KEAMANAN (penting dibaca):
-- Aplikasi ini mengautentikasi pengguna di sisi browser terhadap tabel users
-- memakai anon key Supabase. Artinya SEMUA permintaan berjalan sebagai role
-- anon, dan RLS tidak bisa membedakan admin/operator/pelanggan. Kebijakan
-- "FOR ALL ... USING (true)" pada 1_supabase.sql membuat seluruh tabel dapat
-- dibaca/ditulis siapa pun yang memegang anon key (ia ter-ship di bundle JS).
--
-- Solusi jangka panjang satu-satunya yang benar: pindahkan verifikasi
-- kredensial & mutasi sensitif ke Edge Functions (service_role), atau migrasi
-- ke Supabase Auth agar JWT per-pengguna sampai ke Postgres dan RLS bisa
-- dipakai secara nyata. Blok "LOCKDOWN" di bawah disiapkan untuk saat itu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) ATOMIC PAYMENT (dipakai opsional oleh frontend; fallback lama tetap jalan)
-- Menutup race condition read-modify-write pada recordPayment
-- (dua kasir bayar tagihan sama secara bersamaan -> salah satu hilang).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_payment(p_bill_id text, p_amount numeric)
RETURNS TABLE (id text, paid_amount numeric, balance_due numeric, status text)
LANGUAGE sql AS $$
  UPDATE public.bills
  SET paid_amount   = paid_amount + p_amount,
      balance_due   = GREATEST(0, total_amount - (paid_amount + p_amount)),
      status        = CASE WHEN total_amount - (paid_amount + p_amount) <= 0
                           THEN 'Lunas' ELSE 'Sebagian Dibayar' END,
      updated_at    = now()
  WHERE id = p_bill_id
    AND status <> 'Lunas'
    AND p_amount > 0
    AND p_amount <= GREATEST(0, COALESCE(balance_due, total_amount - paid_amount))
  RETURNING bills.id, bills.paid_amount, bills.balance_due, bills.status;
$$;

-- ----------------------------------------------------------------------------
-- 2) CONSUME TOKEN ATOMIC (mencegah token registrasi/reset dipakai ganda)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_registration_token(p_token text, p_used_by text)
RETURNS boolean
LANGUAGE sql AS $$
  WITH consumed AS (
    UPDATE public.registration_tokens
    SET is_used = true, used_by_username = p_used_by, used_at = now()
    WHERE token = upper(p_token) AND is_used = false
    RETURNING 1
  )
  SELECT count(*) > 0 FROM consumed;
$$;

-- ============================================================================
-- 3) LOCKDOWN PENUH (JANGAN dijalankan selama auth masih client-side!)
-- Mengaktifkan blok ini akan MEMATIKAN fitur yang menulis dari browser
-- (login, registrasi mandiri, operasi admin). Aktifkan hanya setelah semua
-- akses data berpindah ke Edge Functions / Supabase Auth.
-- ============================================================================
-- DO $$ DECLARE t text; BEGIN
--   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
--     EXECUTE format('DROP POLICY IF EXISTS "Allow anon full access to %I" ON public.%I', t, t);
--     EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access to %I" ON public.%I', t, t);
--   END LOOP;
-- END $$;
--
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
-- GRANT SELECT ON public.tariffs, public.announcements TO anon;
-- CREATE POLICY "public read tariffs" ON public.tariffs
--   FOR SELECT TO anon USING (true);
-- CREATE POLICY "public read announcements" ON public.announcements
--   FOR SELECT TO anon USING (true);
-- -- users, customers (NIK!), registration_tokens, settings (rekening bank!),
-- -- bills, payments, audit_logs: TIDAK boleh diakses anon langsung.
