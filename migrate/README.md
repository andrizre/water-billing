# Panduan Migrasi Database Sandmosquito Water Billing

Aplikasi ini mendukung **4 backend database** berbeda secara fleksibel. Anda dapat berganti backend kapan saja cukup dengan mengubah `VITE_ACTIVE_BACKEND` di file `.env`.

---

## 📊 Ringkasan 14 Tabel Database

Seluruh tabel telah diselaraskan di ke-4 backend (Supabase PostgreSQL, SQLite, Google Sheets, dan Mock LocalStorage):

| No | Nama Tabel | Deskripsi & Fitur Utama |
|---|---|---|
| 1 | `users` | Akun pengguna (`admin`, `operator`, `customer`) dengan penugasan wilayah RT (`assigned_rt`). |
| 2 | `tariffs` | Tarif air berjenjang (Tier 1, Tier 2, Tier 3, abodemen beban tetap, denda). |
| 3 | `customers` | Data sambungan warga, NIK, alamat, RT/RW, dan penetapan **Warga Subsidi** (`is_subsidized`, `subsidy_type`, `subsidy_max_amount`, `subsidy_notes`). |
| 4 | `meters` | Nomor meteran fisik air SNI dan status meter. |
| 5 | `meter_readings` | Riwayat pencatatan angka stand meter bulanan oleh operator RT per wilayah. |
| 6 | `bills` | Faktur tagihan bulanan dengan rincian pemakaian, denda, admin, serta kalkulasi **Potongan Subsidi Desa** (`original_amount`, `subsidy_amount`). |
| 7 | `payments` | Transaksi pembayaran kasir loket (Tunai, Transfer Bank, QRIS). |
| 8 | `settings` | Konfigurasi profil BUMDes, tanggal jatuh tempo, denda, admin fee, info rekening bank, dan URL barcode QRIS. |
| 9 | `audit_logs` | Catatan jejak audit aktivitas pengguna sistem. |
| 10 | `announcements` | Siaran pengumuman & broadcast informasi warga/operator. |
| 11 | `complaints` | Layanan tiket keluhan pipa bocor / gangguan air warga. |
| 12 | `subscription_requests` | Pengajuan pindah golongan tarif sambungan air. |
| 13 | `registration_tokens` | Token pendaftaran onboarding warga mandiri. |
| 14 | `maintenance_expenses` | Catatan pengeluaran operasional & pemeliharaan pipa / pompa desa. |

---

## 🗄️ Pilihan Database & Cara Migrasinya

| No | Database Backend | Skrip Migrasi | Cara Aktivasi di `.env` |
|---|---|---|---|
| **1** | **Supabase (PostgreSQL Cloud)** *(Default Rekomendasi)* | `1_supabase.sql` | `VITE_ACTIVE_BACKEND=supabase` |
| **2** | **SQLite Lokal (sandmosquito.db)** | `2_sqlite.sql` | `VITE_ACTIVE_BACKEND=sqlite` |
| **3** | **Google Sheets (Google Apps Script)** | `3_gas_bundle.gs` | `VITE_ACTIVE_BACKEND=gas` |
| **4** | **LocalStorage Mock (Browser Simulator)** | `4_localstorage_mock.json` | `VITE_ACTIVE_BACKEND=mock` |

---

### 1. Migrasi ke Supabase Cloud (PostgreSQL 17)
1. Buka [Dashboard Supabase](https://supabase.com/dashboard).
2. Buat project baru (pilih region terdekat, misal Singapore / `ap-southeast-1`).
3. Buka menu **SQL Editor** pada sidebar Supabase.
4. Buka file [`migrate/1_supabase.sql`](migrate/1_supabase.sql), salin seluruh kodenya, lalu tempel di SQL Editor dan klik **Run**.
5. Ambil Project URL dan `anon` Public API Key dari menu **Project Settings -> API**.
6. Masukkan ke file `.env` di root proyek:
   ```env
   VITE_ACTIVE_BACKEND=supabase
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

---

### 2. Migrasi ke SQLite Lokal (File `sandmosquito.db`)
1. Pastikan runtime Bun atau Node.js terpasang di komputer/server desa.
2. Jalankan server SQLite backend:
   ```bash
   npm run server
   ```
3. Server otomatis berjalan di port `http://localhost:3001` dan membuat file `sandmosquito.db` (WAL Mode) menggunakan skrip [`migrate/2_sqlite.sql`](migrate/2_sqlite.sql).
4. Masukkan ke file `.env`:
   ```env
   VITE_ACTIVE_BACKEND=sqlite
   VITE_SQLITE_API_URL=http://localhost:3001
   ```

---

### 3. Migrasi ke Google Sheets (Google Apps Script Cloud)
1. Buat Google Spreadsheet baru di [sheets.new](https://sheets.new).
2. Klik menu **Extensions -> Apps Script**.
3. Hapus kode default, lalu salin seluruh isi file [`migrate/3_gas_bundle.gs`](migrate/3_gas_bundle.gs).
4. Jalankan fungsi `setupDatabase` sekali untuk membuat seluruh tab lembar kerja secara otomatis.
5. Klik **Deploy -> New deployment -> Select type 'Web app'**:
   - Description: `Sandmosquito Water Billing API`
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Salin Web App URL yang dihasilkan ke file `.env`:
   ```env
   VITE_ACTIVE_BACKEND=gas
   VITE_GAS_API_URL=https://script.google.com/macros/s/.../exec
   ```

---

### 4. Mode Mock LocalStorage (Simulasi Browser Offline 100%)
1. Cukup ubah `.env`:
   ```env
   VITE_ACTIVE_BACKEND=mock
   ```
2. Aplikasi akan langsung berjalan 100% di dalam browser tanpa memerlukan koneksi internet ataupun server eksternal. Struktur data bawaan mengacu pada [`migrate/4_localstorage_mock.json`](migrate/4_localstorage_mock.json).
